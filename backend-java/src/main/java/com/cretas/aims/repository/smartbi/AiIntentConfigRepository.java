package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.AiIntentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI 意图配置 Repository
 *
 * <p>提供意图配置的数据访问功能：
 * <ul>
 *   <li>按分类查询意图</li>
 *   <li>支持工厂级别配置覆盖</li>
 *   <li>按优先级排序</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface AiIntentConfigRepository extends JpaRepository<AiIntentConfig, String> {

    /**
     * 按分类查找所有启用的意图配置
     *
     * @param intentCategory 意图分类
     * @return 意图配置列表
     */
    List<AiIntentConfig> findByIntentCategoryAndIsActiveTrueOrderByPriorityAsc(String intentCategory);

    /**
     * 按意图代码查找
     *
     * @param intentCode 意图代码
     * @return 意图配置（如果存在）
     */
    Optional<AiIntentConfig> findByIntentCodeAndIsActiveTrue(String intentCode);

    /**
     * 按意图代码和工厂ID查找
     *
     * @param intentCode 意图代码
     * @param factoryId  工厂ID
     * @return 意图配置（如果存在）
     */
    Optional<AiIntentConfig> findByIntentCodeAndFactoryIdAndIsActiveTrue(
            String intentCode, String factoryId);

    /**
     * 获取所有启用的意图配置（按优先级排序）
     *
     * @return 所有启用的意图配置
     */
    List<AiIntentConfig> findByIsActiveTrueOrderByPriorityAsc();

    /**
     * 按分类和工厂ID查找（包括全局配置）
     *
     * @param category  意图分类
     * @param factoryId 工厂ID
     * @return 适用的意图配置列表
     */
    @Query("SELECT c FROM AiIntentConfig c WHERE c.intentCategory = :intentCategory " +
           "AND c.isActive = true AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "ORDER BY CASE WHEN c.factoryId IS NOT NULL THEN 0 ELSE 1 END, c.priority ASC")
    List<AiIntentConfig> findByIntentCategoryAndFactoryId(
            @Param("intentCategory") String intentCategory,
            @Param("factoryId") String factoryId);

    /**
     * 获取所有全局意图配置
     *
     * @return 全局意图配置列表
     */
    @Query("SELECT c FROM AiIntentConfig c WHERE c.factoryId IS NULL " +
           "AND c.isActive = true ORDER BY c.priority ASC")
    List<AiIntentConfig> findAllGlobalConfigs();

    /**
     * 获取工厂特定的意图配置
     *
     * @param factoryId 工厂ID
     * @return 工厂特定的意图配置列表
     */
    List<AiIntentConfig> findByFactoryIdAndIsActiveTrueOrderByPriorityAsc(String factoryId);

    /**
     * 获取所有不同的分类
     *
     * @return 分类列表
     */
    @Query("SELECT DISTINCT c.intentCategory FROM AiIntentConfig c WHERE c.isActive = true")
    List<String> findAllDistinctCategories();

    /**
     * 检查意图代码是否存在
     *
     * @param intentCode 意图代码
     * @return true 如果存在
     */
    boolean existsByIntentCodeAndIsActiveTrue(String intentCode);

    /**
     * 按关键词搜索意图（使用 JSON_SEARCH）
     *
     * @param keyword 关键词
     * @return 匹配的意图配置列表
     */
    @Query(value = "SELECT * FROM ai_intent_configs WHERE is_active = true " +
            "AND JSON_SEARCH(keywords, 'one', :keyword) IS NOT NULL " +
            "AND deleted_at IS NULL ORDER BY priority ASC", nativeQuery = true)
    List<AiIntentConfig> findByKeyword(@Param("keyword") String keyword);
}
