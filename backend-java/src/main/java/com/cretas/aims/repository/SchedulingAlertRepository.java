package com.cretas.aims.repository;

import com.cretas.aims.entity.SchedulingAlert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 调度告警 Repository
 */
@Repository
public interface SchedulingAlertRepository extends JpaRepository<SchedulingAlert, String> {

    List<SchedulingAlert> findByFactoryIdAndIsResolvedFalseOrderByCreatedAtDesc(String factoryId);

    Page<SchedulingAlert> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Optional<SchedulingAlert> findByIdAndFactoryId(String id, String factoryId);

    List<SchedulingAlert> findByScheduleId(String scheduleId);

    List<SchedulingAlert> findByPlanId(String planId);

    @Query("SELECT sa FROM SchedulingAlert sa WHERE sa.factoryId = :factoryId " +
           "AND sa.severity = :severity " +
           "AND sa.isResolved = false " +
           "ORDER BY sa.createdAt DESC")
    List<SchedulingAlert> findUnresolvedBySeverity(
        @Param("factoryId") String factoryId,
        @Param("severity") SchedulingAlert.Severity severity);

    @Query("SELECT sa FROM SchedulingAlert sa WHERE sa.factoryId = :factoryId " +
           "AND sa.alertType = :alertType " +
           "ORDER BY sa.createdAt DESC")
    Page<SchedulingAlert> findByFactoryIdAndAlertType(
        @Param("factoryId") String factoryId,
        @Param("alertType") SchedulingAlert.AlertType alertType,
        Pageable pageable);

    @Query("SELECT sa FROM SchedulingAlert sa WHERE sa.factoryId = :factoryId " +
           "AND sa.severity = :severity " +
           "ORDER BY sa.createdAt DESC")
    Page<SchedulingAlert> findByFactoryIdAndSeverity(
        @Param("factoryId") String factoryId,
        @Param("severity") SchedulingAlert.Severity severity,
        Pageable pageable);

    @Query("SELECT COUNT(sa) FROM SchedulingAlert sa WHERE sa.factoryId = :factoryId " +
           "AND sa.isResolved = false")
    long countUnresolvedByFactoryId(@Param("factoryId") String factoryId);

    @Query("SELECT COUNT(sa) FROM SchedulingAlert sa WHERE sa.factoryId = :factoryId " +
           "AND sa.severity = 'critical' AND sa.isResolved = false")
    long countCriticalUnresolvedByFactoryId(@Param("factoryId") String factoryId);
}
