package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialProductConversion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 转化率数据访问层
 *
 * 提供15个MVP核心API端点的数据库查询支持:
 * 1. GET /conversions - 分页列表
 * 2. POST /conversions - 创建
 * 3. GET /conversions/{id} - 详情
 * 4. PUT /conversions/{id} - 更新
 * 5. DELETE /conversions/{id} - 删除
 * 6. GET /conversions/material/{materialTypeId} - 按原材料查询
 * 7. GET /conversions/product/{productTypeId} - 按产品查询
 * 8. GET /conversions/rate - 获取特定转化率
 * 9. POST /conversions/calculate/material-requirement - 计算原材料需求
 * 10. POST /conversions/calculate/product-output - 计算产品产出
 * 11. POST /conversions/validate - 验证转化率
 * 12. PUT /conversions/batch/activate - 批量激活/停用
 * 13. GET /conversions/statistics - 统计信息
 * 14. GET /conversions/export - 导出
 * 15. POST /conversions/import - 导入
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@Repository
public interface ConversionRateRepository extends JpaRepository<MaterialProductConversion, String> {

    // ========== 基础查询 ==========

    /**
     * 按工厂ID查询（分页）
     */
    Page<MaterialProductConversion> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 按工厂ID查询（不分页）
     */
    List<MaterialProductConversion> findByFactoryId(String factoryId);

    /**
     * 按工厂ID和ID查询
     */
    Optional<MaterialProductConversion> findByFactoryIdAndId(String factoryId, String id);

    // ========== 原材料和产品查询 ==========

    /**
     * 按工厂ID和原材料类型ID查询
     */
    List<MaterialProductConversion> findByFactoryIdAndMaterialTypeId(String factoryId, String materialTypeId);

    /**
     * 按工厂ID和产品类型ID查询
     */
    List<MaterialProductConversion> findByFactoryIdAndProductTypeId(String factoryId, String productTypeId);

    /**
     * 按工厂ID、原材料类型ID和产品类型ID查询
     */
    Optional<MaterialProductConversion> findByFactoryIdAndMaterialTypeIdAndProductTypeId(
            String factoryId, String materialTypeId, String productTypeId);

    // ========== 唯一性检查 ==========

    /**
     * 检查转化率是否存在（原材料+产品组合唯一）
     */
    boolean existsByMaterialTypeIdAndProductTypeId(String materialTypeId, String productTypeId);

    /**
     * 检查转化率是否存在（排除指定ID）
     */
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM MaterialProductConversion c " +
           "WHERE c.materialTypeId = :materialTypeId AND c.productTypeId = :productTypeId " +
           "AND c.id <> :excludeId")
    boolean existsByMaterialAndProductExcludingId(@Param("materialTypeId") String materialTypeId,
                                                   @Param("productTypeId") String productTypeId,
                                                   @Param("excludeId") String excludeId);

    // ========== 激活状态查询 ==========

    /**
     * 按工厂ID和激活状态查询
     */
    List<MaterialProductConversion> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 按工厂ID和激活状态查询（分页）
     */
    Page<MaterialProductConversion> findByFactoryIdAndIsActive(String factoryId, Boolean isActive, Pageable pageable);

    /**
     * 按工厂ID、原材料类型ID和激活状态查询
     */
    List<MaterialProductConversion> findByFactoryIdAndMaterialTypeIdAndIsActive(
            String factoryId, String materialTypeId, Boolean isActive);

    /**
     * 按工厂ID、产品类型ID和激活状态查询
     */
    List<MaterialProductConversion> findByFactoryIdAndProductTypeIdAndIsActive(
            String factoryId, String productTypeId, Boolean isActive);

    // ========== 删除操作 ==========

    /**
     * 删除指定工厂的指定转化率
     */
    void deleteByFactoryIdAndId(String factoryId, String id);

    // ========== 统计查询 ==========

    /**
     * 统计指定工厂的转化率数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计指定工厂和激活状态的转化率数量
     */
    long countByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 统计指定原材料类型的转化率数量
     */
    long countByFactoryIdAndMaterialTypeId(String factoryId, String materialTypeId);

    /**
     * 统计指定产品类型的转化率数量
     */
    long countByFactoryIdAndProductTypeId(String factoryId, String productTypeId);

    // ========== 高级查询 ==========

    /**
     * 获取平均转化率
     */
    @Query("SELECT AVG(c.conversionRate) FROM MaterialProductConversion c WHERE c.factoryId = :factoryId AND c.isActive = true")
    Double getAverageConversionRate(@Param("factoryId") String factoryId);

    /**
     * 获取平均损耗率
     */
    @Query("SELECT AVG(c.wastageRate) FROM MaterialProductConversion c WHERE c.factoryId = :factoryId AND c.isActive = true AND c.wastageRate IS NOT NULL")
    Double getAverageWastageRate(@Param("factoryId") String factoryId);
}
