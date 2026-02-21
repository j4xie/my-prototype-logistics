package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.restaurant.Recipe;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.restaurant.RecipeRepository;
import com.cretas.aims.service.restaurant.RecipeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecipeServiceImpl implements RecipeService {

    private static final Logger log = LoggerFactory.getLogger(RecipeServiceImpl.class);

    private final RecipeRepository recipeRepository;

    public RecipeServiceImpl(RecipeRepository recipeRepository) {
        this.recipeRepository = recipeRepository;
    }

    @Override
    @Transactional
    public Recipe createRecipe(String factoryId, Recipe recipe, Long userId) {
        log.info("创建配方: factoryId={}, productTypeId={}, rawMaterialTypeId={}",
                factoryId, recipe.getProductTypeId(), recipe.getRawMaterialTypeId());

        if (recipeRepository.existsByFactoryIdAndProductTypeIdAndRawMaterialTypeIdAndIsActiveTrue(
                factoryId, recipe.getProductTypeId(), recipe.getRawMaterialTypeId())) {
            throw new BusinessException("该菜品已存在此食材的配方行");
        }

        recipe.setFactoryId(factoryId);
        recipe.setCreatedBy(userId);
        recipe.setIsActive(true);
        recipe = recipeRepository.save(recipe);

        log.info("配方创建成功: id={}", recipe.getId());
        return recipe;
    }

    @Override
    public Recipe getRecipeById(String factoryId, String recipeId) {
        return recipeRepository.findByIdAndFactoryId(recipeId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Recipe", "id", recipeId));
    }

    @Override
    public PageResponse<Recipe> getRecipes(String factoryId, String productTypeId, Boolean isActive, int page, int size) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Recipe> result;

        if (productTypeId != null) {
            result = recipeRepository.findByFactoryIdAndProductTypeIdOrderByCreatedAtDesc(factoryId, productTypeId, pageable);
        } else if (isActive != null) {
            result = recipeRepository.findByFactoryIdAndIsActiveOrderByCreatedAtDesc(factoryId, isActive, pageable);
        } else {
            result = recipeRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
        }

        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    @Transactional
    public Recipe updateRecipe(String factoryId, String recipeId, Recipe recipe) {
        log.info("更新配方: factoryId={}, recipeId={}", factoryId, recipeId);

        Recipe existing = recipeRepository.findByIdAndFactoryId(recipeId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Recipe", "id", recipeId));

        if (recipe.getStandardQuantity() != null) {
            existing.setStandardQuantity(recipe.getStandardQuantity());
        }
        if (recipe.getUnit() != null) {
            existing.setUnit(recipe.getUnit());
        }
        if (recipe.getNetYieldRate() != null) {
            existing.setNetYieldRate(recipe.getNetYieldRate());
        }
        if (recipe.getIsMainIngredient() != null) {
            existing.setIsMainIngredient(recipe.getIsMainIngredient());
        }
        if (recipe.getNotes() != null) {
            existing.setNotes(recipe.getNotes());
        }

        existing = recipeRepository.save(existing);
        log.info("配方更新成功: id={}", existing.getId());
        return existing;
    }

    @Override
    @Transactional
    public void deleteRecipe(String factoryId, String recipeId) {
        log.info("软删除配方: factoryId={}, recipeId={}", factoryId, recipeId);

        Recipe existing = recipeRepository.findByIdAndFactoryId(recipeId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Recipe", "id", recipeId));

        existing.setIsActive(false);
        recipeRepository.save(existing);
        log.info("配方已停用: id={}", recipeId);
    }

    @Override
    public List<Recipe> getRecipeByDish(String factoryId, String productTypeId) {
        return recipeRepository.findActiveByFactoryIdAndProductTypeId(factoryId, productTypeId);
    }

    @Override
    public Map<String, Object> calculateIngredients(String factoryId, String productTypeId, int dishQuantity) {
        log.info("计算食材用量: factoryId={}, productTypeId={}, dishQuantity={}", factoryId, productTypeId, dishQuantity);

        List<Recipe> recipes = recipeRepository.findActiveByFactoryIdAndProductTypeId(factoryId, productTypeId);
        if (recipes.isEmpty()) {
            throw new BusinessException("该菜品暂无配方数据");
        }

        BigDecimal qty = BigDecimal.valueOf(dishQuantity);
        List<Map<String, Object>> ingredients = new ArrayList<>();

        for (Recipe r : recipes) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("rawMaterialTypeId", r.getRawMaterialTypeId());
            item.put("unit", r.getUnit());
            item.put("isMainIngredient", r.getIsMainIngredient());
            item.put("standardQuantity", r.getStandardQuantity().multiply(qty).setScale(4, RoundingMode.HALF_UP));
            item.put("actualQuantity", r.getActualQuantity().multiply(qty).setScale(4, RoundingMode.HALF_UP));
            item.put("netYieldRate", r.getNetYieldRate());
            ingredients.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productTypeId", productTypeId);
        result.put("dishQuantity", dishQuantity);
        result.put("ingredients", ingredients);
        return result;
    }

    @Override
    public Map<String, Object> getRecipeSummary(String factoryId) {
        List<Object[]> stats = recipeRepository.countActiveRecipesByProduct(factoryId);

        List<Map<String, Object>> byProduct = new ArrayList<>();
        long totalRecipes = 0;

        for (Object[] row : stats) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("productTypeId", row[0]);
            item.put("recipeCount", row[1]);
            byProduct.add(item);
            totalRecipes += ((Number) row[1]).longValue();
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalActiveRecipes", totalRecipes);
        summary.put("totalDishes", byProduct.size());
        summary.put("byProduct", byProduct);
        return summary;
    }
}
