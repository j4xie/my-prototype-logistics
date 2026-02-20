package com.cretas.aims.controller.inventory;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.inventory.TransferService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/transfers")
@RequiredArgsConstructor
@Tag(name = "内部调拨", description = "总部↔分店/分厂 物资调拨管理")
public class TransferController {

    private final TransferService transferService;
    private final MobileService mobileService;

    @PostMapping
    @Operation(summary = "创建调拨单")
    public ApiResponse<InternalTransfer> createTransfer(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateTransferRequest request) {
        Long userId = extractUserId(authorization);
        log.info("创建调拨单: sourceFactory={}, targetFactory={}", factoryId, request.getTargetFactoryId());
        InternalTransfer transfer = transferService.createTransfer(factoryId, request, userId);
        return ApiResponse.success("调拨单创建成功", transfer);
    }

    @GetMapping
    @Operation(summary = "调拨单列表（双向视角）")
    public ApiResponse<PageResponse<InternalTransfer>> listTransfers(
            @PathVariable @NotBlank String factoryId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<InternalTransfer> result = transferService.getTransfers(factoryId, page, size);
        return ApiResponse.success("查询成功", result);
    }

    @GetMapping("/{transferId}")
    @Operation(summary = "调拨单详情")
    public ApiResponse<InternalTransfer> getTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId) {
        InternalTransfer transfer = transferService.getTransferById(transferId);
        return ApiResponse.success("查询成功", transfer);
    }

    @PostMapping("/{transferId}/request")
    @Operation(summary = "提交调拨申请")
    public ApiResponse<InternalTransfer> requestTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.requestTransfer(transferId, userId);
        return ApiResponse.success("调拨申请已提交", transfer);
    }

    @PostMapping("/{transferId}/approve")
    @Operation(summary = "审批通过")
    public ApiResponse<InternalTransfer> approveTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.approveTransfer(transferId, userId);
        return ApiResponse.success("调拨已审批通过", transfer);
    }

    @PostMapping("/{transferId}/reject")
    @Operation(summary = "驳回调拨")
    public ApiResponse<InternalTransfer> rejectTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization,
            @RequestParam(required = false) String reason) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.rejectTransfer(transferId, userId, reason);
        return ApiResponse.success("调拨已驳回", transfer);
    }

    @PostMapping("/{transferId}/ship")
    @Operation(summary = "调拨发货（扣减调出方库存）")
    public ApiResponse<InternalTransfer> shipTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.shipTransfer(transferId, userId);
        return ApiResponse.success("调拨已发货", transfer);
    }

    @PostMapping("/{transferId}/receive")
    @Operation(summary = "调拨签收")
    public ApiResponse<InternalTransfer> receiveTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.receiveTransfer(transferId, userId);
        return ApiResponse.success("调拨已签收", transfer);
    }

    @PostMapping("/{transferId}/confirm")
    @Operation(summary = "确认调拨（调入方入库）")
    public ApiResponse<InternalTransfer> confirmTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.confirmTransfer(transferId, userId);
        return ApiResponse.success("调拨已确认，库存已更新", transfer);
    }

    @PostMapping("/{transferId}/cancel")
    @Operation(summary = "取消调拨")
    public ApiResponse<InternalTransfer> cancelTransfer(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String transferId,
            @RequestHeader("Authorization") String authorization,
            @RequestParam(required = false) String reason) {
        Long userId = extractUserId(authorization);
        InternalTransfer transfer = transferService.cancelTransfer(transferId, userId, reason);
        return ApiResponse.success("调拨已取消", transfer);
    }

    @GetMapping("/statistics")
    @Operation(summary = "调拨统计")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @NotBlank String factoryId) {
        Map<String, Object> stats = transferService.getTransferStatistics(factoryId);
        return ApiResponse.success("查询成功", stats);
    }

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
