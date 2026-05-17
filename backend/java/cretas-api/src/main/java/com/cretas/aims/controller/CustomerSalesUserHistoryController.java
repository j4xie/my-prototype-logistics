package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.CustomerSalesUserHistory;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.CustomerSalesUserHistoryRepository;
import com.cretas.aims.service.CustomerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Sprint 4 W1 S-CUSTOMER-TAB-1 — tab 20 业务员变更 history.
 *
 * <p>GET /api/mobile/{factoryId}/customer-sales-user-history — list 分页 (tab 20 数据源)
 * <p>POST /api/mobile/{factoryId}/customers/{id}/assigned-sales-user — 变更 + 写 history
 *
 * <p>防呆: R1 (前端 dialog 应预显当前业务员 + 禁同选), R2 (dialog header 客户名/编号),
 * R3 (reason dropdown 6 选项, controller 仅校验非空), R4 (5min dedup 在 service 层).
 * 4 位一体 error: BusinessException(409) 自动 propagate code+message+actionHint.
 *
 * @author Cretas Team
 * @since 2026-05-17
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}")
@RequiredArgsConstructor
public class CustomerSalesUserHistoryController {

    private final CustomerSalesUserHistoryRepository historyRepo;
    private final CustomerService customerService;

    @GetMapping("/customer-sales-user-history")
    public ResponseEntity<ApiResponse<Map<String, Object>>> list(
            @PathVariable String factoryId,
            @RequestParam String customerId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {

        if (page < 1) page = 1;
        if (size < 1 || size > 200) size = 20;

        Page<CustomerSalesUserHistory> p = historyRepo
            .findByFactoryIdAndCustomerIdOrderByChangedAtDesc(
                factoryId, customerId,
                PageRequest.of(page - 1, size, Sort.by("changedAt").descending()));

        Map<String, Object> data = new HashMap<>();
        data.put("content", p.getContent());
        data.put("totalElements", p.getTotalElements());
        data.put("totalPages", p.getTotalPages());
        data.put("page", page);
        data.put("size", size);

        return ResponseEntity.ok(ApiResponse.success("ok", data));
    }

    @PostMapping("/customers/{customerId}/assigned-sales-user")
    public ResponseEntity<ApiResponse<Object>> change(
            @PathVariable String factoryId,
            @PathVariable String customerId,
            @RequestBody Map<String, Object> body,
            @RequestAttribute(value = "userId", required = false) Long userId) {

        // 4 位一体: 校验失败时 message 具体 + actionHint 提示如何修复
        Object newUserIdObj = body.get("newSalesUserId");
        if (newUserIdObj == null) {
            throw new BusinessException(400, "newSalesUserId 必填 — 请选择新业务员后再提交");
        }
        Long newSalesUserId;
        try {
            newSalesUserId = Long.valueOf(newUserIdObj.toString());
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "newSalesUserId 必须为数字 user id");
        }

        String reason = (String) body.get("reason");
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(400, "reason 必填 — 请从 dropdown 选择变更原因 (R3 防呆)");
        }

        // Service 层处理 R4 dedup (5min 内重复变更抛 409) + Customer save + history insert
        var updated = customerService.updateAssignedSalesUser(
            factoryId, customerId, newSalesUserId, reason, userId);

        log.info("Customer {} 业务员变更 success: newUserId={}, by={}", customerId, newSalesUserId, userId);
        return ResponseEntity.ok(ApiResponse.success("业务员变更成功", updated));
    }
}
