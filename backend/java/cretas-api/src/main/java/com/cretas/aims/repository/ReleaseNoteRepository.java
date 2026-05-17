package com.cretas.aims.repository;

import com.cretas.aims.entity.ReleaseNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface ReleaseNoteRepository extends JpaRepository<ReleaseNote, String> {

    /**
     * Active feed: not soft-deleted, not expired, published. Newest first.
     */
    @Query("SELECT r FROM ReleaseNote r " +
            "WHERE r.deletedAt IS NULL " +
            "AND r.publishedAt <= :today " +
            "AND (r.expiresAt IS NULL OR r.expiresAt >= :today) " +
            "ORDER BY r.publishedAt DESC, r.createdAt DESC")
    List<ReleaseNote> findActive(LocalDate today);
}
