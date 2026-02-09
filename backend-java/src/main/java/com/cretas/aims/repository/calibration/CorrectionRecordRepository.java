package com.cretas.aims.repository.calibration;

import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 纠错记录仓库接口
 */
@Repository
public interface CorrectionRecordRepository extends JpaRepository<CorrectionRecord, Long> {

    /**
     * 根据工具调用ID查询
     */
    List<CorrectionRecord> findByToolCallIdOrderByCreatedAtDesc(Long toolCallId);

    /**
     * 根据会话ID查询
     */
    List<CorrectionRecord> findBySessionIdOrderByCreatedAtDesc(String sessionId);

    /**
     * 根据错误分类查询
     */
    Page<CorrectionRecord> findByErrorCategory(ErrorCategory errorCategory, Pageable pageable);

    /**
     * 根据纠错策略查询
     */
    Page<CorrectionRecord> findByCorrectionStrategy(CorrectionStrategy correctionStrategy, Pageable pageable);

    /**
     * 查询成功的纠错记录
     */
    Page<CorrectionRecord> findByCorrectionSuccessTrue(Pageable pageable);

    /**
     * 查询失败的纠错记录
     */
    Page<CorrectionRecord> findByCorrectionSuccessFalse(Pageable pageable);

    /**
     * 按工厂ID和时间范围查询
     */
    List<CorrectionRecord> findByFactoryIdAndCreatedAtBetween(
        String factoryId, LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 统计时间范围内的纠错总数
     */
    @Query("SELECT COUNT(c) FROM CorrectionRecord c WHERE c.factoryId = :factoryId AND c.createdAt BETWEEN :startTime AND :endTime")
    Long countByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 统计成功纠错数
     */
    @Query("SELECT COUNT(c) FROM CorrectionRecord c WHERE c.factoryId = :factoryId AND c.correctionSuccess = true AND c.createdAt BETWEEN :startTime AND :endTime")
    Long countSuccessfulByFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 按错误分类统计
     */
    @Query("SELECT c.errorCategory, COUNT(c) FROM CorrectionRecord c WHERE c.factoryId = :factoryId AND c.createdAt BETWEEN :startTime AND :endTime GROUP BY c.errorCategory")
    List<Object[]> countByErrorCategoryAndFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 按纠错策略统计
     */
    @Query("SELECT c.correctionStrategy, COUNT(c) FROM CorrectionRecord c WHERE c.factoryId = :factoryId AND c.createdAt BETWEEN :startTime AND :endTime GROUP BY c.correctionStrategy")
    List<Object[]> countByCorrectionStrategyAndFactoryIdAndTimeRange(
        @Param("factoryId") String factoryId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime);

    /**
     * 查询高轮次纠错（超过2轮）
     */
    @Query("SELECT c FROM CorrectionRecord c WHERE c.correctionRounds > :minRounds ORDER BY c.correctionRounds DESC")
    List<CorrectionRecord> findHighRoundCorrections(@Param("minRounds") int minRounds);
}
