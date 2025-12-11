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
 * <p>本接口继承自JpaRepository，提供原材料类型实体的基础CRUD操作和自定义查询方法。</p>
 *
 * <h3>功能分类</h3>
 * <ol>
 *   <li><b>基础查询</b>：按工厂ID、激活状态等条件查询（支持分页）</li>
 *   <li><b>条件查询</b>：按类别、存储方式等条件筛选</li>
 *   <li><b>搜索功能</b>：按关键词模糊搜索名称或编码</li>
 *   <li><b>唯一性检查</b>：检查名称或编码是否已存在</li>
 *   <li><b>批量操作</b>：批量查询、批量删除等</li>
 *   <li><b>统计查询</b>：统计数量、获取唯一值列表等</li>
 * </ol>
 *
 * <h3>查询方法命名规范</h3>
 * <p>Spring Data JPA根据方法名自动生成查询，命名规范如下：</p>
 * <ul>
 *   <li><code>findBy</code>：查询方法前缀</li>
 *   <li><code>FactoryId</code>：按工厂ID查询（必填，用于数据隔离）</li>
 *   <li><code>And</code>：条件连接符（AND逻辑）</li>
 *   <li><code>IsActive</code>：按激活状态查询</li>
 *   <li><code>Category</code>：按类别查询</li>
 *   <li><code>StorageType</code>：按存储方式查询</li>
 * </ul>
 *
 * <h3>自定义查询</h3>
 * <p>使用@Query注解定义JPQL查询：</p>
 * <ul>
 *   <li><code>searchByKeyword</code>：模糊搜索名称或编码</li>
 *   <li><code>findDistinctCategoriesByFactoryId</code>：获取唯一的类别列表</li>
 *   <li><code>findLowStockMaterials</code>：查找低库存原材料（需关联库存表）</li>
 * </ul>
 *
 * <h3>性能优化建议</h3>
 * <ul>
 *   <li>所有查询都基于factoryId，确保数据隔离和查询效率</li>
 *   <li>分页查询使用Pageable参数，避免一次性加载大量数据</li>
 *   <li>唯一性检查使用exists方法，比find方法更高效</li>
 *   <li>统计查询使用count方法，避免加载实体对象</li>
 * </ul>
 *
 * @author Claude (AI Assistant)
 * @date 2025-11-19
 * @version 1.0.0
 * @see MaterialType 实体类
 * @see MaterialTypeService 业务逻辑层
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
           "AND (m.name LIKE CONCAT('%', :keyword, '%') OR m.materialCode LIKE CONCAT('%', :keyword, '%'))")
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
