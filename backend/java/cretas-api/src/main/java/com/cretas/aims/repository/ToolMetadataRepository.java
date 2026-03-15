package com.cretas.aims.repository;

import com.cretas.aims.entity.tool.ToolMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ToolMetadataRepository extends JpaRepository<ToolMetadata, Long> {

    Optional<ToolMetadata> findByToolName(String toolName);

    List<ToolMetadata> findByActionType(String actionType);

    List<ToolMetadata> findByRiskLevel(String riskLevel);

    List<ToolMetadata> findByDeprecationNoticeIsNotNull();

    /**
     * Find tools with no calls in the given period.
     */
    List<ToolMetadata> findByLastCalledAtBeforeOrLastCalledAtIsNull(LocalDateTime cutoff);

    /**
     * Increment call count and update last_called_at atomically.
     */
    @Modifying
    @Query("UPDATE ToolMetadata t SET t.callCount = t.callCount + 1, " +
           "t.lastCalledAt = :now, t.successCount = t.successCount + :success, " +
           "t.failureCount = t.failureCount + :failure " +
           "WHERE t.toolName = :toolName")
    int incrementCallCount(@Param("toolName") String toolName,
                           @Param("now") LocalDateTime now,
                           @Param("success") long success,
                           @Param("failure") long failure);
}
