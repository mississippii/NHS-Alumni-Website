package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Issue;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IssueRepository extends JpaRepository<Issue, Long> {

    List<Issue> findAllByOrderByIdAsc();

    long countByAlumnusId(long alumnusId);
}
