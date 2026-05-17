package com.cretas.aims.controller.warehouse;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.inventory.SalesDeliveryRecord;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.inventory.SalesService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Issue #740: 仓库侧发货单 confirm 流程 (六扇门 May10 会议).
 *
 * <p>客户决定: 销售只创建发货单 (不扣库存) → 仓库接收 → 仓库确认实发数量 → 扣库存出送货单
 *
 * <p>权限严格: 所有 endpoint 要求 {@code warehouse:read_write} — 销售角色不可直接调用.
 * 销售要"出库"必须走 {@code POST /api/mobile/{factoryId}/sales/deliveries} 创建 DRAFT,
 * 然后等仓库这边 confirm.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/warehouse/deliveries")
@RequiredArgsConstructor
@Tag(name = "仓库发货管理", description = "销售发货单的仓库侧确认 (Issue #740 — 六扇门 May10)")
public class WarehouseDeliveryController {

    private final SalesService salesService;
    private final MobileService mobileService;

    @GetMapping("/pending")
    @Operation(summary = "待仓库确认发货单列表",
            description = "返回 status IN (DRAFT, PENDING_WAREHOUSE_CONFIRM, PICKED) 的发货单")
    @RequirePermission({"warehouse:read_write", "warehouse:read"})
    public ApiResponse<PageResponse<SalesDeliveryRecord>> listPending(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SalesDeliveryRecord> result = salesService.getPendingWarehouseDeliveries(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    /**
     * Confirm + 扣库存 + 出送货单.
     *
     * <p>Request body example:
     * <pre>
     * {
     *   "actualQuantities": {
     *     "12345": 80,    // deliveryItemId → 实际发货数量 (kg/件等)
     *     "12346": 100
     *   }
     * }
     * </pre>
     * <p>如果 actualQuantities 为空 / 缺少某行, 则按销售-planned deliveredQuantity 走.
     *
     * <p>批次分配 (P0-13) 总量必须等于最终 deliveredQuantity, 否则 reject. 若仓库调整数量
     * 后不匹配, 需先去 "发货记录 → 分配批次" 重新分配, 再 confirm.
     */
    @PostMapping("/{deliveryId}/confirm")
    @Operation(summary = "仓库确认发货 (扣库存)",
            description = "Issue #740 客户决定: 实际发货数量由仓库填写, 扣库存动作在此触发")
    @RequirePermission("warehouse:read_write")
    public ApiResponse<SalesDeliveryRecord> confirmDelivery(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String deliveryId,
            @RequestHeader("Authorization") String authorization,
            @RequestBody(required = false) Map<String, Object> body) {
        Long userId = extractUserId(authorization);

        // Parse actualQuantities map — accept {itemId: number} or {actualQuantities: {...}}
        Map<String, BigDecimal> actualQuantities = parseActualQuantities(body);

        log.info("仓库 confirm 发货: factoryId={}, deliveryId={}, actualQuantities={}, userId={}",
                factoryId, deliveryId,
                actualQuantities == null ? "<none>" : actualQuantities.size() + "项",
                userId);

        SalesDeliveryRecord record = salesService.warehouseConfirmDelivery(
                factoryId, deliveryId, actualQuantities, userId);
        return ApiResponse.success("发货确认成功, 成品库存已扣减", record);
    }

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }

    /**
     * Parse actualQuantities from request body. Accepts either:
     * <ul>
     *   <li>{@code {"actualQuantities": {"itemId": qty, ...}}}</li>
     *   <li>{@code {"itemId": qty, ...}} (flat form)</li>
     * </ul>
     */
    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> parseActualQuantities(Map<String, Object> body) {
        if (body == null || body.isEmpty()) {
            return Collections.emptyMap();
        }
        Object inner = body.get("actualQuantities");
        Map<String, Object> source = (inner instanceof Map) ? (Map<String, Object>) inner : body;
        Map<String, BigDecimal> result = new HashMap<>();
        for (Map.Entry<String, Object> e : source.entrySet()) {
            if (e.getValue() == null) continue;
            try {
                result.put(e.getKey(), new BigDecimal(e.getValue().toString()));
            } catch (NumberFormatException nfe) {
                // skip malformed values, log for diagnosis
                log.warn("actualQuantities value not numeric: key={}, value={}", e.getKey(), e.getValue());
            }
        }
        return result;
    }
}
