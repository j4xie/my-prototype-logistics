package com.cretas.aims.service.bom;

import com.cretas.aims.dto.bom.BatchAddRequest;
import com.cretas.aims.dto.bom.BatchDeleteRequest;
import com.cretas.aims.dto.bom.BatchModifyRequest;
import com.cretas.aims.dto.bom.BatchReplaceRequest;
import com.cretas.aims.dto.bom.BatchResult;

/**
 * BomBatchOperationService (Sprint 3 Track-H / M-BOM-VER-1).
 *
 * <p>4 批量操作 spanning multiple BomRecipes: modify / replace / delete / add. Each operation
 * auto-creates:
 * <ul>
 *   <li>1 {@link com.cretas.aims.entity.bom.EngineeringChangeNotice} DRAFT — captures
 *       operation type + 5-reason + impact scope</li>
 *   <li>N {@link com.cretas.aims.entity.bom.BomVersion} DRAFT — one per affected BomRecipe,
 *       snapshotJson reflects proposed post-change state</li>
 * </ul>
 *
 * <p>Operations do <b>not</b> mutate {@link com.cretas.aims.entity.bom.BomRecipe} or
 * {@link com.cretas.aims.entity.bom.BomRecipeItem} directly. Write-back happens at ECN
 * approval time via {@code BomVersionService.approve} (apply-snapshot path covered in
 * later phase — Day 8-9 emits DRAFTs only, by design).
 *
 * <p>Each request supports {@code allInFactory=true} for full-factory scope OR explicit
 * {@code recipeIds} list. Recipes that don't contain the referenced material are recorded in
 * {@link BatchResult#getSkippedRecipes()} with reason.
 *
 * @author Cretas Team / Sprint 3 Track-H
 * @since 2026-05-16
 */
public interface BomBatchOperationService {

    /** 批量修改: 多 BOM 同一物料的 standardQuantity (+unit) 全改. */
    BatchResult batchModify(BatchModifyRequest req);

    /** 批量替换: 物料 A → B 跨多 BOM. */
    BatchResult batchReplace(BatchReplaceRequest req);

    /** 批量删除: 多 BOM 同一物料 item 全删. */
    BatchResult batchDelete(BatchDeleteRequest req);

    /**
     * 批量新增: 多 BOM 同时加一物料 item.
     * Recipe 已含此 material 时按 {@link BatchAddRequest#isSkipIfAlreadyPresent()} 决定跳过或重复加.
     */
    BatchResult batchAdd(BatchAddRequest req);
}
