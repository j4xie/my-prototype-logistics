package com.cretas.aims.repository;

import com.cretas.aims.entity.intent.KeywordEffectiveness;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 关键词效果追踪 Repository
 */
@Repository
public interface KeywordEffectivenessRepository extends JpaRepository<KeywordEffectiveness, Long> {

    /**
     * 根据工厂、意图、关键词查找效果记录
     */
    Optional<KeywordEffectiveness> findByFactoryIdAndIntentCodeAndKeyword(
        String factoryId, String intentCode, String keyword);

    /**
     * 检查关键词是否存在于指定工厂和意图
     */
    boolean existsByFactoryIdAndIntentCodeAndKeyword(
        String factoryId, String intentCode, String keyword);

    /**
     * 检查关键词是否存在于其他意图（用于防止交叉学习）
     */
    @Query("SELECT COUNT(k) > 0 FROM KeywordEffectiveness k " +
           "WHERE k.factoryId = :factoryId AND k.keyword = :keyword AND k.intentCode <> :intentCode")
    boolean existsByKeywordInOtherIntent(
        @Param("factoryId") String factoryId,
        @Param("keyword") String keyword,
        @Param("intentCode") String intentCode);

    /**
     * 获取工厂某意图的所有关键词
     */
    List<KeywordEffectiveness> findByFactoryIdAndIntentCode(String factoryId, String intentCode);

    /**
     * 获取工厂某意图的有效关键词（效果评分高于阈值）
     */
    @Query("SELECT k FROM KeywordEffectiveness k " +
           "WHERE k.factoryId = :factoryId AND k.intentCode = :intentCode " +
           "AND k.effectivenessScore >= :threshold " +
           "ORDER BY k.weight DESC, k.specificity DESC")
    List<KeywordEffectiveness> findEffectiveKeywords(
        @Param("factoryId") String factoryId,
        @Param("intentCode") String intentCode,
        @Param("threshold") BigDecimal threshold);

    /**
     * 获取需要清理的低效关键词
     */
    @Query("SELECT k FROM KeywordEffectiveness k " +
           "WHERE k.factoryId = :factoryId " +
           "AND k.effectivenessScore < :threshold " +
           "AND k.negativeCount >= :minNegative " +
           "AND k.isAutoLearned = true")
    List<KeywordEffectiveness> findKeywordsForCleanup(
        @Param("factoryId") String factoryId,
        @Param("threshold") BigDecimal threshold,
        @Param("minNegative") int minNegative);

    /**
     * 获取所有唯一关键词（用于重算 specificity）
     */
    @Query("SELECT DISTINCT k.keyword FROM KeywordEffectiveness k")
    List<String> findDistinctKeywords();

    /**
     * 计算关键词出现在多少个意图中
     */
    @Query("SELECT COUNT(DISTINCT k.intentCode) FROM KeywordEffectiveness k " +
           "WHERE k.keyword = :keyword")
    long countDistinctIntentsByKeyword(@Param("keyword") String keyword);

    /**
     * 批量更新关键词的 specificity
     */
    @Modifying
    @Query("UPDATE KeywordEffectiveness k SET k.specificity = :specificity " +
           "WHERE k.keyword = :keyword")
    int updateSpecificityByKeyword(
        @Param("keyword") String keyword,
        @Param("specificity") BigDecimal specificity);

    /**
     * 获取工厂的关键词总数
     */
    long countByFactoryIdAndIntentCode(String factoryId, String intentCode);

    /**
     * 删除指定工厂的关键词
     */
    void deleteByFactoryIdAndIntentCodeAndKeyword(
        String factoryId, String intentCode, String keyword);

    /**
     * 获取高效关键词（用于晋升检查）
     */
    @Query("SELECT k FROM KeywordEffectiveness k " +
           "WHERE k.keyword = :keyword AND k.intentCode = :intentCode " +
           "AND k.effectivenessScore >= :threshold " +
           "ORDER BY k.effectivenessScore DESC")
    List<KeywordEffectiveness> findHighEffectivenessKeywords(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword,
        @Param("threshold") BigDecimal threshold);

    /**
     * 获取某工厂所有自动学习的关键词
     */
    List<KeywordEffectiveness> findByFactoryIdAndIsAutoLearnedTrue(String factoryId);
}
