package com.cretas.aims.controller;

import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.dto.scheduling.DetectMixedBatchRequest;
import com.cretas.aims.dto.scheduling.MixedBatchGroupDTO;
import com.cretas.aims.dto.scheduling.MixedBatchRuleDTO;
import com.cretas.aims.entity.enums.MixedBatchType;
import com.cretas.aims.service.MixedBatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 混批排产控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/mixed-batch")
@RequiredArgsConstructor
@Tag(name = "混批排产管理", description = "混批检测、混批组管理、规则配置")
public class MixedBatchController {

    private final MixedBatchService mixedBatchService;

    // ==================== 混批检测 ====================

    /**
     * AI检测可合批订单
     */
    @PostMapping("/detect")
    @Operation(summary = "检测可合批订单", description = "AI分析订单，检测可以合并的订单组")
    public ResponseEntity<Map<String, Object>> detectMixedBatches(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Valid @RequestBody DetectMixedBatchRequest request) {

        log.info("检测可合批订单: factoryId={}, orderCount={}", factoryId, request.getOrderIds().size());

        List<MixedBatchGroupDTO> groups = mixedBatchService.detectMixedBatches(factoryId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", groups);
        response.put("message", "检测到 " + groups.size() + " 组可合并订单");
        response.put("total", groups.size());

        return ResponseEntity.ok(response);
    }

    // ==================== 混批组管理 ====================

    /**
     * 获取混批组列表
     */
    @GetMapping("/groups")
    @Operation(summary = "获取混批建议列表", description = "获取混批组列表，支持状态和类型筛选")
    public ResponseEntity<Map<String, Object>> getGroups(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) MixedBatchType groupType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        log.info("获取混批组列表: factoryId={}, status={}, groupType={}", factoryId, status, groupType);

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<MixedBatchGroupDTO> groups = mixedBatchService.getMixedBatchGroups(factoryId, status, groupType, pageable);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", groups.getContent());
        response.put("totalElements", groups.getTotalElements());
        response.put("totalPages", groups.getTotalPages());
        response.put("number", groups.getNumber());
        response.put("size", groups.getSize());

        return ResponseEntity.ok(response);
    }

    /**
     * 获取待确认的混批组
     */
    @GetMapping("/groups/pending")
    @Operation(summary = "获取待确认混批组", description = "获取待确认的混批组列表，按推荐分数排序")
    public ResponseEntity<Map<String, Object>> getPendingGroups(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取待确认混批组: factoryId={}", factoryId);

        List<MixedBatchGroupDTO> groups = mixedBatchService.getPendingGroups(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", groups);
        response.put("total", groups.size());

        return ResponseEntity.ok(response);
    }

    /**
     * 获取混批组详情
     */
    @GetMapping("/groups/{groupId}")
    @Operation(summary = "获取混批组详情", description = "获取单个混批组的详细信息")
    public ResponseEntity<Map<String, Object>> getGroupDetail(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "混批组ID") @PathVariable String groupId) {

        log.info("获取混批组详情: factoryId={}, groupId={}", factoryId, groupId);

        MixedBatchGroupDTO group = mixedBatchService.getGroupDetail(factoryId, groupId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", group);

        return ResponseEntity.ok(response);
    }

    /**
     * 确认混批
     */
    @PostMapping("/groups/{groupId}/confirm")
    @Operation(summary = "确认混批", description = "确认混批组，创建生产计划")
    public ResponseEntity<Map<String, Object>> confirmGroup(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "混批组ID") @PathVariable String groupId,
            HttpServletRequest httpRequest) {

        Long userId = getUserId(httpRequest);
        log.info("确认混批: factoryId={}, groupId={}, userId={}", factoryId, groupId, userId);

        ProductionPlanDTO plan = mixedBatchService.confirmMixedBatch(factoryId, groupId, userId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", plan);
        response.put("message", "混批确认成功，已创建生产计划");

        return ResponseEntity.ok(response);
    }

    /**
     * 拒绝混批
     */
    @PostMapping("/groups/{groupId}/reject")
    @Operation(summary = "拒绝混批", description = "拒绝混批建议")
    public ResponseEntity<Map<String, Object>> rejectGroup(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "混批组ID") @PathVariable String groupId,
            @RequestParam(required = false) String reason,
            HttpServletRequest httpRequest) {

        Long userId = getUserId(httpRequest);
        log.info("拒绝混批: factoryId={}, groupId={}, userId={}", factoryId, groupId, userId);

        mixedBatchService.rejectMixedBatch(factoryId, groupId, userId, reason);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "已拒绝混批建议");

