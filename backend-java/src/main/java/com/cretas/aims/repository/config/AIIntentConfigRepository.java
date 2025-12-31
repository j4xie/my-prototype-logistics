package com.cretas.aims.repository.config;

import com.cretas.aims.entity.config.AIIntentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * AI意图配置 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface AIIntentConfigRepository extends JpaRepository<AIIntentConfig, String> {

    /**
     * 根据意图代码查询配置
     */
    Optional<AIIntentConfig> findByIntentCodeAndIsActiveTrueAndDeletedAtIsNull(String intentCode);

    /**
     * 根据意图分类查询所有配置
     */
    List<AIIntentConfig> findByIntentCategoryAndIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc(
            String intentCategory);

    /**
     * 查询所有启用的意图配置
     */
    List<AIIntentConfig> findByIsActiveTrueAndDeletedAtIsNullOrderByPriorityDesc();

    /**
     * 根据敏感度级别查询配置
     */
    List<AIIntentConfig> findBySensitivityLevelAndIsActiveTrueAndDeletedAtIsNull(String sensitivityLevel);

    /**
     * 查询需要审批的意图配置
     */
    List<AIIntentConfig> findByRequiresApprovalTrueAndIsActiveTrueAndDeletedAtIsNull();

    /**
     * 根据关键词模糊匹配意图
     * 用于意图识别时的初筛
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.isActive = true " +
           "AND c.deletedAt IS NULL " +
           "AND c.keywords LIKE %:keyword% " +
           "ORDER BY c.priority DESC")
    List<AIIntentConfig> findByKeywordContaining(@Param("keyword") String keyword);

    /**
     * 检查意图代码是否已存在
     */
    boolean existsByIntentCodeAndDeletedAtIsNull(String intentCode);

    /**
     * 查询指定分类和敏感度的意图
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.intentCategory = :category " +
           "AND c.sensitivityLevel = :level " +
           "AND c.isActive = true " +
           "AND c.deletedAt IS NULL " +
           "ORDER BY c.priority DESC")
    List<AIIntentConfig> findByCategoryAndSensitivity(
            @Param("category") String category,
            @Param("level") String level);

    /**
     * 查询配额消耗高于阈值的意图
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.quotaCost >= :minCost " +
           "AND c.isActive = true " +
           "AND c.deletedAt IS NULL " +
           "ORDER BY c.quotaCost DESC")
    List<AIIntentConfig> findByQuotaCostGreaterThanEqual(@Param("minCost") Integer minCost);

    /**
     * 查询有缓存配置的意图
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.cacheTtlMinutes > 0 " +
           "AND c.isActive = true " +
           "AND c.deletedAt IS NULL")
    List<AIIntentConfig> findCacheableIntents();

    /**
     * 根据处理器类名查询
     */
    List<AIIntentConfig> findByHandlerClassAndIsActiveTrueAndDeletedAtIsNull(String handlerClass);

    /**
     * 精确查询 (用于更新/删除)
     */
    Optional<AIIntentConfig> findByIntentCodeAndDeletedAtIsNull(String intentCode);

    /**
     * 获取所有意图分类
     */
    @Query("SELECT DISTINCT c.intentCategory FROM AIIntentConfig c " +
           "WHERE c.isActive = true AND c.deletedAt IS NULL " +
           "ORDER BY c.intentCategory")
    List<String> findAllCategories();

    /**
     * 统计各敏感度级别的意图数量
     */
    @Query("SELECT c.sensitivityLevel, COUNT(c) FROM AIIntentConfig c " +
           "WHERE c.isActive = true AND c.deletedAt IS NULL " +
           "GROUP BY c.sensitivityLevel")
    List<Object[]> countBySensitivityLevel();
}
