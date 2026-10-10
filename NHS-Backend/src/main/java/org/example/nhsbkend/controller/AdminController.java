package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.repository.AlumnusRepository;
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
    private final byte[] token;
    private final String adminEmail, adminPasswordHash;

    private static final Duration SESSION = Duration.ofHours(12), LOCKOUT = Duration.ofMinutes(15);
    private static final int MAX_FAILS = 10; // per LOCKOUT window, for everyone together: slows password guessing
    private final Map<String, Instant> sessions = new ConcurrentHashMap<>(); // login token -> expiry
    private final ArrayDeque<Instant> fails = new ArrayDeque<>();
    private final SecureRandom random = new SecureRandom();

    public AdminController(BatchImporter importer, PhotoService photos, AlumnusRepository repo,
                           @Value("${nhs.admin-token:}") String token, @Value("${nhs.admin-email:}") String adminEmail,
                           @Value("${nhs.admin-password-hash:}") String adminPasswordHash) {
        this.importer = importer;
        this.photos = photos;
        this.repo = repo;
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
    public record Pending(long id, String name, int batch, String group, String village, String email, String phone, String bloodGroup,
                          String title, String org, String industry, String city, String country, String bio, String photo,
                          List<String> education, List<Socials.Social> socials) {}

    /** Join requests waiting for approval, oldest first. Also how the admin page checks the token. */
    @GetMapping("/pending")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Pending> pending(@RequestHeader(value = "X-Admin-Token", required = false) String given) {
        requireAdmin(given);
        return repo.findByStatusOrderByIdAsc(Alumnus.Status.PENDING).stream().map(a -> new Pending(a.getId(), a.getName(),
                a.getBatch(), a.getDepartment(), a.getVillage(), a.getEmail(), a.getPhone(), a.getBloodGroup(), a.getTitle(), a.getOrganization(),
                a.getIndustry(), a.getCity(), a.getCountry(), a.getBio(), a.getPhotoUrl(),
                a.getEducations().stream().map(e -> e.getLevel() + ": " + e.getInstitution()).toList(), Socials.of(a))).toList();
    }

    /** Approve a join request: the profile goes live. */
    @PostMapping("/alumni/{id}/approve")
    @org.springframework.transaction.annotation.Transactional
    public void approve(@RequestHeader(value = "X-Admin-Token", required = false) String given, @PathVariable long id) {
        requireAdmin(given);
        waiting(id).setStatus(Alumnus.Status.VERIFIED);
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

    private Alumnus find(long id) {
        return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No student with id " + id + "."));
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
        if (given == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in as admin.");
        if (token.length > 0 && MessageDigest.isEqual(token, given.getBytes(StandardCharsets.UTF_8))) return;
        Instant exp = sessions.get(given);
        if (exp != null && exp.isAfter(Instant.now())) return;
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in as admin.");
    }
}
