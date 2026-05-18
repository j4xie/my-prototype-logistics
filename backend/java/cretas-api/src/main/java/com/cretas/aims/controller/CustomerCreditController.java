package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.customer.CreditStatusDTO;
import com.cretas.aims.service.crm.CustomerCreditCheckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * P1 #23 S-CREDIT-1 — 客户信用状态查询 API (2026-05-17).
 *
 * <p>GET /api/mobile/{factoryId}/customers/{customerId}/credit-status — 信用面板 + 创建 SO 前端预检.
 *
 * <p>设计原则: 只读, 不修改任何数据. 写操作 (调额度/改信用状态) 走 CustomerController PUT.
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/customers")
@RequiredArgsConstructor
@Tag(name = "客户信用管理", description = "P1 #23 S-CREDIT-1: 信用额度 / 账期 / 状态查询")
public class CustomerCreditController {

    private final CustomerCreditCheckService creditCheckService;

    @GetMapping("/{customerId}/credit-status")
    @Operation(
            summary = "查询客户信用状态",
            description = "返回 creditLimit / used / available / exceeds / severity / suggestedAction, 供信用面板 + SO 创建前预检."
    )
    public ApiResponse<CreditStatusDTO> getCreditStatus(
            @Parameter(description = "工厂ID", example = "F001", required = true)
            @PathVariable @NotBlank String factoryId,
            @Parameter(description = "客户ID", required = true)
            @PathVariable @NotBlank String customerId,
            @Parameter(description = "可选: 拟下单金额, 用于预判是否超额", example = "5000.00")
            @RequestParam(required = false) BigDecimal requestedAmount) {

        BigDecimal req = requestedAmount != null ? requestedAmount : BigDecimal.ZERO;
        log.debug("查询客户信用: factoryId={}, customerId={}, requestedAmount={}",
                factoryId, customerId, req);
        CreditStatusDTO dto = creditCheckService.checkCreditAvailable(factoryId, customerId, req);
        return ApiResponse.success("查询成功", dto);
    }
}
