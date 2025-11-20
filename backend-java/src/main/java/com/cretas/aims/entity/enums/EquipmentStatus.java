package com.cretas.aims.entity.enums;

/**
 * 设备状态枚举
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public enum EquipmentStatus {
    RUNNING("运行中"),
    IDLE("空闲"),
    MAINTENANCE("维护中"),
    FAULT("故障"),
    OFFLINE("离线");
    private final String description;
    EquipmentStatus(String description) {
        this.description = description;
    }
    public String getDescription() {
        return description;
}
}
