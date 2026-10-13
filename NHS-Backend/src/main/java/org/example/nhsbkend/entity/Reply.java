package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A reply under a comment, by a student who typed their Student ID (no sign-in) (a comment is a member's bio, so {@code commentId} is that alumnus's id).
 * Two levels like Facebook: {@code parentId} null = a reply to the comment, else the top-level reply it answers.
 */
@Entity
@Table(indexes = @Index(name = "ix_reply_comment", columnList = "commentId"))
@Getter
@Setter
@NoArgsConstructor
public class Reply {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long commentId;
    private Long parentId;
    @Column(nullable = false)
    private Long authorId;      // the Student ID typed in
    @Column(nullable = false, length = 1000)
    private String text;
    private java.time.Instant createdAt;
}
