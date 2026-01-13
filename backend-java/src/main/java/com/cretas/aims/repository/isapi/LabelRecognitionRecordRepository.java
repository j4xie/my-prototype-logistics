package com.cretas.aims.repository.isapi;

import com.cretas.aims.entity.isapi.LabelRecognitionRecord;
import com.cretas.aims.entity.isapi.LabelRecognitionRecord.RecognitionStatus;
import com.cretas.aims.entity.isapi.LabelRecognitionRecord.TriggerType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 标签识别记录 Repository
 *
 * @author Cretas Team
 * @since 2026-01-13
 */
@Repository
public interface LabelRecognitionRecordRepository extends JpaRepository<LabelRecognitionRecord, Long> {

    // ==================== 基础查询 ====================

    /**
     * 根据工厂ID按识别时间倒序查询
     */
    List<LabelRecognitionRecord> findByFactoryIdOrderByRecognitionTimeDesc(String factoryId);

    /**
     * 根据工厂ID分页查询（按识别时间倒序）
     */
    Page<LabelRecognitionRecord> findByFactoryIdOrderByRecognitionTimeDesc(String factoryId, Pageable pageable);

    /**
     * 根据配置ID查询
     */
    List<LabelRecognitionRecord> findByConfigIdOrderByRecognitionTimeDesc(Long configId);

    /**
     * 根据配置ID分页查询
     */
    Page<LabelRecognitionRecord> findByConfigIdOrderByRecognitionTimeDesc(Long configId, Pageable pageable);

    /**
     * 根据设备ID查询
     */
    List<LabelRecognitionRecord> findByDeviceIdOrderByRecognitionTimeDesc(String deviceId);

    // ==================== 状态相关查询 ====================

    /**
     * 根据工厂ID和状态查询
     */
    List<LabelRecognitionRecord> findByFactoryIdAndStatus(String factoryId, RecognitionStatus status);

    /**
     * 根据工厂ID和状态分页查询
     */
    Page<LabelRecognitionRecord> findByFactoryIdAndStatusOrderByRecognitionTimeDesc(
            String factoryId, RecognitionStatus status, Pageable pageable);

    /**
     * 查询需要告警的记录（识别失败或批次不匹配）
     */
    @Query("SELECT r FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND (r.status = 'FAILED' OR r.batchMatch = false OR r.printQuality IN ('POOR', 'UNREADABLE')) " +
            "ORDER BY r.recognitionTime DESC")
    List<LabelRecognitionRecord> findAlertRecords(@Param("factoryId") String factoryId);

    // ==================== 时间范围查询 ====================

    /**
     * 根据工厂ID和时间范围查询
     */
    @Query("SELECT r FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime " +
            "ORDER BY r.recognitionTime DESC")
    List<LabelRecognitionRecord> findByFactoryIdAndTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 根据工厂ID和时间范围分页查询
     */
    @Query("SELECT r FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime " +
            "ORDER BY r.recognitionTime DESC")
    Page<LabelRecognitionRecord> findByFactoryIdAndTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    // ==================== 统计查询 ====================

    /**
     * 统计工厂在指定时间范围内的记录数
     */
    @Query("SELECT COUNT(r) FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime")
    long countByFactoryIdAndTimeBetween(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 统计工厂在指定时间范围内指定状态的记录数
     */
    @Query("SELECT COUNT(r) FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.status = :status " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime")
    long countByFactoryIdAndStatusAndRecognitionTimeBetween(
            @Param("factoryId") String factoryId,
            @Param("status") RecognitionStatus status,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 统计各状态的记录数量
     */
    @Query("SELECT r.status, COUNT(r) FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime " +
            "GROUP BY r.status")
    List<Object[]> countByStatusInTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 统计各触发类型的记录数量
     */
    @Query("SELECT r.triggerType, COUNT(r) FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime " +
            "GROUP BY r.triggerType")
    List<Object[]> countByTriggerTypeInTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 统计批次匹配情况
     */
    @Query("SELECT r.batchMatch, COUNT(r) FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime " +
            "AND r.batchMatch IS NOT NULL " +
            "GROUP BY r.batchMatch")
    List<Object[]> countByBatchMatchInTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 获取平均处理时间
     */
    @Query("SELECT AVG(r.processingDurationMs) FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "AND r.recognitionTime BETWEEN :startTime AND :endTime " +
            "AND r.processingDurationMs IS NOT NULL")
    Double getAverageProcessingTime(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    // ==================== 批次号相关查询 ====================

    /**
     * 根据批次号查询
     */
    List<LabelRecognitionRecord> findByRecognizedBatchNumberOrderByRecognitionTimeDesc(String batchNumber);

    /**
     * 根据工厂ID和批次号查询
     */
    List<LabelRecognitionRecord> findByFactoryIdAndRecognizedBatchNumberOrderByRecognitionTimeDesc(
            String factoryId, String batchNumber);

    // ==================== 最近记录查询 ====================

    /**
     * 获取最近N条记录
     */
    @Query("SELECT r FROM LabelRecognitionRecord r WHERE r.factoryId = :factoryId " +
            "ORDER BY r.recognitionTime DESC")
    List<LabelRecognitionRecord> findRecentRecords(@Param("factoryId") String factoryId, Pageable pageable);

    /**
     * 获取配置的最近一条记录
     */
    @Query("SELECT r FROM LabelRecognitionRecord r WHERE r.configId = :configId " +
            "ORDER BY r.recognitionTime DESC")
    List<LabelRecognitionRecord> findLatestByConfigId(@Param("configId") Long configId, Pageable pageable);
}
