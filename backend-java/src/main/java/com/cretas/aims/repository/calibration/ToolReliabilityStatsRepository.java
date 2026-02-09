package com.cretas.aims.repository.calibration;

import com.cretas.aims.entity.calibration.ToolReliabilityStats;
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
 * 工具可靠性统计仓库接口
 */
@Repository
public interface ToolReliabilityStatsRepository extends JpaRepository<ToolReliabilityStats, Long> {

    /**
     * 根据工厂ID、工具名和日期查询
     */
    Optional<ToolReliabilityStats> findByFactoryIdAndToolNameAndStatDate(
        String factoryId, String toolName, LocalDate statDate);

    /**
     * 按成功率排序查询指定日期的所有工具统计
     */
    List<ToolReliabilityStats> findByFactoryIdAndStatDateOrderBySuccessRateDesc(
        String factoryId, LocalDate statDate);

    /**
     * 查询全平台工具统计
     */
    List<ToolReliabilityStats> findByFactoryIdIsNullAndStatDateOrderBySuccessRateDesc(LocalDate statDate);

    /**
     * 查询指定工具的历史统计
     */
    List<ToolReliabilityStats> findByFactoryIdAndToolNameAndStatDateBetweenOrderByStatDateAsc(
        String factoryId, String toolName, LocalDate startDate, LocalDate endDate);

    /**
     * 查询成功率低于阈值的工具
     */
    @Query("SELECT t FROM ToolReliabilityStats t WHERE t.factoryId = :factoryId AND t.statDate = :statDate AND t.successRate < :threshold ORDER BY t.successRate ASC")
    List<ToolReliabilityStats> findLowReliabilityTools(
        @Param("factoryId") String factoryId,
        @Param("statDate") LocalDate statDate,
        @Param("threshold") java.math.BigDecimal threshold);

    /**
     * 按总调用数排序查询热门工具
     */
    List<ToolReliabilityStats> findByFactoryIdAndStatDateOrderByTotalCallsDesc(
        String factoryId, LocalDate statDate);

    /**
     * 按平均执行时间排序查询慢工具
     */
    @Query("SELECT t FROM ToolReliabilityStats t WHERE t.factoryId = :factoryId AND t.statDate = :statDate AND t.avgExecutionTimeMs IS NOT NULL ORDER BY t.avgExecutionTimeMs DESC")
    List<ToolReliabilityStats> findSlowestTools(
        @Param("factoryId") String factoryId,
        @Param("statDate") LocalDate statDate);

    /**
     * 分页查询
     */
    Page<ToolReliabilityStats> findByFactoryIdAndStatDateOrderByTotalCallsDesc(
        String factoryId, LocalDate statDate, Pageable pageable);

    /**
     * 查询指定日期所有工厂的工具统计
     */
    List<ToolReliabilityStats> findByStatDate(LocalDate statDate);
}
