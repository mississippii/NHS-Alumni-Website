package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Counter;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface CounterRepository extends JpaRepository<Counter, String> {

    /** Adds one in the database itself, so two visits at the same moment both count. 0 = no such counter yet. */
    @Modifying
    @Query("update Counter c set c.total = c.total + 1 where c.name = ?1")
    int bump(String name);
}
