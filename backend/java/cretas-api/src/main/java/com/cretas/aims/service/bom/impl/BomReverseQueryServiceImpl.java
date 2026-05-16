package com.cretas.aims.service.bom.impl;

import com.cretas.aims.dto.bom.BomItemUsage;
import com.cretas.aims.dto.bom.MaterialReplacementImpact;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.bom.BomRecipe;
import com.cretas.aims.entity.bom.BomRecipeItem;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.bom.BomRecipeItemRepository;
import com.cretas.aims.repository.bom.BomRecipeRepository;
import com.cretas.aims.service.bom.BomReverseQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * BomReverseQueryService implementation (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BomReverseQueryServiceImpl implements BomReverseQueryService {

    private final BomRecipeItemRepository itemRepo;
    private final BomRecipeRepository recipeRepo;
    private final RawMaterialTypeRepository materialRepo;

    @Override
    @Transactional(readOnly = true)
    public List<BomRecipe> findRecipesByMaterial(String factoryId, String materialId) {
        long start = System.nanoTime();
        List<BomRecipeItem> items = itemRepo.findByFactoryIdAndMaterialTypeId(factoryId, materialId);
        if (items.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> recipeIds = items.stream()
                .map(BomRecipeItem::getRecipeId)
                .collect(Collectors.toSet());
        List<BomRecipe> recipes = recipeRepo.findAllById(recipeIds);

        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        if (elapsedMs > 200) {
            log.warn("BomReverseQuery.findRecipesByMaterial slow: factory={}, material={}, "
                    + "items={}, recipes={}, elapsed={}ms (target ≤200ms)",
                    factoryId, materialId, items.size(), recipes.size(), elapsedMs);
        } else {
            log.debug("BomReverseQuery.findRecipesByMaterial: factory={}, material={}, "
                    + "items={}, recipes={}, elapsed={}ms",
                    factoryId, materialId, items.size(), recipes.size(), elapsedMs);
        }
        return recipes;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BomItemUsage> findUsageByMaterial(String factoryId, String materialId) {
        long start = System.nanoTime();
        List<BomRecipeItem> items = itemRepo.findByFactoryIdAndMaterialTypeId(factoryId, materialId);
        if (items.isEmpty()) {
            return Collections.emptyList();
        }

        // Batch-load all parent recipes to avoid N+1.
        Set<String> recipeIds = items.stream()
                .map(BomRecipeItem::getRecipeId)
                .collect(Collectors.toSet());
        Map<String, BomRecipe> recipeIndex = recipeRepo.findAllById(recipeIds).stream()
                .collect(Collectors.toMap(BomRecipe::getId, r -> r));

        List<BomItemUsage> usages = new ArrayList<>(items.size());
        for (BomRecipeItem item : items) {
            BomRecipe parent = recipeIndex.get(item.getRecipeId());
            usages.add(BomItemUsage.builder()
                    .recipeId(item.getRecipeId())
                    .recipeCode(parent == null ? null : parent.getRecipeCode())
                    .productTypeId(parent == null ? null : parent.getProductTypeId())
                    .productName(parent == null ? null : parent.getProductName())
                    .version(parent == null ? null : parent.getVersion())
                    .isCurrent(parent == null ? null : parent.getIsCurrent())
                    .itemId(item.getId())
                    .standardQuantity(item.getStandardQuantity())
                    .yieldRate(item.getYieldRate())
                    .actualQuantity(item.getActualQuantity())
                    .unit(item.getUnit())
                    .materialCategory(item.getMaterialCategory())
                    .isOptional(item.getIsOptional())
                    .substituteGroup(item.getSubstituteGroup())
                    .itemCost(item.getItemCost())
                    .unitPrice(item.getUnitPrice())
                    .build());
        }

        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        log.debug("BomReverseQuery.findUsageByMaterial: factory={}, material={}, rows={}, elapsed={}ms",
                factoryId, materialId, usages.size(), elapsedMs);
        return usages;
    }

    @Override
    @Transactional(readOnly = true)
    public MaterialReplacementImpact analyzeReplacement(String factoryId,
                                                        String oldMaterialId,
                                                        String newMaterialId) {
        MaterialReplacementImpact.MaterialReplacementImpactBuilder builder =
                MaterialReplacementImpact.builder()
                        .oldMaterialId(oldMaterialId)
                        .newMaterialId(newMaterialId);

        List<String> warnings = new ArrayList<>();

        Optional<RawMaterialType> oldMat = materialRepo.findById(oldMaterialId);
        Optional<RawMaterialType> newMat = materialRepo.findById(newMaterialId);
        if (oldMat.isEmpty()) {
            warnings.add("oldMaterial not found: " + oldMaterialId);
        }
        if (newMat.isEmpty()) {
            warnings.add("newMaterial not found: " + newMaterialId);
        }
        BigDecimal oldUnitPrice = oldMat.map(RawMaterialType::getUnitPrice).orElse(null);
        BigDecimal newUnitPrice = newMat.map(RawMaterialType::getUnitPrice).orElse(null);
        builder.oldMaterialName(oldMat.map(RawMaterialType::getName).orElse(null));
        builder.newMaterialName(newMat.map(RawMaterialType::getName).orElse(null));
        builder.oldUnitPrice(oldUnitPrice);
        builder.newUnitPrice(newUnitPrice);

        List<BomRecipeItem> items = itemRepo.findByFactoryIdAndMaterialTypeId(factoryId, oldMaterialId);
        if (items.isEmpty()) {
            builder.warnings(warnings);
            return builder.build();
        }

        // Group items by recipeId for per-recipe rollup.
        Map<String, List<BomRecipeItem>> byRecipe = items.stream()
                .collect(Collectors.groupingBy(BomRecipeItem::getRecipeId,
                        LinkedHashMap::new, Collectors.toList()));
        Map<String, BomRecipe> recipeIndex = recipeRepo.findAllById(byRecipe.keySet()).stream()
                .collect(Collectors.toMap(BomRecipe::getId, r -> r));

        BigDecimal totalDelta = BigDecimal.ZERO;
        int affectedItemCount = 0;
        List<MaterialReplacementImpact.RecipeImpact> breakdown = new ArrayList<>();

        for (Map.Entry<String, List<BomRecipeItem>> entry : byRecipe.entrySet()) {
            BomRecipe recipe = recipeIndex.get(entry.getKey());
            List<BomRecipeItem> recipeItems = entry.getValue();

            BigDecimal oldRecipeCost = BigDecimal.ZERO;
            BigDecimal newRecipeCost = BigDecimal.ZERO;
            for (BomRecipeItem ri : recipeItems) {
                BigDecimal qty = ri.calculateActualQuantity();
                if (qty == null) continue;
                affectedItemCount++;

                if (oldUnitPrice != null) {
                    oldRecipeCost = oldRecipeCost.add(qty.multiply(oldUnitPrice));
                }
                if (newUnitPrice != null) {
                    newRecipeCost = newRecipeCost.add(qty.multiply(newUnitPrice));
                }
            }

            if (newUnitPrice == null) {
                warnings.add("newMaterial has no unit_price; cost diff for recipe "
                        + (recipe == null ? entry.getKey() : recipe.getRecipeCode()) + " unavailable");
            }

            BigDecimal delta = newRecipeCost.subtract(oldRecipeCost).setScale(4, RoundingMode.HALF_UP);
            totalDelta = totalDelta.add(delta);

            breakdown.add(MaterialReplacementImpact.RecipeImpact.builder()
                    .recipeId(entry.getKey())
                    .recipeCode(recipe == null ? null : recipe.getRecipeCode())
                    .productName(recipe == null ? null : recipe.getProductName())
                    .version(recipe == null ? null : recipe.getVersion())
                    .isCurrent(recipe == null ? null : recipe.getIsCurrent())
                    .oldRecipeMaterialCost(oldRecipeCost.setScale(4, RoundingMode.HALF_UP))
                    .newRecipeMaterialCost(newRecipeCost.setScale(4, RoundingMode.HALF_UP))
                    .costDelta(delta)
                    .build());
        }

        builder.affectedRecipeCount(byRecipe.size())
                .affectedItemCount(affectedItemCount)
                .totalCostDelta(totalDelta.setScale(4, RoundingMode.HALF_UP))
                .recipeBreakdown(breakdown)
                .warnings(warnings);

        log.info("BomReverseQuery.analyzeReplacement: factory={}, {} → {}, affectedRecipes={}, "
                + "affectedItems={}, totalCostDelta={}",
                factoryId, oldMaterialId, newMaterialId, byRecipe.size(),
                affectedItemCount, totalDelta);
        return builder.build();
    }
}
