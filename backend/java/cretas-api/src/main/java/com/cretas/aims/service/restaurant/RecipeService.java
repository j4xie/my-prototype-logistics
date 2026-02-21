package com.cretas.aims.service.restaurant;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.restaurant.Recipe;

import java.util.List;
import java.util.Map;

/**
 * BOM 配方服务接口
 *
 * @author Cretas Team
 * @since 2026-02-20
 */
public interface RecipeService {

    // ==================== CRUD ====================

    /**
     * 创建配方行
     */
    Recipe createRecipe(String factoryId, Recipe recipe, Long userId);

    /**
     * 查询配方详情
     */
    Recipe getRecipeById(String factoryId, String recipeId);

    /**
     * 分页查询配方列表（支持按 productTypeId 筛选）
     */
    PageResponse<Recipe> getRecipes(String factoryId, String productTypeId, Boolean isActive, int page, int size);

    /**
     * 更新配方行
     */
    Recipe updateRecipe(String factoryId, String recipeId, Recipe recipe);

    /**
     * 软删除配方行（将 isActive 置为 false）
     */
    void deleteRecipe(String factoryId, String recipeId);

    // ==================== 菜品配方 ====================

    /**
     * 查询某菜品的完整配方（所有激活的食材行）
     */
    List<Recipe> getRecipeByDish(String factoryId, String productTypeId);

    /**
     * 查询某菜品制作 N 份所需的食材清单（含实际采购量）
     *
     * @param factoryId     工厂/餐厅 ID
     * @param productTypeId 菜品 ID
     * @param dishQuantity  份数
     * @return 食材用量映射 {rawMaterialTypeId -> actualQuantity}
     */
    Map<String, Object> calculateIngredients(String factoryId, String productTypeId, int dishQuantity);

    // ==================== 统计 ====================

    /**
     * 获取工厂配方统计概览
     */
    Map<String, Object> getRecipeSummary(String factoryId);
}
