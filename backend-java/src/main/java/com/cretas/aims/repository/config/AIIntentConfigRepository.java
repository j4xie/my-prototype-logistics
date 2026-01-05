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

    // ==================== 工厂级隔离查询方法 ====================

    /**
     * 查询工厂可见的意图配置（工厂级 + 平台级）
     * 工厂用户可以看到：
     * - 自己工厂的意图 (factoryId = 指定工厂)
     * - 平台级共享意图 (factoryId IS NULL)
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.isActive = true " +
           "AND c.deletedAt IS NULL " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "ORDER BY c.priority DESC")
    List<AIIntentConfig> findByFactoryIdOrPlatformLevel(@Param("factoryId") String factoryId);

    /**
     * 根据意图代码查询（工厂级隔离）
     * 优先查找工厂级配置，如果没有则查找平台级
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.intentCode = :intentCode " +
           "AND c.isActive = true " +
           "AND c.deletedAt IS NULL " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "ORDER BY CASE WHEN c.factoryId = :factoryId THEN 0 ELSE 1 END")
    List<AIIntentConfig> findByIntentCodeAndFactoryIdOrPlatform(
            @Param("intentCode") String intentCode,
            @Param("factoryId") String factoryId);

    /**
     * 检查意图代码是否在工厂范围内已存在
     */
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM AIIntentConfig c " +
           "WHERE c.intentCode = :intentCode " +
           "AND c.deletedAt IS NULL " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL)")
    boolean existsByIntentCodeInFactoryScope(
            @Param("intentCode") String intentCode,
            @Param("factoryId") String factoryId);

    /**
     * 根据ID和工厂ID查询（工厂级隔离）
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.id = :id " +
           "AND c.deletedAt IS NULL " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL)")
    Optional<AIIntentConfig> findByIdAndFactoryIdOrPlatform(
            @Param("id") String id,
            @Param("factoryId") String factoryId);

    // ==================== Embedding 缓存相关方法 ====================

    /**
     * 查询所有启用的意图（用于 embedding 缓存预热）
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.isActive = true " +
           "AND c.deletedAt IS NULL")
    List<AIIntentConfig> findAllEnabled();

    /**
     * 根据工厂ID和启用状态查询
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.isActive = :enabled " +
           "AND c.deletedAt IS NULL")
    List<AIIntentConfig> findByFactoryIdAndEnabled(
            @Param("factoryId") String factoryId,
            @Param("enabled") boolean enabled);

    /**
     * 根据工厂ID和意图代码查询
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.intentCode = :intentCode " +
           "AND c.deletedAt IS NULL")
    Optional<AIIntentConfig> findByFactoryIdAndIntentCode(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode);

    /**
     * 检查工厂级意图代码是否已存在
     * 用于自动创建意图时防止重复
     */
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM AIIntentConfig c " +
           "WHERE c.factoryId = :factoryId " +
           "AND c.intentCode = :intentCode " +
           "AND c.deletedAt IS NULL")
    boolean existsByFactoryIdAndIntentCode(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode);

    /**
     * 统计启用的意图数量
     */
    @Query("SELECT COUNT(c) FROM AIIntentConfig c " +
           "WHERE c.isActive = true " +
           "AND c.deletedAt IS NULL")
    long countEnabled();

    // ==================== 多轮对话相关方法 ====================

    /**
     * 根据意图代码查询 (简单版本)
     */
    Optional<AIIntentConfig> findByIntentCode(String intentCode);

    /**
     * 查询工厂可见的活跃意图（按优先级排序）
     * 用于多轮对话时提供候选意图列表
     */
    @Query("SELECT c FROM AIIntentConfig c " +
           "WHERE c.isActive = true " +
           "AND c.deletedAt IS NULL " +
           "AND (c.factoryId = :factoryId OR c.factoryId IS NULL) " +
           "ORDER BY c.priority DESC, c.intentName ASC")
    List<AIIntentConfig> findActiveByFactoryIdWithPriority(@Param("factoryId") String factoryId);
}
