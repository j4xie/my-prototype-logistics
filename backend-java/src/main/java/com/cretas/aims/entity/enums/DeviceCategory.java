package com.cretas.aims.entity.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 设备类别枚举
 * 区分传统设备与 IoT 设备类型
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
public enum DeviceCategory {
    TRADITIONAL("传统设备", "traditional"),
    IOT_SCALE("IoT电子秤", "iot_scale"),
    IOT_CAMERA("IoT摄像头", "iot_camera"),
    IOT_SENSOR("IoT传感器", "iot_sensor");

    private final String description;
    private final String frontendValue;

    DeviceCategory(String description, String frontendValue) {
        this.description = description;
        this.frontendValue = frontendValue;
    }

    public String getDescription() {
        return description;
    }

    /**
     * 序列化时返回前端期望的小写值
     */
    @JsonValue
    public String getFrontendValue() {
        return frontendValue;
    }

    /**
     * 从前端值或枚举名反序列化
     */
    @JsonCreator
    public static DeviceCategory fromValue(String value) {
        if (value == null) {
            return null;
        }
        // 尝试匹配前端值
        for (DeviceCategory category : values()) {
            if (category.frontendValue.equalsIgnoreCase(value)) {
                return category;
            }
        }
        // 尝试匹配枚举名
        for (DeviceCategory category : values()) {
            if (category.name().equalsIgnoreCase(value)) {
                return category;
            }
        }
        throw new IllegalArgumentException("Unknown device category: " + value);
    }
}
