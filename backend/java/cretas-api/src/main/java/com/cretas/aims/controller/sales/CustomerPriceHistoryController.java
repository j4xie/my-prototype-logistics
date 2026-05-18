package com.cretas.aims.controller.sales;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.CustomerPriceHistory;
import com.cretas.aims.service.CustomerPriceMemoryService;
import com.cretas.aims.utils.FactoryAccessValidator;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Sprint 4 W2 S-PRICE-1 follow-up (2026-05-18 customer feedback) — 客户记忆价 REST 查询.
 *
 * <p>之前只有 listener + service (auto-write on SO confirm + prefill helper), 缺前端可消费的
 * GET endpoint. 配套 web-admin 端 PriceHistoryDialog (RowAction "价格历史").
 *
 * <h4>Endpoint</h4>
 * <pre>
 * GET /api/mobile/{factoryId}/customer-price-history
 *     ?productId=...
 *     [&amp;customerId=...]
 *     [&amp;limit=20]
 * </pre>
 * <ul>
 *   <li><b>productId</b> 必填 — 对应 {@code customer_price_history.product_type_id}</li>
 *   <li><b>customerId</b> 可选 — 缺省时返回该产品在所有客户的成交历史 (e.g. 成品库存视图无 customer 上下文).</li>
 *   <li><b>limit</b> 默认 20, 最大 200 (服务层 clamp).</li>
 * </ul>
 *
 * <h4>响应</h4>
 * 按 {@code order_date DESC, created_at DESC} 排序. {@code unitPrice} 字段为
 * {@link com.cretas.aims.security.PriceSensitive} — 无 {@code procurement:price:view}
 * 权限的角色看到 list 中的 unitPrice 字段已被 {@code PriceFieldResponseAdvice} 置 null.
 *
 * <h4>RBAC</h4>
 * 读权限 — 销售/财务 + 工厂总监. 平台管理员经 RequireRoleInterceptor PLATFORM_ADMIN_ROLES bypass.
 * (warehouse_manager/operator/quality_inspector 等无 view 价 history 必要, 不放).
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/customer-price-history")
@RequiredArgsConstructor
@Tag(name = "客户记忆价 (Sprint 4 W2)",
     description = "GET 历史成交价 — 用于 RowAction 价格历史 Dialog")
public class CustomerPriceHistoryController {

    private final CustomerPriceMemoryService priceMemoryService;
    private final FactoryAccessValidator factoryAccessValidator;

    @GetMapping
    @Operation(summary = "查询客户/产品 成交价历史 (按 orderDate DESC)")
    @RequireRole({"factory_super_admin", "sales_manager", "salesperson",
                  "finance_manager", "procurement_manager", "dispatcher"})
    public ApiResponse<List<CustomerPriceHistory>> listHistory(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) String customerId,
            @RequestParam @NotBlank String productId,
            @RequestParam(defaultValue = "20") int limit) {
        factoryAccessValidator.validateAccess(factoryId);
        // Note: productId path-param 名字对齐前端 dialog 习惯, 实际查 product_type_id (per entity).
        List<CustomerPriceHistory> rows = priceMemoryService.findHistory(
                factoryId,
                (customerId != null && !customerId.isBlank()) ? customerId : null,
                productId,
                limit);
        log.debug("price-history query: factory={}, customer={}, product={}, limit={}, returned={}",
                factoryId, customerId, productId, limit, rows.size());
        return ApiResponse.success("查询成功", rows);
    }
}
