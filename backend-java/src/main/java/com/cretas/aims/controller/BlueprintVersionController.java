package com.cretas.aims.controller;

import com.cretas.aims.dto.blueprint.*;
import com.cretas.aims.service.BlueprintVersionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 蓝图版本管理控制器
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * 提供蓝图版本历史、发布、升级推送等 API
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@RestController
@RequestMapping("/api/platform/blueprints")
@RequiredArgsConstructor
@Tag(name = "Blueprint Version Management", description = "蓝图版本管理API")
public class BlueprintVersionController {

    private final BlueprintVersionService blueprintVersionService;

    // ==================== 版本历史 ====================

    @GetMapping("/{blueprintId}/versions")
    @Operation(summary = "获取版本历史", description = "获取蓝图的所有版本历史记录")
    public ResponseEntity<Map<String, Object>> getVersionHistory(
            @PathVariable String blueprintId
    ) {
        log.info("获取版本历史: {}", blueprintId);

        List<BlueprintVersionDTO> versions = blueprintVersionService.getVersionHistory(blueprintId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", versions);
        response.put("message", String.format("共 %d 个版本", versions.size()));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{blueprintId}/versions/{version}")
    @Operation(summary = "获取指定版本", description = "获取蓝图的指定版本详情")
    public ResponseEntity<Map<String, Object>> getVersion(
            @PathVariable String blueprintId,
            @PathVariable Integer version
    ) {
        log.info("获取版本: {} v{}", blueprintId, version);

        BlueprintVersionDTO versionDTO = blueprintVersionService.getVersion(blueprintId, version);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", versionDTO);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{blueprintId}/versions/latest")
    @Operation(summary = "获取最新版本", description = "获取蓝图的最新版本")
    public ResponseEntity<Map<String, Object>> getLatestVersion(
            @PathVariable String blueprintId
    ) {
        log.info("获取最新版本: {}", blueprintId);

        BlueprintVersionDTO version = blueprintVersionService.getLatestVersion(blueprintId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", version);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{blueprintId}/versions/published")
    @Operation(summary = "获取发布版本列表", description = "获取蓝图的所有已发布版本")
    public ResponseEntity<Map<String, Object>> getPublishedVersions(
            @PathVariable String blueprintId
    ) {
        log.info("获取发布版本: {}", blueprintId);

        List<BlueprintVersionDTO> versions = blueprintVersionService.getPublishedVersions(blueprintId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", versions);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{blueprintId}/versions/compare")
    @Operation(summary = "比较版本差异", description = "比较两个版本之间的差异")
    public ResponseEntity<Map<String, Object>> compareVersions(
            @PathVariable String blueprintId,
            @RequestParam Integer fromVersion,
            @RequestParam Integer toVersion
    ) {
        log.info("比较版本: {} v{} -> v{}", blueprintId, fromVersion, toVersion);

        BlueprintVersionDTO.VersionChangeSummary diff =
                blueprintVersionService.compareVersions(blueprintId, fromVersion, toVersion);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", diff);

        return ResponseEntity.ok(response);
    }

    // ==================== 版本发布 ====================

    @PostMapping("/{blueprintId}/versions/publish")
    @Operation(summary = "发布新版本", description = "将当前蓝图状态发布为正式版本")
    public ResponseEntity<Map<String, Object>> publishVersion(
            @PathVariable String blueprintId,
            @Valid @RequestBody PublishVersionRequest request
    ) {
        log.info("发布版本: {}", blueprintId);

        BlueprintVersionDTO version = blueprintVersionService.publishVersion(blueprintId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", version);
        response.put("message", String.format("成功发布 v%d", version.getVersion()));

        return ResponseEntity.ok(response);
    }

    // ==================== 工厂绑定管理 ====================

    @GetMapping("/{blueprintId}/bindings")
    @Operation(summary = "获取绑定的工厂", description = "获取使用该蓝图的所有工厂")
    public ResponseEntity<Map<String, Object>> getBindingFactories(
            @PathVariable String blueprintId
    ) {
        log.info("获取绑定工厂: {}", blueprintId);

        List<FactoryBindingDTO> bindings = blueprintVersionService.getBindingFactories(blueprintId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", bindings);
        response.put("message", String.format("共 %d 个工厂", bindings.size()));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/factory/{factoryId}/binding")
    @Operation(summary = "获取工厂的蓝图绑定", description = "获取指定工厂的蓝图绑定信息")
    public ResponseEntity<Map<String, Object>> getFactoryBinding(
            @PathVariable String factoryId
    ) {
        log.info("获取工厂绑定: {}", factoryId);

        FactoryBindingDTO binding = blueprintVersionService.getFactoryBinding(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", binding);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/factory/{factoryId}/binding/settings")
    @Operation(summary = "更新绑定设置", description = "更新工厂的蓝图绑定设置（自动更新策略等）")
    public ResponseEntity<Map<String, Object>> updateBindingSettings(
            @PathVariable String factoryId,
            @RequestParam(required = false) Boolean autoUpdate,
            @RequestParam(required = false) String updatePolicy
    ) {
        log.info("更新绑定设置: {} autoUpdate={} policy={}", factoryId, autoUpdate, updatePolicy);

        FactoryBindingDTO binding = blueprintVersionService.updateBindingSettings(
                factoryId, autoUpdate, updatePolicy);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", binding);
        response.put("message", "设置已更新");

        return ResponseEntity.ok(response);
    }

    // ==================== 版本升级 ====================

    @GetMapping("/{blueprintId}/outdated-factories")
    @Operation(summary = "获取需要升级的工厂", description = "获取使用旧版本蓝图的工厂列表")
    public ResponseEntity<Map<String, Object>> getOutdatedFactories(
            @PathVariable String blueprintId
    ) {
        log.info("获取需要升级的工厂: {}", blueprintId);

        List<FactoryBindingDTO> factories = blueprintVersionService.getOutdatedFactories(blueprintId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", factories);
        response.put("message", String.format("%d 个工厂需要升级", factories.size()));

        return ResponseEntity.ok(response);
    }

    @PostMapping("/factory/{factoryId}/upgrade")
    @Operation(summary = "升级工厂版本", description = "将工厂升级到新的蓝图版本")
    public ResponseEntity<Map<String, Object>> upgradeFactory(
            @PathVariable String factoryId,
            @Valid @RequestBody UpgradeFactoryRequest request
    ) {
        log.info("升级工厂: {} -> v{}", factoryId, request.getTargetVersion());

        VersionUpgradeResult result = blueprintVersionService.upgradeFactory(factoryId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.getSuccess());
        response.put("data", result);
        response.put("message", result.getSummary());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/batch-upgrade")
    @Operation(summary = "批量升级工厂", description = "批量将多个工厂升级到新版本")
    public ResponseEntity<Map<String, Object>> batchUpgradeFactories(
            @RequestParam List<String> factoryIds,
            @Valid @RequestBody UpgradeFactoryRequest request
    ) {
        log.info("批量升级工厂: {} 个", factoryIds.size());

        List<VersionUpgradeResult> results = blueprintVersionService.batchUpgradeFactories(
                factoryIds, request);

        long successCount = results.stream().filter(VersionUpgradeResult::getSuccess).count();

        Map<String, Object> response = new HashMap<>();
        response.put("success", successCount == results.size());
        response.put("data", results);
        response.put("message", String.format("成功 %d/%d 个", successCount, results.size()));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/factory/{factoryId}/upgrade/preview")
    @Operation(summary = "预览升级效果", description = "Dry-run模式预览升级将产生的效果")
    public ResponseEntity<Map<String, Object>> previewUpgrade(
            @PathVariable String factoryId,
            @RequestParam(required = false) Integer targetVersion
    ) {
        log.info("预览升级: {} -> v{}", factoryId, targetVersion);

        VersionUpgradeResult result = blueprintVersionService.previewUpgrade(factoryId, targetVersion);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", result);
        response.put("message", "预览成功（未实际执行）");

        return ResponseEntity.ok(response);
    }

    @PostMapping("/factory/{factoryId}/rollback")
    @Operation(summary = "回滚工厂版本", description = "将工厂回滚到指定的旧版本")
    public ResponseEntity<Map<String, Object>> rollbackFactory(
            @PathVariable String factoryId,
            @RequestParam Integer targetVersion,
            @RequestParam(required = false, defaultValue = "手动回滚") String reason
    ) {
        log.info("回滚工厂: {} -> v{}, 原因: {}", factoryId, targetVersion, reason);

        VersionUpgradeResult result = blueprintVersionService.rollbackFactory(
                factoryId, targetVersion, reason);

        Map<String, Object> response = new HashMap<>();
        response.put("success", result.getSuccess());
        response.put("data", result);
        response.put("message", result.getSummary());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{blueprintId}/notify-factories")
    @Operation(summary = "通知工厂新版本", description = "向所有绑定工厂发送新版本通知")
    public ResponseEntity<Map<String, Object>> notifyFactories(
            @PathVariable String blueprintId,
            @RequestParam Integer version
    ) {
        log.info("通知工厂新版本: {} v{}", blueprintId, version);

        blueprintVersionService.notifyFactoriesOfNewVersion(blueprintId, version);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "通知已发送");

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{blueprintId}/process-auto-updates")
    @Operation(summary = "执行自动更新", description = "处理配置了自动更新的工厂")
    public ResponseEntity<Map<String, Object>> processAutoUpdates(
            @PathVariable String blueprintId
    ) {
        log.info("执行自动更新: {}", blueprintId);

        int upgraded = blueprintVersionService.processAutoUpdates(blueprintId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", Map.of("upgradedCount", upgraded));
        response.put("message", String.format("自动更新了 %d 个工厂", upgraded));

        return ResponseEntity.ok(response);
    }
}
