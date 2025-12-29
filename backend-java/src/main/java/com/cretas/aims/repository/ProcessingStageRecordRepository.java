package com.cretas.aims.repository;

import com.cretas.aims.entity.ProcessingStageRecord;
import com.cretas.aims.entity.enums.ProcessingStageType;
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
 * 加工环节记录Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-23
 */
@Repository
public interface ProcessingStageRecordRepository extends JpaRepository<ProcessingStageRecord, Long> {

    /**
     * 根据工厂ID和生产批次ID查询所有环节记录
     */
    List<ProcessingStageRecord> findByFactoryIdAndProductionBatchIdOrderByStageOrderAsc(
            String factoryId, Long productionBatchId);

    /**
     * 根据生产批次ID查询所有环节记录
     */
    List<ProcessingStageRecord> findByProductionBatchIdOrderByStageOrderAsc(Long productionBatchId);

    /**
     * 根据工厂ID分页查询
     */
    Page<ProcessingStageRecord> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和环节类型查询
     */
    List<ProcessingStageRecord> findByFactoryIdAndStageType(String factoryId, ProcessingStageType stageType);

    /**
     * 根据时间范围查询
     */
    @Query("SELECT r FROM ProcessingStageRecord r WHERE r.factoryId = :factoryId " +
           "AND r.startTime >= :startTime AND r.startTime <= :endTime " +
           "ORDER BY r.startTime DESC")
    List<ProcessingStageRecord> findByFactoryIdAndTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 查询批次的某个环节类型的最新记录
     */
    Optional<ProcessingStageRecord> findTopByProductionBatchIdAndStageTypeOrderByStartTimeDesc(
            Long productionBatchId, ProcessingStageType stageType);

    /**
     * 统计批次的环节数量
     */
    long countByProductionBatchId(Long productionBatchId);

    /**
     * 查询某环节类型的平均损耗率 (用于对比分析)
     */
    @Query("SELECT AVG(r.lossRate) FROM ProcessingStageRecord r " +
           "WHERE r.factoryId = :factoryId AND r.stageType = :stageType " +
           "AND r.lossRate IS NOT NULL")
    Double findAverageLossRateByFactoryIdAndStageType(
            @Param("factoryId") String factoryId,
            @Param("stageType") ProcessingStageType stageType);

    /**
     * 查询某环节类型的平均合格率 (用于对比分析)
     */
    @Query("SELECT AVG(r.passRate) FROM ProcessingStageRecord r " +
           "WHERE r.factoryId = :factoryId AND r.stageType = :stageType " +
           "AND r.passRate IS NOT NULL")
    Double findAveragePassRateByFactoryIdAndStageType(
            @Param("factoryId") String factoryId,
            @Param("stageType") ProcessingStageType stageType);

    /**
     * 查询某环节类型的平均时长 (用于对比分析)
     */
    @Query("SELECT AVG(r.durationMinutes) FROM ProcessingStageRecord r " +
           "WHERE r.factoryId = :factoryId AND r.stageType = :stageType " +
           "AND r.durationMinutes IS NOT NULL")
    Double findAverageDurationByFactoryIdAndStageType(
            @Param("factoryId") String factoryId,
            @Param("stageType") ProcessingStageType stageType);

    /**
     * 删除批次的所有环节记录
     */
    void deleteByProductionBatchId(Long productionBatchId);
}
