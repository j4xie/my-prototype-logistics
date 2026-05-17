package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.bom.BomCostSummaryDTO;
import com.cretas.aims.dto.bom.CreateBomItemRequest;
import com.cretas.aims.dto.bom.CreateLaborCostRequest;
import com.cretas.aims.dto.bom.UpdateBomItemRequest;
import com.cretas.aims.dto.bom.UpdateLaborCostRequest;
import com.cretas.aims.entity.bom.BomChangeLog;
import com.cretas.aims.entity.bom.BomItem;
import com.cretas.aims.entity.bom.LaborCostConfig;
import com.cretas.aims.entity.bom.OverheadCostConfig;
import com.cretas.aims.repository.bom.BomChangeLogRepository;
import com.cretas.aims.dto.orchestration.BomTreeResult;
import com.cretas.aims.service.BomService;
import com.cretas.aims.service.orchestration.RecursiveBomExpansionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * BOM成本管理控制器
 * 提供BOM物料清单和成本配置管理接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-13
 */
/**
 * Bug #318 fix: method-level @RequirePermission on write methods only.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/bom")
@RequiredArgsConstructor
@Tag(name = "BOM成本管理", description = "BOM物料清单和成本配置管理")
@RequireModule("bom")
public class BomController {

    private final BomService bomService;
    private final RecursiveBomExpansionService recursiveBomExpansionService;

    /** P1-9 BOM 变更痕迹查询 Repository (可选注入, 老环境未部署 migration 时不阻塞) */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private BomChangeLogRepository bomChangeLogRepository;

    // ========== BOM Items (原辅料配方) ==========

    @GetMapping("/items/{productTypeId}")
    @Operation(summary = "获取产品的BOM物料清单")
    public ApiResponse<List<BomItem>> getBomItems(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String productTypeId) {
        log.info("Getting BOM items: factoryId={}, productTypeId={}", factoryId, productTypeId);
        return ApiResponse.success(bomService.getBomItemsByProduct(factoryId, productTypeId));
    }

    /**
     * M-MATTREE-1 (Sprint 4 W2): 多级 BOM 树展开 + 叶子节点库存短缺计算.
     *
     * <p>区别于 {@code /items/{productTypeId}} 的单层 BomItem 查询, 本端口递归展开 sub-BOM
     * (半成品 → 原料), 返回完整树结构 + maxDepth / leafCount / shortfallLeafCount 统计 +
     * 循环检测 (cycleDetected + cycleTypeIds)。</p>
     */
    @GetMapping("/tree/{productTypeId}")
    @Operation(summary = "多级 BOM 树展开 (M-MATTREE-1)",
            description = "递归展开成品 BOM 到原料叶子, 叶子节点附加库存可用量 + 短缺数量")
    public ApiResponse<BomTreeResult> getBomTree(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID (树根)") String productTypeId,
            @RequestParam(value = "quantity", defaultValue = "1")
            @Parameter(description = "计划生产数量 (默认 1)") java.math.BigDecimal quantity) {
        log.info("Expanding BOM tree: factoryId={}, productTypeId={}, quantity={}",
                factoryId, productTypeId, quantity);
        return ApiResponse.success(
                recursiveBomExpansionService.expandTree(factoryId, productTypeId, quantity));
    }

    /**
     * P1-9 BOM 变更痕迹查询 (v1 §2.2.6).
     * 返回指定产品 BOM 的所有变更历史 (CREATE/UPDATE/DELETE), 按时间倒序.
     */
    @GetMapping("/items/{productTypeId}/change-logs")
    @Operation(summary = "获取 BOM 变更痕迹 (P1-9)")
    public ApiResponse<List<BomChangeLog>> getBomChangeLogs(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String productTypeId) {
        if (bomChangeLogRepository == null) {
            return ApiResponse.success(java.util.Collections.emptyList());
        }
        return ApiResponse.success(bomChangeLogRepository
                .findByFactoryIdAndBomIdAndDeletedAtIsNullOrderByCreatedAtDesc(factoryId, productTypeId));
    }

    @GetMapping("/items")
    @Operation(summary = "获取工厂所有BOM物料")
    public ApiResponse<List<BomItem>> getAllBomItems(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("Getting all BOM items: factoryId={}", factoryId);
        return ApiResponse.success(bomService.getAllBomItems(factoryId));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/items")
    @Operation(summary = "添加BOM物料")
    public ApiResponse<BomItem> addBomItem(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody CreateBomItemRequest request) {
        log.info("Adding BOM item: factoryId={}, materialName={}", factoryId, request.getMaterialName());
        BomItem bomItem = toBomItem(request);
        bomItem.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveBomItem(bomItem));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PutMapping("/items/{id}")
    @Operation(summary = "更新BOM物料")
    public ApiResponse<BomItem> updateBomItem(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "BOM物料ID") Long id,
            @Valid @RequestBody UpdateBomItemRequest request) {
        log.info("Updating BOM item: factoryId={}, id={}", factoryId, id);
        BomItem bomItem = toBomItem(request);
        bomItem.setId(id);
        bomItem.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveBomItem(bomItem));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @DeleteMapping("/items/{id}")
    @Operation(summary = "删除BOM物料")
    public ApiResponse<Void> deleteBomItem(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "BOM物料ID") Long id) {
        log.info("Deleting BOM item: factoryId={}, id={}", factoryId, id);
        bomService.deleteBomItem(id);
        return ApiResponse.success(null);
    }

    // ========== Labor Cost (人工费用) ==========

    @GetMapping("/labor")
    @Operation(summary = "获取人工费用配置")
    public ApiResponse<List<LaborCostConfig>> getLaborCosts(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(required = false) @Parameter(description = "产品类型ID") String productTypeId) {
        log.info("Getting labor costs: factoryId={}, productTypeId={}", factoryId, productTypeId);
        if (productTypeId != null && !productTypeId.isEmpty()) {
            return ApiResponse.success(bomService.getLaborCostsByProduct(factoryId, productTypeId));
        }
        return ApiResponse.success(bomService.getGlobalLaborCosts(factoryId));
    }

    @GetMapping("/labor/all")
    @Operation(summary = "获取所有人工费用配置")
    public ApiResponse<List<LaborCostConfig>> getAllLaborCosts(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("Getting all labor costs: factoryId={}", factoryId);
        return ApiResponse.success(bomService.getAllLaborCosts(factoryId));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/labor")
    @Operation(summary = "添加人工费用")
    public ApiResponse<LaborCostConfig> addLaborCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @Valid @RequestBody CreateLaborCostRequest request) {
        log.info("Adding labor cost: factoryId={}, processName={}", factoryId, request.getProcessName());
        LaborCostConfig config = toLaborCostConfig(request);
        config.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveLaborCost(config));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PutMapping("/labor/{id}")
    @Operation(summary = "更新人工费用")
    public ApiResponse<LaborCostConfig> updateLaborCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "人工费用ID") Long id,
            @Valid @RequestBody UpdateLaborCostRequest request) {
        log.info("Updating labor cost: factoryId={}, id={}", factoryId, id);
        LaborCostConfig config = toLaborCostConfig(request);
        config.setId(id);
        config.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveLaborCost(config));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @DeleteMapping("/labor/{id}")
    @Operation(summary = "删除人工费用")
    public ApiResponse<Void> deleteLaborCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "人工费用ID") Long id) {
        log.info("Deleting labor cost: factoryId={}, id={}", factoryId, id);
        bomService.deleteLaborCost(id);
        return ApiResponse.success(null);
    }

    // ========== Overhead Cost (均摊费用) ==========

    @GetMapping("/overhead")
    @Operation(summary = "获取均摊费用配置")
    public ApiResponse<List<OverheadCostConfig>> getOverheadCosts(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("Getting overhead costs: factoryId={}", factoryId);
        return ApiResponse.success(bomService.getOverheadCosts(factoryId));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/overhead")
    @Operation(summary = "添加均摊费用")
    public ApiResponse<OverheadCostConfig> addOverheadCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody OverheadCostConfig config) {
        log.info("Adding overhead cost: factoryId={}, name={}", factoryId, config.getName());
        config.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveOverheadCost(config));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PutMapping("/overhead/{id}")
    @Operation(summary = "更新均摊费用")
    public ApiResponse<OverheadCostConfig> updateOverheadCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "均摊费用ID") Long id,
            @RequestBody OverheadCostConfig config) {
        log.info("Updating overhead cost: factoryId={}, id={}", factoryId, id);
        // T-R5-3 (R5 audit §3 BUG#1, 2026-05-12): was a blind save(body) that
        // dropped DB-only audit columns (createdAt/version) to NULL on partial
        // payloads. Service now select-then-merge — only client-supplied fields
        // are overwritten; everything else stays.
        return ApiResponse.success(bomService.updateOverheadCost(factoryId, id, config));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @DeleteMapping("/overhead/{id}")
    @Operation(summary = "删除均摊费用")
    public ApiResponse<Void> deleteOverheadCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "均摊费用ID") Long id) {
        log.info("Deleting overhead cost: factoryId={}, id={}", factoryId, id);
        bomService.deleteOverheadCost(id);
        return ApiResponse.success(null);
    }

    // ========== Cost Calculation (成本计算) ==========

    @GetMapping("/cost-summary/{productTypeId}")
    @Operation(summary = "计算产品成本汇总")
    public ApiResponse<BomCostSummaryDTO> calculateCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "产品类型ID") String productTypeId) {
        log.info("Calculating product cost: factoryId={}, productTypeId={}", factoryId, productTypeId);
        return ApiResponse.success(bomService.calculateProductCost(factoryId, productTypeId));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PostMapping("/cost-summary/batch")
    @Operation(summary = "批量计算产品成本")
    public ApiResponse<List<BomCostSummaryDTO>> calculateCostsBatch(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody List<String> productTypeIds) {
        log.info("Calculating batch product costs: factoryId={}, count={}", factoryId, productTypeIds.size());
        return ApiResponse.success(bomService.calculateProductCosts(factoryId, productTypeIds));
    }

    @GetMapping("/products-with-bom")
    @Operation(summary = "获取有BOM配置的产品列表")
    public ApiResponse<List<String>> getProductTypesWithBom(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {
        log.info("Getting product types with BOM: factoryId={}", factoryId);
        return ApiResponse.success(bomService.getProductTypesWithBom(factoryId));
    }

    // ========== Request DTO → Entity mappers (Rule 17.1 cleanup, PR #370) ==========

    /**
     * Map CreateBomItemRequest → BomItem entity. Defaults align with the
     * legacy @Builder.Default values on BomItem (yieldRate=100.00, taxRate=0,
     * materialCategory="RAW", sortOrder=0) so the wire contract stays
     * permissive: callers may omit these and persistence sees the same
     * defaults as before the refactor.
     */
    private static BomItem toBomItem(CreateBomItemRequest r) {
        BomItem b = new BomItem();
        b.setProductTypeId(r.getProductTypeId());
        b.setProductName(r.getProductName());
        b.setMaterialTypeId(r.getMaterialTypeId());
        b.setMaterialName(r.getMaterialName());
        b.setStandardQuantity(r.getStandardQuantity());
        b.setYieldRate(r.getYieldRate() != null ? r.getYieldRate() : new BigDecimal("100.00"));
        b.setUnit(r.getUnit());
        b.setUnitPrice(r.getUnitPrice());
        b.setTaxRate(r.getTaxRate() != null ? r.getTaxRate() : BigDecimal.ZERO);
        b.setMaterialCategory(r.getMaterialCategory() != null ? r.getMaterialCategory() : "RAW");
        b.setSortOrder(r.getSortOrder() != null ? r.getSortOrder() : 0);
        b.setRemark(r.getRemark());
        return b;
    }

    /** Update variant — same shape as create (PUT is full-replace). */
    private static BomItem toBomItem(UpdateBomItemRequest r) {
        BomItem b = new BomItem();
        b.setProductTypeId(r.getProductTypeId());
        b.setProductName(r.getProductName());
        b.setMaterialTypeId(r.getMaterialTypeId());
        b.setMaterialName(r.getMaterialName());
        b.setStandardQuantity(r.getStandardQuantity());
        b.setYieldRate(r.getYieldRate() != null ? r.getYieldRate() : new BigDecimal("100.00"));
        b.setUnit(r.getUnit());
        b.setUnitPrice(r.getUnitPrice());
        b.setTaxRate(r.getTaxRate() != null ? r.getTaxRate() : BigDecimal.ZERO);
        b.setMaterialCategory(r.getMaterialCategory() != null ? r.getMaterialCategory() : "RAW");
        b.setSortOrder(r.getSortOrder() != null ? r.getSortOrder() : 0);
        b.setRemark(r.getRemark());
        return b;
    }

    /**
     * Map CreateLaborCostRequest → LaborCostConfig entity. Defaults align with
     * @Builder.Default on LaborCostConfig (defaultQuantity=1, isActive=true,
     * sortOrder=0).
     */
    private static LaborCostConfig toLaborCostConfig(CreateLaborCostRequest r) {
        LaborCostConfig c = new LaborCostConfig();
        c.setProductTypeId(r.getProductTypeId());
        c.setProcessName(r.getProcessName());
        c.setProcessCategory(r.getProcessCategory());
        c.setUnitPrice(r.getUnitPrice());
        c.setPriceUnit(r.getPriceUnit());
        c.setDefaultQuantity(r.getDefaultQuantity() != null ? r.getDefaultQuantity() : BigDecimal.ONE);
        c.setIsActive(r.getIsActive() != null ? r.getIsActive() : Boolean.TRUE);
        c.setSortOrder(r.getSortOrder() != null ? r.getSortOrder() : 0);
        c.setRemark(r.getRemark());
        return c;
    }

    /** Update variant — same shape as create (PUT is full-replace). */
    private static LaborCostConfig toLaborCostConfig(UpdateLaborCostRequest r) {
        LaborCostConfig c = new LaborCostConfig();
        c.setProductTypeId(r.getProductTypeId());
        c.setProcessName(r.getProcessName());
        c.setProcessCategory(r.getProcessCategory());
        c.setUnitPrice(r.getUnitPrice());
        c.setPriceUnit(r.getPriceUnit());
        c.setDefaultQuantity(r.getDefaultQuantity() != null ? r.getDefaultQuantity() : BigDecimal.ONE);
        c.setIsActive(r.getIsActive() != null ? r.getIsActive() : Boolean.TRUE);
        c.setSortOrder(r.getSortOrder() != null ? r.getSortOrder() : 0);
        c.setRemark(r.getRemark());
        return c;
    }
}
