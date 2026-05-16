package com.cretas.aims.service.bom;

import com.cretas.aims.dto.bom.BomItemUsage;
import com.cretas.aims.dto.bom.MaterialReplacementImpact;
import com.cretas.aims.entity.bom.BomRecipe;

import java.util.List;

/**
 * BomReverseQueryService (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>物料 → BOM 反查: 哪些 BOM 用了某物料? 替换 / 停产时影响哪些产品?
 *
 * <p>Perf target (DoD): {@link #findRecipesByMaterial} ≤200ms for 1000 BomRecipe. Backed by
 * existing index {@code idx_bri_material} on {@code bom_recipe_items(factory_id, material_type_id)}
 * (Track D1 / V20260514). 反查走 BomRecipeItem.materialTypeId → recipe_id join — index seek
 * O(log N) on filtered key.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
public interface BomReverseQueryService {

    /** 哪些 BOM 用了这个物料? (distinct BomRecipes). */
    List<BomRecipe> findRecipesByMaterial(String factoryId, String materialId);

    /**
     * 哪些 BOM 用了这个物料 — 含 BomRecipeItem 用量 / 出成率 / 成本 明细 (per item row).
     * 同一 BomRecipe 可能出现多次 if recipe 内多条 item 引用同一 material (e.g. 同物料不同
     * sortOrder / different substituteGroup).
     */
    List<BomItemUsage> findUsageByMaterial(String factoryId, String materialId);

    /**
     * 替换影响分析: oldMaterialId → newMaterialId 跨所有 BomRecipe.
     *
     * <p>逻辑: 找全部使用 oldMaterialId 的 BomRecipeItem, 对每条 item 按 newMaterialId 的 unitPrice
     * 重算 itemCost, 汇总 recipe 级 / 总和级 cost delta. 不实际写入 — 是 read-only 影响分析,
     * 用于 ECN 创建前的 cost-optimization 评估.
     */
    MaterialReplacementImpact analyzeReplacement(String factoryId, String oldMaterialId, String newMaterialId);
}
