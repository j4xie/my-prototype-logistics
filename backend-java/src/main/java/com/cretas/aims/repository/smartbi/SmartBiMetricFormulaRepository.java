package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiMetricFormula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 指标公式配置 Repository
 *
 * 提供指标公式的数据访问接口，支持：
 * - 按指标代码查询
 * - 按公式类型查询
 * - 工厂级配置覆盖全局配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface SmartBiMetricFormulaRepository extends JpaRepository<SmartBiMetricFormula, Long> {

    /**
     * 按指标代码查找启用的全局配置
     *
     * @param metricCode 指标代码
     * @return 指标公式配置
     */
    Optional<SmartBiMetricFormula> findByMetricCodeAndIsActiveTrue(String metricCode);

    /**
     * 按指标代码和工厂ID查找配置
     * 优先返回工厂级配置，其次返回全局配置
     *
     * @param metricCode 指标代码
     * @param factoryId  工厂ID
     * @return 指标公式配置
     */
    @Query("SELECT m FROM SmartBiMetricFormula m WHERE m.metricCode = :metricCode " +
           "AND m.isActive = true " +
           "AND (m.factoryId = :factoryId OR m.factoryId IS NULL) " +
           "ORDER BY CASE WHEN m.factoryId IS NOT NULL THEN 0 ELSE 1 END")
    List<SmartBiMetricFormula> findByMetricCodeAndFactoryIdWithFallback(
            @Param("metricCode") String metricCode,
            @Param("factoryId") String factoryId);

    /**
     * 按指标代码和工厂ID精确查找
     *
     * @param metricCode 指标代码
     * @param factoryId  工厂ID
     * @return 指标公式配置
     */
    Optional<SmartBiMetricFormula> findByMetricCodeAndFactoryId(String metricCode, String factoryId);

    /**
     * 按公式类型查找所有启用的配置
     *
     * @param formulaType 公式类型（SIMPLE/DERIVED/CUSTOM）
     * @return 指标公式配置列表
     */
    List<SmartBiMetricFormula> findByFormulaTypeAndIsActiveTrue(String formulaType);

    /**
     * 获取所有启用的指标公式配置，按代码排序
     *
     * @return 指标公式配置列表
     */
    List<SmartBiMetricFormula> findByIsActiveTrueOrderByMetricCodeAsc();

    /**
     * 按工厂ID查找所有启用的配置
     *
     * @param factoryId 工厂ID
     * @return 指标公式配置列表
     */
    List<SmartBiMetricFormula> findByFactoryIdAndIsActiveTrueOrderByMetricCodeAsc(String factoryId);

    /**
     * 查找全局配置（无工厂ID）
     *
     * @return 全局指标公式配置列表
     */
    @Query("SELECT m FROM SmartBiMetricFormula m WHERE m.factoryId IS NULL " +
           "AND m.isActive = true ORDER BY m.metricCode ASC")
    List<SmartBiMetricFormula> findGlobalFormulas();

    /**
     * 查找指定工厂的有效配置（包含全局和工厂级）
     *
     * @param factoryId 工厂ID
     * @return 指标公式配置列表
     */
    @Query("SELECT m FROM SmartBiMetricFormula m WHERE m.isActive = true " +
           "AND (m.factoryId IS NULL OR m.factoryId = :factoryId) " +
           "ORDER BY m.metricCode ASC, " +
           "CASE WHEN m.factoryId IS NOT NULL THEN 0 ELSE 1 END")
    List<SmartBiMetricFormula> findEffectiveFormulasForFactory(@Param("factoryId") String factoryId);

    /**
     * 检查指标代码是否存在
     *
     * @param metricCode 指标代码
     * @return 是否存在
     */
    boolean existsByMetricCodeAndIsActiveTrue(String metricCode);

    /**
     * 按聚合方式查找
     *
     * @param aggregation 聚合方式
     * @return 指标公式配置列表
     */
    List<SmartBiMetricFormula> findByAggregationAndIsActiveTrue(String aggregation);

    /**
     * 统计各公式类型的数量
     *
     * @param formulaType 公式类型
     * @return 数量
     */
    long countByFormulaTypeAndIsActiveTrue(String formulaType);

    /**
     * 获取所有不同的指标代码
     *
     * @return 指标代码列表
     */
    @Query("SELECT DISTINCT m.metricCode FROM SmartBiMetricFormula m WHERE m.isActive = true")
    List<String> findAllMetricCodes();
}
