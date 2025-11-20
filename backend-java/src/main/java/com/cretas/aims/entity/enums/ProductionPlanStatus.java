package com.cretas.aims.entity.enums;

/**
 * 生产计划状态枚举
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public enum ProductionPlanStatus {
    /**
     * 待处理
     */
    PENDING("待处理", "计划已创建，等待开始"),
     /**
      * 进行中
      */
    IN_PROGRESS("进行中", "生产正在进行"),
     /**
      * 已完成
      */
    COMPLETED("已完成", "生产已完成"),
     /**
      * 已取消
      */
    CANCELLED("已取消", "计划已取消"),
     /**
      * 暂停
      */
    PAUSED("暂停", "生产暂时停止");
    private final String displayName;
    private final String description;
    ProductionPlanStatus(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }
    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
