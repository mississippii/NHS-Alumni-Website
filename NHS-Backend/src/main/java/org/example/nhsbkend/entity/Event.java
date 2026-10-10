package org.example.nhsbkend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/** A reunion or alumni event. Shown on the website from its date until the day after. */
@Entity
@Table(indexes = @Index(name = "ix_event_date", columnList = "eventDate"))
@Getter
@Setter
@NoArgsConstructor
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate eventDate;
    @Column(length = 30)
    private String eventTime;   // free text, e.g. "4:00 PM"
    @Column(nullable = false, length = 150)
    private String title;
    @Column(length = 150)
    private String place;
    @Column(length = 2000)
    private String details;
}
