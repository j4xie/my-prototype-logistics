package com.cretas.aims.controller;

import com.cretas.aims.entity.config.ApprovalChainConfig;
import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.service.ApprovalChainService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.persistence.EntityNotFoundException;
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
public class ApprovalChainController {

    private final ApprovalChainService approvalChainService;

    // ==================== CRUD 操作 ====================

    /**
     * 获取所有审批链配置
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllConfigs(
            @PathVariable String factoryId) {

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
    public ResponseEntity<Map<String, Object>> getConfigsByType(
            @PathVariable String factoryId,
            @PathVariable DecisionType decisionType) {

        log.info("根据类型获取审批链配置 - factoryId={}, decisionType={}", factoryId, decisionType);

        List<ApprovalChainConfig> configs = approvalChainService.getConfigsByDecisionType(factoryId, decisionType);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", configs);
        response.put("decisionType", decisionType);

        return ResponseEntity.ok(response);
    }

    /**
     * 获取单个配置详情
     */
    @GetMapping("/{configId}")
    public ResponseEntity<Map<String, Object>> getConfig(
            @PathVariable String factoryId,
            @PathVariable String configId) {

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
    public ResponseEntity<Map<String, Object>> createConfig(
            @PathVariable String factoryId,
            @RequestBody ApprovalChainConfig config) {

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
    public ResponseEntity<Map<String, Object>> updateConfig(
            @PathVariable String factoryId,
            @PathVariable String configId,
            @RequestBody ApprovalChainConfig config) {

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
    public ResponseEntity<Map<String, Object>> deleteConfig(
            @PathVariable String factoryId,
            @PathVariable String configId) {

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
    public ResponseEntity<Map<String, Object>> toggleEnabled(
            @PathVariable String factoryId,
            @PathVariable String configId,
            @RequestParam boolean enabled) {

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
    public ResponseEntity<Map<String, Object>> checkApprovalRequired(
            @PathVariable String factoryId,
            @RequestParam DecisionType decisionType,
            @RequestBody(required = false) Map<String, Object> context) {

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
    public ResponseEntity<Map<String, Object>> checkPermission(
            @PathVariable String factoryId,
            @PathVariable String configId,
            @RequestParam Long userId,
            @RequestParam String userRole) {

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
    public ResponseEntity<Map<String, Object>> getStatistics(@PathVariable String factoryId) {

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
    public ResponseEntity<Map<String, Object>> validateConfig(
            @PathVariable String factoryId,
            @RequestBody ApprovalChainConfig config) {

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
    public ResponseEntity<Map<String, Object>> getDecisionTypes(@PathVariable String factoryId) {

        log.info("获取所有决策类型 - factoryId={}", factoryId);

        DecisionType[] types = DecisionType.values();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", types);
        response.put("count", types.length);

        return ResponseEntity.ok(response);
    }
}
