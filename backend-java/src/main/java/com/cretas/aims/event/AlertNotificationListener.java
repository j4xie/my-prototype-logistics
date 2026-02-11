package com.cretas.aims.event;

import com.cretas.aims.entity.Notification;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.enums.NotificationType;
import com.cretas.aims.repository.NotificationRepository;
import com.cretas.aims.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 告警通知监听器
 * 监听 ProductionAlertEvent 并为相关用户创建通知
 *
 * 通知目标角色:
 * - factory_super_admin: 工厂总监，接收所有告警
 * - workshop_supervisor: 车间主任，接收所有告警
 * - quality_manager: 质量经理，仅接收 CRITICAL 告警
 * - dispatcher: 调度，仅接收 CRITICAL 告警
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Component
public class AlertNotificationListener {

    private static final Logger log = LoggerFactory.getLogger(AlertNotificationListener.class);

    /** Roles that receive ALL production alerts */
    private static final List<String> PRIMARY_ALERT_ROLES = Arrays.asList(
            "factory_super_admin",
            "workshop_supervisor"
    );

    /** Roles that only receive CRITICAL alerts */
    private static final List<String> CRITICAL_ONLY_ROLES = Arrays.asList(
            "quality_manager",
            "dispatcher"
    );

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Handle a production alert event asynchronously.
     * Creates notification entities for the relevant users in the factory.
     */
    @EventListener
    @Async
    @Transactional
    public void handleAlertEvent(ProductionAlertEvent event) {
        log.info("处理告警通知事件: alertId={}, factoryId={}, type={}, level={}",
                event.getAlertId(), event.getFactoryId(), event.getAlertType(), event.getLevel());

        try {
            String factoryId = event.getFactoryId();
            boolean isCritical = "CRITICAL".equals(event.getLevel());

            // Collect target users
            List<User> targetUsers = new ArrayList<>();

            // Primary roles always receive alerts
            for (String roleCode : PRIMARY_ALERT_ROLES) {
                List<User> users = userRepository.findByFactoryIdAndRoleCode(factoryId, roleCode);
                targetUsers.addAll(users);
            }

            // Critical-only roles receive only CRITICAL level alerts
            if (isCritical) {
                for (String roleCode : CRITICAL_ONLY_ROLES) {
                    List<User> users = userRepository.findByFactoryIdAndRoleCode(factoryId, roleCode);
                    targetUsers.addAll(users);
                }
            }

            if (targetUsers.isEmpty()) {
                log.warn("工厂 {} 无匹配的通知目标用户", factoryId);
                return;
            }

            // Build notification title and content
            String levelLabel = getAlertLevelLabel(event.getLevel());
            String typeLabel = getAlertTypeLabel(event.getAlertType());
            String title = String.format("[%s] %s", levelLabel, typeLabel);
            String content = event.getDescription();
            NotificationType notificationType = isCritical ? NotificationType.ALERT : NotificationType.WARNING;

            // Create a notification for each target user
            int createdCount = 0;
            for (User user : targetUsers) {
                try {
                    Notification notification = Notification.builder()
                            .factoryId(factoryId)
                            .userId(user.getId())
                            .title(title)
                            .content(content)
                            .type(notificationType)
                            .isRead(false)
                            .source("ALERT")
                            .sourceId(String.valueOf(event.getAlertId()))
                            .actionUrl("/production/alerts/" + event.getAlertId())
                            .build();

                    notificationRepository.save(notification);
                    createdCount++;
                } catch (Exception e) {
                    log.warn("为用户 {} 创建通知失败: {}", user.getId(), e.getMessage());
                }
            }

            log.info("告警通知创建完成: alertId={}, 通知数={}, 目标用户数={}",
                    event.getAlertId(), createdCount, targetUsers.size());

        } catch (Exception e) {
            log.error("处理告警通知事件失败: alertId={}, error={}", event.getAlertId(), e.getMessage(), e);
        }
    }

    /**
     * Get a Chinese display label for alert level.
     */
    private String getAlertLevelLabel(String level) {
        if (level == null) return "信息";
        switch (level) {
            case "CRITICAL": return "严重";
            case "WARNING": return "警告";
            case "INFO": return "信息";
            default: return level;
        }
    }

    /**
     * Get a Chinese display label for alert type.
     */
    private String getAlertTypeLabel(String alertType) {
        if (alertType == null) return "生产异常";
        switch (alertType) {
            case "YIELD_DROP": return "良率下降";
            case "COST_SPIKE": return "成本飙升";
            case "OEE_LOW": return "OEE过低";
            case "QUALITY_FAIL": return "质量不达标";
            default: return alertType;
        }
    }
}
