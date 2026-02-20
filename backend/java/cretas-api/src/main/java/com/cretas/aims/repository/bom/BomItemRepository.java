package com.cretas.aims.repository.bom;

import com.cretas.aims.entity.bom.BomItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * BOM项目 Repository
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-13
 */
@Repository
public interface BomItemRepository extends JpaRepository<BomItem, Long> {

    /**
     * 根据工厂ID和产品类型ID查询BOM项目列表
     */
    List<BomItem> findByFactoryIdAndProductTypeIdAndDeletedAtIsNullOrderBySortOrderAsc(
        String factoryId, String productTypeId);

    /**
     * 根据工厂ID查询所有BOM项目列表
     */
    List<BomItem> findByFactoryIdAndDeletedAtIsNullOrderByProductTypeIdAscSortOrderAsc(String factoryId);

    /**
     * 查询工厂下所有有BOM配置的产品类型ID
     */
    @Query("SELECT DISTINCT b.productTypeId FROM BomItem b WHERE b.factoryId = :factoryId AND b.deletedAt IS NULL")
    List<String> findDistinctProductTypeIds(@Param("factoryId") String factoryId);

    /**
     * 检查是否存在重复的BOM项目
     */
    boolean existsByFactoryIdAndProductTypeIdAndMaterialTypeIdAndDeletedAtIsNull(
        String factoryId, String productTypeId, String materialTypeId);

    /**
     * 根据工厂ID和产品类型ID删除BOM项目
     */
    void deleteByFactoryIdAndProductTypeId(String factoryId, String productTypeId);

    /**
     * 统计产品的原料项目数量
     */
    @Query("SELECT COUNT(b) FROM BomItem b WHERE b.factoryId = :factoryId AND b.productTypeId = :productTypeId AND b.deletedAt IS NULL")
    long countByFactoryIdAndProductTypeId(@Param("factoryId") String factoryId, @Param("productTypeId") String productTypeId);
}
