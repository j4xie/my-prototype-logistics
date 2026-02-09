package com.cretas.aims.repository.calibration;

import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 行为校准指标仓库接口
 */
@Repository
public interface BehaviorCalibrationMetricsRepository extends JpaRepository<BehaviorCalibrationMetrics, Long> {

    /**
     * 根据工厂ID、日期和周期类型查询
     */
    Optional<BehaviorCalibrationMetrics> findByFactoryIdAndMetricDateAndPeriodType(
        String factoryId, LocalDate metricDate, PeriodType periodType);

    /**
     * 根据工厂ID和日期范围查询
     */
    List<BehaviorCalibrationMetrics> findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
        String factoryId, LocalDate startDate, LocalDate endDate, PeriodType periodType);

    /**
     * 查询全平台指标（factoryId为null）
     */
    List<BehaviorCalibrationMetrics> findByFactoryIdIsNullAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
        LocalDate startDate, LocalDate endDate, PeriodType periodType);

    /**
     * 查询最新的日指标
     */
    Optional<BehaviorCalibrationMetrics> findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
        String factoryId, PeriodType periodType);

    /**
     * 按综合得分排序查询工厂指标
     */
    @Query("SELECT m FROM BehaviorCalibrationMetrics m WHERE m.metricDate = :date AND m.periodType = :periodType AND m.factoryId IS NOT NULL ORDER BY m.compositeScore DESC")
    List<BehaviorCalibrationMetrics> findFactoryMetricsRankedByCompositeScore(
        @Param("date") LocalDate date,
        @Param("periodType") PeriodType periodType);

    /**
     * 计算日期范围内的平均综合得分
     */
    @Query("SELECT AVG(m.compositeScore) FROM BehaviorCalibrationMetrics m WHERE m.factoryId = :factoryId AND m.metricDate BETWEEN :startDate AND :endDate AND m.periodType = :periodType")
    Double avgCompositeScoreByFactoryIdAndDateRange(
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        @Param("periodType") PeriodType periodType);

    /**
     * 分页查询指定工厂的历史指标
     */
    Page<BehaviorCalibrationMetrics> findByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
        String factoryId, PeriodType periodType, Pageable pageable);

    /**
     * 查询指定日期所有工厂的指标
     */
    List<BehaviorCalibrationMetrics> findByMetricDateAndPeriodType(LocalDate metricDate, PeriodType periodType);
}
