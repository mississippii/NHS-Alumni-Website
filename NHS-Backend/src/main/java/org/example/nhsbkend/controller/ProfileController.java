package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.entity.Education;
import org.example.nhsbkend.entity.SocialLink;
import org.example.nhsbkend.entity.Issue;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.repository.IssueRepository;
import org.example.nhsbkend.service.PhotoService;
import org.example.nhsbkend.service.PinService;
import org.example.nhsbkend.service.Socials;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Join / update-my-profile, without passwords. The student fills the form and presses Submit; a PIN goes to the email
 * in the form, and the form is saved once they type the PIN back (see PinService).
 * PIN right = saved and public at once for records from the school's sheets. The first PIN claims the record and its
 * email becomes the key: after that only PINs sent to that address can change it. A wrong claim is undone by an admin
 * with POST /api/admin/alumni/{id}/reset.
 * Joining (batches older than the sheets) is different: the PIN only proves the email, and the new record stays PENDING,
 * hidden from the site, until an admin approves it (see AdminController).
 */
@RestController
@RequestMapping("/api")
public class ProfileController {

    public static final int FOUNDED = 1958;
    /** From this batch on, records added from the board's result sheets have no name: opening one's form needs its SSC roll. */
    public static final int ROLL_CHECK_FROM = 2022;

    public record EducationIn(String level, String institution, String subject, Integer year) {}

    public record Form(String email, String pin, String name, Integer batch, String group,
                       String phone, String bloodGroup, String title, String org, String industry, String city, String country,
                       String bio, Boolean showPhone, Boolean showEmail, List<EducationIn> education, Map<String, String> socials,
                       String village, Long roll, java.time.LocalDate birthDate, String sex,
                       String emailPin) { // the PIN sent to a new email, when the owner changes it
        public Form(String email, String pin, String name, Integer batch, String group,
                    String phone, String bloodGroup, String title, String org, String industry, String city, String country,
                    String bio, Boolean showPhone, Boolean showEmail, List<EducationIn> education, Map<String, String> socials,
                    String village, Long roll, java.time.LocalDate birthDate, String sex) {
            this(email, pin, name, batch, group, phone, bloodGroup, title, org, industry, city, country, bio, showPhone, showEmail,
                    education, socials, village, roll, birthDate, sex, null);
        }
    }

    private static final Set<String> BLOOD = Set.of("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-");
    private static final Set<String> EDU_TYPES = Set.of("College", "University");
    private static final Set<String> GROUPS = Set.of("Science", "Business Studies", "Humanities");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final AlumnusRepository repo;
    private final PinService pins;
    private final PhotoService photos;
    private final IssueRepository issues;

    public ProfileController(AlumnusRepository repo, PinService pins, PhotoService photos, IssueRepository issues) {
        this.repo = repo;
        this.pins = pins;
        this.photos = photos;
        this.issues = issues;
    }

    public record HelpForm(String message, String contact) {}

    /** "Help" on a profile: a note to the admin, e.g. a wrong name. Shows in the admin's notifications until fixed. */
    @PostMapping("/alumni/{id}/help")
    public Map<String, String> help(@PathVariable long id, @RequestBody HelpForm f) {
        find(id);
        if (StoryController.blank(f.message())) throw StoryController.bad("Write what needs fixing.");
        // ponytail: per-profile cap only; add an IP rate limit if spam shows up
        if (issues.countByAlumnusId(id) >= 5) throw StoryController.bad("This profile already has requests waiting. The admin will check them soon.");
        Issue i = new Issue();
        i.setAlumnusId(id);
        i.setMessage(StoryController.clip(f.message(), 1000));
        i.setContact(StoryController.blank(f.contact()) ? null : StoryController.clip(f.contact(), 120));
        i.setCreatedAt(java.time.Instant.now());
        issues.save(i);
        return Map.of("status", "SENT");
    }

