package org.example.nhsbkend.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A named running total. "visits": one per browser per day, shown as a bare number in the footer. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Counter {

    @Id
    private String name;
    private long total;

    public Counter(String name, long total) {
        this.name = name;
        this.total = total;
    }
}
