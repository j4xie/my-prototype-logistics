package com.cretas.aims.entity.enums;

/**
 * P2 #74 S-COMPLAINT-1 — 售后服务投诉状态.
 *
 * <pre>
 * NEW (新建)
 *   ↓ start investigation
 * INVESTIGATING (调查中)
 *   ↓ resolve
 * RESOLVED (已解决)
 *   ↓ close
 * CLOSED (已关闭)
 * </pre>
 */
public enum ServiceComplaintStatus {
    NEW,
    INVESTIGATING,
    RESOLVED,
    CLOSED,
}