        return ResponseEntity.ok(response);
    }

    /**
     * 更新混批组订单
     */
    @PutMapping("/groups/{groupId}/orders")
    @Operation(summary = "更新混批组订单", description = "添加或移除混批组中的订单")
    public ResponseEntity<Map<String, Object>> updateGroupOrders(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "混批组ID") @PathVariable String groupId,
            @RequestBody List<String> orderIds) {

        log.info("更新混批组订单: factoryId={}, groupId={}, orderCount={}", factoryId, groupId, orderIds.size());

        MixedBatchGroupDTO group = mixedBatchService.updateGroupOrders(factoryId, groupId, orderIds);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", group);
        response.put("message", "订单更新成功");

        return ResponseEntity.ok(response);
    }

    // ==================== 规则管理 ====================

    /**
     * 获取混批规则列表
     */
    @GetMapping("/rules")
    @Operation(summary = "获取混批规则", description = "获取工厂的混批规则配置")
    public ResponseEntity<Map<String, Object>> getRules(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取混批规则: factoryId={}", factoryId);

        List<MixedBatchRuleDTO> rules = mixedBatchService.getRules(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", rules);

        return ResponseEntity.ok(response);
    }

    /**
     * 更新混批规则
     */
    @PutMapping("/rules")
    @Operation(summary = "更新混批规则", description = "创建或更新混批规则配置")
    public ResponseEntity<Map<String, Object>> saveRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Valid @RequestBody MixedBatchRuleDTO ruleDTO) {

        log.info("更新混批规则: factoryId={}, ruleType={}", factoryId, ruleDTO.getRuleType());

        MixedBatchRuleDTO saved = mixedBatchService.saveRule(factoryId, ruleDTO);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", saved);
        response.put("message", "规则保存成功");

        return ResponseEntity.ok(response);
    }

    /**
     * 启用/禁用规则
     */
    @PostMapping("/rules/{ruleType}/toggle")
    @Operation(summary = "启用/禁用规则", description = "切换混批规则的启用状态")
    public ResponseEntity<Map<String, Object>> toggleRule(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "规则类型") @PathVariable MixedBatchType ruleType,
            @RequestParam boolean enabled) {

        log.info("切换规则状态: factoryId={}, ruleType={}, enabled={}", factoryId, ruleType, enabled);

        mixedBatchService.toggleRule(factoryId, ruleType, enabled);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", enabled ? "规则已启用" : "规则已禁用");

        return ResponseEntity.ok(response);
    }

    // ==================== 统计与清理 ====================

    /**
     * 获取混批统计
     */
    @GetMapping("/statistics")
    @Operation(summary = "获取混批统计", description = "获取混批相关的统计信息")
    public ResponseEntity<Map<String, Object>> getStatistics(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取混批统计: factoryId={}", factoryId);

        Map<String, Object> statistics = mixedBatchService.getStatistics(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", statistics);

        return ResponseEntity.ok(response);
    }

    /**
     * 清理过期混批组
     */
    @DeleteMapping("/groups/expired")
    @Operation(summary = "清理过期混批组", description = "清理已过期的混批组")
    public ResponseEntity<Map<String, Object>> cleanupExpired(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("清理过期混批组: factoryId={}", factoryId);

        int count = mixedBatchService.cleanupExpiredGroups(factoryId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", Map.of("cleanedCount", count));
        response.put("message", "已清理 " + count + " 个过期混批组");

        return ResponseEntity.ok(response);
    }

    // ==================== 辅助方法 ====================

    /**
     * 从请求中获取用户ID
     */
    private Long getUserId(HttpServletRequest request) {
        Object userIdObj = request.getAttribute("userId");
        if (userIdObj == null) {
            return null;
        }
        if (userIdObj instanceof Long) {
            return (Long) userIdObj;
        }
        if (userIdObj instanceof Integer) {
            return ((Integer) userIdObj).longValue();
        }
        if (userIdObj instanceof String) {
            try {
                return Long.parseLong((String) userIdObj);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
