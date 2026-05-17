package com.cretas.aims.service.workflow.impl;

import com.cretas.aims.dto.approval.ApprovalDecision;
import com.cretas.aims.dto.approval.ApprovalRecord;
import com.cretas.aims.dto.approval.ExecutionContext;
import com.cretas.aims.dto.approval.PendingApproval;
import com.cretas.aims.entity.config.ApprovalWorkflow;
import com.cretas.aims.entity.config.ApprovalWorkflowEdge;
import com.cretas.aims.entity.config.ApprovalWorkflowNode;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.service.ApprovalWorkflowService;
import com.cretas.aims.service.workflow.ApprovalWorkflowExecutor;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator;
import com.cretas.aims.service.workflow.SandboxedSpelEvaluator.SpelEvaluationFailure;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ApprovalWorkflowExecutor 内存实现.
 *
 * <p>Day 4 (Sprint 3 Track-I) — synchronous, in-memory, single-JVM. ExecutionContext
 * 存在 ConcurrentHashMap, 重启丢. Sprint 4 follow-up 加 Redis + 持久化表.
 *
 * <p><b>SpEL</b>: Spring Expression Language 求值 condition. businessContext map
 * entries 映射为 SpEL 变量 ({@code #amount}, {@code #department} 等).
 *
 * @since 2026-05-16
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ApprovalWorkflowExecutorImpl implements ApprovalWorkflowExecutor {

    private final ApprovalWorkflowService workflowService;
    /**
     * Sprint 4 W2 Chat J C-WF-VAR-1: 沙箱化 SpEL 求值器, 替代 Sprint 3 I 直接
     * 使用的 StandardEvaluationContext (开放反射 / RCE attack vector).
     */
    private final SandboxedSpelEvaluator spelEvaluator;

    /** In-memory ExecutionContext store. Sprint 4 → Redis. */
    private final Map<String, ExecutionContext> contextStore = new ConcurrentHashMap<>();

    // ==================== 公开 API ====================

    @Override
    public ExecutionContext start(ApprovalWorkflow workflow,
                                  String businessRefId,
                                  Map<String, Object> businessContext,
                                  Long initiatorUserId) {
        log.info("启动 ApprovalWorkflow 实例 - workflowId={}, businessRefId={}, initiator={}",
                workflow.getId(), businessRefId, initiatorUserId);

        ExecutionContext ctx = ExecutionContext.builder()
                .executionId(UUID.randomUUID().toString())
                .workflowId(workflow.getId())
                .factoryId(workflow.getFactoryId())
                .decisionType(workflow.getDecisionType())
                .businessRefId(businessRefId)
                .businessContext(businessContext == null ? new HashMap<>() : new HashMap<>(businessContext))
                .activeNodeIds(new HashSet<>())
                .nodeHistory(new HashMap<>())
                .joinArrivals(new HashMap<>())
                .initiatorUserId(initiatorUserId)
                .startedAt(Instant.now())
                .status(ExecutionContext.Status.RUNNING)
                .build();

        GraphIndex graph = indexGraph(workflow);
        advance(ctx, graph, workflow.getStartNodeId(), null);

        contextStore.put(ctx.getExecutionId(), ctx);
        return ctx;
    }

    @Override
    public ExecutionContext submit(ExecutionContext ctx,
                                   String nodeId,
                                   ApprovalDecision decision,
                                   Long approverUserId,
                                   String approverRole,
                                   String comment) {
        if (ctx.getStatus() != ExecutionContext.Status.RUNNING) {
            throw new BusinessException(400, "工作流实例已结束, 不可再 submit. 当前 status=" + ctx.getStatus());
        }
        if (!ctx.getActiveNodeIds().contains(nodeId)) {
            throw new BusinessException(400, "节点 " + nodeId + " 当前不活跃, 不能 submit")
                    .withHint("可能审批人弄错了节点, 或工作流已被其他人推进");
        }

        ApprovalWorkflow workflow = lookupWorkflowOrFail(ctx);
        GraphIndex graph = indexGraph(workflow);
        ApprovalWorkflowNode node = graph.nodesById.get(nodeId);
        if (node == null || !"approval".equals(node.getType())) {
            throw new BusinessException(400, "节点 " + nodeId + " 不是 approval 类型, 不能 submit");
        }

        // 记录审批
        ctx.recordApproval(ApprovalRecord.builder()
                .nodeId(nodeId)
                .approverUserId(approverUserId)
                .approverRole(approverRole)
                .decision(decision)
                .comment(comment)
                .decidedAt(Instant.now())
                .build());

        log.info("审批 submit - executionId={}, nodeId={}, userId={}, decision={}",
                ctx.getExecutionId(), nodeId, approverUserId, decision);

        // REJECTED → 直接终止 (Day 4 简化; Sprint 4 支持 rejectionHandling 细分)
        if (decision == ApprovalDecision.REJECTED) {
            terminate(ctx, ExecutionContext.Status.REJECTED, "REJECTED");
            return ctx;
        }

        // APPROVED → 看 requiredApprovers 是否满足 (会签场景)
        int requiredApprovers = extractInt(node.getConfig(), "requiredApprovers", 1);
        int currentApproved = ctx.countApprovedAt(nodeId);
        if (currentApproved < requiredApprovers) {
            log.info("会签进度: nodeId={}, currentApproved={}/{} — 等待更多 approver",
                    nodeId, currentApproved, requiredApprovers);
            return ctx;
        }

        // 满足 — 推进 outgoing
        ctx.getActiveNodeIds().remove(nodeId);
        for (ApprovalWorkflowEdge edge : graph.outgoingByNode.getOrDefault(nodeId, List.of())) {
            advance(ctx, graph, edge.getTarget(), nodeId);
        }
        return ctx;
    }

    @Override
    public List<PendingApproval> getPending(ExecutionContext ctx) {
        if (ctx.getStatus() != ExecutionContext.Status.RUNNING) return List.of();

        ApprovalWorkflow workflow = lookupWorkflowOrFail(ctx);
        GraphIndex graph = indexGraph(workflow);

        List<PendingApproval> pending = new ArrayList<>();
        for (String activeId : ctx.getActiveNodeIds()) {
            ApprovalWorkflowNode node = graph.nodesById.get(activeId);
            if (node == null || !"approval".equals(node.getType())) continue;

            int requiredApprovers = extractInt(node.getConfig(), "requiredApprovers", 1);
            int currentApproved = ctx.countApprovedAt(activeId);
            int timeoutMinutes = extractInt(node.getConfig(), "timeoutMinutes", 0);
            Long timeoutAt = timeoutMinutes > 0
                    ? ctx.getStartedAt().getEpochSecond() + (long) timeoutMinutes * 60L
                    : null;

            pending.add(PendingApproval.builder()
                    .nodeId(activeId)
                    .nodeName(node.getLabel())
                    .approverRoles(extractList(node.getConfig(), "approverRoles"))
                    .approverUserIds(extractList(node.getConfig(), "approverUserIds"))
                    .requiredApprovers(requiredApprovers)
                    .currentApprovers(currentApproved)
                    .timeoutAt(timeoutAt)
                    .activatedAt(Instant.now())
                    .build());
        }
        return pending;
    }

    @Override
    public ExecutionContext cancel(ExecutionContext ctx, Long cancellerUserId, String reason) {
        if (ctx.getStatus() != ExecutionContext.Status.RUNNING) {
            throw new BusinessException(400, "工作流实例已结束, 不可取消. status=" + ctx.getStatus());
        }
        log.info("取消 ApprovalWorkflow 实例 - executionId={}, canceller={}, reason={}",
                ctx.getExecutionId(), cancellerUserId, reason);
        ctx.setCancellerUserId(cancellerUserId);
        ctx.setCancelReason(reason);
        terminate(ctx, ExecutionContext.Status.CANCELLED, "CANCELLED");
        return ctx;
    }

    @Override
    public ExecutionContext escalate(ExecutionContext ctx, String timeoutNodeId) {
        // Day 4 stub — Sprint 4 配合 escalationConfigId 实现
        log.warn("escalate 暂未实现 (Sprint 4 follow-up) — executionId={}, nodeId={}",
                ctx.getExecutionId(), timeoutNodeId);
        return ctx;
    }

    @Override
    public ExecutionContext getContext(String executionId) {
        return contextStore.get(executionId);
    }

    // ==================== 内部 advance 逻辑 ====================

    /**
     * 从 nodeId 推进, 处理各 type 的转换规则.
     *
     * @param fromSourceNodeId 上游节点 (join 簿记用); 启动时为 null
     */
    private void advance(ExecutionContext ctx, GraphIndex graph, String nodeId, String fromSourceNodeId) {
        if (ctx.getStatus() != ExecutionContext.Status.RUNNING) return;

        ApprovalWorkflowNode node = graph.nodesById.get(nodeId);
        if (node == null) {
            log.error("找不到节点 - executionId={}, nodeId={}", ctx.getExecutionId(), nodeId);
            terminate(ctx, ExecutionContext.Status.REJECTED, "GRAPH_ERROR");
            return;
        }

        switch (node.getType()) {
            case "start" -> advanceFromStart(ctx, graph, nodeId);
            case "approval" -> activateApproval(ctx, graph, nodeId, node);
            case "condition" -> advanceFromCondition(ctx, graph, nodeId);
            case "parallel" -> advanceFromParallel(ctx, graph, nodeId);
            case "join" -> arriveAtJoin(ctx, graph, nodeId, fromSourceNodeId);
            case "notify" -> advanceFromNotify(ctx, graph, nodeId, node);
            case "end" -> terminateAtEnd(ctx, node);
            default -> {
                log.error("未知节点类型 - nodeId={}, type={}", nodeId, node.getType());
                terminate(ctx, ExecutionContext.Status.REJECTED, "UNKNOWN_NODE_TYPE");
            }
        }
    }

    private void advanceFromStart(ExecutionContext ctx, GraphIndex graph, String nodeId) {
        List<ApprovalWorkflowEdge> outgoing = graph.outgoingByNode.getOrDefault(nodeId, List.of());
        if (outgoing.isEmpty()) {
            log.warn("start 节点无 outgoing edge - terminating REJECTED");
            terminate(ctx, ExecutionContext.Status.REJECTED, "START_NO_OUTGOING");
            return;
        }
        // start 节点只取第一个 outgoing (按 priority 排序)
        advance(ctx, graph, outgoing.get(0).getTarget(), nodeId);
    }

    private void activateApproval(ExecutionContext ctx, GraphIndex graph, String nodeId, ApprovalWorkflowNode node) {
        // 检查 autoApproveCondition
        String autoApproveCondition = (String) (node.getConfig() == null ? null : node.getConfig().get("autoApproveCondition"));
        if (StringUtils.hasText(autoApproveCondition) && evaluateCondition(autoApproveCondition, ctx.getBusinessContext())) {
            log.info("Auto-approve 触发 - nodeId={}, condition={}", nodeId, autoApproveCondition);
            // 记录 auto-approve 跟正常 APPROVED 一样
            int requiredApprovers = extractInt(node.getConfig(), "requiredApprovers", 1);
            for (int i = 0; i < requiredApprovers; i++) {
                ctx.recordApproval(ApprovalRecord.builder()
                        .nodeId(nodeId)
                        .decision(ApprovalDecision.APPROVED)
                        .comment("AUTO_APPROVE:" + autoApproveCondition)
                        .build());
            }
            // 推进 outgoing
            for (ApprovalWorkflowEdge edge : graph.outgoingByNode.getOrDefault(nodeId, List.of())) {
                advance(ctx, graph, edge.getTarget(), nodeId);
            }
            return;
        }
        // 检查 autoRejectCondition
        String autoRejectCondition = (String) (node.getConfig() == null ? null : node.getConfig().get("autoRejectCondition"));
        if (StringUtils.hasText(autoRejectCondition) && evaluateCondition(autoRejectCondition, ctx.getBusinessContext())) {
            log.info("Auto-reject 触发 - nodeId={}, condition={}", nodeId, autoRejectCondition);
            ctx.recordApproval(ApprovalRecord.builder()
                    .nodeId(nodeId)
                    .decision(ApprovalDecision.REJECTED)
                    .comment("AUTO_REJECT:" + autoRejectCondition)
                    .build());
            terminate(ctx, ExecutionContext.Status.REJECTED, "REJECTED");
            return;
        }
        // 否则 — 激活节点等待人审
        ctx.getActiveNodeIds().add(nodeId);
        log.info("激活 approval 节点 - executionId={}, nodeId={}, label={}",
                ctx.getExecutionId(), nodeId, node.getLabel());
    }

    private void advanceFromCondition(ExecutionContext ctx, GraphIndex graph, String nodeId) {
        List<ApprovalWorkflowEdge> outgoing = graph.outgoingByNode.getOrDefault(nodeId, List.of());
        // 按 priority ASC 评估 (数值越小越优先 per Edge javadoc)
        List<ApprovalWorkflowEdge> sorted = new ArrayList<>(outgoing);
        sorted.sort(Comparator.comparingInt(e -> e.getPriority() == null ? 0 : e.getPriority()));

        ApprovalWorkflowEdge defaultEdge = null;
        for (ApprovalWorkflowEdge edge : sorted) {
            if ("DEFAULT".equalsIgnoreCase(edge.getLabel())) {
                defaultEdge = edge;
                continue;
            }
            if (!StringUtils.hasText(edge.getCondition())) {
                // 空 condition = 总是 true
                advance(ctx, graph, edge.getTarget(), nodeId);
                return;
            }
            if (evaluateCondition(edge.getCondition(), ctx.getBusinessContext())) {
                log.info("Condition 评估通过 - nodeId={}, condition={}, target={}",
                        nodeId, edge.getCondition(), edge.getTarget());
                advance(ctx, graph, edge.getTarget(), nodeId);
                return;
            }
        }
        if (defaultEdge != null) {
            log.info("Condition fall-through to DEFAULT - nodeId={}, target={}", nodeId, defaultEdge.getTarget());
            advance(ctx, graph, defaultEdge.getTarget(), nodeId);
            return;
        }
        log.warn("Condition 所有 outgoing 均不匹配且无 DEFAULT - nodeId={}, terminating REJECTED", nodeId);
        terminate(ctx, ExecutionContext.Status.REJECTED, "CONDITION_NO_MATCH");
    }

    private void advanceFromParallel(ExecutionContext ctx, GraphIndex graph, String nodeId) {
        List<ApprovalWorkflowEdge> outgoing = graph.outgoingByNode.getOrDefault(nodeId, List.of());
        if (outgoing.isEmpty()) {
            log.warn("parallel 节点无 outgoing - terminating");
            terminate(ctx, ExecutionContext.Status.REJECTED, "PARALLEL_NO_OUTGOING");
            return;
        }
        // 同时启动所有分支
        for (ApprovalWorkflowEdge edge : outgoing) {
            advance(ctx, graph, edge.getTarget(), nodeId);
        }
    }

    private void arriveAtJoin(ExecutionContext ctx, GraphIndex graph, String joinNodeId, String fromSourceNodeId) {
        ApprovalWorkflowNode node = graph.nodesById.get(joinNodeId);
        // 记录到达
        if (fromSourceNodeId != null) {
            int arrivedCount = ctx.recordJoinArrival(joinNodeId, fromSourceNodeId);
            ctx.recordApproval(ApprovalRecord.joinArrival(joinNodeId, fromSourceNodeId));
            log.info("Join 到达 - nodeId={}, fromSource={}, arrivedCount={}",
                    joinNodeId, fromSourceNodeId, arrivedCount);
        }

        // 检查 mode 是否满足
        String mode = (String) (node.getConfig() == null ? "ALL" : node.getConfig().getOrDefault("mode", "ALL"));
        boolean ready = switch (mode) {
            case "ALL" -> {
                Set<String> incomingSources = graph.incomingByNode.getOrDefault(joinNodeId, List.of())
                        .stream().map(ApprovalWorkflowEdge::getSource)
                        .collect(java.util.stream.Collectors.toSet());
                Set<String> arrived = ctx.getJoinArrivals().getOrDefault(joinNodeId, Set.of());
                yield arrived.containsAll(incomingSources);
            }
            case "N_OF_M" -> {
                int n = extractInt(node.getConfig(), "n", Integer.MAX_VALUE);
                yield ctx.getJoinArrivals().getOrDefault(joinNodeId, Set.of()).size() >= n;
            }
            case "ANY" -> ctx.getJoinArrivals().getOrDefault(joinNodeId, Set.of()).size() >= 1;
            default -> {
                log.error("Join 节点 mode 非法 - nodeId={}, mode={}", joinNodeId, mode);
                yield false;
            }
        };

        if (!ready) {
            log.info("Join 等待更多分支 - nodeId={}, mode={}", joinNodeId, mode);
            return;
        }

        log.info("Join 满足 mode={} - 推进 outgoing - nodeId={}", mode, joinNodeId);
        for (ApprovalWorkflowEdge edge : graph.outgoingByNode.getOrDefault(joinNodeId, List.of())) {
            advance(ctx, graph, edge.getTarget(), joinNodeId);
        }
    }

    private void advanceFromNotify(ExecutionContext ctx, GraphIndex graph, String nodeId, ApprovalWorkflowNode node) {
        // Day 4 stub: log only. Sprint 4 配合 InAppNotification service push.
        List<String> notifyRoles = extractList(node.getConfig(), "notifyRoles");
        log.info("Notify 节点触发 - nodeId={}, roles={}", nodeId, notifyRoles);
        // Fire-and-forget, 立即推进
        for (ApprovalWorkflowEdge edge : graph.outgoingByNode.getOrDefault(nodeId, List.of())) {
            advance(ctx, graph, edge.getTarget(), nodeId);
        }
    }

    private void terminateAtEnd(ExecutionContext ctx, ApprovalWorkflowNode endNode) {
        String outcome = (String) (endNode.getConfig() == null ? "APPROVED" : endNode.getConfig().getOrDefault("outcome", "APPROVED"));
        ExecutionContext.Status terminalStatus = switch (outcome) {
            case "REJECTED" -> ExecutionContext.Status.REJECTED;
            case "TIMEOUT" -> ExecutionContext.Status.TIMEOUT;
            case "CANCELLED" -> ExecutionContext.Status.CANCELLED;
            default -> ExecutionContext.Status.APPROVED;
        };
        terminate(ctx, terminalStatus, outcome);
    }

    private void terminate(ExecutionContext ctx, ExecutionContext.Status status, String outcome) {
        // REJECTED 优先 (若并行分支中某个 end 是 REJECTED, 全局 REJECTED)
        if (ctx.getStatus() == ExecutionContext.Status.REJECTED && status == ExecutionContext.Status.APPROVED) {
            log.info("已 REJECTED 不被 APPROVED 覆盖 - executionId={}", ctx.getExecutionId());
            return;
        }
        ctx.setStatus(status);
        ctx.setFinalOutcome(outcome);
        ctx.setCompletedAt(Instant.now());
        ctx.getActiveNodeIds().clear();
        log.info("ApprovalWorkflow 实例终止 - executionId={}, status={}, outcome={}",
                ctx.getExecutionId(), status, outcome);
    }

    // ==================== Helpers ====================

    private ApprovalWorkflow lookupWorkflowOrFail(ExecutionContext ctx) {
        return workflowService.getById(ctx.getFactoryId(), ctx.getWorkflowId())
                .orElseThrow(() -> new BusinessException(404,
                        "工作流配置不存在 - workflowId=" + ctx.getWorkflowId()));
    }

    /** Build graph indexes for fast lookup. */
    GraphIndex indexGraph(ApprovalWorkflow workflow) {
        List<ApprovalWorkflowNode> nodes = workflowService.deserializeNodes(workflow.getNodesJson());
        List<ApprovalWorkflowEdge> edges = workflowService.deserializeEdges(workflow.getEdgesJson());

        Map<String, ApprovalWorkflowNode> nodesById = new HashMap<>();
        for (ApprovalWorkflowNode n : nodes) nodesById.put(n.getId(), n);

        Map<String, List<ApprovalWorkflowEdge>> outgoing = new HashMap<>();
        Map<String, List<ApprovalWorkflowEdge>> incoming = new HashMap<>();
        for (ApprovalWorkflowEdge e : edges) {
            outgoing.computeIfAbsent(e.getSource(), k -> new ArrayList<>()).add(e);
            incoming.computeIfAbsent(e.getTarget(), k -> new ArrayList<>()).add(e);
        }
        return new GraphIndex(nodesById, outgoing, incoming);
    }

    boolean evaluateCondition(String spel, Map<String, Object> businessContext) {
        // C-WF-VAR-1: 走 SandboxedSpelEvaluator. RCE attack vectors (T(Runtime), new ProcessBuilder,
        // .getClass(), 写入) 全 throw SpelEvaluationFailure 而非 silent execute.
        // 求值失败统一 fallback false (executor 行为不变), 但日志带 user-friendly message.
        try {
            return spelEvaluator.evaluateBoolean(spel, businessContext);
        } catch (SpelEvaluationFailure e) {
            log.error("SpEL 求值失败 (workflow executor) - expression={}, message={}, hint={}",
                    spel, e.getUserMessage(), e.getActionHint());
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> extractList(Map<String, Object> config, String key) {
        if (config == null) return List.of();
        Object v = config.get(key);
        if (v instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    private int extractInt(Map<String, Object> config, String key, int defaultValue) {
        if (config == null) return defaultValue;
        Object v = config.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException ignored) { /* fallthrough */ }
        }
        return defaultValue;
    }

    /** Internal: graph 索引 (per execution, 不缓存). */
    record GraphIndex(
            Map<String, ApprovalWorkflowNode> nodesById,
            Map<String, List<ApprovalWorkflowEdge>> outgoingByNode,
            Map<String, List<ApprovalWorkflowEdge>> incomingByNode
    ) {}
}
