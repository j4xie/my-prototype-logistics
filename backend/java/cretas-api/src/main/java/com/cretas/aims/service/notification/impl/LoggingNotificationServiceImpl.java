package com.cretas.aims.service.notification.impl;

import com.cretas.aims.service.notification.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * P1-5 通知服务默认实现 — 仅 log, 未接真实渠道.
 *
 * <p>切换到真实实现 (钉钉/微信/email) 时:
 * <ol>
 *   <li>新建 DingTalkNotificationServiceImpl / WeChatNotificationServiceImpl 等</li>
 *   <li>加 @Primary 或用 Spring Profile 区分 environment</li>
 *   <li>本类保留作为 fallback / dev 环境</li>
 * </ol>
 */
@Slf4j
@Service
public class LoggingNotificationServiceImpl implements NotificationService {

    @Override
    public void notifyRole(String factoryId, String roleCode, String title, String body) {
        log.info("[P1-5 Notification] factory={} role={} title={} body={}",
                factoryId, roleCode, title, body);
    }

    @Override
    public void notifyUser(String factoryId, Long userId, String title, String body) {
        log.info("[P1-5 Notification] factory={} user={} title={} body={}",
                factoryId, userId, title, body);
    }

    @Override
    public void broadcastFactory(String factoryId, String title, String body) {
        log.warn("[P1-5 Notification BROADCAST] factory={} title={} body={}",
                factoryId, title, body);
    }
}
