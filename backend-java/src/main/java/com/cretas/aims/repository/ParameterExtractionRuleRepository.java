package com.cretas.aims.repository;

import com.cretas.aims.entity.learning.ParameterExtractionRule;
import com.cretas.aims.entity.learning.ParameterExtractionRule.PatternType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 参数提取规则 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-17
 */
@Repository
public interface ParameterExtractionRuleRepository extends JpaRepository<ParameterExtractionRule, String> {

    /**
     * 查找工厂和意图下的所有活跃规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @return 规则列表
     */
    @Query("SELECT r FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.intentCode = :intentCode " +
           "AND r.isActive = true " +
           "AND r.deletedAt IS NULL " +
           "ORDER BY r.confidence DESC, r.hitCount DESC")
    List<ParameterExtractionRule> findActiveRulesByFactoryAndIntent(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode);

    /**
     * 查找工厂、意图和参数的规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param paramName 参数名
     * @return 规则列表
     */
    @Query("SELECT r FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.intentCode = :intentCode " +
           "AND r.paramName = :paramName " +
           "AND r.isActive = true " +
           "AND r.deletedAt IS NULL " +
           "ORDER BY r.confidence DESC")
    List<ParameterExtractionRule> findByFactoryAndIntentAndParam(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode,
            @Param("paramName") String paramName);

    /**
     * 查找高置信度的规则（用于无需确认的直接提取）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param minConfidence 最低置信度阈值
     * @return 规则列表
     */
    @Query("SELECT r FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.intentCode = :intentCode " +
           "AND r.confidence >= :minConfidence " +
           "AND r.isActive = true " +
           "AND r.deletedAt IS NULL " +
           "ORDER BY r.confidence DESC, r.hitCount DESC")
    List<ParameterExtractionRule> findHighConfidenceRules(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode,
            @Param("minConfidence") BigDecimal minConfidence);

    /**
     * 查找已验证的规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @return 规则列表
     */
    @Query("SELECT r FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.intentCode = :intentCode " +
           "AND r.isVerified = true " +
           "AND r.isActive = true " +
           "AND r.deletedAt IS NULL " +
           "ORDER BY r.confidence DESC")
    List<ParameterExtractionRule> findVerifiedRules(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode);

    /**
     * 检查是否存在相同的规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param paramName 参数名
     * @param patternType 模式类型
     * @param extractionPattern 提取模式
     * @return 是否存在
     */
    @Query("SELECT COUNT(r) > 0 FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR (r.factoryId IS NULL AND :factoryId IS NULL)) " +
           "AND r.intentCode = :intentCode " +
           "AND r.paramName = :paramName " +
           "AND r.patternType = :patternType " +
           "AND r.extractionPattern = :extractionPattern " +
           "AND r.deletedAt IS NULL")
    boolean existsSimilarRule(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode,
            @Param("paramName") String paramName,
            @Param("patternType") PatternType patternType,
            @Param("extractionPattern") String extractionPattern);

    /**
     * 查找相似的规则（用于去重和更新）
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param paramName 参数名
     * @param patternType 模式类型
     * @param extractionPattern 提取模式
     * @return 规则（如果存在）
     */
    @Query("SELECT r FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR (r.factoryId IS NULL AND :factoryId IS NULL)) " +
           "AND r.intentCode = :intentCode " +
           "AND r.paramName = :paramName " +
           "AND r.patternType = :patternType " +
           "AND r.extractionPattern = :extractionPattern " +
           "AND r.deletedAt IS NULL")
    Optional<ParameterExtractionRule> findSimilarRule(
            @Param("factoryId") String factoryId,
            @Param("intentCode") String intentCode,
            @Param("paramName") String paramName,
            @Param("patternType") PatternType patternType,
            @Param("extractionPattern") String extractionPattern);

    /**
     * 更新命中统计
     *
     * @param id 规则ID
     * @param hitTime 命中时间
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE ParameterExtractionRule r SET r.hitCount = r.hitCount + 1, " +
           "r.lastHitAt = :hitTime, r.updatedAt = :hitTime WHERE r.id = :id")
    int incrementHitCount(@Param("id") String id, @Param("hitTime") LocalDateTime hitTime);

    /**
     * 更新成功统计
     *
     * @param id 规则ID
     * @param hitTime 命中时间
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE ParameterExtractionRule r SET r.hitCount = r.hitCount + 1, " +
           "r.successCount = r.successCount + 1, r.lastHitAt = :hitTime, " +
           "r.updatedAt = :hitTime WHERE r.id = :id")
    int incrementSuccessCount(@Param("id") String id, @Param("hitTime") LocalDateTime hitTime);

    /**
     * 确认规则（用户确认后）
     *
     * @param id 规则ID
     * @param updateTime 更新时间
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE ParameterExtractionRule r SET r.isVerified = true, " +
           "r.sourceType = 'USER_CONFIRMED', r.confidence = 0.95, " +
           "r.updatedAt = :updateTime WHERE r.id = :id")
    int confirmRule(@Param("id") String id, @Param("updateTime") LocalDateTime updateTime);

    /**
     * 停用低成功率的规则
     *
     * @param minHitCount 最小命中次数
     * @param maxSuccessRate 最大成功率
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE ParameterExtractionRule r SET r.isActive = false, " +
           "r.updatedAt = CURRENT_TIMESTAMP WHERE r.hitCount >= :minHitCount " +
           "AND (r.successCount * 1.0 / r.hitCount) < :maxSuccessRate " +
           "AND r.isActive = true")
    int deactivateLowSuccessRules(
            @Param("minHitCount") int minHitCount,
            @Param("maxSuccessRate") double maxSuccessRate);

    /**
     * 统计工厂的规则数量
     *
     * @param factoryId 工厂ID
     * @return 规则数量
     */
    @Query("SELECT COUNT(r) FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.deletedAt IS NULL")
    long countByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 统计意图的规则数量
     *
     * @param intentCode 意图代码
     * @return 规则数量
     */
    long countByIntentCodeAndDeletedAtIsNull(String intentCode);

    /**
     * 查找所有按来源类型分组的规则统计
     *
     * @param factoryId 工厂ID
     * @return 统计结果
     */
    @Query("SELECT r.sourceType, COUNT(r) FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.deletedAt IS NULL " +
           "GROUP BY r.sourceType")
    List<Object[]> countBySourceType(@Param("factoryId") String factoryId);

    /**
     * 软删除规则
     *
     * @param id 规则ID
     * @param deleteTime 删除时间
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE ParameterExtractionRule r SET r.deletedAt = :deleteTime, " +
           "r.updatedAt = :deleteTime WHERE r.id = :id")
    int softDelete(@Param("id") String id, @Param("deleteTime") LocalDateTime deleteTime);

    /**
     * 按模式类型查找规则
     *
     * @param factoryId 工厂ID
     * @param intentCode 意图代码
     * @param patternType 模式类型
     * @return 规则列表
     */
    List<ParameterExtractionRule> findByFactoryIdAndIntentCodeAndPatternTypeAndDeletedAtIsNull(
            String factoryId, String intentCode, PatternType patternType);

    /**
     * 查找最近使用的规则
     *
     * @param factoryId 工厂ID
     * @param since 起始时间
     * @return 规则列表
     */
    @Query("SELECT r FROM ParameterExtractionRule r WHERE " +
           "(r.factoryId = :factoryId OR r.factoryId IS NULL) " +
           "AND r.lastHitAt >= :since " +
           "AND r.deletedAt IS NULL " +
           "ORDER BY r.lastHitAt DESC")
    List<ParameterExtractionRule> findRecentlyUsedRules(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);
}
