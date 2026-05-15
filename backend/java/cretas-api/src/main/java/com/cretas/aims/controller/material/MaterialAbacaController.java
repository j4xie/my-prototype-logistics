package com.cretas.aims.controller.material;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.material.CreateAbacaQuantityLogRequest;
import com.cretas.aims.entity.warehouse.AbacaQuantityLog;
import com.cretas.aims.service.MobileService;
import com.cretas.aims.service.material.AbacaQuantityLogService;
import com.cretas.aims.utils.TokenUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 抄码品称重日志 Controller (W-ABA-1).
 *
 * <p>Base path: <code>/api/mobile/{factoryId}/material/abaca-log</code></p>
 *
 * <p>6 个 endpoints (per SCHEMA_DESIGN.md §2.1):</p>
 * <ol>
 *   <li>GET    ?batchId=...    — 批次全部称重 + 汇总</li>
 *   <li>GET    /{id}           — 详情</li>
 *   <li>POST   /               — 单箱称重新增</li>
 *   <li>POST   /batch          — 批量称重 (同批次 N 箱一次提交)</li>
 *   <li>PUT    /{id}/verify    — 复核 (双签)</li>
 *   <li>DELETE /{id}           — 软删除 (仅未复核可删)</li>
 * </ol>
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/material/abaca-log")
@RequiredArgsConstructor
@Tag(name = "抄码品称重日志", description = "W-ABA-1 抄码品入库实际称重 (六扇门卤制品工厂刚需)")
public class MaterialAbacaController {

    private final AbacaQuantityLogService abacaService;
    private final MobileService mobileService;

    @Operation(summary = "列表 — 按批次查询全部称重 + 累计汇总")
    @GetMapping
    public ApiResponse<Map<String, Object>> listByBatch(
            @PathVariable String factoryId,
            @RequestParam @NotBlank String batchId) {
        return ApiResponse.success(abacaService.listByBatch(factoryId, batchId));
    }

    @Operation(summary = "详情 — 单条称重记录 + 批次累计汇总")
    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> getById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ApiResponse.success(abacaService.getById(factoryId, id));
    }

    @Operation(summary = "新增 — 单箱称重")
    @PostMapping
    public ApiResponse<Map<String, Object>> create(
            @PathVariable String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody CreateAbacaQuantityLogRequest req) {
        Long userId = currentUserId(authorization);
        return ApiResponse.success("称重记录已创建", abacaService.create(factoryId, userId, req));
    }

    @Operation(summary = "批量新增 — 同批次 N 箱一次提交")
    @PostMapping("/batch")
    public ApiResponse<Map<String, Object>> createBatch(
            @PathVariable String factoryId,
            @RequestHeader("Authorization") String authorization,
            @Valid @RequestBody List<CreateAbacaQuantityLogRequest> reqs) {
        Long userId = currentUserId(authorization);
        return ApiResponse.success("批量称重已创建", abacaService.createBatch(factoryId, userId, reqs));
    }

    @Operation(summary = "复核 (双签) — 设置 verifiedBy + verifiedAt")
    @PutMapping("/{id}/verify")
    public ApiResponse<AbacaQuantityLog> verify(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestHeader("Authorization") String authorization) {
        Long userId = currentUserId(authorization);
        return ApiResponse.success("复核成功", abacaService.verify(factoryId, id, userId));
    }

    @Operation(summary = "软删除 — 仅未复核可删")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> softDelete(
            @PathVariable String factoryId,
            @PathVariable String id) {
        abacaService.softDelete(factoryId, id);
        return ApiResponse.successMessage("称重记录已删除");
    }

    private Long currentUserId(String authorization) {
        String token = TokenUtils.extractToken(authorization);
        return mobileService.getUserFromToken(token).getId();
    }
}
