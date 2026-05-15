package com.cretas.aims.controller.material;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.material.CreateAbacaQuantityLogRequest;
import com.cretas.aims.entity.warehouse.AbacaQuantityLog;
import com.cretas.aims.service.material.AbacaQuantityLogService;
import com.cretas.aims.utils.SecurityUtils;
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
 *   <li>GET    ?batchId=...    — 批次全部称重 + 汇总       (procurement:read)</li>
 *   <li>GET    /{id}           — 详情                       (procurement:read)</li>
 *   <li>POST   /               — 单箱称重新增              (procurement:read_write)</li>
 *   <li>POST   /batch          — 批量称重 (同批次 N 箱一次提交) (procurement:read_write)</li>
 *   <li>PUT    /{id}/verify    — 复核 (双签)               (procurement:read_write)</li>
 *   <li>DELETE /{id}           — 软删除 (仅未复核可删)     (procurement:read_write)</li>
 * </ol>
 *
 * <p>RBAC: Sprint1-Fix-K3 (#649 follow-up) — 每个 endpoint 加 @RequirePermission +
 * 删除自定义 JWT parse helper, 统一改用 {@link SecurityUtils#getCurrentUserId()}.
 * Service 层既有双签 / 已复核拒删 / factory 隔离 invariant 保留作 belt+suspenders.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/material/abaca-log")
@RequiredArgsConstructor
@Tag(name = "抄码品称重日志", description = "W-ABA-1 抄码品入库实际称重 (六扇门卤制品工厂刚需)")
public class MaterialAbacaController {

    private final AbacaQuantityLogService abacaService;

    @Operation(summary = "列表 — 按批次查询全部称重 + 累计汇总")
    @GetMapping
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<Map<String, Object>> listByBatch(
            @PathVariable String factoryId,
            @RequestParam @NotBlank String batchId) {
        return ApiResponse.success(abacaService.listByBatch(factoryId, batchId));
    }

    @Operation(summary = "详情 — 单条称重记录 + 批次累计汇总")
    @GetMapping("/{id}")
    @RequirePermission({"procurement:read_write", "procurement:read"})
    public ApiResponse<Map<String, Object>> getById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        return ApiResponse.success(abacaService.getById(factoryId, id));
    }

    @Operation(summary = "新增 — 单箱称重")
    @PostMapping
    @RequirePermission("procurement:read_write")
    public ApiResponse<Map<String, Object>> create(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateAbacaQuantityLogRequest req) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ApiResponse.success("称重记录已创建", abacaService.create(factoryId, userId, req));
    }

    @Operation(summary = "批量新增 — 同批次 N 箱一次提交")
    @PostMapping("/batch")
    @RequirePermission("procurement:read_write")
    public ApiResponse<Map<String, Object>> createBatch(
            @PathVariable String factoryId,
            @Valid @RequestBody List<CreateAbacaQuantityLogRequest> reqs) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ApiResponse.success("批量称重已创建", abacaService.createBatch(factoryId, userId, reqs));
    }

    @Operation(summary = "复核 (双签) — 设置 verifiedBy + verifiedAt; 称重员自己复核会被 service 层拒绝")
    @PutMapping("/{id}/verify")
    @RequirePermission("procurement:read_write")
    public ApiResponse<AbacaQuantityLog> verify(
            @PathVariable String factoryId,
            @PathVariable String id) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ApiResponse.success("复核成功", abacaService.verify(factoryId, id, userId));
    }

    @Operation(summary = "软删除 — 仅未复核可删")
    @DeleteMapping("/{id}")
    @RequirePermission("procurement:read_write")
    public ApiResponse<Void> softDelete(
            @PathVariable String factoryId,
            @PathVariable String id) {
        abacaService.softDelete(factoryId, id);
        return ApiResponse.successMessage("称重记录已删除");
    }
}
