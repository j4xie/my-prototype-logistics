package com.cretas.aims.dto.approval;

import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import lombok.*;

import java.time.Instant;
import java.util.*;

/**
 * 单个 ApprovalWorkflow 实例的运行时状态.
 *
 * <p><b>Day 4 持久化策略</b>: 内存 ConcurrentHashMap (单实例 dev / demo OK).
 * Sprint 4 follow-up 加 Redis cache (key={@link #executionId}) + 持久化表
 * approval_workflow_instances 防 prod 重启丢状态.
 *
 * <p>会签 join 簿记: arrived branches 记在 {@link #joinArrivals},
 * key = joinNodeId, value = Set of incoming sourceNodeId 已到达.
 *
 * @since 2026-05-16 (Sprint 3 Track-I)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionContext {

    public enum Status {
        RUNNING,
        APPROVED,
        REJECTED,
        CANCELLED,
        TIMEOUT
    }

    /** UUID — 运行时实例 ID, 不入库 (Sprint 4 持久化时再 stable). */
    private String executionId;

    /** 关联的 ApprovalWorkflow ID (entity from DB). */
    private String workflowId;

    private String factoryId;

    private DecisionType decisionType;

    /** 业务单据 ID (e.g. quality_inspection.id / voucher.id). */
    private String businessRefId;

    /** SpEL 求值上下文 (amount / department / role / etc.). */
    @Builder.Default
    private Map<String, Object> businessContext = new HashMap<>();

    /** 当前活跃节点 ID 集合. 并行场景下多个; 单线串行场景下 1 个; 终态空. */
    @Builder.Default
    private Set<String> activeNodeIds = new HashSet<>();

    /** 节点 → 审批记录列表 (会签场景多条). */
    @Builder.Default
    private Map<String, List<ApprovalRecord>> nodeHistory = new HashMap<>();

    /**
     * Join 节点簿记: joinNodeId → 已到达的 incoming source nodeId 集合.
     *
     * <p>mode=ALL 时需要所有入边 source 都到; mode=N_OF_M 看 size; mode=ANY 看 ≥1.
     */
    @Builder.Default
    private Map<String, Set<String>> joinArrivals = new HashMap<>();

    private Long initiatorUserId;

    @Builder.Default
    private Instant startedAt = Instant.now();

    private Instant completedAt;

    @Builder.Default
    private Status status = Status.RUNNING;

    /** end 节点的 outcome (APPROVED/REJECTED/TIMEOUT/CANCELLED) — 终态时填. */
    private String finalOutcome;

    /** 取消时填写 — 谁取消的, 为什么. */
    private Long cancellerUserId;
    private String cancelReason;

    /** Helper: 添加审批记录到 nodeHistory. */
    public void recordApproval(ApprovalRecord record) {
        nodeHistory.computeIfAbsent(record.getNodeId(), k -> new ArrayList<>()).add(record);
    }

    /** Helper: 标记 branch 到 join 节点的到达. 返回到达后的总数. */
    public int recordJoinArrival(String joinNodeId, String fromSourceNodeId) {
        Set<String> arrived = joinArrivals.computeIfAbsent(joinNodeId, k -> new HashSet<>());
        arrived.add(fromSourceNodeId);
        return arrived.size();
    }

    /** Helper: 已通过审批的人数 (排除 join arrival markers). */
    public int countApprovedAt(String nodeId) {
        List<ApprovalRecord> records = nodeHistory.getOrDefault(nodeId, List.of());
        return (int) records.stream()
                .filter(r -> r.getDecision() == ApprovalDecision.APPROVED)
                .count();
    }
}
