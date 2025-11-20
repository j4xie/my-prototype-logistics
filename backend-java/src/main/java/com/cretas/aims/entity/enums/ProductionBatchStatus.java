package com.cretas.aims.entity.enums;

/**
 * 生产批次状态枚举
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public enum ProductionBatchStatus {
    PLANNED("计划中"),
    IN_PROGRESS("生产中"),
    PAUSED("已暂停"),
    COMPLETED("已完成"),
    CANCELLED("已取消");
    private final String description;
    ProductionBatchStatus(String description) {
        this.description = description;
    }
    public String getDescription() {
        return description;
}
}
