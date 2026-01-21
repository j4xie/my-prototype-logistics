package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiAlertThreshold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 告警阈值 Repository
 *
 * 提供告警阈值的数据访问方法，支持：
 * - 按类型查询阈值
 * - 按指标代码查询阈值
 * - 支持工厂级别配置覆盖全局配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface SmartBiAlertThresholdRepository extends JpaRepository<SmartBiAlertThreshold, Long> {

    /**
     * 按阈值类型查找所有启用的阈值配置
     *
     * @param thresholdType 阈值类型（如 SALES, FINANCE, DEPARTMENT）
     * @return 该类型下所有启用的阈值配置列表
     */
    List<SmartBiAlertThreshold> findByThresholdTypeAndIsActiveTrue(String thresholdType);

    /**
     * 按指标代码查找所有启用的阈值配置
     *
     * @param metricCode 指标代码（如 SALES_AMOUNT, PROFIT_RATE）
     * @return 该指标的所有启用阈值配置列表
     */
    List<SmartBiAlertThreshold> findByMetricCodeAndIsActiveTrue(String metricCode);

    /**
     * 按阈值类型、指标代码和工厂ID精确查找
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @param factoryId     工厂ID（null 表示全局配置）
     * @return 匹配的阈值配置
     */
    Optional<SmartBiAlertThreshold> findByThresholdTypeAndMetricCodeAndFactoryId(
            String thresholdType, String metricCode, String factoryId);

    /**
     * 查找全局阈值配置（factoryId 为 null）
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @return 全局阈值配置
     */
    @Query("SELECT t FROM SmartBiAlertThreshold t WHERE t.thresholdType = :thresholdType " +
           "AND t.metricCode = :metricCode AND t.factoryId IS NULL AND t.isActive = true")
    Optional<SmartBiAlertThreshold> findGlobalThreshold(
            @Param("thresholdType") String thresholdType,
            @Param("metricCode") String metricCode);

    /**
     * 按类型和工厂ID查找（包括全局配置）
     * 工厂级别配置优先于全局配置
     *
     * @param thresholdType 阈值类型
     * @param factoryId     工厂ID
     * @return 阈值配置列表，按工厂ID降序排列（工厂配置优先）
     */
    @Query("SELECT t FROM SmartBiAlertThreshold t WHERE t.thresholdType = :thresholdType " +
           "AND t.isActive = true " +
           "AND (t.factoryId IS NULL OR t.factoryId = :factoryId) " +
           "ORDER BY CASE WHEN t.factoryId IS NULL THEN 1 ELSE 0 END, t.metricCode")
    List<SmartBiAlertThreshold> findByThresholdTypeAndFactoryId(
            @Param("thresholdType") String thresholdType,
            @Param("factoryId") String factoryId);

    /**
     * 查找特定工厂的阈值配置（优先工厂配置，其次全局配置）
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @param factoryId     工厂ID
     * @return 阈值配置（工厂配置优先）
     */
    @Query("SELECT t FROM SmartBiAlertThreshold t WHERE t.thresholdType = :thresholdType " +
           "AND t.metricCode = :metricCode AND t.isActive = true " +
           "AND (t.factoryId = :factoryId OR t.factoryId IS NULL) " +
           "ORDER BY CASE WHEN t.factoryId IS NULL THEN 1 ELSE 0 END")
    List<SmartBiAlertThreshold> findThresholdWithFallback(
            @Param("thresholdType") String thresholdType,
            @Param("metricCode") String metricCode,
            @Param("factoryId") String factoryId);

    /**
     * 获取所有阈值类型
     *
     * @return 所有启用的阈值类型列表
     */
    @Query("SELECT DISTINCT t.thresholdType FROM SmartBiAlertThreshold t WHERE t.isActive = true")
    List<String> findAllThresholdTypes();

    /**
     * 获取指定类型下的所有指标代码
     *
     * @param thresholdType 阈值类型
     * @return 该类型下所有启用的指标代码列表
     */
    @Query("SELECT DISTINCT t.metricCode FROM SmartBiAlertThreshold t " +
           "WHERE t.thresholdType = :thresholdType AND t.isActive = true")
    List<String> findMetricCodesByType(@Param("thresholdType") String thresholdType);

    /**
     * 检查阈值配置是否存在
     *
     * @param thresholdType 阈值类型
     * @param metricCode    指标代码
     * @param factoryId     工厂ID
     * @return true 如果存在
     */
    boolean existsByThresholdTypeAndMetricCodeAndFactoryId(
            String thresholdType, String metricCode, String factoryId);

    /**
     * 统计指定类型的阈值配置数量
     *
     * @param thresholdType 阈值类型
     * @return 配置数量
     */
    long countByThresholdTypeAndIsActiveTrue(String thresholdType);
}
