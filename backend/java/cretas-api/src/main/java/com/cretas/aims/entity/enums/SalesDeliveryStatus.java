package com.cretas.aims.entity.enums;

/**
 * 发货/出库状态枚举
 *
 * Issue #740 (六扇门 May10 会议):
 *   销售创建发货单 (DRAFT / PENDING_WAREHOUSE_CONFIRM, NOT 扣库存)
 *     → 仓库确认实发数量 (POST /warehouse/deliveries/{id}/confirm — 扣库存)
 *     → SHIPPED → DELIVERED
 *
 * 状态流转:
 *   DRAFT                       — 销售刚创建, 待仓库接手 (兼容旧逻辑)
 *   PENDING_WAREHOUSE_CONFIRM   — 销售已提交, 等待仓库确认实发数量
 *   PICKED                      — 仓库已拣货 (旧字段, 保留兼容)
 *   SHIPPED                     — 仓库确认扣库存, 已发货
 *   DELIVERED                   — 客户签收
 *   RETURNED                    — 退回
 */
public enum SalesDeliveryStatus {
    DRAFT("草稿", "发货单草稿"),
    PENDING_WAREHOUSE_CONFIRM("待仓库确认", "销售已提交, 等待仓库确认实发数量"),
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
