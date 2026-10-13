package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A "Help" note sent from a profile (e.g. a misspelled name the student can't edit). Deleted once the admin fixes it. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Issue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long alumnusId;
    @Column(nullable = false, length = 1000)
    private String message;
    @Column(length = 120)
    private String contact;     // phone or email, optional
    private java.time.Instant createdAt;
}
