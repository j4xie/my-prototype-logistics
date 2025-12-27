package com.cretas.aims.repository;

import com.cretas.aims.entity.WorkerAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 工人分配 Repository
 */
@Repository
public interface WorkerAssignmentRepository extends JpaRepository<WorkerAssignment, String> {

    List<WorkerAssignment> findByScheduleId(String scheduleId);

    List<WorkerAssignment> findByUserId(Long userId);

    Optional<WorkerAssignment> findByScheduleIdAndUserId(String scheduleId, Long userId);

    @Query("SELECT wa FROM WorkerAssignment wa " +
           "JOIN wa.schedule ls " +
           "JOIN ls.plan sp " +
           "WHERE wa.userId = :userId " +
           "AND sp.planDate = :date " +
           "ORDER BY ls.plannedStartTime")
    List<WorkerAssignment> findByUserIdAndDate(
        @Param("userId") Long userId,
        @Param("date") LocalDate date);

    @Query("SELECT wa FROM WorkerAssignment wa " +
           "JOIN wa.schedule ls " +
           "WHERE ls.plan.factoryId = :factoryId " +
           "AND wa.status = :status")
    List<WorkerAssignment> findByFactoryIdAndStatus(
        @Param("factoryId") String factoryId,
        @Param("status") WorkerAssignment.AssignmentStatus status);

    @Query("SELECT COUNT(wa) FROM WorkerAssignment wa WHERE wa.scheduleId = :scheduleId")
    long countByScheduleId(@Param("scheduleId") String scheduleId);

    @Query("SELECT COUNT(wa) FROM WorkerAssignment wa WHERE wa.scheduleId = :scheduleId " +
           "AND wa.status = 'checked_in'")
    long countCheckedInByScheduleId(@Param("scheduleId") String scheduleId);
}
