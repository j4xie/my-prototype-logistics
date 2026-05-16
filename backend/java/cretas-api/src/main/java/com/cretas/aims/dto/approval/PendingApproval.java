package com.cretas.aims.dto.approval;

import lombok.*;

import java.time.Instant;
import java.util.List;

/**
 * 当前等待审批的 approval 节点信息.
 *
 * <p>{@link ExecutionContext#getActiveNodeIds()} 中的每个 approval 节点都会
 * 投影出一个 PendingApproval. UI / 通知系统据此通知 approver.
 *
 * @since 2026-05-16 (Sprint 3 Track-I)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PendingApproval {
    private String nodeId;
    private String nodeName;
    private List<String> approverRoles;
    private List<String> approverUserIds;

    /** 需要的审批人数 (会签时 ≥ 2). */
    private Integer requiredApprovers;

    /** 已签到人数 (会签进度). */
    private Integer currentApprovers;

    /** 超时绝对时间 (epoch second), null = 不超时. */
    private Long timeoutAt;

    /** 进入节点的时间. */
    private Instant activatedAt;
}
