package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.listsummary.ListSummaryRequest;
import com.cretas.aims.dto.listsummary.ListSummaryResponse;
import com.cretas.aims.service.listsummary.ListSummaryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * Sprint 2 Track I — U-FOOTER-1 列表底部 sticky footer 实时合计.
 *
 * Path: POST /api/mobile/{factoryId}/list-summary/{entityType}
 *
 * Supported entityType values (Day 2 + Day 4-prep extension):
 *   - salesOrder        — 销售订单 (sales_orders)
 *   - purchaseOrder     — 采购订单 (purchase_orders)
 *   - inventory         — 物料库存 (material_batches)
 *   - wastage           — 餐饮损耗 (wastage_records)
 *   - attendance        — 考勤打卡 (time_clock_records)
 *   - returnOrder       — 退货单 (return_orders)
 *   - internalTransfer  — 内部调拨 (internal_transfers; source 或 target = factoryId)
 *   - qualityInspection — 质检 (quality_inspections; result PASS/FAIL/PENDING)
 *   - productionPlan    — 生产计划 (production_plans; 计划/完成数量 + 完成率)
 *   - shipment          — 发货 (sales_delivery_records; 待发货/已完成 split)
 *
 * Frontend: RN StickyFooterSummary + Vue TableFooter.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/list-summary")
@RequiredArgsConstructor
@Tag(name = "列表合计", description = "Sticky Footer 实时合计 (U-FOOTER-1)")
public class ListSummaryController {

    private final ListSummaryService listSummaryService;

    @PostMapping("/{entityType}")
    @Operation(summary = "查询列表合计统计",
               description = "按 filterConditions 过滤后, 计算 count/sum/avg 等聚合 stat, 给底部 sticky footer 渲染")
    @RequirePermission({"sales:read", "sales:read_write",
                        "procurement:read", "procurement:read_write",
                        "warehouse:read", "warehouse:read_write",
                        "restaurant:read", "restaurant:read_write",
                        "hr:read", "hr:read_write",
                        "quality:read", "quality:read_write"})
    public ApiResponse<ListSummaryResponse> getSummary(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String entityType,
            @RequestBody(required = false) ListSummaryRequest request) {
        if (request == null) {
            request = new ListSummaryRequest();
        }
        log.debug("list-summary: factory={}, entity={}, filter={}",
                factoryId, entityType, request.getFilterConditions());
        ListSummaryResponse response = listSummaryService.computeSummary(factoryId, entityType, request);
        return ApiResponse.success("查询成功", response);
    }
}
