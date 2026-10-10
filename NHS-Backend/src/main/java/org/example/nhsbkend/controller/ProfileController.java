package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.entity.Education;
import org.example.nhsbkend.entity.SocialLink;
import org.example.nhsbkend.repository.AlumnusRepository;
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

    public record EducationIn(String level, String institution, String subject, Integer year) {}

    public record Form(String email, String pin, String name, Integer batch, String group,
                       String phone, String bloodGroup, String title, String org, String industry, String city, String country,
                       String bio, Boolean showPhone, Boolean showEmail, List<EducationIn> education, Map<String, String> socials,
                       String village) {}

    private static final Set<String> BLOOD = Set.of("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-");
    private static final Set<String> EDU_TYPES = Set.of("College", "University");
    private static final Set<String> GROUPS = Set.of("Science", "Business Studies", "Humanities");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9 -]{6,20}$");

    private final AlumnusRepository repo;
    private final PinService pins;
    private final PhotoService photos;

    public ProfileController(AlumnusRepository repo, PinService pins, PhotoService photos) {
        this.repo = repo;
        this.pins = pins;
        this.photos = photos;
    }

    /** Submit pressed: check the form, then email a PIN to the address in it. Nothing is saved yet. */
    @PostMapping("/alumni/{id}/pin")
    @Transactional(readOnly = true)
    public Map<String, String> pin(@PathVariable long id, @RequestBody Form f) {
        String email = owner(find(id), f.email());
        apply(new Alumnus(), f); // throwaway copy: only to report mistakes before the PIN is sent
        pins.send(email);
        return Map.of("status", "SENT");
    }

    /** PIN entered: save and publish. */
    @PostMapping(value = "/alumni/{id}/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, String> submit(@PathVariable long id, @RequestPart("form") Form f,
                                      @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        Alumnus a = find(id);
        String email = owner(a, f.email());
        apply(a, f); // validate everything before spending the PIN
        BufferedImage img = image(photo);
        pins.check(email, f.pin(), true);
        a.setEmail(email);
        if (img != null) a.setPhotoUrl(photos.save(id, img, 0.5, 0.4, 1));
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
        a.setName(text(f.name(), 120, "Name"));
        if (a.getName() == null || a.getName().length() < 3) throw bad(HttpStatus.BAD_REQUEST, "Enter your full name.");
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
        apply(a, f);
        return a;
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
        if (!PHONE.matcher(phone).matches()) throw bad(HttpStatus.BAD_REQUEST, "Enter a valid phone number.");
        if (blood != null && !BLOOD.contains(blood)) throw bad(HttpStatus.BAD_REQUEST, "Pick a blood group from the list.");
        a.setPhone(phone);
        a.setBloodGroup(blood);
        a.setTitle(text(f.title(), 120, "Occupation"));
        a.setOrganization(text(f.org(), 120, "Organization"));
        a.setIndustry(text(f.industry(), 60, "Field"));
        a.setCity(text(f.city(), 80, "City"));
        a.setCountry(text(f.country(), 80, "Country"));
        a.setBio(text(f.bio(), 2000, "About you"));
        a.setShowPhone(!Boolean.FALSE.equals(f.showPhone()));
        a.setShowEmail(!Boolean.FALSE.equals(f.showEmail()));

        List<EducationIn> edu = f.education() == null ? List.of() : f.education();
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

        a.getSocialLinks().clear();
        if (a.getId() != null) repo.flush(); // delete the old links before inserting new ones (unique per platform)
        if (f.socials() != null) f.socials().forEach((type, raw) -> {
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
        return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static String email(String raw) {
        String e = PinService.norm(raw);
        if (e.length() > 120 || !EMAIL.matcher(e).matches()) throw bad(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        return e;
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
