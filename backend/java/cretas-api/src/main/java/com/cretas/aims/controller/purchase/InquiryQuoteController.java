package com.cretas.aims.controller.purchase;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.purchase.AddSupplierPriceRequest;
import com.cretas.aims.dto.purchase.CreateInquiryQuoteRequest;
import com.cretas.aims.dto.purchase.SelectAndConvertRequest;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.purchase.InquiryQuote;
import com.cretas.aims.entity.purchase.InquiryQuoteSupplierPrice;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.purchase.InquiryQuoteService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 核价单 REST 接口 (P-NUCLEAR-1, 28-Backlog #30).
 *
 * <p>询价 → 核价 → 采购 三阶段 pipeline 端点.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/purchase/inquiry-quotes")
@RequiredArgsConstructor
@Tag(name = "核价单管理 (P-NUCLEAR-1)", description = "询价 → 核价 → 采购 三阶段 pipeline")
public class InquiryQuoteController {

    private final InquiryQuoteService inquiryQuoteService;
    private final MobileService mobileService;

    // ==================== 询价单 CRUD ====================

    @PostMapping
    @Operation(summary = "创建核价单 (DRAFT)")
    @RequirePermission("procurement:read_write")
    public ApiResponse<InquiryQuote> create(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateInquiryQuoteRequest request) {
        Long userId = extractUserId(authorization);
        InquiryQuote q = inquiryQuoteService.create(factoryId, request, userId);
        return ApiResponse.success(
                String.format("核价单 %s 创建成功", q.getInquiryNumber()), q);
    }

    @GetMapping
    @Operation(summary = "核价单列表")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<PageResponse<InquiryQuote>> list(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success("查询成功",
                inquiryQuoteService.list(factoryId, page, size));
    }

    @GetMapping("/{inquiryId}")
    @Operation(summary = "核价单详情")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<InquiryQuote> getById(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inquiryId) {
        return ApiResponse.success("查询成功",
                inquiryQuoteService.getById(factoryId, inquiryId));
    }

    @PostMapping("/{inquiryId}/submit")
    @Operation(summary = "提交询价 (DRAFT → INQUIRING)")
    @RequirePermission("procurement:read_write")
    public ApiResponse<InquiryQuote> submit(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inquiryId) {
        InquiryQuote q = inquiryQuoteService.submit(factoryId, inquiryId);
        return ApiResponse.success(
                String.format("核价单 %s 已提交询价", q.getInquiryNumber()), q);
    }

    @PostMapping("/{inquiryId}/cancel")
    @Operation(summary = "取消核价单")
    @RequirePermission("procurement:read_write")
    public ApiResponse<InquiryQuote> cancel(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inquiryId) {
        InquiryQuote q = inquiryQuoteService.cancel(factoryId, inquiryId);
        return ApiResponse.success(
                String.format("核价单 %s 已取消", q.getInquiryNumber()), q);
    }

    // ==================== 供应商报价 ====================

    @PostMapping("/{inquiryId}/supplier-prices")
    @Operation(summary = "添加 / 更新供应商报价",
            description = "同供应商已报价则更新; 第一条报价加入后状态 INQUIRING → QUOTED")
    @RequirePermission("procurement:read_write")
    public ApiResponse<InquiryQuoteSupplierPrice> addSupplierPrice(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inquiryId,
            @Valid @RequestBody AddSupplierPriceRequest request) {
        InquiryQuoteSupplierPrice price = inquiryQuoteService
                .addOrUpdateSupplierPrice(factoryId, inquiryId, request);
        return ApiResponse.success("报价提交成功", price);
    }

    @GetMapping("/{inquiryId}/supplier-prices")
    @Operation(summary = "查询所有供应商报价 (按价格升序)")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<List<InquiryQuoteSupplierPrice>> listSupplierPrices(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inquiryId) {
        return ApiResponse.success("查询成功",
                inquiryQuoteService.listSupplierPrices(factoryId, inquiryId));
    }

    // ==================== 选定 + 转化采购单 ====================

    @PostMapping("/{inquiryId}/select-and-convert")
    @Operation(summary = "选定中标供应商 + 生成采购单 (idempotent)",
            description = "防呆 R4: 同一 inquiry 重复调用 → 409 + 已生成 PO 信息, " +
                    "不重复创建. 前端 catch 409 跳转已有 PO.")
    @RequirePermission("procurement:read_write")
    public ApiResponse<PurchaseOrder> selectAndConvert(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String inquiryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody SelectAndConvertRequest request) {
        Long userId = extractUserId(authorization);
        PurchaseOrder po = inquiryQuoteService
                .selectAndConvertToPurchaseOrder(factoryId, inquiryId, request, userId);
        return ApiResponse.success(
                String.format("核价单已转化为采购单 %s", po.getOrderNumber()), po);
    }

    // ==================== 内部 ====================

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
