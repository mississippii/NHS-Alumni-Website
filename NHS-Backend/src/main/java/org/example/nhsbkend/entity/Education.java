package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Education after SSC (HSC, diploma, degrees). SSC itself comes from the student's batch. */
@Entity
@Table(name = "education", indexes = @Index(name = "ix_education_alumnus", columnList = "alumnus_id"))
@Getter
@Setter
@NoArgsConstructor
public class Education {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "alumnus_id", foreignKey = @ForeignKey(name = "fk_education_alumnus"))
    private Alumnus alumnus;

    @Column(length = 40) private String level;          // HSC, Diploma, BSc, MSc …
    @Column(nullable = false, length = 120) private String institution;
    @Column(length = 120) private String subject;
    private Integer passingYear;

    public Education(Alumnus alumnus, String level, String institution, String subject, Integer passingYear) {
        this.alumnus = alumnus;
        this.level = level;
        this.institution = institution;
        this.subject = subject;
        this.passingYear = passingYear;
    }
}
