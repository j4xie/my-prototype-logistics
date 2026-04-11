package com.cretas.aims.service.notification;

/**
 * P1-5 通用通知服务 — 可扩展到钉钉/企业微信/email/RN push 等.
 *
 * <p>当前实现仅 log (LoggingNotificationServiceImpl), 未接真实通道.
 * 业务代码调用此 service 不需要关心具体渠道, 未来切换 impl 即可.
 */
public interface NotificationService {

    /**
     * 发送通知给特定角色 (工厂内广播给该角色所有人).
     *
     * @param factoryId 工厂ID
     * @param roleCode 角色代码 (e.g. WORKSHOP_SUPERVISOR / FACTORY_ADMIN)
     * @param title 通知标题 (短)
     * @param body 通知正文 (可长)
     */
    void notifyRole(String factoryId, String roleCode, String title, String body);

    /**
     * 发送通知给特定用户.
     */
    void notifyUser(String factoryId, Long userId, String title, String body);

    /**
     * 系统级广播 (所有用户, 谨慎使用).
     */
    void broadcastFactory(String factoryId, String title, String body);
}
