package com.cretas.aims.repository;

import com.cretas.aims.entity.intent.IntentOptimizationSuggestion;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion.SuggestionStatus;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion.SuggestionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 意图优化建议数据访问接口
 *
 * 提供:
 * - 优化建议的CRUD操作
 * - 按状态/类型/影响分数查询
 * - 批量状态更新
 * - 过期建议清理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Repository
public interface IntentOptimizationSuggestionRepository extends JpaRepository<IntentOptimizationSuggestion, String> {

    // ==================== 基本查询 ====================

    /**
     * 分页查询工厂的优化建议
     */
    Page<IntentOptimizationSuggestion> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 分页查询工厂特定状态的建议
     */
    Page<IntentOptimizationSuggestion> findByFactoryIdAndStatus(
            String factoryId, SuggestionStatus status, Pageable pageable);

    /**
     * 分页查询工厂的优化建议（按影响分数降序）
     */
    Page<IntentOptimizationSuggestion> findByFactoryIdOrderByImpactScoreDesc(
            String factoryId, Pageable pageable);

    /**
     * 查询特定意图的优化建议
     */
    List<IntentOptimizationSuggestion> findByIntentCodeOrderByImpactScoreDesc(String intentCode);

    /**
     * 查询工厂特定状态的建议
     */
    List<IntentOptimizationSuggestion> findByFactoryIdAndStatusOrderByImpactScoreDesc(
            String factoryId, SuggestionStatus status);

    /**
     * 查询待处理的高影响建议 (使用 impactScore 字段)
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.status = 'PENDING' AND s.impactScore >= :minImpact " +
           "ORDER BY s.impactScore DESC")
    List<IntentOptimizationSuggestion> findHighImpactPendingSuggestions(
            @Param("factoryId") String factoryId,
            @Param("minImpact") java.math.BigDecimal minImpact,
            Pageable pageable);

    /**
     * 查询待处理的高影响建议 (使用 impactScore)
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.status = 'PENDING' AND s.impactScore >= :minScore " +
           "ORDER BY s.impactScore DESC")
    List<IntentOptimizationSuggestion> findHighImpactPendingSuggestionsByScore(
            @Param("factoryId") String factoryId,
            @Param("minScore") java.math.BigDecimal minScore);

    // ==================== 按类型查询 ====================

    /**
     * 按建议类型分页查询
     */
    Page<IntentOptimizationSuggestion> findByFactoryIdAndSuggestionTypeOrderByImpactScoreDesc(
            String factoryId, SuggestionType type, Pageable pageable);

    /**
     * 统计各类型建议数量
     */
    @Query("SELECT s.suggestionType, COUNT(s) FROM IntentOptimizationSuggestion s " +
           "WHERE s.factoryId = :factoryId AND s.status = 'PENDING' " +
           "GROUP BY s.suggestionType")
    List<Object[]> countBySuggestionType(@Param("factoryId") String factoryId);

    // ==================== 频率和影响分析 ====================

    /**
     * 查询高频问题建议（频率>=N次）
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.status = 'PENDING' AND s.frequency >= :minFrequency " +
           "ORDER BY s.frequency DESC")
    List<IntentOptimizationSuggestion> findHighFrequencySuggestions(
            @Param("factoryId") String factoryId,
            @Param("minFrequency") Integer minFrequency);

    /**
     * 计算待处理建议的平均影响分数
     */
    @Query("SELECT AVG(s.impactScore) FROM IntentOptimizationSuggestion s " +
           "WHERE s.factoryId = :factoryId AND s.status = 'PENDING'")
    java.math.BigDecimal calculateAverageImpactScore(@Param("factoryId") String factoryId);

