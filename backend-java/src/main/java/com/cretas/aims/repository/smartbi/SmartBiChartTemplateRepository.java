package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SmartBI 图表模板配置 Repository
 *
 * 提供图表模板的数据访问接口，支持：
 * - 按模板代码查询
 * - 按图表类型查询
 * - 按分类查询
 * - 工厂级配置覆盖全局配置
 * - 按适用指标查询（JSON 字段）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface SmartBiChartTemplateRepository extends JpaRepository<SmartBiChartTemplate, Long> {

    /**
     * 获取所有启用的图表模板，按排序顺序排列
     *
     * @return 图表模板列表
     */
    List<SmartBiChartTemplate> findByIsActiveTrueOrderBySortOrder();

    /**
     * 按分类查找所有启用的模板
     *
     * @param category 模板分类（GENERAL/FINANCE/SALES/INVENTORY/PRODUCTION/QUALITY）
     * @return 图表模板列表
     */
    List<SmartBiChartTemplate> findByCategoryAndIsActiveTrueOrderBySortOrder(String category);

    /**
     * 按图表类型查找所有启用的模板
     *
     * @param chartType 图表类型（LINE/BAR/PIE/RADAR 等）
     * @return 图表模板列表
     */
    List<SmartBiChartTemplate> findByChartTypeAndIsActiveTrueOrderBySortOrder(String chartType);

    /**
     * 按模板代码查找全局模板（无工厂ID）
     *
     * @param templateCode 模板代码
     * @return 图表模板
     */
    Optional<SmartBiChartTemplate> findByTemplateCodeAndFactoryIdIsNull(String templateCode);

    /**
     * 按模板代码和工厂ID精确查找
     *
     * @param templateCode 模板代码
     * @param factoryId    工厂ID
     * @return 图表模板
     */
    Optional<SmartBiChartTemplate> findByTemplateCodeAndFactoryId(String templateCode, String factoryId);

    /**
     * 查找指定工厂的有效模板（包含全局和工厂级）
     * 工厂级模板优先于全局模板
     *
     * @param factoryId 工厂ID
     * @return 图表模板列表
     */
    @Query("SELECT t FROM SmartBiChartTemplate t WHERE t.isActive = true " +
           "AND (t.factoryId IS NULL OR t.factoryId = :factoryId) " +
           "ORDER BY t.sortOrder ASC, " +
           "CASE WHEN t.factoryId IS NOT NULL THEN 0 ELSE 1 END")
    List<SmartBiChartTemplate> findAllWithFactoryOverride(@Param("factoryId") String factoryId);

    /**
     * 按适用指标代码查找模板（PostgreSQL 兼容）
     * 使用 JSONB 包含操作符检查 applicable_metrics 数组是否包含指定指标代码
     *
     * @param metricCode 指标代码
     * @return 图表模板列表
     */
    @Query(value = "SELECT * FROM smart_bi_chart_templates t " +
                   "WHERE t.is_active = true " +
                   "AND t.deleted_at IS NULL " +
                   "AND t.applicable_metrics::jsonb @> to_jsonb(:metricCode::text) " +
                   "ORDER BY t.sort_order ASC",
           nativeQuery = true)
    List<SmartBiChartTemplate> findByApplicableMetricContaining(@Param("metricCode") String metricCode);

    /**
     * 统计指定分类的启用模板数量
     *
     * @param category 模板分类
     * @return 数量
     */
    long countByCategoryAndIsActiveTrue(String category);

    /**
     * 按模板代码查找启用的模板（优先工厂级，其次全局）
     *
     * @param templateCode 模板代码
     * @param factoryId    工厂ID
     * @return 图表模板列表
     */
    @Query("SELECT t FROM SmartBiChartTemplate t WHERE t.templateCode = :templateCode " +
           "AND t.isActive = true " +
           "AND (t.factoryId = :factoryId OR t.factoryId IS NULL) " +
           "ORDER BY CASE WHEN t.factoryId IS NOT NULL THEN 0 ELSE 1 END")
    List<SmartBiChartTemplate> findByTemplateCodeWithFactoryFallback(
            @Param("templateCode") String templateCode,
            @Param("factoryId") String factoryId);

    /**
     * 查找全局模板（无工厂ID）
     *
     * @return 全局图表模板列表
     */
    @Query("SELECT t FROM SmartBiChartTemplate t WHERE t.factoryId IS NULL " +
           "AND t.isActive = true ORDER BY t.sortOrder ASC")
    List<SmartBiChartTemplate> findGlobalTemplates();

    /**
     * 按工厂ID查找所有启用的模板
     *
     * @param factoryId 工厂ID
     * @return 图表模板列表
     */
    List<SmartBiChartTemplate> findByFactoryIdAndIsActiveTrueOrderBySortOrder(String factoryId);

    /**
     * 检查模板代码是否存在
     *
     * @param templateCode 模板代码
     * @return 是否存在
     */
    boolean existsByTemplateCodeAndIsActiveTrue(String templateCode);

    /**
     * 按图表类型和分类查找
     *
     * @param chartType 图表类型
     * @param category  模板分类
     * @return 图表模板列表
     */
    List<SmartBiChartTemplate> findByChartTypeAndCategoryAndIsActiveTrueOrderBySortOrder(
            String chartType, String category);

    /**
     * 统计各图表类型的数量
     *
     * @param chartType 图表类型
     * @return 数量
     */
    long countByChartTypeAndIsActiveTrue(String chartType);

    /**
     * 获取所有不同的模板分类
     *
     * @return 分类列表
     */
    @Query("SELECT DISTINCT t.category FROM SmartBiChartTemplate t WHERE t.isActive = true")
    List<String> findAllCategories();

    /**
     * 获取所有不同的图表类型
     *
     * @return 图表类型列表
     */
    @Query("SELECT DISTINCT t.chartType FROM SmartBiChartTemplate t WHERE t.isActive = true")
    List<String> findAllChartTypes();
}
