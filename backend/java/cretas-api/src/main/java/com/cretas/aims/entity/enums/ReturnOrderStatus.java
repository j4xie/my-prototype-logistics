package com.cretas.aims.entity.enums;

public enum ReturnOrderStatus {
    DRAFT("草稿", "退货单草稿，尚未提交"),
    SUBMITTED("已提交", "已提交等待审批"),
    APPROVED("已审批", "审批通过，等待处理"),
    REJECTED("已驳回", "审批驳回"),
    PROCESSING("处理中", "退货正在处理"),
    COMPLETED("已完成", "退货流程已完成");

    private final String displayName;
    private final String description;

    ReturnOrderStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}
