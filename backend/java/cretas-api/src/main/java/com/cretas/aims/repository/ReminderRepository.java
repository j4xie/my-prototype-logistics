package com.cretas.aims.repository;

import com.cretas.aims.entity.Reminder;
import com.cretas.aims.entity.enums.ReminderStatus;
import com.cretas.aims.entity.enums.ReminderType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Sprint 4 W2 S-REMIND-1 — Reminder 仓储.
 */
@Repository
public interface ReminderRepository extends JpaRepository<Reminder, String> {

    Optional<Reminder> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    /** 我的提醒 list view 主查询: 按状态过滤 + 按 dueDate 排序. */
    Page<Reminder> findByFactoryIdAndAssigneeIdAndStatusInAndDeletedAtIsNull(
            String factoryId, Long assigneeId, List<ReminderStatus> statuses, Pageable pageable);

    /** Bell badge 计数: 仅 PENDING. */
    long countByFactoryIdAndAssigneeIdAndStatusAndDeletedAtIsNull(
            String factoryId, Long assigneeId, ReminderStatus status);

    /** Scanner 幂等保证: 同 source 已有未 DISMISSED 提醒则跳过. */
    Optional<Reminder> findFirstByFactoryIdAndTypeAndSourceTypeAndSourceIdAndStatusInAndDeletedAtIsNull(
            String factoryId, ReminderType type, String sourceType, String sourceId,
            List<ReminderStatus> statuses);

    /** Scanner: SNOOZED 到期回流 PENDING. */
    @Modifying
    @Query("UPDATE Reminder r SET r.status = 'PENDING', r.snoozedUntil = NULL " +
            "WHERE r.status = 'SNOOZED' AND r.snoozedUntil <= :today AND r.deletedAt IS NULL")
    int reactivateExpiredSnoozes(@Param("today") LocalDate today);
}
