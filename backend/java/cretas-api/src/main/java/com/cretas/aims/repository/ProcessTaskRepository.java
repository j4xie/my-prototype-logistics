package com.cretas.aims.repository;

import com.cretas.aims.entity.ProcessTask;
import com.cretas.aims.entity.enums.ProcessTaskStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessTaskRepository extends JpaRepository<ProcessTask, String> {

    Optional<ProcessTask> findByFactoryIdAndId(String factoryId, String id);

    /** Active tasks: PENDING, IN_PROGRESS, SUPPLEMENTING */
    @Query("SELECT t FROM ProcessTask t WHERE t.factoryId = :factoryId " +
           "AND t.status IN ('PENDING', 'IN_PROGRESS', 'SUPPLEMENTING') " +
           "ORDER BY t.startDate ASC, t.createdAt ASC")
    List<ProcessTask> findActiveTasks(@Param("factoryId") String factoryId);

    Page<ProcessTask> findByFactoryId(String factoryId, Pageable pageable);

    Page<ProcessTask> findByFactoryIdAndStatus(String factoryId, ProcessTaskStatus status, Pageable pageable);

    Page<ProcessTask> findByFactoryIdAndProductTypeId(String factoryId, String productTypeId, Pageable pageable);

    Page<ProcessTask> findByFactoryIdAndStatusAndProductTypeId(
            String factoryId, ProcessTaskStatus status, String productTypeId, Pageable pageable);

    List<ProcessTask> findByFactoryIdAndProductionRunId(String factoryId, String productionRunId);

    @Query("SELECT t FROM ProcessTask t WHERE t.factoryId = :factoryId " +
           "AND t.status IN ('PENDING', 'IN_PROGRESS', 'SUPPLEMENTING')")
    List<ProcessTask> findActiveTasksForCalibration(@Param("factoryId") String factoryId);

    /** Atomic increment of pendingQuantity — avoids read-modify-write race condition */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE process_tasks SET pending_quantity = pending_quantity + :delta, " +
           "version = version + 1 WHERE id = :taskId", nativeQuery = true)
    int atomicAddPendingQuantity(@Param("taskId") String taskId, @Param("delta") BigDecimal delta);

    /** Atomic decrement of pendingQuantity and increment of completedQuantity */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE process_tasks SET " +
           "completed_quantity = completed_quantity + :qty, " +
           "pending_quantity = GREATEST(pending_quantity - :qty, 0), " +
           "version = version + 1 WHERE id = :taskId", nativeQuery = true)
    int atomicApproveQuantity(@Param("taskId") String taskId, @Param("qty") BigDecimal qty);
}
