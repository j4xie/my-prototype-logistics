package com.cretas.aims.controller.inventory;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.inventory.SalesOrderShortageReport;
import com.cretas.aims.repository.inventory.SalesOrderShortageReportRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 销售订单缺料分析 REST (Sprint 2 Track E — S-MRP-1 / N31)
 *
 * <p>仅 1 个 endpoint — RN {@code SalesOrderShortageReviewScreen} + AIChat
 * {@code ShortageAnalysisTool} 通过此接口拉取已生成的快照。AI Tool 自身可直接调
 * {@code ShortageAnalysisService.analyzeForSalesOrder} (live 模式, 不走本 endpoint)。
 *
 * <p>报告由 {@code SalesOrderShortageReportListener} 在销售订单财务审核通过后异步生成。
 * 未审核的订单返回 NOT_AVAILABLE 占位状态 — 前端展示 "审核通过后可见缺料分析"。
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/sales/orders")
@RequiredArgsConstructor
@Tag(name = "销售订单缺料分析", description = "Sprint 2 N31 — read 缺料快照报告")
public class SalesOrderShortageController {

    private final SalesOrderShortageReportRepository reportRepository;

    @GetMapping("/{orderId}/shortage-report")
    @Operation(summary = "查询销售订单的缺料分析报告",
            description = "异步生成 — 财务审核通过后约 1-3 秒可见; 未生成时 status=NOT_AVAILABLE")
    @RequirePermission({"sales:read_write", "sales:read"})
    public ApiResponse<SalesOrderShortageReport> getShortageReport(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String orderId) {
        return reportRepository.findByFactoryIdAndSalesOrderId(factoryId, orderId)
                .map(report -> ApiResponse.success("查询成功", report))
                .orElseGet(() -> {
                    SalesOrderShortageReport placeholder = new SalesOrderShortageReport();
                    placeholder.setFactoryId(factoryId);
                    placeholder.setSalesOrderId(orderId);
                    placeholder.setAnalysisStatus("NOT_AVAILABLE");
                    placeholder.setAnalysisSummary("缺料分析尚未生成 — 请确认销售订单已通过财务审核, 或稍后重试。");
                    return ApiResponse.success("缺料分析尚未生成", placeholder);
                });
    }
}