    /**
     * Submit pressed: check the form, then email a PIN to the address in it. Nothing is saved yet. On a claimed profile
     * this only happens for a new email (proves it's real); the saved email's PIN came from "Edit profile".
     */
    @PostMapping("/alumni/{id}/pin")
    @Transactional(readOnly = true)
    public Map<String, String> pin(@PathVariable long id, @RequestBody Form f) {
        Alumnus a = find(id);
        rollCheck(a, f.roll());
        String email = a.isVerified() && a.getEmail() != null ? newEmail(a, f.email()) : owner(a, f.email());
        if (a.getName() == null) fullName(f);
        sex(a, f.sex());
        apply(new Alumnus(), f); // throwaway copy: only to report mistakes before the PIN is sent
        pins.send(email);
        return Map.of("status", "SENT");
    }

    /** "Edit profile" on a claimed profile, step 1: a PIN to the saved email. Returns it masked ("t***@gmail.com"). */
    @PostMapping("/alumni/{id}/unlock")
    @Transactional(readOnly = true)
    public Map<String, String> unlock(@PathVariable long id) {
        String email = claimedEmail(find(id));
        if (!pins.recent(email)) pins.send(email); // Edit tapped again within a minute: the PIN already sent still works
        return Map.of("email", email.charAt(0) + "***" + email.substring(email.indexOf('@')));
    }

    public record PinIn(String pin) {}
    public record Private(String email, String phone, java.time.LocalDate birthDate, boolean showPhone) {}

    /** Step 2: PIN right = the form opens with the private fields filled. The same PIN saves it within the hour (see submit). */
    @PostMapping("/alumni/{id}/unlock/check")
    @Transactional(readOnly = true)
    public Private unlockCheck(@PathVariable long id, @RequestBody PinIn in) {
        Alumnus a = find(id);
        pins.check(claimedEmail(a), in.pin(), false);
        return new Private(a.getEmail(), a.getPhone(), a.getBirthDate(), a.isShowPhone());
    }

    /** The email typed on a claimed profile: the saved one, or a new one that no other profile uses. */
    private String newEmail(Alumnus a, String raw) {
        String e = email(raw);
        if (!e.equalsIgnoreCase(a.getEmail()) && repo.existsByEmailIgnoreCase(e))
            throw bad(HttpStatus.CONFLICT, "This email already belongs to another profile.");
        return e.equalsIgnoreCase(a.getEmail()) ? a.getEmail() : e;
    }

    private static String claimedEmail(Alumnus a) {
        if (!a.isVerified() || a.getEmail() == null) throw bad(HttpStatus.CONFLICT, "This profile isn’t claimed yet. Use “Update my profile”.");
        return a.getEmail();
    }

    /**
     * "Update my profile" on a batch from {@link #ROLL_CHECK_FROM}: the form opens once the SSC roll matches. A student
     * who opened the wrong profile but typed a roll of the same batch gets that roll's record instead: {"id": its id}.
     */
    @PostMapping("/alumni/{id}/roll")
    @Transactional(readOnly = true)
    public Map<String, Object> roll(@PathVariable long id, @RequestBody Map<String, Long> body) {
        Alumnus a = find(id);
        Long roll = body.get("roll");
        if (roll != null && !roll.equals(a.getRoll()))
            a = repo.findByBatchAndRoll(a.getBatch(), roll).filter(x -> x.getStatus() != Alumnus.Status.PENDING).orElse(a);
        rollCheck(a, roll);
        return Map.of("status", "OK", "id", a.getId());
    }

    public record RollIn(Integer batch, String group, Long roll) {}

    /** Home page "find me by SSC roll" (batches from {@link #ROLL_CHECK_FROM}): batch + group + roll → that student's id. */
    @PostMapping("/roll")
    @Transactional(readOnly = true)
    public Map<String, Object> findByRoll(@RequestBody RollIn in) {
        if (in.batch() == null || in.batch() < ROLL_CHECK_FROM || in.roll() == null || in.group() == null)
            throw bad(HttpStatus.BAD_REQUEST, "Choose your batch and group, then enter your SSC roll.");
        Alumnus a = repo.findByBatchAndRoll(in.batch(), in.roll())
                .filter(x -> x.getStatus() != Alumnus.Status.PENDING && !x.isDeceased() && in.group().equals(x.getDepartment()))
                .orElseThrow(() -> bad(HttpStatus.NOT_FOUND, "No " + in.group() + " student of batch " + in.batch() + " has that SSC roll. Check your admit card."));
        return Map.of("id", a.getId());
    }

