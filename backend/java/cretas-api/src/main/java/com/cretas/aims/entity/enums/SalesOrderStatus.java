package com.cretas.aims.entity.enums;

/**
 * 销售订单状态枚举
 * 通用：工厂出货 = 餐饮外卖/堂食
 */
public enum SalesOrderStatus {
    DRAFT("草稿", "销售订单草稿"),
    CONFIRMED("已确认", "客户已确认订单"),
    PROCESSING("处理中", "拣货/备货中"),
    PARTIAL_DELIVERED("部分发货", "部分商品已发货"),
    COMPLETED("已完成", "全部发货完成"),
    CANCELLED("已取消", "订单已取消");

    private final String displayName;
    private final String description;

    SalesOrderStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
}
