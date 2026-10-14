package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.entity.Story;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.repository.StoryRepository;
import org.example.nhsbkend.service.PhotoService;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

/** The Stories page: published stories for everyone, and "Share a story" (waits for the admin's approval). */
@RestController
@RequestMapping("/api/stories")
public class StoryController {

    static final int MAX_PENDING = 100; // stops a flood of junk sends; the admin clears the queue

    private final StoryRepository stories;
    private final AlumnusRepository alumni;
    private final PhotoService photos;

    public StoryController(StoryRepository stories, AlumnusRepository alumni, PhotoService photos) {
        this.stories = stories;
        this.alumni = alumni;
        this.photos = photos;
    }

    /**
     * A story as the website shows it. alumnusId/group are null when it isn't about one student. A linked student's
     * profile photo is shown even before they join: the admin approved featuring them.
     */
    public record StoryItem(long id, String kind, String title, String role, String quote, String body, LocalDate published,
                            Long alumnusId, String name, Integer batch, String group, String photo) {
        public static StoryItem of(Story s) {
            Alumnus a = s.getAlumnus();
            String name = AlumniController.Card.blank(s.getName()), photo = AlumniController.Card.blank(s.getPhotoUrl());
            if (a == null) return new StoryItem(s.getId(), s.getKind(), s.getTitle(), s.getRole(), s.getQuote(), s.getBody(),
                    s.getPublished(), null, name, s.getBatch(), null, photo);
            return new StoryItem(s.getId(), s.getKind(), s.getTitle(), s.getRole(), s.getQuote(), s.getBody(), s.getPublished(),
                    a.getId(), name != null ? name : a.getName(), a.getBatch(), a.getDepartment(),
                    photo != null ? photo : AlumniController.Card.blank(a.getPhotoUrl()));
        }
    }

    /** Most recent published stories first; the website shows a fixed number (default 12, at most 50). */
    @GetMapping
    public List<StoryItem> stories(@RequestParam(defaultValue = "12") int limit) {
        return stories.findByStatusOrderByPublishedDescIdDesc(Story.Status.PUBLISHED, PageRequest.of(0, Math.clamp(limit, 1, 50)))
                .stream().map(StoryItem::of).toList();
    }

    @GetMapping("/{id}")
    public StoryItem story(@PathVariable long id) {
        return stories.findById(id).filter(s -> s.getStatus() == Story.Status.PUBLISHED).map(StoryItem::of)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    /** What a student sends: their own student ID, so the admin sees whose story it is. website is a honeypot: hidden on the page, so only bots fill it. */
    public record Submission(Long studentId, String body, String website) {}

    /** "Share a story": multipart with "form" (JSON) and an optional "photo". Waits for the admin's approval. */
    @PostMapping("/submit")
    @Transactional
    public void submit(@RequestPart("form") Submission f, @RequestPart(value = "photo", required = false) MultipartFile photo) throws IOException {
        if (f.website() != null && !f.website().isBlank()) return; // a bot: pretend it worked
        if (f.studentId() == null || blank(f.body())) throw bad("Your story and your student ID are required.");
        if (f.body().length() > 10000) throw bad("The story is too long (max 10,000 characters).");
        Alumnus a = alumni.findById(f.studentId()).filter(x -> x.getStatus() != Alumnus.Status.PENDING)
                .orElseThrow(() -> bad("No student with ID " + f.studentId() + "."));
        if (a.getName() == null) throw bad("Add your name to your profile first (Update my profile), then share your story.");
        if (stories.countByStatus(Story.Status.PENDING) >= MAX_PENDING)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Many stories are waiting for review. Please try again in a few days.");
        Story s = new Story();
        s.setStatus(Story.Status.PENDING);
        fill(s, a.getId(), null, null, null, headline(f.body()), null, null, f.body());
        s.setPublished(LocalDate.now());
        stories.save(s);
        savePhoto(s, photo);
    }

    // ---------- shared with the admin's story editor ----------

    /** Checks and copies the fields both forms have. Throws 400 with a reason the user can read. */
    void fill(Story s, Long studentId, String name, Integer batch, String kind, String title, String role, String quote, String body) {
        if (blank(title) || blank(body)) throw bad("Headline and story are required.");
        if (studentId == null && blank(name)) throw bad("Give a student ID or the name of who the story is about.");
        if (batch != null && (batch < 1958 || batch > LocalDate.now().getYear())) throw bad("Batch must be a year from 1958 to now.");
        s.setAlumnus(studentId == null ? null : alumni.findById(studentId).filter(a -> a.getStatus() != Alumnus.Status.PENDING)
                .orElseThrow(() -> bad("No student with ID " + studentId + ".")));
        s.setName(blank(name) ? null : clip(name, 120));
        s.setBatch(studentId == null ? batch : null); // a linked student's batch comes from their record
        if (kind != null && Story.KINDS.contains(kind)) s.setKind(kind); // else keep it (new stories start as a success story)
        s.setTitle(clip(title, 150));
        s.setRole(blank(role) ? null : clip(role, 150));
        s.setQuote(blank(quote) ? null : clip(quote, 400));
        s.setBody(body.strip());
    }

    /** Saves the story first if it's new: the photo's file name is the story's id. */
    void savePhoto(Story s, MultipartFile photo) throws IOException {
        if (photo == null || photo.isEmpty()) return;
        try {
            s.setPhotoUrl(photos.saveStory(s.getId(), photo.getInputStream()));
        } catch (IllegalArgumentException e) {
            throw bad(e.getMessage());
        }
    }

    /** No headline on the share form: the story's first sentence stands in; the admin can change it before approving. */
    static String headline(String body) {
        String first = body.strip().split("(?<=[.!?।])\\s|\\n", 2)[0].strip();
        return first.length() > 100 ? first.substring(0, 99).strip() + "…" : first;
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    static String clip(String s, int max) {
        s = s.strip();
        return s.length() > max ? s.substring(0, max) : s;
    }

    static ResponseStatusException bad(String why) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, why);
    }
}
