package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One former student. Rows start as UNCLAIMED from the school's SSC records (name, batch, department, village);
 * the profile fields are filled in by the alumnus after they claim the record and are verified.
 * The batch is the year the student passed SSC (rows with grade F are not imported).
 */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_batch_roll", columnNames = {"batch", "roll"}),
        indexes = {@Index(name = "ix_batch", columnList = "batch"), @Index(name = "ix_name", columnList = "name")})
@Getter
@Setter
@NoArgsConstructor
public class Alumnus {

    public enum Status { UNCLAIMED, PENDING, VERIFIED }

    /** Student ID, see {@link org.example.nhsbkend.repository.AlumnusRepository#nextId}. Set once at creation; never changes. */
    @Id
    private Long id;

    // --- from the SSC record ---
    // Null for students added from a board result sheet (roll only): they type their name when they claim the record.
    @Column(length = 120)
    private String name;
    @Column(nullable = false)
    private int batch;
    @Column(nullable = false, length = 40)
    private String department; // Science | Business Studies | Humanities
    @Column(length = 10)
    private String sex;
    @Column(length = 80)
    private String village;
    // From the SSC record, used to match re-imports; never returned by the API. Null for alumni who joined through the
    // website (e.g. batches before 2006, which have no sheet).
    private Long roll;
    private Long regNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Status status = Status.UNCLAIMED;

    // --- written by the alumnus after claiming ---
    @Column(length = 120) private String title;
    @Column(length = 120) private String organization;
    @Column(length = 60) private String industry;
    @Column(length = 80) private String city;
    @Column(length = 80) private String country;
    @Column(length = 300) private String photoUrl;
    @Column(length = 120) private String email; // also the login: changes need a PIN sent to this address
    @Column(length = 30) private String phone;
    @Column(length = 10) private String bloodGroup; // A+, A-, B+, B-, AB+, AB-, O+, O- ("b+ve" etc. is tidied on display)
    @Column(length = 2000) private String bio;
    /** Likes on the bio, shown as a comment on Events. A bare count: who liked isn't stored. */
    @Column(nullable = false, columnDefinition = "int default 0") private int likes;
    @Column(length = 500) private String quote;
    private boolean featured;
    // --- related rows (normalized: one row per item, deleted with the student) ---
    @OneToMany(mappedBy = "alumnus", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("platform")
    private java.util.List<SocialLink> socialLinks = new java.util.ArrayList<>();
    @OneToMany(mappedBy = "alumnus", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("passingYear DESC, id DESC") // newest first; without years, the latest added first
    @org.hibernate.annotations.BatchSize(size = 64) // directory cards read these: one query per page, not per card
    private java.util.List<Education> educations = new java.util.ArrayList<>();
    @OneToMany(mappedBy = "alumnus", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("startYear DESC")
    private java.util.List<Job> jobs = new java.util.ArrayList<>();

    // --- privacy choices ---
    private boolean showLocation = true;
    private boolean showVillage = false;
    @org.hibernate.annotations.ColumnDefault("true")
    private boolean showPhone = true;
    @org.hibernate.annotations.ColumnDefault("true")
    private boolean showEmail = true;

    /** Private: asked on the form, shown only to the admin, never on the public profile. */
    private java.time.LocalDate birthDate;

    /** When the profile first went live (claimed with the PIN, or a join request approved); orders "Recently joined". */
    private java.time.Instant joinedAt;

    /** Passed away: set by the admin only. The profile becomes a memorial (shows everything a member's profile shows; out of blood-donor search; no edits). */
    @org.hibernate.annotations.ColumnDefault("false")
    private boolean deceased;
    private java.time.LocalDate passedOn; // date of death, optional
    private Integer passedYear;           // its year; also kept alone when only the year is known

    /** Last time the owner saved the profile (or an admin approved it). */
    private java.time.Instant updatedAt;

    public boolean isVerified() {
        return status == Status.VERIFIED;
    }
}
