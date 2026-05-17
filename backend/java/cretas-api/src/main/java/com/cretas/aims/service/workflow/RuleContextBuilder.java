package com.cretas.aims.service.workflow;

import com.cretas.aims.dto.approval.ExecutionContext;
import com.cretas.aims.entity.User;

import java.util.HashMap;
import java.util.Map;

/**
 * 把 {@link ExecutionContext} + 发起人 {@link User} 派生为 evaluator-friendly context Map.
 *
 * <p>Single point of injection — Sprint 4 Wave 1 Chat O 完成
 * {@code WorkflowVariableContext} 后, 改这里 delegate 即可. 其他 caller 不变.
 *
 * <p>当前 minimal context fields (Chat O 未 ship):
 * <ul>
 *   <li>businessContext 透传: amount / department / customerId / ...</li>
 *   <li>initiator 信息: initiatorUserId / role / department / username</li>
 *   <li>流程态: workflowId / executionId / decisionType</li>
 * </ul>
 *
 * @since 2026-05-16
 */
public final class RuleContextBuilder {

    private RuleContextBuilder() {}

    /**
     * @param exec 执行实例 (非 null)
     * @param initiator 发起人 (可 null — 用户表查不到时)
     */
    public static Map<String, Object> build(ExecutionContext exec, User initiator) {
        Map<String, Object> ctx = new HashMap<>();
        if (exec != null) {
            if (exec.getBusinessContext() != null) {
                ctx.putAll(exec.getBusinessContext());
            }
            ctx.put("initiatorUserId", exec.getInitiatorUserId());
            ctx.put("workflowId", exec.getWorkflowId());
            ctx.put("executionId", exec.getExecutionId());
            ctx.put("decisionType", exec.getDecisionType() == null ? null : exec.getDecisionType().name());
            ctx.put("factoryId", exec.getFactoryId());
        }
        if (initiator != null) {
            // initiator 的 role / department 会 override businessContext 中同名 key,
            // 这是有意 — businessContext 是任意业务字段, initiator 信息更权威.
            if (initiator.getRoleCode() != null) ctx.put("role", initiator.getRoleCode());
            if (initiator.getDepartment() != null) ctx.put("department", initiator.getDepartment());
            if (initiator.getUsername() != null) ctx.put("username", initiator.getUsername());
        }
        return ctx;
    }
}
