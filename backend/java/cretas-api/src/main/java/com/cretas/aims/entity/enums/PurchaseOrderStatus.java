package com.cretas.aims.entity.enums;

/**
 * 采购订单状态枚举
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
public enum PurchaseOrderStatus {
    /** 草稿 */
    DRAFT("草稿", "采购订单草稿，尚未提交"),
    /** 已提交待审批 */
    SUBMITTED("已提交", "已提交等待审批"),
    /** 已审批 */
    APPROVED("已审批", "审批通过，等待供应商发货"),
    /** 部分到货 */
    PARTIAL_RECEIVED("部分到货", "部分物料已到货入库"),
    /** 全部到货 */
    COMPLETED("已完成", "全部物料已到货入库"),
    /** 已取消 */
    CANCELLED("已取消", "采购订单已取消"),
    /** 已关闭 */
    CLOSED("已关闭", "采购订单已关闭（含部分到货后关闭）");

    private final String displayName;
    private final String description;

    PurchaseOrderStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}
