package com.cretas.aims.repository;

import com.cretas.aims.entity.DialectMapping;
import com.cretas.aims.entity.DialectMapping.MappingSource;
import com.cretas.aims.entity.DialectMapping.MappingType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 方言/口语映射 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Repository
public interface DialectMappingRepository extends JpaRepository<DialectMapping, Long> {

    /**
     * 查找所有启用的映射
     */
    List<DialectMapping> findByEnabledTrueOrderByConfidenceDesc();

    /**
     * 根据工厂ID查找映射（包括全局映射）
     */
    @Query("SELECT d FROM DialectMapping d WHERE d.enabled = true " +
            "AND (d.factoryId = :factoryId OR d.factoryId IS NULL) " +
            "ORDER BY d.confidence DESC")
    List<DialectMapping> findByFactoryIdOrGlobal(@Param("factoryId") String factoryId);

    /**
     * 根据方言表达查找映射
     */
    Optional<DialectMapping> findByDialectExprAndEnabledTrue(String dialectExpr);

    /**
     * 根据方言表达和工厂ID查找映射
     */
    @Query("SELECT d FROM DialectMapping d WHERE d.dialectExpr = :dialectExpr " +
            "AND d.enabled = true " +
            "AND (d.factoryId = :factoryId OR d.factoryId IS NULL) " +
            "ORDER BY CASE WHEN d.factoryId IS NOT NULL THEN 0 ELSE 1 END, d.confidence DESC")
    List<DialectMapping> findByDialectExprAndFactory(
            @Param("dialectExpr") String dialectExpr,
            @Param("factoryId") String factoryId);

    /**
     * 查找指定类型的映射
     */
    List<DialectMapping> findByMappingTypeAndEnabledTrueOrderByConfidenceDesc(MappingType mappingType);

    /**
     * 查找指定来源的映射
     */
    List<DialectMapping> findBySourceAndEnabledTrueOrderByConfidenceDesc(MappingSource source);

    /**
     * 检查映射是否存在
     */
    boolean existsByDialectExprAndFactoryId(String dialectExpr, String factoryId);

    /**
     * 根据置信度阈值查找映射
     */
    @Query("SELECT d FROM DialectMapping d WHERE d.enabled = true " +
            "AND d.confidence >= :minConfidence " +
            "ORDER BY d.confidence DESC")
    List<DialectMapping> findByMinConfidence(@Param("minConfidence") Double minConfidence);

    /**
     * 更新使用次数
     */
    @Modifying
    @Query("UPDATE DialectMapping d SET d.useCount = d.useCount + 1 WHERE d.id = :id")
    void incrementUseCount(@Param("id") Long id);

    /**
     * 更新成功次数
     */
    @Modifying
    @Query("UPDATE DialectMapping d SET d.successCount = d.successCount + 1 WHERE d.id = :id")
    void incrementSuccessCount(@Param("id") Long id);

    /**
     * 批量禁用低置信度映射
     */
    @Modifying
    @Query("UPDATE DialectMapping d SET d.enabled = false " +
            "WHERE d.confidence < :threshold AND d.source != 'PRESET'")
    int disableLowConfidenceMappings(@Param("threshold") Double threshold);

    /**
     * 查找高频使用的映射（用于分析）
     */
    @Query("SELECT d FROM DialectMapping d WHERE d.enabled = true " +
            "AND d.useCount >= :minUseCount " +
            "ORDER BY d.useCount DESC")
    List<DialectMapping> findHighFrequencyMappings(@Param("minUseCount") Integer minUseCount);

    /**
     * 统计各类型映射数量
     */
    @Query("SELECT d.mappingType, COUNT(d) FROM DialectMapping d " +
            "WHERE d.enabled = true GROUP BY d.mappingType")
    List<Object[]> countByMappingType();

    /**
     * 删除指定工厂的学习映射
     */
    @Modifying
    @Query("DELETE FROM DialectMapping d WHERE d.factoryId = :factoryId AND d.source = 'LEARNED'")
    int deleteLearnedMappingsByFactory(@Param("factoryId") String factoryId);
}
