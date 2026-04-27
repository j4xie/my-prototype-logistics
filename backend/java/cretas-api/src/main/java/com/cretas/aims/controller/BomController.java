package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequireModule;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.bom.BomCostSummaryDTO;
import com.cretas.aims.entity.bom.BomChangeLog;
import com.cretas.aims.entity.bom.BomItem;
import com.cretas.aims.entity.bom.LaborCostConfig;
import com.cretas.aims.entity.bom.OverheadCostConfig;
import com.cretas.aims.repository.bom.BomChangeLogRepository;
import com.cretas.aims.service.BomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

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
            @RequestBody BomItem bomItem) {
        log.info("Adding BOM item: factoryId={}, materialName={}", factoryId, bomItem.getMaterialName());
        bomItem.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveBomItem(bomItem));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PutMapping("/items/{id}")
    @Operation(summary = "更新BOM物料")
    public ApiResponse<BomItem> updateBomItem(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "BOM物料ID") Long id,
            @RequestBody BomItem bomItem) {
        log.info("Updating BOM item: factoryId={}, id={}", factoryId, id);
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
            @RequestBody LaborCostConfig config) {
        log.info("Adding labor cost: factoryId={}, processName={}", factoryId, config.getProcessName());
        config.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveLaborCost(config));
    }

    @RequirePermission({"production:read_write", "rd:read_write", "finance:read_write"})
    @PutMapping("/labor/{id}")
    @Operation(summary = "更新人工费用")
    public ApiResponse<LaborCostConfig> updateLaborCost(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "人工费用ID") Long id,
            @RequestBody LaborCostConfig config) {
        log.info("Updating labor cost: factoryId={}, id={}", factoryId, id);
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
        config.setId(id);
        config.setFactoryId(factoryId);
        return ApiResponse.success(bomService.saveOverheadCost(config));
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
}
