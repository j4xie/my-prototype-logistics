package com.cretas.aims.controller.sales;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.sales.BatchAllocationDTO;
import com.cretas.aims.entity.sales.SalesDeliveryItemBatchAllocation;
import com.cretas.aims.service.sales.SalesDeliveryBatchAllocationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * PC 端销售发货批次分配 REST 接口（P0-13 昆山六扇门）。
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "销售发货批次分配", description = "P0-13 强制批次追溯")
@RequestMapping("/api/mobile/{factoryId}/sales-deliveries/items/{deliveryItemId}/batch-allocations")
public class SalesDeliveryBatchAllocationController {

    private final SalesDeliveryBatchAllocationService service;

    @GetMapping
    @Operation(summary = "查询某发货行的批次分配")
    public ApiResponse<List<SalesDeliveryItemBatchAllocation>> list(
            @PathVariable String factoryId,
            @PathVariable String deliveryItemId) {
        return ApiResponse.success("查询成功", service.listByDeliveryItem(factoryId, deliveryItemId));
    }

    @PostMapping
    @Operation(summary = "设置发货行的批次分配（先清空再写入）")
    public ApiResponse<Map<String, Object>> allocate(
            @PathVariable String factoryId,
            @PathVariable String deliveryItemId,
            @RequestBody AllocateRequest request) {
        service.allocateBatches(factoryId, deliveryItemId, request.getAllocations());
        return ApiResponse.success("批次分配成功", Map.of(
                "deliveryItemId", deliveryItemId,
                "fullyAllocated", service.isFullyAllocated(factoryId, deliveryItemId)
        ));
    }

    @DeleteMapping
    @Operation(summary = "清空发货行的批次分配")
    public ApiResponse<Void> clear(
            @PathVariable String factoryId,
            @PathVariable String deliveryItemId) {
        service.clearAllocations(factoryId, deliveryItemId);
        return ApiResponse.success("清空成功", null);
    }

    @lombok.Data
    public static class AllocateRequest {
        private List<BatchAllocationDTO> allocations;
    }
}
