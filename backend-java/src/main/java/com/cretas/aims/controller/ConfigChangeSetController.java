package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.ConfigChangeSet;
import com.cretas.aims.entity.config.ConfigChangeSet.ChangeStatus;
import com.cretas.aims.entity.config.ConfigChangeSet.ConfigType;
import com.cretas.aims.service.ConfigChangeSetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 配置变更集控制器
 *
 * 提供配置变更的完整生命周期管理:
 * - 创建变更集
 * - 预览差异
 * - 审批/拒绝
 * - 应用变更
 * - 回滚变更
 *
 * @author Cretas Team
 * @since 2025-12-30
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/config-changes")
@RequiredArgsConstructor
@Tag(name = "配置变更管理", description = "配置变更集的创建、审批、应用和回滚")
public class ConfigChangeSetController {

    private final ConfigChangeSetService changeSetService;

    // ========== 查询端点 ==========

    @GetMapping
    @Operation(summary = "分页查询变更集列表")
    public ApiResponse<Page<ConfigChangeSet>> getChangeSets(
            @PathVariable String factoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) ChangeStatus status) {

        Pageable pageable = PageRequest.of(page, size);

        Page<ConfigChangeSet> result;
        if (status != null) {
            result = changeSetService.getChangeSetsByStatus(factoryId, status, pageable);
        } else {
            result = changeSetService.getChangeSets(factoryId, pageable);
        }

        return ApiResponse.success(result);
    }

    @GetMapping("/pending")
    @Operation(summary = "获取待审批的变更集列表")
    public ApiResponse<List<ConfigChangeSet>> getPendingChangeSets(
            @PathVariable String factoryId) {

        List<ConfigChangeSet> result = changeSetService.getPendingChangeSets(factoryId);
        return ApiResponse.success(result);
    }

    @GetMapping("/pending/count")
    @Operation(summary = "统计待审批数量")
    public ApiResponse<Map<String, Long>> countPendingChangeSets(
            @PathVariable String factoryId) {

        long count = changeSetService.countPendingChangeSets(factoryId);
        Map<String, Long> result = new HashMap<>();
        result.put("count", count);
        return ApiResponse.success(result);
    }

    @GetMapping("/rollbackable")
    @Operation(summary = "获取可回滚的变更集列表")
    public ApiResponse<List<ConfigChangeSet>> getRollbackableChangeSets(
            @PathVariable String factoryId) {

        List<ConfigChangeSet> result = changeSetService.getRollbackableChangeSets(factoryId);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取变更集详情")
    public ApiResponse<ConfigChangeSet> getChangeSetById(
            @PathVariable String factoryId,
            @PathVariable String id) {

        ConfigChangeSet result = changeSetService.getChangeSetById(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/preview")
    @Operation(summary = "预览变更差异")
    public ApiResponse<Map<String, Object>> previewDiff(
            @PathVariable String factoryId,
            @PathVariable String id) {

        Map<String, Object> result = changeSetService.previewDiff(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/history/{configType}/{configId}")
    @Operation(summary = "获取配置的变更历史")
    public ApiResponse<List<ConfigChangeSet>> getChangeHistory(
            @PathVariable String factoryId,
            @PathVariable ConfigType configType,
            @PathVariable String configId) {

        List<ConfigChangeSet> result = changeSetService.getChangeHistory(configType, configId);
        return ApiResponse.success(result);
    }

    @GetMapping("/statistics/{configType}")
    @Operation(summary = "按配置类型统计各状态数量")
    public ApiResponse<Map<String, Long>> getStatusStatistics(
            @PathVariable String factoryId,
            @PathVariable ConfigType configType) {

        Map<String, Long> result = changeSetService.getStatusStatistics(factoryId, configType);
        return ApiResponse.success(result);
    }

    // ========== Dry-Run 预览端点 ==========

    @PostMapping("/dry-run")
    @Operation(summary = "Dry-run 预览变更效果",
               description = "在创建 ChangeSet 之前，预览即将产生的差异和潜在问题")
    public ApiResponse<Map<String, Object>> dryRun(
            @PathVariable String factoryId,
            @Valid @RequestBody DryRunRequest request) {

        Map<String, Object> result = changeSetService.dryRun(
                request.getConfigType(),
                request.getConfigId(),
                request.getConfigName(),
                request.getBeforeSnapshot(),
                request.getAfterSnapshot());

        return ApiResponse.success(result);
    }

    // ========== 创建端点 ==========

    @PostMapping
    @Operation(summary = "创建配置变更集")
    public ApiResponse<ConfigChangeSet> createChangeSet(
            @PathVariable String factoryId,
            @Valid @RequestBody CreateChangeSetRequest request,
            HttpServletRequest httpRequest) {

        Long userId = getUserId(httpRequest);
        String userName = getUserName(httpRequest);

        ConfigChangeSet result = changeSetService.createChangeSet(
                factoryId,
                request.getConfigType(),
                request.getConfigId(),
                request.getConfigName(),
                request.getBeforeSnapshot(),
                request.getAfterSnapshot(),
                userId,
                userName);

        return ApiResponse.success(result);
    }

    // ========== 审批端点 ==========

    @PostMapping("/{id}/approve")
    @Operation(summary = "审批通过变更集")
    public ApiResponse<ConfigChangeSet> approveChangeSet(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody ApprovalRequest request,
            HttpServletRequest httpRequest) {

        Long approverId = getUserId(httpRequest);
        String approverName = getUserName(httpRequest);

        ConfigChangeSet result = changeSetService.approveChangeSet(
                id, approverId, approverName, request.getComment());

        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "拒绝变更集")
    public ApiResponse<ConfigChangeSet> rejectChangeSet(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody RejectRequest request,
            HttpServletRequest httpRequest) {

        Long approverId = getUserId(httpRequest);
        String approverName = getUserName(httpRequest);

        ConfigChangeSet result = changeSetService.rejectChangeSet(
                id, approverId, approverName, request.getReason());

        return ApiResponse.success(result);
    }

    // ========== 应用与回滚端点 ==========

    @PostMapping("/{id}/apply")
    @Operation(summary = "应用变更集 (使变更生效)")
    public ApiResponse<ConfigChangeSet> applyChangeSet(
            @PathVariable String factoryId,
            @PathVariable String id) {

        ConfigChangeSet result = changeSetService.applyChangeSet(id);
        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/rollback")
    @Operation(summary = "回滚变更集")
    public ApiResponse<ConfigChangeSet> rollbackChangeSet(
            @PathVariable String factoryId,
            @PathVariable String id,
            @Valid @RequestBody RollbackRequest request,
            HttpServletRequest httpRequest) {

        Long userId = getUserId(httpRequest);

        ConfigChangeSet result = changeSetService.rollbackChangeSet(id, userId, request.getReason());
        return ApiResponse.success(result);
    }

    // ========== 辅助方法 ==========

    private Long getUserId(HttpServletRequest request) {
        Object userId = request.getAttribute("userId");
        if (userId == null) {
            return null;
        }
        if (userId instanceof Long) {
            return (Long) userId;
        }
        if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        }
        return Long.parseLong(userId.toString());
    }

    private String getUserName(HttpServletRequest request) {
        Object userName = request.getAttribute("username");
        return userName != null ? userName.toString() : "Unknown";
    }

    // ========== 请求 DTO ==========

    @Data
    public static class CreateChangeSetRequest {
        @NotNull(message = "配置类型不能为空")
        private ConfigType configType;

        @NotBlank(message = "配置ID不能为空")
        private String configId;

        private String configName;

        private String beforeSnapshot;

        @NotBlank(message = "变更后配置不能为空")
        private String afterSnapshot;
    }

    @Data
    public static class ApprovalRequest {
        private String comment;
    }

    @Data
    public static class RejectRequest {
        @NotBlank(message = "拒绝原因不能为空")
        private String reason;
    }

    @Data
    public static class RollbackRequest {
        @NotBlank(message = "回滚原因不能为空")
        private String reason;
    }

    @Data
    public static class DryRunRequest {
        @NotNull(message = "配置类型不能为空")
        private ConfigType configType;

        @NotBlank(message = "配置ID不能为空")
        private String configId;

        private String configName;

        private String beforeSnapshot;

        @NotBlank(message = "变更后配置不能为空")
        private String afterSnapshot;
    }
}
