package com.cretas.aims.repository.learning;

import com.cretas.aims.entity.learning.TrainingSample;
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
 * 训练样本 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Repository
public interface TrainingSampleRepository extends JpaRepository<TrainingSample, Long> {

    // ========== 反馈更新 ==========

    /**
     * 更新样本反馈
     */
    @Modifying
    @Query("UPDATE TrainingSample s SET s.isCorrect = :isCorrect, " +
           "s.correctIntentCode = :correctIntent, s.feedbackAt = :now " +
           "WHERE s.id = :id")
    int updateFeedback(
        @Param("id") Long id,
        @Param("isCorrect") boolean isCorrect,
        @Param("correctIntent") String correctIntent,
        @Param("now") LocalDateTime now
    );

    // ========== 查询 ==========

    /**
     * 获取未反馈的样本
     */
    @Query("SELECT s FROM TrainingSample s WHERE s.factoryId = :factoryId " +
           "AND s.isCorrect IS NULL ORDER BY s.createdAt DESC")
    Page<TrainingSample> findUnfeedback(
        @Param("factoryId") String factoryId,
        Pageable pageable
    );

    /**
     * 获取需要纠正的样本 (isCorrect = false)
     */
    @Query("SELECT s FROM TrainingSample s WHERE s.factoryId = :factoryId " +
           "AND s.isCorrect = false ORDER BY s.feedbackAt DESC")
    Page<TrainingSample> findIncorrect(
        @Param("factoryId") String factoryId,
        Pageable pageable
    );

    /**
     * 获取可用于训练的样本
     */
    @Query("SELECT s FROM TrainingSample s WHERE s.factoryId = :factoryId " +
           "AND s.isCorrect IS NOT NULL " +
           "AND s.confidence >= :minConfidence")
    List<TrainingSample> findTrainingReady(
        @Param("factoryId") String factoryId,
        @Param("minConfidence") java.math.BigDecimal minConfidence
    );

    /**
     * 获取 LLM Fallback 样本
     */
    @Query("SELECT s FROM TrainingSample s WHERE s.factoryId = :factoryId " +
           "AND s.matchMethod = 'LLM' " +
           "AND s.createdAt >= :since ORDER BY s.createdAt DESC")
    List<TrainingSample> findLlmFallbacks(
        @Param("factoryId") String factoryId,
        @Param("since") LocalDateTime since
    );

    // ========== 统计 ==========

    /**
     * 按匹配方法统计
     */
    @Query("SELECT s.matchMethod, COUNT(s) FROM TrainingSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.createdAt >= :since " +
           "GROUP BY s.matchMethod")
    List<Object[]> countByMatchMethod(
        @Param("factoryId") String factoryId,
        @Param("since") LocalDateTime since
    );

    /**
     * 按反馈结果统计
     */
    @Query("SELECT s.isCorrect, COUNT(s) FROM TrainingSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.isCorrect IS NOT NULL " +
           "AND s.createdAt >= :since " +
           "GROUP BY s.isCorrect")
    List<Object[]> countByFeedback(
        @Param("factoryId") String factoryId,
        @Param("since") LocalDateTime since
    );

    /**
     * 统计 LLM Fallback 率
     * 返回 [llm_count, total_count]
     */
    @Query(value = "SELECT " +
           "(SELECT COUNT(*) FROM ai_training_samples WHERE factory_id = :factoryId AND match_method = 'LLM' AND created_at >= :since) as llm_count, " +
           "(SELECT COUNT(*) FROM ai_training_samples WHERE factory_id = :factoryId AND created_at >= :since) as total_count",
           nativeQuery = true)
    List<Object[]> getLlmFallbackRate(
        @Param("factoryId") String factoryId,
        @Param("since") LocalDateTime since
    );

    /**
     * 按意图统计样本数
     */
    @Query("SELECT s.matchedIntentCode, COUNT(s), " +
           "SUM(CASE WHEN s.isCorrect = true THEN 1 ELSE 0 END), " +
           "SUM(CASE WHEN s.isCorrect = false THEN 1 ELSE 0 END) " +
           "FROM TrainingSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.createdAt >= :since " +
           "GROUP BY s.matchedIntentCode")
    List<Object[]> getIntentStatistics(
        @Param("factoryId") String factoryId,
        @Param("since") LocalDateTime since
    );

    // ========== 导出 ==========

    /**
     * 获取导出数据 (用于模型微调)
     */
    @Query("SELECT s.userInput, " +
           "CASE WHEN s.isCorrect = true THEN s.matchedIntentCode ELSE s.correctIntentCode END " +
           "FROM TrainingSample s " +
           "WHERE s.factoryId = :factoryId " +
           "AND s.isCorrect IS NOT NULL " +
           "AND s.confidence >= :minConfidence")
    List<Object[]> exportForTraining(
        @Param("factoryId") String factoryId,
        @Param("minConfidence") java.math.BigDecimal minConfidence
    );

    // ========== 清理 ==========

    /**
     * 删除过期样本 (保留最近N天)
     */
    @Modifying
    @Query("DELETE FROM TrainingSample s WHERE s.createdAt < :before " +
           "AND s.isCorrect IS NULL")
    int deleteExpiredUnfeedback(@Param("before") LocalDateTime before);

    /**
     * 统计工厂样本总数
     */
    @Query("SELECT COUNT(s) FROM TrainingSample s WHERE s.factoryId = :factoryId")
    long countByFactory(@Param("factoryId") String factoryId);
}
