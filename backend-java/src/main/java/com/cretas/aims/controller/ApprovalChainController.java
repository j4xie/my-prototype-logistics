package com.cretas.aims.controller;

import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.service.ApprovalChainService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.persistence.EntityNotFoundException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 审批链路配置控制器
 *
 * 提供审批链配置的 REST API:
 * - CRUD 操作
 * - 决策类型查询
 * - 权限验证
 * - 配置统计
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/approval-chains")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "审批链路配置管理", description = "审批链配置的REST API，包括CRUD操作、决策类型查询、权限验证、配置统计等功能")
public class ApprovalChainController {

    private final ApprovalChainService approvalChainService;

    // ==================== CRUD 操作 ====================

    /**
     * 获取所有审批链配置
     */
    @GetMapping
    @Operation(summary = "获取所有审批链配置", description = "获取指定工厂的所有审批链配置列表，包括启用和禁用状态的配置")
    public ResponseEntity<Map<String, Object>> getAllConfigs(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.info("获取所有审批链配置 - factoryId={}", factoryId);

        List<ApprovalChainConfig> configs = approvalChainService.getAllConfigs(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", configs);
        response.put("total", configs.size());

        return ResponseEntity.ok(response);
    }

    /**
     * 根据决策类型获取配置
     */
    @GetMapping("/by-type/{decisionType}")
    @Operation(summary = "根据决策类型获取配置", description = "根据决策类型筛选审批链配置，如质量处置、紧急插单等类型")
    public ResponseEntity<Map<String, Object>> getConfigsByType(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "决策类型", example = "QUALITY_DISPOSITION") String decisionType) {

        log.info("根据类型获取审批链配置 - factoryId={}, decisionType={}", factoryId, decisionType);

        try {
            DecisionType type = DecisionType.valueOf(decisionType.toUpperCase());
            List<ApprovalChainConfig> configs = approvalChainService.getConfigsByDecisionType(factoryId, type);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", configs);
            response.put("decisionType", type);

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("无效的决策类型 - {}", decisionType);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "无效的决策类型: " + decisionType + "，有效值: " + Arrays.toString(DecisionType.values()));
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 获取单个配置详情
     */
    @GetMapping("/{configId}")
    @Operation(summary = "获取单个配置详情", description = "根据配置ID获取审批链配置的详细信息，包括审批级别、审批人等")
    public ResponseEntity<Map<String, Object>> getConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置ID", example = "AC001") String configId) {

        log.info("获取审批链配置详情 - factoryId={}, configId={}", factoryId, configId);

        return approvalChainService.getConfig(factoryId, configId)
                .map(config -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("data", config);
                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "配置不存在");
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
                });
    }

    /**
     * 创建审批链配置
     */
    @PostMapping
    @Operation(summary = "创建审批链配置", description = "创建新的审批链配置，包括设置决策类型、审批级别、审批人、超时时间等")
    public ResponseEntity<Map<String, Object>> createConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "审批链配置信息") ApprovalChainConfig config) {

        log.info("创建审批链配置 - factoryId={}, name={}", factoryId, config.getName());

        try {
            ApprovalChainConfig created = approvalChainService.createConfig(factoryId, config);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", created);
            response.put("message", "审批链配置创建成功");

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (IllegalArgumentException e) {
            log.warn("创建审批链配置失败 - {}", e.getMessage());
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 更新审批链配置
     */
    @PutMapping("/{configId}")
    @Operation(summary = "更新审批链配置", description = "更新指定的审批链配置，可修改审批人、超时时间、启用状态等属性")
    public ResponseEntity<Map<String, Object>> updateConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置ID", example = "AC001") String configId,
            @RequestBody @Parameter(description = "更新后的审批链配置") ApprovalChainConfig config) {

        log.info("更新审批链配置 - factoryId={}, configId={}", factoryId, configId);

        try {
            ApprovalChainConfig updated = approvalChainService.updateConfig(factoryId, configId, config);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", updated);
            response.put("message", "审批链配置更新成功");

            return ResponseEntity.ok(response);

        } catch (EntityNotFoundException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "配置不存在");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);

        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 删除审批链配置 (软删除)
     */
    @DeleteMapping("/{configId}")
    @Operation(summary = "删除审批链配置", description = "软删除指定的审批链配置，配置数据不会物理删除，可以恢复")
    public ResponseEntity<Map<String, Object>> deleteConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置ID", example = "AC001") String configId) {

        log.info("删除审批链配置 - factoryId={}, configId={}", factoryId, configId);

        try {
            approvalChainService.deleteConfig(factoryId, configId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "审批链配置已删除");

            return ResponseEntity.ok(response);

        } catch (EntityNotFoundException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "配置不存在");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);

        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * 启用/禁用配置
     */
    @PatchMapping("/{configId}/toggle")
    @Operation(summary = "切换审批链配置状态", description = "启用或禁用指定的审批链配置，禁用后该配置不会参与审批流程判断")
    public ResponseEntity<Map<String, Object>> toggleEnabled(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置ID", example = "AC001") String configId,
            @RequestParam @Parameter(description = "是否启用", example = "true") boolean enabled) {

        log.info("切换审批链配置状态 - factoryId={}, configId={}, enabled={}", factoryId, configId, enabled);

        try {
            ApprovalChainConfig updated = approvalChainService.toggleEnabled(factoryId, configId, enabled);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("data", updated);
            response.put("message", enabled ? "配置已启用" : "配置已禁用");

            return ResponseEntity.ok(response);

        } catch (EntityNotFoundException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "配置不存在");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }
    }

    // ==================== 审批判断 ====================

    /**
     * 检查是否需要审批
     */
    @PostMapping("/check-required")
    @Operation(summary = "检查是否需要审批", description = "根据决策类型和上下文信息检查当前操作是否需要走审批流程，如需要则返回第一级审批配置信息")
    public ResponseEntity<Map<String, Object>> checkApprovalRequired(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "决策类型", example = "QUALITY_DISPOSITION") DecisionType decisionType,
            @RequestBody(required = false) @Parameter(description = "审批上下文信息，可选") Map<String, Object> context) {

        log.info("检查是否需要审批 - factoryId={}, decisionType={}", factoryId, decisionType);

        boolean required = approvalChainService.requiresApproval(
                factoryId, decisionType, context != null ? context : new HashMap<>());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("requiresApproval", required);
        response.put("decisionType", decisionType);

        // 如果需要审批，返回第一级配置信息
        if (required) {
            approvalChainService.getFirstLevelConfig(factoryId, decisionType)
                    .ifPresent(config -> response.put("firstLevelConfig", config));
        }

        return ResponseEntity.ok(response);
    }

    /**
     * 验证用户审批权限
     */
    @GetMapping("/{configId}/check-permission")
    @Operation(summary = "验证用户审批权限", description = "验证指定用户是否有权限对该审批链配置进行审批操作")
    public ResponseEntity<Map<String, Object>> checkPermission(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置ID", example = "AC001") String configId,
            @RequestParam @Parameter(description = "用户ID", example = "1") Long userId,
            @RequestParam @Parameter(description = "用户角色", example = "factory_admin") String userRole) {

        log.info("验证审批权限 - factoryId={}, configId={}, userId={}, userRole={}",
                factoryId, configId, userId, userRole);

        return approvalChainService.getConfig(factoryId, configId)
                .map(config -> {
                    boolean hasPermission = approvalChainService.hasApprovalPermission(config, userId, userRole);

                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("hasPermission", hasPermission);
                    response.put("configId", configId);
                    response.put("userId", userId);

                    return ResponseEntity.ok(response);
                })
                .orElseGet(() -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "配置不存在");
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
                });
    }

    // ==================== 统计与验证 ====================

    /**
     * 获取配置统计信息
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取配置统计信息", description = "获取工厂审批链配置的统计数据，按决策类型分组统计配置数量")
    public ResponseEntity<Map<String, Object>> getStatistics(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.info("获取审批链配置统计 - factoryId={}", factoryId);

        Map<DecisionType, Long> stats = approvalChainService.getConfigStatistics(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", stats);
        response.put("totalTypes", stats.size());
        response.put("totalConfigs", stats.values().stream().mapToLong(Long::longValue).sum());

        return ResponseEntity.ok(response);
    }

    /**
     * 验证配置
     */
    @PostMapping("/validate")
    @Operation(summary = "验证审批链配置", description = "验证审批链配置的合法性，检查审批人、超时时间、级别设置等是否符合规范")
    public ResponseEntity<Map<String, Object>> validateConfig(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestBody @Parameter(description = "待验证的审批链配置") ApprovalChainConfig config) {

        log.info("验证审批链配置 - factoryId={}", factoryId);

        Map<String, Object> validation = approvalChainService.validateConfig(config);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("validation", validation);

        return ResponseEntity.ok(response);
    }

    /**
     * 获取所有决策类型
     */
    @GetMapping("/decision-types")
    @Operation(summary = "获取所有决策类型", description = "获取系统支持的所有决策类型枚举值，用于创建审批链配置时选择")
    public ResponseEntity<Map<String, Object>> getDecisionTypes(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.info("获取所有决策类型 - factoryId={}", factoryId);

        DecisionType[] types = DecisionType.values();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", types);
        response.put("count", types.length);

        return ResponseEntity.ok(response);
    }
}
