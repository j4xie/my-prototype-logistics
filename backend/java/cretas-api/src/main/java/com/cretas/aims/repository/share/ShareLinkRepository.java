package com.cretas.aims.repository.share;

import com.cretas.aims.entity.share.ShareLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Share-link persistence (PR #872 follow-up to #860).
 *
 * <p>Token is the PK so {@link #findById} also works; the named
 * {@code findByToken} variant is exposed for readability at call sites.
 */
@Repository
public interface ShareLinkRepository extends JpaRepository<ShareLink, String> {

    Optional<ShareLink> findByToken(String token);

    /**
     * Increment view counter + record last-viewed timestamp. Bulk update via
     * JPQL — no entity hydration required for the public read path. Returns
     * the row-count (1 if the token still exists, 0 if it was removed mid-read).
     */
    @Modifying
    @Query("UPDATE ShareLink s SET s.viewCount = s.viewCount + 1, s.lastViewedAt = :now WHERE s.token = :token")
    int recordView(@Param("token") String token, @Param("now") LocalDateTime now);
}