    /**
     * 查询Top-N高影响建议
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.status = 'PENDING' ORDER BY s.impactScore DESC")
    List<IntentOptimizationSuggestion> findTopImpactSuggestions(
            @Param("factoryId") String factoryId, Pageable pageable);

    // ==================== 状态统计 ====================

    /**
     * 统计各状态的建议数量
     */
    @Query("SELECT s.status, COUNT(s) FROM IntentOptimizationSuggestion s " +
           "WHERE s.factoryId = :factoryId GROUP BY s.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    /**
     * 统计待处理建议总数
     */
    long countByFactoryIdAndStatus(String factoryId, SuggestionStatus status);

    /**
     * 查询已应用的建议（用于效果评估）
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.status = 'APPLIED' AND s.appliedAt >= :startDate " +
           "ORDER BY s.appliedAt DESC")
    List<IntentOptimizationSuggestion> findRecentlyAppliedSuggestions(
            @Param("factoryId") String factoryId,
            @Param("startDate") LocalDateTime startDate);

    // ==================== 更新操作 ====================

    /**
     * 应用建议
     */
    @Modifying
    @Query("UPDATE IntentOptimizationSuggestion s SET s.status = 'APPLIED', " +
           "s.appliedAt = :appliedAt, s.appliedBy = :appliedBy WHERE s.id = :id")
    int applySuggestion(
            @Param("id") String id,
            @Param("appliedAt") LocalDateTime appliedAt,
            @Param("appliedBy") Long appliedBy);

    /**
     * 拒绝建议
     */
    @Modifying
    @Query("UPDATE IntentOptimizationSuggestion s SET s.status = 'REJECTED', " +
           "s.rejectReason = :reason WHERE s.id = :id")
    int rejectSuggestion(
            @Param("id") String id,
            @Param("reason") String reason);

    /**
     * 增加建议频率（当相同问题再次出现时）
     */
    @Modifying
    @Query("UPDATE IntentOptimizationSuggestion s SET s.frequency = s.frequency + 1 " +
           "WHERE s.id = :id")
    int incrementFrequency(@Param("id") String id);

    // ==================== 过期处理 ====================

    /**
     * 查询已过期的待处理建议
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.status = 'PENDING' " +
           "AND s.expiredAt < :now")
    List<IntentOptimizationSuggestion> findExpiredSuggestions(@Param("now") LocalDateTime now);

    /**
     * 批量标记为过期
     */
    @Modifying
    @Query("UPDATE IntentOptimizationSuggestion s SET s.status = 'EXPIRED' " +
           "WHERE s.status = 'PENDING' AND s.expiredAt < :now")
    int markExpiredSuggestions(@Param("now") LocalDateTime now);

    // ==================== 去重检查 ====================

    /**
     * 检查是否已存在相同类型的待处理建议
     */
    boolean existsByIntentCodeAndSuggestionTypeAndStatus(
            String intentCode, SuggestionType type, SuggestionStatus status);

    /**
     * 查找相同意图和类型的待处理建议（用于合并）
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.intentCode = :intentCode " +
           "AND s.suggestionType = :type AND s.status = 'PENDING'")
    List<IntentOptimizationSuggestion> findExistingSuggestion(
            @Param("intentCode") String intentCode,
            @Param("type") SuggestionType type);

    // ==================== CREATE_INTENT 专用查询 ====================

    /**
     * 查找相同建议意图代码的待处理 CREATE_INTENT 建议
     * 用于合并相同新意图的多次触发
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.suggestedIntentCode = :suggestedCode " +
           "AND s.suggestionType = 'CREATE_INTENT' AND s.status = 'PENDING'")
    List<IntentOptimizationSuggestion> findPendingCreateIntentSuggestion(
            @Param("factoryId") String factoryId,
            @Param("suggestedCode") String suggestedCode);

    /**
     * 分页查询工厂的 CREATE_INTENT 建议（用于管理界面）
     */
    @Query("SELECT s FROM IntentOptimizationSuggestion s WHERE s.factoryId = :factoryId " +
           "AND s.suggestionType = 'CREATE_INTENT' AND s.status = :status " +
           "ORDER BY s.frequency DESC, s.impactScore DESC")
    Page<IntentOptimizationSuggestion> findCreateIntentSuggestions(
            @Param("factoryId") String factoryId,
            @Param("status") SuggestionStatus status,
            Pageable pageable);

    // ==================== 平台级晋升专用查询 ====================

    /**
     * 查询工厂特定意图的特定类型和状态的建议
     * 用于检查是否已存在相同的晋升请求
     */
    List<IntentOptimizationSuggestion> findByFactoryIdAndIntentCodeAndSuggestionTypeAndStatus(
            String factoryId,
            String intentCode,
            SuggestionType suggestionType,
            SuggestionStatus status);

    /**
     * 查询特定类型和状态的所有建议（跨工厂）
     * 用于平台管理员查看所有待审批的晋升请求
     */
    List<IntentOptimizationSuggestion> findBySuggestionTypeAndStatus(
            SuggestionType suggestionType,
            SuggestionStatus status);

    /**
     * 分页查询特定类型和状态的所有建议（跨工厂）
     */
    Page<IntentOptimizationSuggestion> findBySuggestionTypeAndStatus(
            SuggestionType suggestionType,
            SuggestionStatus status,
            Pageable pageable);

    // ==================== 清理操作 ====================

    /**
     * 删除旧的已处理建议（保留策略：已应用/拒绝超过90天）
     */
    @Modifying
    @Query("DELETE FROM IntentOptimizationSuggestion s " +
           "WHERE s.status IN ('APPLIED', 'REJECTED', 'EXPIRED') " +
           "AND s.updatedAt < :cutoffDate")
    int deleteOldProcessedSuggestions(@Param("cutoffDate") LocalDateTime cutoffDate);
}
