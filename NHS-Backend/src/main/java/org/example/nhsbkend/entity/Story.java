package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * A story on the Stories page: a success story or a batch memory. The admin writes them (live at once), or anyone sends
 * one from the website (PENDING until the admin approves). It may be linked to a student (by student ID); otherwise
 * {@link #name} says who it's about or who wrote it. Its own photo is optional; a linked student's profile photo is used otherwise.
 */
@Entity
@Table(indexes = @Index(name = "ix_story_status_published", columnList = "status, published"))
@Getter
@Setter
@NoArgsConstructor
public class Story {

    public enum Status { PENDING, PUBLISHED }
    public static final java.util.List<String> KINDS = java.util.List.of("Success story", "Batch memory");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Status status = Status.PUBLISHED;
    @Column(nullable = false, length = 20)
    private String kind = KINDS.get(0);

    @ManyToOne
    private Alumnus alumnus;    // null when the story isn't about one student
    @Column(length = 120)
    private String name;        // who it's about / who wrote it; for a linked student, blank = their record name
    private Integer batch;      // for a story not linked to a student, e.g. a batch memory
    @Column(length = 120)
    private String contact;     // email or phone of whoever sent it; only the admin sees it
    @Column(length = 300)
    private String photoUrl;

    @Column(nullable = false, length = 150)
    private String title;       // headline, e.g. "From Nimsar to a lecturer at BUET"
    @Column(length = 150)
    private String role;        // what they do now, as the story tells it (the profile may not be updated yet)
    @Column(length = 400)
    private String quote;       // optional pull quote, in their words
    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;        // paragraphs separated by blank lines
    @Column(nullable = false)
    private LocalDate published; // sent date while pending; set again when approved, so it shows as recent
}
