package com.cretas.aims.controller.warehouse;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.warehouse.ReusableContainer;
import com.cretas.aims.entity.warehouse.ReusableContainerTransaction;
import com.cretas.aims.service.warehouse.ReusableContainerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 周转耗材 (周转框) 进销存 — C4
 * 客户原话 (Apr 7 会议 3428-3475s): 周转框丢了客户要赔钱, 需要管理在库/在客户处
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/reusable-containers")
@RequiredArgsConstructor
@Tag(name = "周转耗材管理", description = "周转框/塑料筐进销存 — 在库/在客户处/丢失赔偿")
public class ReusableContainerController {

    private final ReusableContainerService service;

    @GetMapping
    public ApiResponse<Page<ReusableContainer>> list(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(service.listContainers(factoryId, PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ApiResponse<ReusableContainer> get(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id) {
        return ApiResponse.success(service.getContainer(factoryId, id));
    }

    @PostMapping
    public ApiResponse<ReusableContainer> create(
            @PathVariable @NotBlank String factoryId,
            @RequestBody ReusableContainer dto) {
        return ApiResponse.success("创建成功", service.createContainer(factoryId, dto));
    }

    @PostMapping("/{id}/ship-out")
    public ApiResponse<ReusableContainerTransaction> shipOut(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id,
            @RequestBody Map<String, Object> body) {
        Integer quantity = parseInt(body.get("quantity"));
        return ApiResponse.success("已发出", service.shipOut(factoryId, id, quantity,
                (String) body.get("customerId"),
                (String) body.get("customerName"),
                (String) body.get("salesDeliveryId"),
                (String) body.get("remark")));
    }

    @PostMapping("/{id}/return-in")
    public ApiResponse<ReusableContainerTransaction> returnIn(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id,
            @RequestBody Map<String, Object> body) {
        Integer quantity = parseInt(body.get("quantity"));
        return ApiResponse.success("已归还", service.returnIn(factoryId, id, quantity,
                (String) body.get("customerId"),
                (String) body.get("customerName"),
                (String) body.get("remark")));
    }

    @PostMapping("/{id}/loss")
    public ApiResponse<ReusableContainerTransaction> loss(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id,
            @RequestBody Map<String, Object> body) {
        Integer quantity = parseInt(body.get("quantity"));
        BigDecimal comp = body.get("compensationAmount") == null ? null
                : new BigDecimal(body.get("compensationAmount").toString());
        return ApiResponse.success("已登记丢失", service.markLoss(factoryId, id, quantity,
                (String) body.get("customerId"),
                (String) body.get("customerName"),
                comp,
                (String) body.get("remark")));
    }

    @GetMapping("/{id}/transactions")
    public ApiResponse<List<ReusableContainerTransaction>> transactions(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String id) {
        return ApiResponse.success(service.listTransactions(factoryId, id));
    }

    @GetMapping("/customer-balances")
    public ApiResponse<List<Map<String, Object>>> customerBalances(
            @PathVariable @NotBlank String factoryId) {
        return ApiResponse.success(service.customerBalances(factoryId));
    }

    private Integer parseInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        return Integer.parseInt(o.toString());
    }
}
