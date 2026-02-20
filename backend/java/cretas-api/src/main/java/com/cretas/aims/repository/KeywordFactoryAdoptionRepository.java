package com.cretas.aims.repository;

import com.cretas.aims.entity.intent.KeywordFactoryAdoption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 跨工厂关键词采用 Repository
 */
@Repository
public interface KeywordFactoryAdoptionRepository extends JpaRepository<KeywordFactoryAdoption, Long> {

    /**
     * 根据意图、关键词、工厂查找采用记录
     */
    Optional<KeywordFactoryAdoption> findByIntentCodeAndKeywordAndFactoryId(
        String intentCode, String keyword, String factoryId);

    /**
     * 检查是否已采用
     */
    boolean existsByIntentCodeAndKeywordAndFactoryId(
        String intentCode, String keyword, String factoryId);

    /**
     * 获取某关键词在所有工厂的采用记录
     */
    List<KeywordFactoryAdoption> findByIntentCodeAndKeyword(String intentCode, String keyword);

    /**
     * 获取某关键词的采用工厂数（未禁用）
     */
    @Query("SELECT COUNT(DISTINCT k.factoryId) FROM KeywordFactoryAdoption k " +
           "WHERE k.intentCode = :intentCode AND k.keyword = :keyword " +
           "AND k.isDisabled = false")
    long countActiveFactoriesByKeyword(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword);

    /**
     * 获取某关键词的平均效果评分
     */
    @Query("SELECT AVG(k.effectivenessScore) FROM KeywordFactoryAdoption k " +
           "WHERE k.intentCode = :intentCode AND k.keyword = :keyword " +
           "AND k.isDisabled = false")
    BigDecimal getAverageEffectiveness(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword);

    /**
     * 检查关键词是否被任何工厂禁用
     */
    @Query("SELECT COUNT(k) > 0 FROM KeywordFactoryAdoption k " +
           "WHERE k.intentCode = :intentCode AND k.keyword = :keyword " +
           "AND k.isDisabled = true")
    boolean hasDisabledByAnyFactory(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword);

    /**
     * 获取可晋升的关键词候选（3+工厂采用，未晋升）
     */
    @Query("SELECT k.intentCode, k.keyword, COUNT(DISTINCT k.factoryId) as factoryCount " +
           "FROM KeywordFactoryAdoption k " +
           "WHERE k.isDisabled = false AND k.isPromoted = false " +
           "GROUP BY k.intentCode, k.keyword " +
           "HAVING COUNT(DISTINCT k.factoryId) >= :minFactories")
    List<Object[]> findPromotionCandidates(@Param("minFactories") int minFactories);

    /**
     * 标记关键词已晋升
     */
    @Modifying
    @Query("UPDATE KeywordFactoryAdoption k SET k.isPromoted = true, k.promotedAt = CURRENT_TIMESTAMP " +
           "WHERE k.intentCode = :intentCode AND k.keyword = :keyword")
    int markAsPromoted(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword);

    /**
     * 获取工厂采用的所有关键词
     */
    List<KeywordFactoryAdoption> findByFactoryId(String factoryId);

    /**
     * 获取某意图的已晋升关键词
     */
    @Query("SELECT DISTINCT k.keyword FROM KeywordFactoryAdoption k " +
           "WHERE k.intentCode = :intentCode AND k.isPromoted = true")
    List<String> findPromotedKeywords(@Param("intentCode") String intentCode);

    /**
     * 更新效果评分
     */
    @Modifying
    @Query("UPDATE KeywordFactoryAdoption k SET k.effectivenessScore = :score, k.usageCount = k.usageCount + 1 " +
           "WHERE k.intentCode = :intentCode AND k.keyword = :keyword AND k.factoryId = :factoryId")
    int updateEffectivenessAndUsage(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword,
        @Param("factoryId") String factoryId,
        @Param("score") BigDecimal score);

    /**
     * 获取采用该关键词的工厂ID列表
     */
    @Query("SELECT k.factoryId FROM KeywordFactoryAdoption k " +
           "WHERE k.intentCode = :intentCode AND k.keyword = :keyword " +
           "AND k.isDisabled = false")
    List<String> findFactoryIdsByKeyword(
        @Param("intentCode") String intentCode,
        @Param("keyword") String keyword);
}
