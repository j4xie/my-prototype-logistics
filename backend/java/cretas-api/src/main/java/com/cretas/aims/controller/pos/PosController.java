package com.cretas.aims.controller.pos;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.enums.PosBrand;
import com.cretas.aims.entity.pos.PosConnection;
import com.cretas.aims.entity.pos.PosOrderSync;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.pos.PosAdapterRegistry;
import com.cretas.aims.service.pos.PosIntegrationService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/pos")
@RequiredArgsConstructor
@Tag(name = "POS集成管理", description = "POS系统连接、同步、Webhook管理")
public class PosController {

    private final PosIntegrationService posService;
    private final PosAdapterRegistry adapterRegistry;
    private final MobileService mobileService;

    // ==================== 连接管理 ====================

    @PostMapping("/connections")
    @Operation(summary = "创建POS连接")
    public ApiResponse<PosConnection> createConnection(
            @PathVariable @NotBlank String factoryId,
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> request) {
        Long userId = extractUserId(authorization);
        PosConnection connection = posService.createConnection(
                factoryId,
                PosBrand.valueOf(request.get("brand")),
                request.get("connectionName"),
                request.get("appKey"),
                request.get("appSecret"),
                request.get("posStoreId"),
                userId,
                request.get("remark"));
        return ApiResponse.success("POS连接创建成功", connection);
    }

    @GetMapping("/connections")
    @Operation(summary = "POS连接列表")
    public ApiResponse<List<PosConnection>> listConnections(
            @PathVariable @NotBlank String factoryId) {
        List<PosConnection> connections = posService.getConnections(factoryId);
        return ApiResponse.success("查询成功", connections);
    }

    @GetMapping("/connections/{connectionId}")
    @Operation(summary = "POS连接详情")
    public ApiResponse<PosConnection> getConnection(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String connectionId) {
        PosConnection connection = posService.getConnection(factoryId, connectionId);
        return ApiResponse.success("查询成功", connection);
    }

    @DeleteMapping("/connections/{connectionId}")
    @Operation(summary = "删除POS连接")
    public ApiResponse<Void> deleteConnection(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String connectionId) {
        posService.deleteConnection(factoryId, connectionId);
        return ApiResponse.success("POS连接删除成功", null);
    }

    @PostMapping("/connections/{connectionId}/toggle")
    @Operation(summary = "启用/停用POS连接")
    public ApiResponse<PosConnection> toggleConnection(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String connectionId,
            @RequestParam boolean active) {
        PosConnection connection = posService.toggleConnection(factoryId, connectionId, active);
        return ApiResponse.success(active ? "POS连接已启用" : "POS连接已停用", connection);
    }

    // ==================== 连接测试 ====================

    @PostMapping("/connections/{connectionId}/test")
    @Operation(summary = "测试POS连接")
    public ApiResponse<Map<String, Object>> testConnection(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String connectionId) {
        boolean success = posService.testConnection(factoryId, connectionId);
        Map<String, Object> result = Map.of("connectionId", connectionId, "success", success);
        return ApiResponse.success(success ? "连接测试成功" : "连接测试失败", result);
    }

    // ==================== 手动同步 ====================

    @PostMapping("/connections/{connectionId}/sync")
    @Operation(summary = "手动触发订单同步")
    public ApiResponse<List<PosOrderSync>> syncOrders(
            @PathVariable @NotBlank String factoryId,
            @PathVariable @NotBlank String connectionId) {
        List<PosOrderSync> results = posService.syncOrders(factoryId, connectionId);
        return ApiResponse.success("同步完成，新增" + results.size() + "条订单", results);
    }

    // ==================== Webhook回调 ====================

    @PostMapping("/webhook/{brand}")
    @Operation(summary = "POS Webhook回调入口")
    public ApiResponse<Void> handleWebhook(
            @PathVariable @NotBlank String factoryId,
            @PathVariable String brand,
            @RequestBody String payload,
            @RequestHeader(value = "X-Signature", required = false) String signature,
            @RequestHeader Map<String, String> headers) {
        PosBrand posBrand = PosBrand.valueOf(brand.toUpperCase());
        posService.handleWebhook(factoryId, posBrand, payload, signature, headers);
        return ApiResponse.success("Webhook处理成功", null);
    }

    // ==================== 统计与查询 ====================

    @GetMapping("/statistics")
    @Operation(summary = "POS集成统计")
    public ApiResponse<Map<String, Object>> getStatistics(
            @PathVariable @NotBlank String factoryId) {
        Map<String, Object> stats = posService.getStatistics(factoryId);
        return ApiResponse.success("查询成功", stats);
    }

    @GetMapping("/supported-brands")
    @Operation(summary = "查询已支持的POS品牌")
    public ApiResponse<Set<PosBrand>> getSupportedBrands(
            @PathVariable @NotBlank String factoryId) {
        return ApiResponse.success("查询成功", adapterRegistry.getRegisteredBrands());
    }

    // ==================== 内部方法 ====================

    private Long extractUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
