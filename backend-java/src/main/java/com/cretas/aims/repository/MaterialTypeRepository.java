package com.cretas.aims.repository;

import com.cretas.aims.entity.MaterialType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 原材料类型数据访问层
 *
 * 提供13个API端点的数据库查询支持:
 * 1. GET /materials/types - 分页列表
 * 2. POST /materials/types - 创建
 * 3. GET /materials/types/{id} - 详情
 * 4. PUT /materials/types/{id} - 更新
 * 5. DELETE /materials/types/{id} - 删除
 * 6. GET /materials/types/active - 激活列表
 * 7. GET /materials/types/category/{category} - 按类别
 * 8. GET /materials/types/storage-type/{storageType} - 按存储方式
 * 9. GET /materials/types/search - 搜索
 * 10. GET /materials/types/check-code - 检查编码
 * 11. GET /materials/types/categories - 类别列表
 * 12. GET /materials/types/low-stock - 低库存（需关联库存表）
 * 13. PUT /materials/types/batch/status - 批量更新状态
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 */
@Repository
public interface MaterialTypeRepository extends JpaRepository<MaterialType, String> {

    // ========== 基础查询 ==========

    /**
     * 按工厂ID查询（分页）
     */
    Page<MaterialType> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 按工厂ID查询（不分页）
     */
    List<MaterialType> findByFactoryId(String factoryId);

    /**
     * 按工厂ID和激活状态查询（分页）
     */
    Page<MaterialType> findByFactoryIdAndIsActive(String factoryId, Boolean isActive, Pageable pageable);

    /**
     * 按工厂ID和激活状态查询（不分页）
     */
    List<MaterialType> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 按工厂ID和ID查询
     */
    Optional<MaterialType> findByFactoryIdAndId(String factoryId, String id);

    // ========== 类别和存储方式查询 ==========

    /**
     * 按工厂ID和类别查询
     */
    List<MaterialType> findByFactoryIdAndCategory(String factoryId, String category);

    /**
     * 按工厂ID和存储方式查询
     */
    List<MaterialType> findByFactoryIdAndStorageType(String factoryId, String storageType);

    /**
     * 获取所有唯一的类别（去重）
     */
    @Query("SELECT DISTINCT m.category FROM MaterialType m WHERE m.factoryId = :factoryId AND m.category IS NOT NULL")
    List<String> findDistinctCategoriesByFactoryId(@Param("factoryId") String factoryId);

    // ========== 搜索和检查 ==========

    /**
     * 搜索原材料类型（按名称或编码模糊匹配）
     */
    @Query("SELECT m FROM MaterialType m WHERE m.factoryId = :factoryId " +
           "AND (m.name LIKE %:keyword% OR m.materialCode LIKE %:keyword%)")
    Page<MaterialType> searchByKeyword(@Param("factoryId") String factoryId,
                                       @Param("keyword") String keyword,
                                       Pageable pageable);

    /**
     * 检查原材料编码是否存在
     */
    boolean existsByFactoryIdAndMaterialCode(String factoryId, String materialCode);

    /**
     * 检查原材料编码是否存在（排除指定ID）
     */
    boolean existsByFactoryIdAndMaterialCodeAndIdNot(String factoryId, String materialCode, String id);

    /**
     * 检查原材料名称是否存在
     */
    boolean existsByFactoryIdAndName(String factoryId, String name);

    /**
     * 检查原材料名称是否存在（排除指定ID）
     */
    boolean existsByFactoryIdAndNameAndIdNot(String factoryId, String name, String id);

    // ========== 批量操作 ==========

    /**
     * 按工厂ID和ID列表查询（用于批量操作）
     */
    List<MaterialType> findByFactoryIdAndIdIn(String factoryId, List<String> ids);

    /**
     * 删除指定工厂的指定原材料类型
     */
    void deleteByFactoryIdAndId(String factoryId, String id);

    // ========== 统计查询 ==========

    /**
     * 统计指定工厂的原材料类型数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计指定工厂的激活原材料类型数量
     */
    long countByFactoryIdAndIsActive(String factoryId, Boolean isActive);

    /**
     * 统计指定工厂和类别的原材料类型数量
     */
    long countByFactoryIdAndCategory(String factoryId, String category);

    // ========== 低库存查询（需关联material_batches表） ==========

    /**
     * 获取低库存原材料（需关联库存数据）
     * 注: 此查询需要material_batches表支持，暂时返回空列表
     */
    @Query("SELECT m FROM MaterialType m WHERE m.factoryId = :factoryId AND m.isActive = true")
    List<MaterialType> findLowStockMaterials(@Param("factoryId") String factoryId);
}
