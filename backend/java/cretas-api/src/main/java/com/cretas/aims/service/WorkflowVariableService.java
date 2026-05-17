package com.cretas.aims.service;

import com.cretas.aims.entity.config.WorkflowVariableDef;
import com.cretas.aims.service.workflow.WorkflowVariableContext;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 工作流变量库服务 (C-WF-VAR-1).
 *
 * <p>提供 CRUD + 表达式测试 (供 PropertyPanel / AIChat Tool 验证 SpEL).
 *
 * @since 2026-05-17
 */
public interface WorkflowVariableService {

    /** 弹框使用: 工厂可见变量 (自定义 + 系统预设). */
    List<WorkflowVariableDef> listAvailable(String factoryId);

    /** Admin: 列出某工厂自定义变量. */
    List<WorkflowVariableDef> listByFactory(String factoryId);

    /** Admin: 列出系统预设. */
    List<WorkflowVariableDef> listSystemPresets();

    Optional<WorkflowVariableDef> getById(String factoryId, String id);

    /** Admin 创建工厂自定义变量. */
    WorkflowVariableDef create(String factoryId, WorkflowVariableDef def);

    /** Admin 更新工厂自定义变量 (PATCH). */
    WorkflowVariableDef update(String factoryId, String id, WorkflowVariableDef partial);

    /** Admin 软删除工厂自定义变量 (系统预设不可删). */
    void delete(String factoryId, String id);

    // ==================== Expression test ====================

    /**
     * 测试 SpEL 表达式 — 供 PropertyPanel / AIChat workflow_variable_test Tool 用.
     *
     * <p>步骤:
     * <ol>
     *   <li>用 {@code sampleContext} 构建 {@link WorkflowVariableContext}</li>
     *   <li>SandboxedSpelEvaluator 求值, 返结果 + 任何 hint</li>
     * </ol>
     *
     * <p>结果 map 字段:
     * <ul>
     *   <li>{@code success}: boolean — eval 成功 / 失败</li>
     *   <li>{@code result}: Object — 求值结果 (success=true 时)</li>
     *   <li>{@code resultType}: String — 结果类型简写</li>
     *   <li>{@code errorMessage}: String — user-friendly message (success=false 时)</li>
     *   <li>{@code actionHint}: String — R5 友好 next action (success=false 时)</li>
     * </ul>
     */
    Map<String, Object> testExpression(String factoryId, String spel,
                                       Map<String, Object> sampleContext);
}
