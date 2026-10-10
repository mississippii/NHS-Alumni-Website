package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A past job. The current job is kept on the student (title / organization / industry). endYear null = still there. */
@Entity
@Table(name = "job", indexes = @Index(name = "ix_job_alumnus", columnList = "alumnus_id"))
@Getter
@Setter
@NoArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "alumnus_id", foreignKey = @ForeignKey(name = "fk_job_alumnus"))
    private Alumnus alumnus;

    @Column(nullable = false, length = 120) private String title;
    @Column(length = 120) private String organization;
    private Integer startYear;
    private Integer endYear;

    public Job(Alumnus alumnus, String title, String organization, Integer startYear, Integer endYear) {
        this.alumnus = alumnus;
        this.title = title;
        this.organization = organization;
        this.startYear = startYear;
        this.endYear = endYear;
    }
}
