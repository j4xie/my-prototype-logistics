package com.cretas.aims.repository;

import com.cretas.aims.entity.WorkOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 工单数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, String> {

    /**
     * 根据工厂ID分页查询工单
     */
    Page<WorkOrder> findByFactoryIdAndDeletedAtIsNull(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态分页查询
     */
    Page<WorkOrder> findByFactoryIdAndStatusAndDeletedAtIsNull(
            String factoryId, String status, Pageable pageable);

    /**
     * 根据ID和工厂ID查询
     */
    Optional<WorkOrder> findByIdAndFactoryIdAndDeletedAtIsNull(String id, String factoryId);

    /**
     * 根据工单编号查询
     */
    Optional<WorkOrder> findByOrderNumberAndDeletedAtIsNull(String orderNumber);

    /**
     * 根据生产批次ID查询关联工单
     */
    List<WorkOrder> findByProductionBatchIdAndDeletedAtIsNull(Long productionBatchId);

    /**
     * 根据分配用户查询工单
     */
    Page<WorkOrder> findByFactoryIdAndAssignedToAndDeletedAtIsNull(
            String factoryId, Long assignedTo, Pageable pageable);

    /**
     * 根据部门查询工单
     */
    Page<WorkOrder> findByFactoryIdAndDepartmentIdAndDeletedAtIsNull(
            String factoryId, String departmentId, Pageable pageable);

    /**
     * 统计工厂工单数量
     */
    long countByFactoryIdAndDeletedAtIsNull(String factoryId);

    /**
     * 统计特定状态的工单数量
     */
    long countByFactoryIdAndStatusAndDeletedAtIsNull(String factoryId, String status);

    /**
     * 查询计划时间范围内的工单
     */
    @Query("SELECT w FROM WorkOrder w WHERE w.factoryId = :factoryId " +
           "AND w.plannedStartTime >= :startTime AND w.plannedEndTime <= :endTime " +
           "AND w.deletedAt IS NULL ORDER BY w.plannedStartTime")
    List<WorkOrder> findByPlannedTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 查询逾期未完成的工单
     */
    @Query("SELECT w FROM WorkOrder w WHERE w.factoryId = :factoryId " +
           "AND w.status NOT IN ('COMPLETED', 'CANCELLED') " +
           "AND w.plannedEndTime < :now AND w.deletedAt IS NULL")
    List<WorkOrder> findOverdueWorkOrders(
            @Param("factoryId") String factoryId,
            @Param("now") LocalDateTime now);
}
