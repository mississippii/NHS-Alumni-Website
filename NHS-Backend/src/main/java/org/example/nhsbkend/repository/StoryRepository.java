package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Story;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoryRepository extends JpaRepository<Story, Long> {

    List<Story> findByStatusOrderByPublishedDescIdDesc(Story.Status status, Pageable page);

    /** Admin: waiting ones first, then newest first. */
    List<Story> findAllByOrderByStatusAscPublishedDescIdDesc();

    long countByStatus(Story.Status status);
}
