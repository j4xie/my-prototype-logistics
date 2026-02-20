package com.cretas.aims.controller.finance;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.finance.RecordTransactionRequest;
import com.cretas.aims.entity.enums.CounterpartyType;
import com.cretas.aims.entity.enums.PaymentMethod;
import com.cretas.aims.entity.finance.ArApTransaction;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.finance.ArApService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/finance")
@RequiredArgsConstructor
@Tag(name = "应收应付管理", description = "AR/AP 交易记录、对账单、账龄分析")
public class ArApController {

    private final ArApService arApService;
    private final MobileService mobileService;

    // ==================== 应收（AR） ====================

    @PostMapping("/receivable")
    @Operation(summary = "记录应收挂账（销售出货）")
    public ApiResponse<ArApTransaction> recordReceivable(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody RecordTransactionRequest request) {
        Long userId = extractUserId(authorization);
        ArApTransaction transaction = arApService.recordReceivable(
                factoryId, request.getCounterpartyId(), request.getOrderId(),
                request.getAmount(), request.getDueDate(), userId, request.getRemark());
        return ApiResponse.success("应收记录创建成功", transaction);
    }

    @PostMapping("/receivable/payment")
    @Operation(summary = "记录客户付款（冲减应收）")
    public ApiResponse<ArApTransaction> recordArPayment(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody RecordTransactionRequest request) {
        Long userId = extractUserId(authorization);
        PaymentMethod method = request.getPaymentMethod() != null
                ? PaymentMethod.valueOf(request.getPaymentMethod()) : PaymentMethod.BANK_TRANSFER;
        ArApTransaction transaction = arApService.recordArPayment(
                factoryId, request.getCounterpartyId(), request.getAmount(),
                method, request.getPaymentReference(), userId, request.getRemark());
        return ApiResponse.success("收款记录创建成功", transaction);
    }

    // ==================== 应付（AP） ====================

    @PostMapping("/payable")
    @Operation(summary = "记录应付挂账（采购入库）")
    public ApiResponse<ArApTransaction> recordPayable(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody RecordTransactionRequest request) {
        Long userId = extractUserId(authorization);
        ArApTransaction transaction = arApService.recordPayable(
                factoryId, request.getCounterpartyId(), request.getOrderId(),
                request.getAmount(), request.getDueDate(), userId, request.getRemark());
        return ApiResponse.success("应付记录创建成功", transaction);
    }

    @PostMapping("/payable/payment")
    @Operation(summary = "记录向供应商付款（冲减应付）")
    public ApiResponse<ArApTransaction> recordApPayment(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody RecordTransactionRequest request) {
        Long userId = extractUserId(authorization);
        PaymentMethod method = request.getPaymentMethod() != null
                ? PaymentMethod.valueOf(request.getPaymentMethod()) : PaymentMethod.BANK_TRANSFER;
        ArApTransaction transaction = arApService.recordApPayment(
                factoryId, request.getCounterpartyId(), request.getAmount(),
                method, request.getPaymentReference(), userId, request.getRemark());
        return ApiResponse.success("付款记录创建成功", transaction);
    }

    // ==================== 手工调整 ====================

    @PostMapping("/adjustment")
    @Operation(summary = "手工调整余额")
    public ApiResponse<ArApTransaction> recordAdjustment(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @RequestParam CounterpartyType counterpartyType,
            @Valid @RequestBody RecordTransactionRequest request) {
        Long userId = extractUserId(authorization);
        ArApTransaction transaction = arApService.recordAdjustment(
                factoryId, counterpartyType, request.getCounterpartyId(),
                request.getAmount(), userId, request.getRemark());
        return ApiResponse.success("调整记录创建成功", transaction);
    }

    // ==================== 查询 ====================

    @GetMapping("/transactions")
    @Operation(summary = "交易记录列表")
    public ApiResponse<PageResponse<ArApTransaction>> listTransactions(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(required = false) CounterpartyType counterpartyType,
            @RequestParam(required = false) String counterpartyId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<ArApTransaction> result = arApService.getTransactions(
                factoryId, counterpartyType, counterpartyId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/statement")
    @Operation(summary = "对账单（指定期间的交易明细+期初期末余额）")
    public ApiResponse<Map<String, Object>> getStatement(
            @PathVariable @NotBlank String factoryId,
            @RequestParam CounterpartyType counterpartyType,
            @RequestParam String counterpartyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        Map<String, Object> statement = arApService.getStatement(
                factoryId, counterpartyType, counterpartyId, startDate, endDate);
        return ApiResponse.success("查询成功", statement);
    }

    @GetMapping("/aging")
    @Operation(summary = "账龄分析（6桶）")
    public ApiResponse<List<Map<String, Object>>> getAgingAnalysis(
            @PathVariable @NotBlank String factoryId,
            @RequestParam CounterpartyType counterpartyType) {
        List<Map<String, Object>> aging = arApService.getAgingAnalysis(factoryId, counterpartyType);
        return ApiResponse.success("查询成功", aging);
    }

    @GetMapping("/overview")
    @Operation(summary = "财务概览（应收应付汇总）")
    public ApiResponse<Map<String, Object>> getFinanceOverview(
            @PathVariable @NotBlank String factoryId) {
        Map<String, Object> overview = arApService.getFinanceOverview(factoryId);
        return ApiResponse.success("查询成功", overview);
    }

    @GetMapping("/credit-check")
    @Operation(summary = "信用额度检查")
    public ApiResponse<Map<String, Object>> checkCreditLimit(
            @PathVariable @NotBlank String factoryId,
            @RequestParam @NotBlank String customerId,
            @RequestParam BigDecimal amount) {
        boolean withinLimit = arApService.checkCreditLimit(factoryId, customerId, amount);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("customerId", customerId);
        result.put("requestedAmount", amount);
        result.put("withinCreditLimit", withinLimit);
        return ApiResponse.success("查询成功", result);
    }

    // ==================== 内部方法 ====================

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
