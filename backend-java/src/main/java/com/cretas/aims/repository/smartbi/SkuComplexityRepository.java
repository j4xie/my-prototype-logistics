package com.cretas.aims.repository.smartbi;

import com.cretas.aims.entity.smartbi.SkuComplexity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * SKU 复杂度 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Repository
public interface SkuComplexityRepository extends JpaRepository<SkuComplexity, String> {

    /**
     * 根据工厂ID和SKU编码查找复杂度记录
     *
     * @param factoryId 工厂ID
     * @param skuCode SKU编码
     * @return 复杂度记录
     */
    Optional<SkuComplexity> findByFactoryIdAndSkuCode(String factoryId, String skuCode);

    /**
     * 根据工厂ID查找所有复杂度记录
     *
     * @param factoryId 工厂ID
     * @return 复杂度记录列表
     */
    List<SkuComplexity> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID分页查找复杂度记录
     *
     * @param factoryId 工厂ID
     * @param pageable 分页参数
     * @return 分页结果
     */
    Page<SkuComplexity> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和复杂度等级查找记录
     *
     * @param factoryId 工厂ID
     * @param complexityLevel 复杂度等级
     * @return 复杂度记录列表
     */
    List<SkuComplexity> findByFactoryIdAndComplexityLevel(String factoryId, Integer complexityLevel);

    /**
     * 根据工厂ID和来源类型查找记录
     *
     * @param factoryId 工厂ID
     * @param sourceType 来源类型
     * @return 复杂度记录列表
     */
    List<SkuComplexity> findByFactoryIdAndSourceType(String factoryId, String sourceType);

    /**
     * 根据工厂ID和SOP配置ID查找记录
     *
     * @param factoryId 工厂ID
     * @param sopConfigId SOP配置ID
     * @return 复杂度记录
     */
    Optional<SkuComplexity> findByFactoryIdAndSopConfigId(String factoryId, String sopConfigId);

    /**
     * 查找高复杂度 SKU（等级 >= 指定值）
     *
     * @param factoryId 工厂ID
     * @param minLevel 最小复杂度等级
     * @return 复杂度记录列表
     */
    @Query("SELECT s FROM SkuComplexity s WHERE s.factoryId = :factoryId " +
           "AND s.complexityLevel >= :minLevel ORDER BY s.complexityLevel DESC")
    List<SkuComplexity> findHighComplexitySkus(
            @Param("factoryId") String factoryId,
            @Param("minLevel") Integer minLevel);

    /**
     * 统计各复杂度等级的SKU数量
     *
     * @param factoryId 工厂ID
     * @return 统计结果 [level, count]
     */
    @Query("SELECT s.complexityLevel, COUNT(s) FROM SkuComplexity s " +
           "WHERE s.factoryId = :factoryId GROUP BY s.complexityLevel ORDER BY s.complexityLevel")
    List<Object[]> countByComplexityLevel(@Param("factoryId") String factoryId);

    /**
     * 计算工厂的平均复杂度
     *
     * @param factoryId 工厂ID
     * @return 平均复杂度
     */
    @Query("SELECT AVG(s.complexityLevel) FROM SkuComplexity s WHERE s.factoryId = :factoryId")
    Double calculateAverageComplexity(@Param("factoryId") String factoryId);

    /**
     * 批量查找SKU复杂度
     *
     * @param factoryId 工厂ID
     * @param skuCodes SKU编码列表
     * @return 复杂度记录列表
     */
    @Query("SELECT s FROM SkuComplexity s WHERE s.factoryId = :factoryId " +
           "AND s.skuCode IN :skuCodes")
    List<SkuComplexity> findByFactoryIdAndSkuCodeIn(
            @Param("factoryId") String factoryId,
            @Param("skuCodes") List<String> skuCodes);

    /**
     * 检查SKU复杂度是否存在
     *
     * @param factoryId 工厂ID
     * @param skuCode SKU编码
     * @return 是否存在
     */
    boolean existsByFactoryIdAndSkuCode(String factoryId, String skuCode);

    /**
     * 统计AI分析的SKU数量
     *
     * @param factoryId 工厂ID
     * @return 数量
     */
    @Query("SELECT COUNT(s) FROM SkuComplexity s WHERE s.factoryId = :factoryId " +
           "AND s.sourceType = 'AI_SOP'")
    long countAiAnalyzedSkus(@Param("factoryId") String factoryId);
}
