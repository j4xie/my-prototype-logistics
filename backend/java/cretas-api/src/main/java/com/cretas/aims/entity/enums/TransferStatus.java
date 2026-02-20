package com.cretas.aims.entity.enums;

/**
 * 内部调拨单状态枚举（完整状态机）
 *
 * DRAFT → REQUESTED → APPROVED → SHIPPED → RECEIVED → CONFIRMED
 *                  ↘ REJECTED
 * 任意非终态 → CANCELLED
 */
public enum TransferStatus {
    DRAFT("草稿", "调拨单草稿"),
    REQUESTED("已申请", "分店/分厂已提交调拨申请"),
    APPROVED("已审批", "总部/调出方已审批通过"),
    REJECTED("已驳回", "调拨申请被驳回"),
    SHIPPED("已发货", "调出方已出库发货"),
    RECEIVED("已签收", "调入方已签收"),
    CONFIRMED("已确认", "双方确认完成，库存已更新"),
    CANCELLED("已取消", "调拨单已取消");

    private final String displayName;
    private final String description;

    TransferStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }

    /** 是否为终态 */
    public boolean isTerminal() {
        return this == CONFIRMED || this == CANCELLED || this == REJECTED;
    }
}