    /** PIN entered: save and publish. */
    @PostMapping(value = "/alumni/{id}/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, String> submit(@PathVariable long id, @RequestPart("form") Form f,
                                      @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        Alumnus a = find(id);
        rollCheck(a, f.roll());
        // claimed: the PIN went to the saved email; a new email also needs the PIN sent to it (so a typo can't lock them out)
        String email = a.isVerified() && a.getEmail() != null ? a.getEmail() : owner(a, f.email());
        String newEmail = a.isVerified() && a.getEmail() != null ? newEmail(a, f.email()) : email;
        if (a.getName() == null) a.setName(fullName(f));
        a.setSex(sex(a, f.sex()));
        apply(a, f); // validate everything before spending the PIN
        BufferedImage img = image(photo);
        if (!newEmail.equals(email)) pins.check(newEmail, f.emailPin(), false); // both right before either is used up
        pins.check(email, f.pin(), true);
        if (!newEmail.equals(email)) pins.check(newEmail, f.emailPin(), true);
        a.setEmail(newEmail);
        if (img != null) a.setPhotoUrl(photos.save(id, img, 0.5, 0.4, 1));
        a.setUpdatedAt(java.time.Instant.now());
        if (!a.isVerified()) a.setJoinedAt(a.getUpdatedAt()); // later edits keep their place in "Recently joined"
        a.setStatus(Alumnus.Status.VERIFIED);
        return Map.of("status", a.getStatus().name());
    }

    @PostMapping("/alumni/join/pin")
    @Transactional(readOnly = true)
    public Map<String, String> joinPin(@RequestBody Form f) {
        pins.send(newMember(f).getEmail());
        return Map.of("status", "SENT");
    }

