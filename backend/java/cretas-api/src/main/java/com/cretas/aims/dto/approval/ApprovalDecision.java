package com.cretas.aims.dto.approval;

/**
 * 审批人对单个 approval 节点的决定.
 *
 * @since 2026-05-16 (Sprint 3 Track-I)
 */
public enum ApprovalDecision {
    /** 通过 — 推进流程到 outgoing edges. */
    APPROVED,

    /** 拒绝 — 终止整个工作流实例 (Day 4 简化版; Sprint 4 支持 rejectionHandling 细分). */
    REJECTED
}
