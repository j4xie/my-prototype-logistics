package com.cretas.aims.repository;

import com.cretas.aims.entity.LineSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 产线排程 Repository
 */
@Repository
public interface LineScheduleRepository extends JpaRepository<LineSchedule, String> {

    List<LineSchedule> findByPlanId(String planId);

    List<LineSchedule> findByPlanIdOrderBySequenceOrder(String planId);

    Optional<LineSchedule> findByIdAndPlanId(String id, String planId);

    List<LineSchedule> findByProductionLineIdAndStatus(
        String productionLineId, LineSchedule.ScheduleStatus status);

    @Query("SELECT ls FROM LineSchedule ls WHERE ls.plan.factoryId = :factoryId " +
           "AND ls.status = :status ORDER BY ls.plannedStartTime")
    List<LineSchedule> findByFactoryIdAndStatus(
        @Param("factoryId") String factoryId,
        @Param("status") LineSchedule.ScheduleStatus status);

    @Query("SELECT ls FROM LineSchedule ls WHERE ls.productionLineId = :lineId " +
           "AND ls.plannedStartTime BETWEEN :start AND :end " +
           "ORDER BY ls.plannedStartTime")
    List<LineSchedule> findByProductionLineAndTimeRange(
        @Param("lineId") String lineId,
        @Param("start") LocalDateTime start,
        @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(ls) FROM LineSchedule ls WHERE ls.planId = :planId " +
           "AND ls.status = :status")
    long countByPlanIdAndStatus(
        @Param("planId") String planId,
        @Param("status") LineSchedule.ScheduleStatus status);

    @Query("SELECT ls FROM LineSchedule ls WHERE ls.plan.factoryId = :factoryId " +
           "AND ls.status = 'delayed' ORDER BY ls.plannedEndTime")
    List<LineSchedule> findDelayedSchedules(@Param("factoryId") String factoryId);

    @Query("SELECT ls FROM LineSchedule ls WHERE ls.plan.factoryId = :factoryId " +
           "AND ls.status = 'in_progress' ORDER BY ls.plannedEndTime")
    List<LineSchedule> findInProgressSchedules(@Param("factoryId") String factoryId);

    /**
     * 按状态查询所有排程（用于定时任务延期检测）
     */
    List<LineSchedule> findByStatus(LineSchedule.ScheduleStatus status);
}
