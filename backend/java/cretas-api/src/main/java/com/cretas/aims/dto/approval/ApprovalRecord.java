package com.cretas.aims.dto.approval;

import lombok.*;

import java.time.Instant;

/**
 * 单个审批操作的历史记录.
 *
 * <p>记录在 {@link ExecutionContext#getNodeHistory()} 下, 按 nodeId 分组.
 * 会签场景下同一 nodeId 会有多条 ApprovalRecord (每个审批人一条).
 *
 * @since 2026-05-16 (Sprint 3 Track-I)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalRecord {
    private String nodeId;
    private Long approverUserId;
    private String approverRole;
    private ApprovalDecision decision;
    private String comment;
    @Builder.Default
    private Instant decidedAt = Instant.now();

    /** 系统记录 — 标记 branch 到达 join 节点 (会签 / parallel join 簿记). */
    public static ApprovalRecord joinArrival(String joinNodeId, String fromSourceNodeId) {
        return ApprovalRecord.builder()
                .nodeId(joinNodeId)
                .comment("JOIN_ARRIVAL_FROM:" + fromSourceNodeId)
                .build();
    }

    /** 系统记录 — auto-approve 触发. */
    public static ApprovalRecord autoApprove(String nodeId, String condition) {
        return ApprovalRecord.builder()
                .nodeId(nodeId)
                .decision(ApprovalDecision.APPROVED)
                .comment("AUTO_APPROVE:" + condition)
                .build();
    }
}
