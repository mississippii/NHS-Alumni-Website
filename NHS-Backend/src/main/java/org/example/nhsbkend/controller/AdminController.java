package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.service.BatchImporter;
import org.example.nhsbkend.service.PhotoService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Admin-only actions, guarded by the X-Admin-Token header.
 * ponytail: one shared token; replace with real admin accounts (Spring Security) when the admin dashboard is built.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final BatchImporter importer;
    private final PhotoService photos;
    private final AlumnusRepository repo;
    private final byte[] token;

    public AdminController(BatchImporter importer, PhotoService photos, AlumnusRepository repo, @Value("${nhs.admin-token}") String token) {
        this.importer = importer;
        this.photos = photos;
        this.repo = repo;
        this.token = token.getBytes(StandardCharsets.UTF_8);
    }

    public record PhotoResult(long id, String photoUrl) {}

    /**
     * Set a student's profile photo (JPEG or PNG, max 5 MB):
     *   curl -H "X-Admin-Token: …" -F file=@me.png "localhost:8081/api/admin/alumni/535/photo?zoom=1.4&focusY=0.35"
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
     * website is removed. curl -X POST -H "X-Admin-Token: …" localhost:8081/api/admin/alumni/535/reset
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

    /** Upload a batch spreadsheet: curl -H "X-Admin-Token: …" -F file=@batch-14.xlsx localhost:8081/api/admin/import */
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
        if (token.length == 0 || given == null || !MessageDigest.isEqual(token, given.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin token missing or wrong.");
    }
}
