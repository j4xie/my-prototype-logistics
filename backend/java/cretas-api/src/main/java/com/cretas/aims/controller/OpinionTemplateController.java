package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.OpinionTemplate;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.service.OpinionTemplateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 审批意见模板控制器 (C-OPINION-1).
 *
 * <p>Sprint 4 W2 Chat J — 审批弹框 dropdown 数据源 + admin 自定义模板 CRUD.
 *
 * <p>读操作公开 (任何工厂用户可拉自己的 + 系统预设),
 * 写操作要求 {@code system:read_write} 权限.
 *
 * @since 2026-05-16
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/opinion-templates")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "审批意见模板",
     description = "审批 dialog 常用语下拉数据源 + 工厂自定义模板 CRUD. 系统预设 (factory_id IS NULL) 全工厂共享, 仅平台管理员可改.")
public class OpinionTemplateController {

    private final OpinionTemplateService service;

    // ==================== Read (弹框使用) ====================

    @GetMapping("/available")
    @Operation(summary = "拉取工厂可见模板 (自定义 + 系统预设)",
               description = "弹框 onMount 调此接口, 根据 decisionType 返回工厂自定义 + 系统预设, 按 sortOrder 升序.")
    public ApiResponse<List<OpinionTemplate>> listAvailable(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "决策类型, 匹配 ApprovalChainConfig.DecisionType", example = "CUSTOM")
            String decisionType) {
        log.debug("拉取可见意见模板 - factoryId={}, decisionType={}", factoryId, decisionType);
        return ApiResponse.success(service.listAvailable(factoryId, decisionType));
    }

    @GetMapping
    @Operation(summary = "列出某工厂自定义模板 (admin)")
    public ApiResponse<List<OpinionTemplate>> listByFactory(
            @PathVariable String factoryId) {
        log.debug("列出工厂自定义模板 - factoryId={}", factoryId);
        return ApiResponse.success(service.listByFactory(factoryId));
    }

    @GetMapping("/system-presets")
    @Operation(summary = "列出系统预设模板 (admin)")
    public ApiResponse<List<OpinionTemplate>> listSystemPresets(
            @PathVariable String factoryId) {
        log.debug("列出系统预设模板 - factoryId={}", factoryId);
        return ApiResponse.success(service.listSystemPresets());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取模板详情")
    public ApiResponse<OpinionTemplate> getById(
            @PathVariable String factoryId,
            @PathVariable String id) {
        OpinionTemplate t = service.getById(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("意见模板", "id", id));
        return ApiResponse.success(t);
    }

    // ==================== Write ====================

    @RequirePermission({"system:read_write"})
    @PostMapping
    @Operation(summary = "创建工厂自定义模板")
    public ApiResponse<OpinionTemplate> create(
            @PathVariable String factoryId,
            @Valid @RequestBody OpinionTemplate request) {
        log.info("创建意见模板 - factoryId={}, content={}", factoryId, request.getContent());
        OpinionTemplate created = service.create(factoryId, request);
        return ApiResponse.success("意见模板创建成功", created);
    }

    @RequirePermission({"system:read_write"})
    @PutMapping("/{id}")
    @Operation(summary = "更新工厂自定义模板 (PATCH)")
    public ApiResponse<OpinionTemplate> update(
            @PathVariable String factoryId,
            @PathVariable String id,
            @RequestBody OpinionTemplate partial) {
        log.info("更新意见模板 - factoryId={}, id={}", factoryId, id);
        OpinionTemplate updated = service.update(factoryId, id, partial);
        return ApiResponse.success("意见模板更新成功", updated);
    }

    @RequirePermission({"system:read_write"})
    @DeleteMapping("/{id}")
    @Operation(summary = "删除工厂自定义模板 (软删除)")
    public ApiResponse<Void> delete(
            @PathVariable String factoryId,
            @PathVariable String id) {
        log.info("删除意见模板 - factoryId={}, id={}", factoryId, id);
        service.delete(factoryId, id);
        return ApiResponse.successMessage("意见模板已删除");
    }
}
