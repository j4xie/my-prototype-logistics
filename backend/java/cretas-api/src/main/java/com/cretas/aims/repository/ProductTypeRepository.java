package com.cretas.aims.repository;

import com.cretas.aims.entity.ProductType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
/**
 * 产品类型数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface ProductTypeRepository extends JpaRepository<ProductType, String> {
    /**
     * 根据工厂ID和产品代码查找
     */
    Optional<ProductType> findByFactoryIdAndCode(String factoryId, String code);

    /**
     * 根据ID和工厂ID查找（工厂隔离）
     */
    Optional<ProductType> findByIdAndFactoryId(String id, String factoryId);
     /**
     * 查找工厂的所有产品类型
      */
    List<ProductType> findByFactoryId(String factoryId);
     /**
     * 查找工厂的激活产品类型
      */
    List<ProductType> findByFactoryIdAndIsActive(String factoryId, Boolean isActive);
     /**
     * 分页查找工厂的产品类型
      */
    Page<ProductType> findByFactoryId(String factoryId, Pageable pageable);
     /**
     * 根据类别查找产品类型
      */
    List<ProductType> findByFactoryIdAndCategory(String factoryId, String category);
     /**
     * 搜索产品类型
     * 注意：code使用右模糊（可使用索引），name/category使用双向模糊（无法使用索引）
      */
    @Query("SELECT p FROM ProductType p WHERE p.factoryId = :factoryId AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(p.code) LIKE LOWER(CONCAT(:keyword, '%')) OR " +
           "LOWER(p.category) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<ProductType> searchProductTypes(@Param("factoryId") String factoryId,
                                         @Param("keyword") String keyword,
                                         Pageable pageable);
     /**
     * 检查产品代码是否存在
      */
    boolean existsByFactoryIdAndCode(String factoryId, String code);

    /**
     * 检查产品类型是否存在（工厂隔离）
     */
    boolean existsByIdAndFactoryId(String id, String factoryId);
     /**
     * 统计产品类型数量
      */
    @Query("SELECT COUNT(p) FROM ProductType p WHERE p.factoryId = :factoryId AND p.isActive = true")
    Long countActiveProductTypes(@Param("factoryId") String factoryId);
     /**
     * 统计工厂的产品类型总数
      */
    long countByFactoryId(String factoryId);

    /**
     * 查找工厂的所有激活产品类型
     * 用于蓝图导出功能
     *
     * @param factoryId 工厂ID
     * @return 产品类型列表
     */
    List<ProductType> findByFactoryIdAndIsActiveTrue(String factoryId);

    /**
     * 批量查询多个产品类型 - 解决 N+1 查询问题
     * @param ids 产品类型ID集合
     * @return 产品类型列表
     */
    List<ProductType> findByIdIn(java.util.Collection<String> ids);
}
