package com.cretas.aims.controller;

import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.entity.config.WorkflowVariableDef;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.service.WorkflowVariableService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 工作流变量库控制器 (C-WF-VAR-1).
 *
 * <p>读: 公开 (workflow editor / PropertyPanel / AIChat Tool 拉变量列表)
 * <p>写: 要求 {@code system:read_write} (admin 配置工厂自定义变量)
 *
 * @since 2026-05-17
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/workflow-variables")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "工作流变量库",
     description = "PropertyPanel/AIChat Tool 使用. 系统预设 (factory_id IS NULL) 全工厂共享, 仅 admin 可改.")
public class WorkflowVariableController {

    private final WorkflowVariableService service;

    @GetMapping("/available")
    @Operation(summary = "拉取工厂可见变量 (自定义 + 系统预设)")
    public ApiResponse<List<WorkflowVariableDef>> listAvailable(@PathVariable String factoryId) {
        return ApiResponse.success(service.listAvailable(factoryId));
    }

    @GetMapping
    @Operation(summary = "列出某工厂自定义变量 (admin)")
    public ApiResponse<List<WorkflowVariableDef>> listByFactory(@PathVariable String factoryId) {
        return ApiResponse.success(service.listByFactory(factoryId));
    }

    @GetMapping("/system-presets")
    @Operation(summary = "列出系统预设变量")
    public ApiResponse<List<WorkflowVariableDef>> listSystemPresets(@PathVariable String factoryId) {
        return ApiResponse.success(service.listSystemPresets());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取变量定义详情")
    public ApiResponse<WorkflowVariableDef> getById(@PathVariable String factoryId,
                                                    @PathVariable String id) {
        WorkflowVariableDef v = service.getById(factoryId, id)
                .orElseThrow(() -> new ResourceNotFoundException("工作流变量定义", "id", id));
        return ApiResponse.success(v);
    }

    @RequirePermission({"system:read_write"})
    @PostMapping
    @Operation(summary = "创建工厂自定义变量")
    public ApiResponse<WorkflowVariableDef> create(@PathVariable String factoryId,
                                                   @RequestBody WorkflowVariableDef def) {
        return ApiResponse.success("变量定义创建成功", service.create(factoryId, def));
    }

    @RequirePermission({"system:read_write"})
    @PutMapping("/{id}")
    @Operation(summary = "更新工厂自定义变量 (PATCH)")
    public ApiResponse<WorkflowVariableDef> update(@PathVariable String factoryId,
                                                   @PathVariable String id,
                                                   @RequestBody WorkflowVariableDef partial) {
        return ApiResponse.success("变量定义更新成功", service.update(factoryId, id, partial));
    }

    @RequirePermission({"system:read_write"})
    @DeleteMapping("/{id}")
    @Operation(summary = "删除工厂自定义变量 (软删除)")
    public ApiResponse<Void> delete(@PathVariable String factoryId, @PathVariable String id) {
        service.delete(factoryId, id);
        return ApiResponse.successMessage("变量定义已删除");
    }

    // ==================== R5: 表达式测试 (友好错误) ====================

    @PostMapping("/test")
    @Operation(summary = "测试 SpEL 表达式 (sandbox 求值, 返结果 + R5 友好错误)",
               description = "PropertyPanel / AIChat Tool 调此接口. Body: " +
                       "{ \"spel\": \"#order.amount > 10000\", \"sampleContext\": {\"order\": {\"amount\": 15000}} }")
    public ApiResponse<Map<String, Object>> testExpression(
            @PathVariable String factoryId,
            @RequestBody TestExpressionRequest req) {
        return ApiResponse.success(service.testExpression(factoryId, req.getSpel(), req.getSampleContext()));
    }

    @lombok.Data
    public static class TestExpressionRequest {
        private String spel;
        private Map<String, Object> sampleContext;
    }
}
