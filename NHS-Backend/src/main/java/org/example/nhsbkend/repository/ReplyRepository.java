package org.example.nhsbkend.repository;

import org.example.nhsbkend.entity.Reply;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ReplyRepository extends JpaRepository<Reply, Long> {

    List<Reply> findByCommentIdInOrderByIdAsc(Collection<Long> commentIds);

    long countByCommentId(long commentId);

    void deleteByParentId(long parentId);
}
