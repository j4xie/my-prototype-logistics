package com.cretas.aims.event;

import org.springframework.context.ApplicationEvent;

/**
 * 生产告警事件
 * 当异常检测创建新的告警时发布此事件
 * 用于异步发送通知给相关用户
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
public class ProductionAlertEvent extends ApplicationEvent {

    private final Long alertId;
    private final String factoryId;
    private final String alertType;
    private final String level;
    private final String description;

    public ProductionAlertEvent(Object source, Long alertId, String factoryId,
                                String alertType, String level, String description) {
        super(source);
        this.alertId = alertId;
        this.factoryId = factoryId;
        this.alertType = alertType;
        this.level = level;
        this.description = description;
    }

    public Long getAlertId() {
        return alertId;
    }

    public String getFactoryId() {
        return factoryId;
    }

    public String getAlertType() {
        return alertType;
    }

    public String getLevel() {
        return level;
    }

    public String getDescription() {
        return description;
    }

    @Override
    public String toString() {
        return String.format("ProductionAlertEvent[alertId=%d, factoryId=%s, type=%s, level=%s]",
                alertId, factoryId, alertType, level);
    }
}
