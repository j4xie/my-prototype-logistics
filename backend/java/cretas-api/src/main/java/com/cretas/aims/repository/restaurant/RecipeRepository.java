package com.cretas.aims.repository.restaurant;

import com.cretas.aims.entity.restaurant.Recipe;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * BOM 配方仓库
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
@Repository
public interface RecipeRepository extends JpaRepository<Recipe, String> {

    // ==================== 基础查询 ====================

    Page<Recipe> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    Page<Recipe> findByFactoryIdAndProductTypeIdOrderByCreatedAtDesc(
            String factoryId, String productTypeId, Pageable pageable);

    Page<Recipe> findByFactoryIdAndIsActiveOrderByCreatedAtDesc(
            String factoryId, Boolean isActive, Pageable pageable);

    Optional<Recipe> findByIdAndFactoryId(String id, String factoryId);

    // ==================== 菜品配方查询 ====================

    /**
     * 查询某菜品的完整配方列表（按 isMainIngredient DESC 排序，主料先展示）
     */
    @Query("SELECT r FROM Recipe r WHERE r.factoryId = :factoryId AND r.productTypeId = :productTypeId " +
            "AND r.isActive = true ORDER BY r.isMainIngredient DESC, r.createdAt ASC")
    List<Recipe> findActiveByFactoryIdAndProductTypeId(
            @Param("factoryId") String factoryId,
            @Param("productTypeId") String productTypeId);

    /**
     * 统计某菜品的配方条目数
     */
    long countByFactoryIdAndProductTypeIdAndIsActiveTrue(String factoryId, String productTypeId);

    /**
     * 查询使用了某食材的所有配方（影响分析：食材下架前使用）
     */
    List<Recipe> findByFactoryIdAndRawMaterialTypeIdAndIsActiveTrue(String factoryId, String rawMaterialTypeId);

    /**
     * 检查某菜品是否已存在该食材的配方行（避免重复）
     */
    boolean existsByFactoryIdAndProductTypeIdAndRawMaterialTypeIdAndIsActiveTrue(
            String factoryId, String productTypeId, String rawMaterialTypeId);

    // ==================== 统计 ====================

    /**
     * 统计该工厂的活跃配方数量（按菜品分组）
     */
    @Query("SELECT r.productTypeId, COUNT(r) FROM Recipe r " +
            "WHERE r.factoryId = :factoryId AND r.isActive = true " +
            "GROUP BY r.productTypeId")
    List<Object[]> countActiveRecipesByProduct(@Param("factoryId") String factoryId);
}