    /** Someone who isn't in the school's sheets (e.g. SSC before 2006) asks to join; an admin approves it. */
    @PostMapping(value = "/alumni/join", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, Object> join(@RequestPart("form") Form f, @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        Alumnus a = newMember(f);
        BufferedImage img = image(photo);
        pins.check(a.getEmail(), f.pin(), true);
        a.setStatus(Alumnus.Status.PENDING);
        a.setId(repo.nextId(a.getBatch(), a.getDepartment()));
        a = repo.save(a); // an assigned ID means save() merges: keep working on the managed copy
        if (img != null) a.setPhotoUrl(photos.save(a.getId(), img, 0.5, 0.4, 1));
        return Map.of("id", a.getId(), "status", a.getStatus().name());
    }

    private Alumnus newMember(Form f) {
        String email = email(f.email());
        if (repo.existsByEmailIgnoreCaseAndStatus(email, Alumnus.Status.PENDING))
            throw bad(HttpStatus.CONFLICT, "You already asked to join with this email. It is waiting for admin approval.");
        if (repo.existsByEmailIgnoreCase(email))
            throw bad(HttpStatus.CONFLICT, "This email already belongs to a profile. Find yours in the directory and update it there.");
        Alumnus a = new Alumnus();
        a.setName(fullName(f));
        // Batches from the school's sheets are already listed: those students update their record instead of joining.
        Integer first = repo.firstRecordBatch();
        int max = first == null ? Year.now().getValue() + 5 : first - 1;
        if (f.batch() == null || f.batch() < FOUNDED || f.batch() > max)
            throw bad(HttpStatus.BAD_REQUEST, "Batch must be between " + FOUNDED + " and " + max + "."
                    + (first == null ? "" : " From " + first + " on you're already listed: find yourself in the directory and update your profile."));
        a.setBatch(f.batch());
        if (!GROUPS.contains(f.group())) throw bad(HttpStatus.BAD_REQUEST, "Pick your group.");
        a.setDepartment(f.group());
        // Records from the sheets bring their village; people joining type it (required, shown on the profile).
        a.setVillage(text(f.village(), 80, "Village"));
        if (a.getVillage() == null) throw bad(HttpStatus.BAD_REQUEST, "Enter your village.");
        a.setEmail(email);
        a.setSex(sex(a, f.sex()));
        apply(a, f);
        return a;
    }

    /** A nameless record (batch 2022 on, roll only) opens only with its SSC roll; once the student adds their name, the email PIN guards it. */
    private static void rollCheck(Alumnus a, Long roll) {
        if (a.getName() == null && a.getBatch() >= ROLL_CHECK_FROM && a.getRoll() != null && !a.getRoll().equals(roll))
            throw bad(HttpStatus.FORBIDDEN, "No student in batch " + a.getBatch() + " has that SSC roll. Check the roll on your admit card.");
    }

    private static String fullName(Form f) {
        String name = text(f.name(), 120, "Name");
        if (name == null || name.length() < 3) throw bad(HttpStatus.BAD_REQUEST, "Enter your full name.");
        return name;
    }

    /** The email allowed to change this record: the one on file once it has been claimed, otherwise any unused one. */
    private String owner(Alumnus a, String raw) {
        if (a.getStatus() == Alumnus.Status.PENDING)
            throw bad(HttpStatus.CONFLICT, "This profile is waiting for admin approval.");
        String email = email(raw);
        if (a.getStatus() == Alumnus.Status.UNCLAIMED) {
            if (repo.existsByEmailIgnoreCase(email))
                throw bad(HttpStatus.CONFLICT, "This email already belongs to another profile.");
            return email;
        }
        if (a.getEmail() == null || !a.getEmail().equalsIgnoreCase(email))
            throw bad(HttpStatus.FORBIDDEN, "This profile is already claimed. Use the email saved on it, or ask the alumni admin if it isn’t you.");
        return email;
    }

    private void apply(Alumnus a, Form f) {
        String phone = text(f.phone(), 30, "Phone"), blood = text(f.bloodGroup(), 3, "Blood group");
        if (phone == null) throw bad(HttpStatus.BAD_REQUEST, "Enter your phone number.");
        if (blood != null && !BLOOD.contains(blood)) throw bad(HttpStatus.BAD_REQUEST, "Pick a blood group from the list.");
        checkBirthDate(f.birthDate());
        a.setPhone(phone(phone));
        a.setBirthDate(f.birthDate());
        a.setBloodGroup(blood);
        a.setTitle(text(f.title(), 120, "Occupation"));
        a.setOrganization(text(f.org(), 120, "Organization"));
        a.setIndustry(text(f.industry(), 60, "Field"));
        a.setCity(text(f.city(), 80, "City"));
        a.setCountry(text(f.country(), 80, "Country"));
        a.setBio(text(f.bio(), 2000, "Comment"));
        a.setShowPhone(!Boolean.FALSE.equals(f.showPhone()));
        a.setShowEmail(true); // a verified profile always shows its email
        // A blank village keeps the one already on the record (from the SSC sheets).
        String village = text(f.village(), 80, "Village");
        if (village != null) a.setVillage(village);

        setEducationAndSocials(a, f.education() == null ? List.of() : f.education(), f.socials());
    }

    /** "MALE" / "FEMALE" from the form (prefilled from the school's sheets); left blank, the one on file stays. */
    public static String sex(Alumnus a, String raw) {
        String s = raw == null ? "" : raw.strip().toUpperCase(java.util.Locale.ROOT);
        if (s.isEmpty() && a.getSex() != null) return a.getSex();
        if (!s.equals("MALE") && !s.equals("FEMALE")) throw bad(HttpStatus.BAD_REQUEST, "Choose male or female.");
        return s;
    }

    static void checkBirthDate(java.time.LocalDate d) {
        if (d == null) throw bad(HttpStatus.BAD_REQUEST, "Enter your date of birth.");
        if (d.getYear() < 1930 || d.isAfter(java.time.LocalDate.now().minusYears(8))) throw bad(HttpStatus.BAD_REQUEST, "Check the date of birth.");
    }

    static boolean isBloodGroup(String b) {
        return BLOOD.contains(b);
    }

    /** Replaces both lists, checking each entry. Also used by the admin's memorial form. */
    public void setEducationAndSocials(Alumnus a, List<EducationIn> edu, Map<String, String> socials) {
        if (edu.size() > 10) throw bad(HttpStatus.BAD_REQUEST, "Add at most 10 education entries.");
        a.getEducations().clear();
        int max = Year.now().getValue() + 6;
        for (EducationIn e : edu) {
            String inst = text(e.institution(), 120, "Institution");
            if (inst == null) continue; // empty row left in the form
            if (e.year() != null && (e.year() < FOUNDED || e.year() > max)) throw bad(HttpStatus.BAD_REQUEST, "Check the passing year for " + inst + ".");
            if (!EDU_TYPES.contains(e.level())) throw bad(HttpStatus.BAD_REQUEST, "Choose College or University for " + inst + ".");
            a.getEducations().add(new Education(a, e.level(), inst, text(e.subject(), 120, "Subject"), e.year()));
        }

        if (a.getId() != null) repo.flush(); // write links still waiting to be saved, so the clear below deletes them
        a.getSocialLinks().clear();
        if (a.getId() != null) repo.flush(); // delete the old links before inserting new ones (unique per platform)
        if (socials != null) socials.forEach((type, raw) -> {
            if (raw == null || raw.isBlank()) return;
            var p = Socials.platform(type);
            if (p == null) throw bad(HttpStatus.BAD_REQUEST, "Unknown social site: " + type);
            String url = Socials.clean(p, raw);
            if (url == null || url.length() > 300) throw bad(HttpStatus.BAD_REQUEST, "That doesn’t look like a " + Socials.label(type) + " link.");
            a.getSocialLinks().add(new SocialLink(a, type, url));
        });
    }

    /** The uploaded photo, decoded and checked; null if none. Photos only show once the profile is verified. */
    private static BufferedImage image(MultipartFile photo) throws IOException {
        if (photo == null || photo.isEmpty()) return null;
        try (var in = photo.getInputStream()) {
            return PhotoService.read(in);
        } catch (IllegalArgumentException e) {
            throw bad(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    private Alumnus find(long id) {
        Alumnus a = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (a.isDeceased()) throw bad(HttpStatus.FORBIDDEN, "This is a memorial profile. Only the alumni admin can change it.");
        return a;
    }

    private static String email(String raw) {
        String e = PinService.norm(raw);
        if (e.length() > 120 || !EMAIL.matcher(e).matches()) throw bad(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        return e;
    }

    private static final Pattern BD_MOBILE = Pattern.compile("1[3-9]\\d{8}");

    /**
     * International format, e.g. "+880 1932 590 638". Accepts "01932590638", "+8801932590638", "+880 01932…" or
     * "+44 7911123456" (the form sends "+code number"). A missing code means Bangladesh.
     */
    public static String phone(String raw) {
        String s = raw.strip().replaceFirst("^00", "+");
        String cc = "880", n = s.replaceAll("\\D", "");
        var m = Pattern.compile("^\\+\\s*(\\d{1,3})[\\s-]+(.*)$").matcher(s);
        if (m.matches()) { cc = m.group(1); n = m.group(2).replaceAll("\\D", ""); }
        else if (s.startsWith("+") && n.startsWith("880")) n = n.substring(3);
        else if (s.startsWith("+")) throw bad(HttpStatus.BAD_REQUEST, "Put a space after the country code, e.g. +44 7911123456.");
        n = n.replaceFirst("^0", ""); // trunk prefix: "+880 01…" → "+880 1…"
        if (cc.equals("880")) {
            if (!BD_MOBILE.matcher(n).matches()) throw bad(HttpStatus.BAD_REQUEST, "Enter a valid Bangladesh mobile number, e.g. 01712 345678.");
            return "+880 " + n.substring(0, 4) + " " + n.substring(4, 7) + " " + n.substring(7);
        }
        if (n.length() < 6 || n.length() > 13) throw bad(HttpStatus.BAD_REQUEST, "Enter a valid phone number.");
        // ponytail: other countries get plain groups of 3, per-country grouping (libphonenumber) if anyone asks
        return "+" + cc + " " + n.replaceAll("(\\d{3})(?=\\d{2})", "$1 ");
    }

    /** Trimmed text, null when empty; rejects text longer than the column. */
    private static String text(String v, int max, String field) {
        if (v == null || v.isBlank()) return null;
        v = v.strip();
        if (v.length() > max) throw bad(HttpStatus.BAD_REQUEST, field + " is too long (max " + max + " characters).");
        return v;
    }

    private static ResponseStatusException bad(HttpStatus s, String msg) {
        return new ResponseStatusException(s, msg);
    }
}
