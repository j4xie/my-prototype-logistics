package com.cretas.aims.service.workflow;

import com.cretas.aims.dto.approval.ApprovalDecision;
import com.cretas.aims.dto.approval.ExecutionContext;
import com.cretas.aims.dto.approval.PendingApproval;
import com.cretas.aims.entity.config.ApprovalWorkflow;

import java.util.List;
import java.util.Map;

/**
 * Graph-native 审批工作流执行引擎.
 *
 * <p>实现 4 种执行模式:
 * <ul>
 *   <li><b>Sequential</b>: approval 节点 requiredApprovers=1, 单签后走 outgoing.</li>
 *   <li><b>Conditional</b>: condition 节点按 outgoing edges 的 SpEL condition 评估,
 *       选第一个 true 的 (优先级 ASC) 走.</li>
 *   <li><b>Parallel</b>: parallel 节点同时启动所有 outgoing 分支.</li>
 *   <li><b>会签 N-of-M</b>: join 节点 mode=ALL/N_OF_M/ANY 决定何时汇聚.</li>
 * </ul>
 *
 * <p><b>持久化</b>: Day 4 内存实现 (ConcurrentHashMap, 单实例 OK). Sprint 4
 * follow-up 加 Redis + 持久化表.
 *
 * @since 2026-05-16 (Sprint 3 Track-I)
 */
public interface ApprovalWorkflowExecutor {

    /**
     * 启动一个 ApprovalWorkflow 实例.
     *
     * <p>从 startNode 开始自动推进, 直到撞到 approval 节点 (pause) 或 end 节点 (terminate).
     */
    ExecutionContext start(ApprovalWorkflow workflow,
                           String businessRefId,
                           Map<String, Object> businessContext,
                           Long initiatorUserId);

    /**
     * 提交一个审批决定.
     *
     * <p>调用方提交 approve/reject. 单签场景下 approve 后立即推进 outgoing edges;
     * 会签场景下累积签到, requiredApprovers 满足才推进.
     *
     * <p>reject 直接终止整个 workflow (Day 4 简化; Sprint 4 支持 rejectionHandling
     * 细分: return_to_reporter / return_to_previous / escalate_to_admin).
     */
    ExecutionContext submit(ExecutionContext ctx,
                            String nodeId,
                            ApprovalDecision decision,
                            Long approverUserId,
                            String approverRole,
                            String comment);

    /** 查询当前活跃 approval 节点 + 它们的 approver 需求. */
    List<PendingApproval> getPending(ExecutionContext ctx);

    /** 取消整个 workflow 实例 (设 status=CANCELLED). */
    ExecutionContext cancel(ExecutionContext ctx, Long cancellerUserId, String reason);

    /** 超时升级 (Scheduler 调用). 暂时未实现 — Sprint 4 配合 escalationConfigId. */
    ExecutionContext escalate(ExecutionContext ctx, String timeoutNodeId);

    /** 查询 ExecutionContext (内存 store lookup). */
    ExecutionContext getContext(String executionId);
}
