package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.entity.Event;
import org.example.nhsbkend.repository.EventRepository;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.repository.StoryRepository;
import org.example.nhsbkend.entity.Story;
import org.example.nhsbkend.entity.SocialLink;
import org.example.nhsbkend.service.BatchImporter;
import org.example.nhsbkend.service.PhotoService;
import org.example.nhsbkend.service.Socials;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Admin-only actions, guarded by the X-Admin-Token header. The admin page gets a token by logging in with the admin
 * email + password (POST /api/admin/login); scripts can also use the fixed nhs.admin-token if one is configured.
 * The password is only stored as a PBKDF2 hash (nhs.admin-password-hash, kept in secrets.yaml, not in git).
 * ponytail: one admin account and in-memory sessions (a restart logs the admin out); move to Spring Security if more
 * admins are needed.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final BatchImporter importer;
    private final PhotoService photos;
    private final AlumnusRepository repo;
    private final StoryRepository stories;
    private final EventRepository events;
    private final org.example.nhsbkend.repository.IssueRepository issues;
    private final StoryController storyApi;
    private final ProfileController profiles;
    private final byte[] token;
    private final String adminEmail, adminPasswordHash;

    private static final Duration SESSION = Duration.ofHours(12), LOCKOUT = Duration.ofMinutes(15);
    private static final int MAX_FAILS = 10; // per LOCKOUT window, for everyone together: slows password guessing
    private final Map<String, Instant> sessions = new ConcurrentHashMap<>(); // login token -> expiry
    private final ArrayDeque<Instant> fails = new ArrayDeque<>();
    private final SecureRandom random = new SecureRandom();

    public AdminController(BatchImporter importer, PhotoService photos, AlumnusRepository repo, StoryRepository stories, EventRepository events, org.example.nhsbkend.repository.IssueRepository issues, StoryController storyApi, ProfileController profiles,
                           @Value("${nhs.admin-token:}") String token, @Value("${nhs.admin-email:}") String adminEmail,
                           @Value("${nhs.admin-password-hash:}") String adminPasswordHash) {
        this.importer = importer;
        this.photos = photos;
        this.repo = repo;
        this.stories = stories;
        this.events = events;
        this.issues = issues;
        this.storyApi = storyApi;
        this.profiles = profiles;
        this.token = token.getBytes(StandardCharsets.UTF_8);
        this.adminEmail = adminEmail.strip().toLowerCase(Locale.ROOT);
        this.adminPasswordHash = adminPasswordHash.strip();
    }

    public record Login(String email, String password) {}

    /** Email + password -> a token for the X-Admin-Token header, valid for 12 hours. */
    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Login l) {
        Instant now = Instant.now();
        synchronized (fails) {
            while (!fails.isEmpty() && fails.peekFirst().plus(LOCKOUT).isBefore(now)) fails.removeFirst();
            if (fails.size() >= MAX_FAILS)
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many wrong tries. Wait 15 minutes and try again.");
            String email = l.email() == null ? "" : l.email().strip().toLowerCase(Locale.ROOT);
            if (adminEmail.isEmpty() || !email.equals(adminEmail) || !passwordMatches(l.password(), adminPasswordHash)) {
                fails.addLast(now);
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Wrong email or password.");
            }
        }
        sessions.values().removeIf(exp -> exp.isBefore(now));
        String t = HexFormat.of().formatHex(bytes(32));
        sessions.put(t, now.plus(SESSION));
        return Map.of("token", t);
    }

    @PostMapping("/logout")
    public void logout(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        if (given != null) sessions.remove(given);
    }

    private byte[] bytes(int n) {
        byte[] b = new byte[n];
        random.nextBytes(b);
        return b;
    }

    /**
     * stored = "pbkdf2$iterations$saltBase64$hashBase64" (PBKDF2-HMAC-SHA256). Make one for a new password with:
     * python3 -c "import hashlib,os,base64,getpass;s=os.urandom(16);i=210000;print('pbkdf2$%d$%s$%s'%(i,base64.b64encode(s).decode(),base64.b64encode(hashlib.pbkdf2_hmac('sha256',getpass.getpass().encode(),s,i,32)).decode()))"
     */
    static boolean passwordMatches(String password, String stored) {
        String[] p = stored.split("\\$");
        if (password == null || p.length != 4 || !p[0].equals("pbkdf2")) return false;
        try {
            byte[] salt = Base64.getDecoder().decode(p[2]), want = Base64.getDecoder().decode(p[3]);
            var spec = new PBEKeySpec(password.toCharArray(), salt, Integer.parseInt(p[1]), want.length * 8);
            return MessageDigest.isEqual(want, SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded());
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return false;
        }
    }

    public record PhotoResult(long id, String photoUrl) {}

    /** A join request as the admin sees it: everything the person typed, public or not. */
    public record Pending(long id, String name, int batch, String group, String village, String email, String phone, java.time.LocalDate birthDate, String sex, String bloodGroup,
                          String title, String org, String industry, String city, String country, String bio, String photo,
                          List<String> education, List<Socials.Social> socials) {}

    /** Join requests waiting for approval, oldest first. Also how the admin page checks the token. */
    @GetMapping("/pending")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Pending> pending(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        requireAdmin(given);
        return repo.findByStatusOrderByIdAsc(Alumnus.Status.PENDING).stream().map(a -> new Pending(a.getId(), a.getName(),
                a.getBatch(), a.getDepartment(), a.getVillage(), a.getEmail(), a.getPhone(), a.getBirthDate(), a.getSex(), a.getBloodGroup(), a.getTitle(), a.getOrganization(),
                a.getIndustry(), a.getCity(), a.getCountry(), a.getBio(), a.getPhotoUrl(),
                a.getEducations().stream().map(e -> e.getLevel() + ": " + e.getInstitution()).toList(), Socials.of(a))).toList();
    }

    /** Approve a join request: the profile goes live. */
    @PostMapping("/alumni/{id}/approve")
    @org.springframework.transaction.annotation.Transactional
    public void approve(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) {
        requireAdmin(given);
        Alumnus a = waiting(id);
        a.setStatus(Alumnus.Status.VERIFIED);
        a.setJoinedAt(java.time.Instant.now());
        a.setUpdatedAt(a.getJoinedAt());
    }

    /** Reject a join request: the record and its photo are deleted. */
    @PostMapping("/alumni/{id}/reject")
    @org.springframework.transaction.annotation.Transactional
    public void reject(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) throws IOException {
        requireAdmin(given);
        Alumnus a = waiting(id);
        photos.delete(id);
        repo.delete(a);
    }

    private Alumnus waiting(long id) {
        Alumnus a = find(id);
        if (a.getStatus() != Alumnus.Status.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "This profile isn't waiting for approval.");
        return a;
    }

    /**
     * Set a student's profile photo (JPEG or PNG, max 5 MB):
     *   curl -H "X-Admin-Token: …" -F file=@me.png "10.10.10.16:8081/api/admin/alumni/535/photo?zoom=1.4&focusY=0.35"
     * focusX / focusY (0..1, default 0.5 / 0.4) pick the point to centre on; zoom (1..4) crops tighter.
     */
    @PostMapping("/alumni/{id}/photo")
    @org.springframework.transaction.annotation.Transactional
    public PhotoResult photo(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id,
                             @RequestParam("file") MultipartFile file,
                             @RequestParam(defaultValue = "0.5") double focusX, @RequestParam(defaultValue = "0.4") double focusY,
                             @RequestParam(defaultValue = "1") double zoom) throws IOException {
        requireAdmin(given);
        Alumnus a = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No student with id " + id + "."));
        try {
            a.setPhotoUrl(photos.save(id, file.getInputStream(), focusX, focusY, zoom));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        return new PhotoResult(id, a.getPhotoUrl());
    }

    /**
     * Undo a claim (wrong person, spam): the record goes back to the plain SSC data, and someone who joined through the
     * website is removed. curl -X POST -H "X-Admin-Token: …" 10.10.10.16:8081/api/admin/alumni/535/reset
     */
    @PostMapping("/alumni/{id}/reset")
    @org.springframework.transaction.annotation.Transactional
    public void reset(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) throws IOException {
        requireAdmin(given);
        Alumnus a = find(id);
        photos.delete(id);
        if (a.getRoll() == null) { // joined through the website, not in any sheet
            repo.delete(a);
            return;
        }
        a.setPhotoUrl(null);
        a.setPhone(null); a.setEmail(null); a.setBloodGroup(null); a.setTitle(null); a.setOrganization(null); a.setIndustry(null);
        a.setCity(null); a.setCountry(null); a.setBio(null); a.setEmail(null);
        a.getEducations().clear();
        a.getSocialLinks().clear();
        a.setStatus(Alumnus.Status.UNCLAIMED);
    }

    /** Any student as the admin edits it on the "In memory" tab. */
    public record Memorial(long id, String name, int batch, String group, String village, String status, boolean deceased,
                           java.time.LocalDate passedOn, Integer passedYear, String photo, String email, String phone, String title, String org, String bio,
                           java.time.LocalDate birthDate, String bloodGroup, String industry, String city, String country,
                           List<ProfileController.EducationIn> education, Map<String, String> socials, String sex) {
        static Memorial of(Alumnus a) {
            return new Memorial(a.getId(), a.getName(), a.getBatch(), a.getDepartment(), a.getVillage(), a.getStatus().name(),
                    a.isDeceased(), a.getPassedOn(), a.getPassedYear(), a.getPhotoUrl(), a.getEmail(), a.getPhone(), a.getTitle(), a.getOrganization(), a.getBio(),
                    a.getBirthDate(), a.getBloodGroup(), a.getIndustry(), a.getCity(), a.getCountry(),
                    a.getEducations().stream().map(e -> new ProfileController.EducationIn(e.getLevel(), e.getInstitution(), e.getSubject(), e.getPassingYear())).toList(),
                    a.getSocialLinks().stream().collect(java.util.stream.Collectors.toMap(SocialLink::getPlatform, SocialLink::getUrl, (x, y) -> x)), a.getSex());
        }
    }

    /** batch + group are only read when adding someone who has no record yet. */
    /** Everything a student's own form has. education / socials = null leaves those lists as they are. */
    public record MemorialForm(boolean deceased, java.time.LocalDate passedOn, String name, String village, String email, String phone,
                               String title, String org, String bio, Integer batch, String group,
                               java.time.LocalDate birthDate, String bloodGroup, String industry, String city, String country,
                               List<ProfileController.EducationIn> education, Map<String, String> socials, String sex) {}

    @GetMapping("/memorials")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Memorial> memorials(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        requireAdmin(given);
        return repo.findByDeceasedTrueOrderByBatchAscIdAsc().stream().map(Memorial::of).toList();
    }

    /** Someone with no record yet (e.g. SSC before 2006): a new memorial profile for their batch and group. */
    @PostMapping("/memorials")
    @org.springframework.transaction.annotation.Transactional
    public Memorial newMemorial(@RequestHeader(value = "X-Admin-Token", required = false) String given,
                                @RequestPart("form") MemorialForm f,
                                @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        requireAdmin(given);
        if (f.batch() == null || f.batch() < ProfileController.FOUNDED || f.batch() > java.time.Year.now().getValue())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose their SSC batch.");
        if (!AlumnusRepository.DEPARTMENT_CODES.containsKey(f.group())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose their group.");
        if (clip(f.name(), 120) == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter their name.");
        Alumnus a = new Alumnus();
        a.setBatch(f.batch());
        a.setDepartment(f.group());
        a.setStatus(Alumnus.Status.VERIFIED);
        a.setId(repo.nextId(f.batch(), f.group()));
        a = repo.save(a); // an assigned ID means save() merges: keep working on the managed copy
        return fill(a, new MemorialForm(true, f.passedOn(), f.name(), f.village(), f.email(), f.phone(), f.title(), f.org(), f.bio(), null, null,
                f.birthDate(), f.bloodGroup(), f.industry(), f.city(), f.country(), f.education(), f.socials(), f.sex()), photo);
    }

    @GetMapping("/alumni/{id}")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public Memorial student(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) {
        requireAdmin(given);
        return Memorial.of(find(id));
    }

    /**
     * Mark a student as passed away (or undo it) and fill in what friends know: multipart "form" (JSON) + optional "photo".
     * A memorial shows its details publicly, so an unclaimed record becomes VERIFIED; blank fields are cleared.
     * Email and phone are kept for the admin only.
     */
    @PostMapping("/alumni/{id}/memorial")
    @org.springframework.transaction.annotation.Transactional
    public Memorial memorial(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id,
                             @RequestPart("form") MemorialForm f,
                             @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        requireAdmin(given);
        return fill(find(id), f, photo);
    }

    private Memorial fill(Alumnus a, MemorialForm f, MultipartFile photo) throws IOException {
        long id = a.getId();
        if (a.getStatus() == Alumnus.Status.PENDING) throw new ResponseStatusException(HttpStatus.CONFLICT, "Approve or reject this join request first.");
        java.time.LocalDate day = f.passedOn();
        if (day != null && (day.getYear() < a.getBatch() || day.isAfter(java.time.LocalDate.now())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date of death must be between " + a.getBatch() + " and today.");
        String name = clip(f.name(), 120);
        if (name == null && a.getName() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter their name.");
        if (name != null) a.setName(name);
        a.setDeceased(f.deceased());
        if (!f.deceased()) { a.setPassedOn(null); a.setPassedYear(null); }
        else if (day != null) { a.setPassedOn(day); a.setPassedYear(day.getYear()); }
        // no date given: a year already on file (entered before dates were asked) stays
        if (clip(f.village(), 80) != null) a.setVillage(clip(f.village(), 80));
        a.setEmail(clip(f.email(), 120));
        a.setPhone(f.phone() == null || f.phone().isBlank() ? null : ProfileController.phone(f.phone()));
        a.setTitle(clip(f.title(), 120));
        a.setOrganization(clip(f.org(), 120));
        a.setBio(clip(f.bio(), 2000));
        if (f.birthDate() != null) ProfileController.checkBirthDate(f.birthDate()); // optional here: friends may not know it
        a.setBirthDate(f.birthDate());
        String blood = clip(f.bloodGroup(), 3);
        if (blood != null && !ProfileController.isBloodGroup(blood)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pick a blood group from the list.");
        a.setBloodGroup(blood);
        if (f.sex() != null && !f.sex().isBlank()) a.setSex(ProfileController.sex(new Alumnus(), f.sex())); // the admin may correct it
        a.setIndustry(clip(f.industry(), 60));
        a.setCity(clip(f.city(), 80));
        a.setCountry(clip(f.country(), 80));
        if (f.education() != null || f.socials() != null)
            profiles.setEducationAndSocials(a, f.education() != null ? f.education()
                    : a.getEducations().stream().map(e -> new ProfileController.EducationIn(e.getLevel(), e.getInstitution(), e.getSubject(), e.getPassingYear())).toList(),
                    f.socials() != null ? f.socials() : Memorial.of(a).socials());
        if (photo != null && !photo.isEmpty()) {
            try {
                a.setPhotoUrl(photos.save(id, photo.getInputStream(), 0.5, 0.4, 1));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
            }
        }
        if (a.isDeceased() && a.getStatus() == Alumnus.Status.UNCLAIMED) a.setStatus(Alumnus.Status.VERIFIED);
        // undone, and the student never claimed it themselves (no join date): back to a plain record
        if (!a.isDeceased() && a.getJoinedAt() == null && a.getStatus() == Alumnus.Status.VERIFIED) a.setStatus(Alumnus.Status.UNCLAIMED);
        a.setUpdatedAt(Instant.now());
        return Memorial.of(a);
    }

    private static String clip(String s, int max) {
        if (s == null || s.isBlank()) return null;
        s = s.strip();
        if (s.length() > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keep each field under " + max + " characters.");
        return s;
    }

    private Alumnus find(long id) {
        return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No student with id " + id + "."));
    }

    /**
     * id = null for a new story. studentId (e.g. 201303003) links it to a student and is optional; without one, name
     * (who it's about / who wrote it) is required. removePhoto drops the story's own photo.
     */
    public record StoryForm(Long id, Long studentId, String name, Integer batch, String kind, String title, String role,
                            String quote, String body, boolean removePhoto) {}

    /** A story as the admin sees it: also its status and the sender's contact. */
    public record AdminStory(StoryController.StoryItem story, String status, String contact) {
        static AdminStory of(Story s) {
            return new AdminStory(StoryController.StoryItem.of(s), s.getStatus().name(), s.getContact());
        }
    }

    /** Every story: waiting ones first, then newest first. */
    @GetMapping("/stories")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<AdminStory> allStories(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        requireAdmin(given);
        return stories.findAllByOrderByStatusAscPublishedDescIdDesc().stream().map(AdminStory::of).toList();
    }

    /** Add (live at once) or edit a story: multipart with "form" (JSON) and an optional "photo" (JPEG or PNG). */
    @PostMapping("/stories")
    @org.springframework.transaction.annotation.Transactional
    public AdminStory saveStory(@RequestHeader(value = "X-Admin-Token", required = false) String given,
                                @RequestPart("form") StoryForm f,
                                @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        requireAdmin(given);
        Story s = f.id() == null ? new Story() : story(f.id());
        storyApi.fill(s, f.studentId(), f.name(), f.batch(), f.kind(), f.title(), f.role(), f.quote(), f.body());
        if (s.getPublished() == null) s.setPublished(java.time.LocalDate.now());
        s = stories.save(s);
        if (photo != null && !photo.isEmpty()) storyApi.savePhoto(s, photo);
        else if (f.removePhoto() && s.getPhotoUrl() != null) {
            photos.deleteStory(s.getId());
            s.setPhotoUrl(null);
        }
        return AdminStory.of(s);
    }

    /** Publish a story someone sent. It's dated today, so it shows first. */
    @PostMapping("/stories/{id}/approve")
    @org.springframework.transaction.annotation.Transactional
    public void approveStory(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) {
        requireAdmin(given);
        Story s = story(id);
        if (s.getStatus() == Story.Status.PUBLISHED) return;
        s.setStatus(Story.Status.PUBLISHED);
        s.setPublished(java.time.LocalDate.now());
    }

    /** Delete a story (also how a sent story is rejected). */
    @DeleteMapping("/stories/{id}")
    public void deleteStory(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) throws IOException {
        requireAdmin(given);
        stories.deleteById(id);
        photos.deleteStory(id);
    }

    private Story story(long id) {
        return stories.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No story with id " + id + "."));
    }

    /** id = null for a new event. time is free text, e.g. "4:00 PM". */
    public record EventForm(Long id, java.time.LocalDate date, String time, String title, String place, String details) {}

    private static AlumniController.EventItem item(Event e) {
        return new AlumniController.EventItem(e.getId(), e.getEventDate(), e.getEventTime(), e.getTitle(), e.getPlace(), e.getDetails());
    }

    /** Every event, past ones too, newest date first. */
    @GetMapping("/events")
    public List<AlumniController.EventItem> allEvents(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        requireAdmin(given);
        return events.findAllByOrderByEventDateDescIdDesc().stream().map(AdminController::item).toList();
    }

    /** Add or edit an event; the website lists it from today until its date has passed. */
    @PostMapping("/events")
    @org.springframework.transaction.annotation.Transactional
    public AlumniController.EventItem saveEvent(@RequestHeader(value = "X-Admin-Token", required = false) String given, @RequestBody EventForm f) {
        requireAdmin(given);
        if (f.date() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose the event date.");
        String title = clip(f.title(), 150);
        if (title == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the event title.");
        Event e = f.id() == null ? new Event()
                : events.findById(f.id()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No event with id " + f.id() + "."));
        e.setEventDate(f.date());
        e.setEventTime(clip(f.time(), 30));
        e.setTitle(title);
        e.setPlace(clip(f.place(), 150));
        e.setDetails(clip(f.details(), 2000));
        return item(events.save(e));
    }

    @DeleteMapping("/events/{id}")
    public void deleteEvent(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) {
        requireAdmin(given);
        events.deleteById(id);
    }

    public record HelpRequest(long id, long studentId, String name, int batch, String group, String photo, String message, String contact, Instant at) {}

    /** Help notes sent from profiles, oldest first. */
    @GetMapping("/issues")
    public List<HelpRequest> issues(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        requireAdmin(given);
        return issues.findAllByOrderByIdAsc().stream().map(i -> {
            var a = repo.findById(i.getAlumnusId()).orElse(null);
            return new HelpRequest(i.getId(), i.getAlumnusId(), a == null ? null : a.getName(), a == null ? 0 : a.getBatch(), a == null ? null : a.getDepartment(),
                    a == null ? null : AlumniController.Card.blank(a.getPhotoUrl()), i.getMessage(), i.getContact(), i.getCreatedAt());
        }).toList();
    }

    /** Fixed (or not needed): the note is removed. */
    @DeleteMapping("/issues/{id}")
    public void deleteIssue(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) {
        requireAdmin(given);
        issues.deleteById(id);
    }

    /** Upload a batch spreadsheet: curl -H "X-Admin-Token: …" -F file=@batch-14.xlsx 10.10.10.16:8081/api/admin/import */
    @PostMapping("/import")
    public BatchImporter.Result importBatch(@RequestHeader(value = "X-Admin-Token", required = false) String given,
                                            @RequestParam("file") MultipartFile file) throws IOException {
        requireAdmin(given);
        String name = String.valueOf(file.getOriginalFilename()).toLowerCase();
        if (!name.endsWith(".xlsx") && !name.endsWith(".xls"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload an Excel file (.xls or .xlsx).");
        try {
            return importer.importSheet(file.getInputStream());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    private void requireAdmin(String given) {
        if (!isAdmin(given)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in as admin.");
    }

    /** True for the fixed token or a live login token. */
    public boolean isAdmin(String given) {
        if (given == null) return false;
        if (token.length > 0 && MessageDigest.isEqual(token, given.getBytes(StandardCharsets.UTF_8))) return true;
        Instant exp = sessions.get(given);
        return exp != null && exp.isAfter(Instant.now());
    }
}
