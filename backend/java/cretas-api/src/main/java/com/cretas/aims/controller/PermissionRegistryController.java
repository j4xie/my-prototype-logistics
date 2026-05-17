package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.auth.PermissionRegistry;
import com.cretas.aims.entity.auth.PermissionRegistry.Source;
import com.cretas.aims.service.auth.PermissionManifestExporter;
import com.cretas.aims.service.auth.PermissionRegistryService;
import com.cretas.aims.service.auth.PermissionRegistryService.ScanResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 权限登记 Controller (Sprint 4 Wave 2 Chat J — C-CHECKPOWER-1).
 *
 * <p>路径前缀 {@code /api/mobile/{factoryId}/system/permission-registry} — 与项目惯例对齐
 * (mobile 路径前缀, factoryId path-param)。
 *
 * <p>权限要求 — 全部需要 {@code system:audit} (新权限,由本 controller 启动扫描自动登记)。
 *
 * @since 2026-05-24
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/system/permission-registry")
@RequiredArgsConstructor
@Tag(name = "权限登记 (Permission Registry)", description = "C-CHECKPOWER-1 中央权限登记与审计")
public class PermissionRegistryController {

    private final PermissionRegistryService registryService;
    private final PermissionManifestExporter exporter;

    @GetMapping("/manifest")
    @Operation(summary = "导出完整权限 manifest",
               description = "返回分模块聚合的完整权限矩阵 JSON,用于审计 / diff / 前端展示")
    @RequirePermission("system:audit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> exportManifest(
            @Parameter(description = "工厂ID (路径占位,manifest 暂全局)") @PathVariable String factoryId) {

        log.debug("[PermissionRegistry] manifest export - factoryId={}", factoryId);
        return ResponseEntity.ok(ApiResponse.success(exporter.exportFullManifest()));
    }

    @GetMapping("/manifest/module/{module}")
    @Operation(summary = "导出指定 module 的权限 manifest")
    @RequirePermission("system:audit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> exportModuleManifest(
            @PathVariable String factoryId,
            @PathVariable String module) {

        return ResponseEntity.ok(ApiResponse.success(exporter.exportModule(module)));
    }

    @GetMapping("/summary")
    @Operation(summary = "权限 audit summary",
               description = "返回 byModule / bySource count + module 列表")
    @RequirePermission("system:audit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> auditSummary(
            @PathVariable String factoryId) {

        return ResponseEntity.ok(ApiResponse.success(registryService.auditSummary()));
    }

    @GetMapping("/modules")
    @Operation(summary = "列出所有 module")
    @RequirePermission("system:audit")
    public ResponseEntity<ApiResponse<List<String>>> listModules(
            @PathVariable String factoryId) {

        return ResponseEntity.ok(ApiResponse.success(registryService.listModules()));
    }

    @GetMapping
    @Operation(summary = "按 module / source 过滤权限列表")
    @RequirePermission("system:audit")
    public ResponseEntity<ApiResponse<List<PermissionRegistry>>> list(
            @PathVariable String factoryId,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) Source source) {

        if (module != null && !module.isBlank()) {
            return ResponseEntity.ok(ApiResponse.success(registryService.listByModule(module)));
        }
        if (source != null) {
            return ResponseEntity.ok(ApiResponse.success(registryService.listBySource(source)));
        }
        return ResponseEntity.ok(ApiResponse.success(registryService.listAllActive()));
    }

    @PostMapping("/rescan")
    @Operation(summary = "手动触发反射重新扫描",
               description = "重新扫描所有 controller @RequirePermission 注解,upsert 到 registry。" +
                             "通常启动时已自动跑 — 此端点用于 controller hot-load 后或调试时强刷")
    @RequirePermission("system:audit")
    public ResponseEntity<ApiResponse<ScanResult>> rescan(@PathVariable String factoryId) {
        log.info("[PermissionRegistry] 手动重扫触发 - factoryId={}", factoryId);
        return ResponseEntity.ok(ApiResponse.success(registryService.scanAndRegister()));
    }
}
