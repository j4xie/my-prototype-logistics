package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.ConfigChangeSet;
import com.cretas.aims.entity.config.ConfigChangeSet.ChangeStatus;
import com.cretas.aims.entity.config.ConfigChangeSet.ConfigType;
import com.cretas.aims.service.ConfigChangeSetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
@Tag(name = "配置变更管理", description = "配置变更集管理相关接口，提供配置变更的完整生命周期管理。包括变更集列表查询（分页/待审批/可回滚）、变更集详情和差异预览、创建变更集、Dry-run预览变更效果、审批通过/拒绝、应用变更、回滚变更、配置历史查询和状态统计等功能。支持规则、模板、编码规则等多种配置类型")
public class ConfigChangeSetController {

    private final ConfigChangeSetService changeSetService;

    // ========== 查询端点 ==========

    @GetMapping
    @Operation(summary = "分页查询变更集列表", description = "分页获取工厂的配置变更集列表，支持按状态筛选")
    public ApiResponse<Page<ConfigChangeSet>> getChangeSets(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(defaultValue = "0") @Parameter(description = "页码（0-based）", example = "0") int page,
            @RequestParam(defaultValue = "10") @Parameter(description = "每页数量", example = "10") int size,
            @RequestParam(required = false) @Parameter(description = "变更状态: PENDING/APPROVED/REJECTED/APPLIED/ROLLED_BACK", example = "PENDING") ChangeStatus status) {

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
    @Operation(summary = "获取待审批的变更集列表", description = "获取工厂所有状态为PENDING的变更集列表，用于审批人员查看")
    public ApiResponse<List<ConfigChangeSet>> getPendingChangeSets(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        List<ConfigChangeSet> result = changeSetService.getPendingChangeSets(factoryId);
        return ApiResponse.success(result);
    }

    @GetMapping("/pending/count")
    @Operation(summary = "统计待审批数量", description = "统计工厂待审批的变更集数量，用于显示待办徽标")
    public ApiResponse<Map<String, Long>> countPendingChangeSets(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        long count = changeSetService.countPendingChangeSets(factoryId);
        Map<String, Long> result = new HashMap<>();
        result.put("count", count);
        return ApiResponse.success(result);
    }

    @GetMapping("/rollbackable")
    @Operation(summary = "获取可回滚的变更集列表", description = "获取工厂所有可以回滚的变更集列表（状态为APPLIED的变更集）")
    public ApiResponse<List<ConfigChangeSet>> getRollbackableChangeSets(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        List<ConfigChangeSet> result = changeSetService.getRollbackableChangeSets(factoryId);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取变更集详情", description = "根据变更集ID获取详细信息，包括配置快照和变更状态")
    public ApiResponse<ConfigChangeSet> getChangeSetById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "变更集ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id) {

        ConfigChangeSet result = changeSetService.getChangeSetById(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/preview")
    @Operation(summary = "预览变更差异", description = "预览变更集中变更前后的配置差异，以可视化方式展示变更内容")
    public ApiResponse<Map<String, Object>> previewDiff(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "变更集ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id) {

        Map<String, Object> result = changeSetService.previewDiff(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/history/{configType}/{configId}")
    @Operation(summary = "获取配置的变更历史", description = "获取指定配置项的所有历史变更记录，按时间倒序排列")
    public ApiResponse<List<ConfigChangeSet>> getChangeHistory(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置类型: RULE/TEMPLATE/ENCODING_RULE", example = "RULE") ConfigType configType,
            @PathVariable @Parameter(description = "配置项ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String configId) {

        List<ConfigChangeSet> result = changeSetService.getChangeHistory(configType, configId);
        return ApiResponse.success(result);
    }

    @GetMapping("/statistics/{configType}")
    @Operation(summary = "按配置类型统计各状态数量", description = "按配置类型统计各状态（PENDING/APPROVED/REJECTED等）的变更集数量")
    public ApiResponse<Map<String, Long>> getStatusStatistics(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "配置类型: RULE/TEMPLATE/ENCODING_RULE", example = "RULE") ConfigType configType) {

        Map<String, Long> result = changeSetService.getStatusStatistics(factoryId, configType);
        return ApiResponse.success(result);
    }

    // ========== Dry-Run 预览端点 ==========

    @PostMapping("/dry-run")
    @Operation(summary = "Dry-run 预览变更效果",
               description = "在创建 ChangeSet 之前，预览即将产生的差异和潜在问题，不实际创建变更集")
    public ApiResponse<Map<String, Object>> dryRun(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @Valid @RequestBody @Parameter(description = "Dry-run请求，包含配置类型、配置ID、变更前后快照等信息") DryRunRequest request) {

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
    @Operation(summary = "创建配置变更集", description = "创建一个新的配置变更集，状态初始为PENDING，等待审批")
    public ApiResponse<ConfigChangeSet> createChangeSet(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @Valid @RequestBody @Parameter(description = "创建变更集请求，包含配置类型、配置ID、变更前后快照等信息") CreateChangeSetRequest request,
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
    @Operation(summary = "审批通过变更集", description = "审批通过指定的变更集，将状态变更为APPROVED，可选添加审批备注")
    public ApiResponse<ConfigChangeSet> approveChangeSet(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "变更集ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @Valid @RequestBody @Parameter(description = "审批请求，可选包含审批备注") ApprovalRequest request,
            HttpServletRequest httpRequest) {

        Long approverId = getUserId(httpRequest);
        String approverName = getUserName(httpRequest);

        ConfigChangeSet result = changeSetService.approveChangeSet(
                id, approverId, approverName, request.getComment());

        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "拒绝变更集", description = "拒绝指定的变更集，将状态变更为REJECTED，必须提供拒绝原因")
    public ApiResponse<ConfigChangeSet> rejectChangeSet(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "变更集ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @Valid @RequestBody @Parameter(description = "拒绝请求，必须包含拒绝原因") RejectRequest request,
            HttpServletRequest httpRequest) {

        Long approverId = getUserId(httpRequest);
        String approverName = getUserName(httpRequest);

        ConfigChangeSet result = changeSetService.rejectChangeSet(
                id, approverId, approverName, request.getReason());

        return ApiResponse.success(result);
    }

    // ========== 应用与回滚端点 ==========

    @PostMapping("/{id}/apply")
    @Operation(summary = "应用变更集 (使变更生效)", description = "应用已审批通过的变更集，将配置变更实际生效，状态变更为APPLIED")
    public ApiResponse<ConfigChangeSet> applyChangeSet(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "变更集ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id) {

        ConfigChangeSet result = changeSetService.applyChangeSet(id);
        return ApiResponse.success(result);
    }

    @PostMapping("/{id}/rollback")
    @Operation(summary = "回滚变更集", description = "回滚已应用的变更集，将配置恢复到变更前的状态，状态变更为ROLLED_BACK")
    public ApiResponse<ConfigChangeSet> rollbackChangeSet(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "变更集ID", example = "a1b2c3d4-e5f6-7890-abcd-ef1234567890") String id,
            @Valid @RequestBody @Parameter(description = "回滚请求，必须包含回滚原因") RollbackRequest request,
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
