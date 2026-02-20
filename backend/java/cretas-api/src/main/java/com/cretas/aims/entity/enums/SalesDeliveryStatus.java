package com.cretas.aims.entity.enums;

/**
 * 发货/出库状态枚举
 */
public enum SalesDeliveryStatus {
    DRAFT("草稿", "发货单草稿"),
    PICKED("已拣货", "已完成拣货/备货"),
    SHIPPED("已发货", "已交付物流/已出门店"),
    DELIVERED("已签收", "客户已签收确认"),
    RETURNED("已退回", "货物退回");

    private final String displayName;
    private final String description;

    SalesDeliveryStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}
