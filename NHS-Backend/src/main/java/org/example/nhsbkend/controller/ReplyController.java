package org.example.nhsbkend.controller;

import org.example.nhsbkend.entity.Alumnus;
import org.example.nhsbkend.entity.Reply;
import org.example.nhsbkend.repository.AlumnusRepository;
import org.example.nhsbkend.repository.ReplyRepository;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Replies under members' comments: the replier types their Student ID (no sign-in) and shows with that record's name and photo. Only the admin deletes. */
@RestController
@RequestMapping("/api")
public class ReplyController {

    // ponytail: a per-comment cap is the only spam guard; add an IP rate limit if spam shows up
    private static final int MAX_PER_COMMENT = 200;

    private final AlumnusRepository repo;
    private final ReplyRepository replies;
    private final AdminController admin;

    public ReplyController(AlumnusRepository repo, ReplyRepository replies, AdminController admin) {
        this.repo = repo;
        this.replies = replies;
        this.admin = admin;
    }

    public record ReplyIn(Long studentId, String text, Long parentId) {}
    public record ReplyItem(long id, Long parentId, long authorId, String name, int batch, String photo, String text, Instant at) {
        static ReplyItem of(Reply r, Alumnus a) {
            return new ReplyItem(r.getId(), r.getParentId(), a.getId(), a.getName(), a.getBatch(), AlumniController.Card.blank(a.getPhotoUrl()), r.getText(), r.getCreatedAt());
        }
    }

    @PostMapping("/comments/{commentId}/replies")
    public ReplyItem reply(@PathVariable long commentId, @RequestBody ReplyIn in) {
        Alumnus c = repo.findById(commentId).orElse(null);
        if (c == null || !c.isVerified() || c.isDeceased() || StoryController.blank(c.getBio()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "That comment is gone.");
        Alumnus me = in.studentId() == null ? null : repo.findById(AlumnusRepository.currentId(in.studentId())).orElse(null);
        if (me == null || me.getName() == null || me.isDeceased() || me.getStatus() == Alumnus.Status.PENDING)
            throw StoryController.bad("No student with that Student ID.");
        if (StoryController.blank(in.text())) throw StoryController.bad("Write a reply.");
        if (replies.countByCommentId(commentId) >= MAX_PER_COMMENT) throw StoryController.bad("This comment can’t take more replies.");
        Reply r = new Reply();
        r.setCommentId(commentId);
        if (in.parentId() != null) {
            // replying to a reply: it joins that thread (two levels, like Facebook)
            Reply p = replies.findById(in.parentId()).filter(x -> x.getCommentId() == commentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "That reply is gone."));
            r.setParentId(p.getParentId() != null ? p.getParentId() : p.getId());
        }
        r.setAuthorId(me.getId());
        r.setText(StoryController.clip(in.text(), 1000));
        r.setCreatedAt(Instant.now());
        return ReplyItem.of(replies.save(r), me);
    }

    /** Admin only; replies under it go with it. */
    @DeleteMapping("/admin/replies/{id}")
    @Transactional
    public void delete(@RequestHeader(value = "X-Admin-Token", required = false) String adminToken, @PathVariable long id) {
        if (!admin.isAdmin(adminToken)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in as admin.");
        replies.deleteByParentId(id);
        replies.deleteById(id);
    }

    /** Replies for these comments: comment id → its replies, oldest first, with each writer's name and photo. */
    Map<Long, List<ReplyItem>> under(List<Long> commentIds) {
        var all = replies.findByCommentIdInOrderByIdAsc(commentIds);
        var people = new java.util.HashMap<Long, Alumnus>();
        repo.findAllById(all.stream().map(Reply::getAuthorId).distinct().toList()).forEach(a -> people.put(a.getId(), a));
        return all.stream().filter(r -> people.containsKey(r.getAuthorId())).collect(Collectors.groupingBy(Reply::getCommentId,
                Collectors.mapping(r -> ReplyItem.of(r, people.get(r.getAuthorId())), Collectors.toList())));
    }
}
