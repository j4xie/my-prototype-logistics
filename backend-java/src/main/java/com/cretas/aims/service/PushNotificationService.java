package com.cretas.aims.service;

import java.util.Map;

/**
 * 推送通知服务接口
 * 使用 Expo Push Notification API 发送推送
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
public interface PushNotificationService {

    /**
     * 发送推送到单个设备
     *
     * @param pushToken Expo Push Token
     * @param title     通知标题
     * @param body      通知内容
     * @param data      附加数据
     */
    void sendToDevice(String pushToken, String title, String body, Map<String, Object> data);

    /**
     * 发送推送到单个设备（带优先级）
     *
     * @param pushToken Expo Push Token
     * @param title     通知标题
     * @param body      通知内容
     * @param data      附加数据
     * @param priority  优先级 (default/normal/high)
     */
    void sendToDevice(String pushToken, String title, String body, Map<String, Object> data, String priority);

    /**
     * 发送推送到用户的所有设备
     *
     * @param userId 用户 ID
     * @param title  通知标题
     * @param body   通知内容
     * @param data   附加数据
     */
    void sendToUser(Long userId, String title, String body, Map<String, Object> data);

    /**
     * 发送推送到工厂的所有设备
     *
     * @param factoryId 工厂 ID
     * @param title     通知标题
     * @param body      通知内容
     * @param data      附加数据
     */
    void sendToFactory(String factoryId, String title, String body, Map<String, Object> data);

    /**
     * 发送推送到多个用户
     *
     * @param userIds 用户 ID 列表
     * @param title   通知标题
     * @param body    通知内容
     * @param data    附加数据
     */
    void sendToUsers(Long[] userIds, String title, String body, Map<String, Object> data);

    /**
     * 发送批量推送（多个 Token）
     *
     * @param pushTokens Push Token 列表
     * @param title      通知标题
     * @param body       通知内容
     * @param data       附加数据
     */
    void sendBatch(String[] pushTokens, String title, String body, Map<String, Object> data);

    /**
     * 发送审批通知
     *
     * @param userId       用户 ID
     * @param approvalType 审批类型 (plan/quality/etc)
     * @param approvalId   审批项 ID
     * @param message      消息内容
     */
    void sendApprovalNotification(Long userId, String approvalType, Long approvalId, String message);

    /**
     * 发送质检通知
     *
     * @param userId        用户 ID
     * @param inspectionId  质检 ID
     * @param inspectionResult 质检结果
     * @param message       消息内容
     */
    void sendQualityNotification(Long userId, Long inspectionId, String inspectionResult, String message);

    /**
     * 发送计划变更通知
     *
     * @param userIds   用户 ID 列表
     * @param planId    计划 ID
     * @param changeType 变更类型
     * @param message   消息内容
     */
    void sendPlanChangeNotification(Long[] userIds, Long planId, String changeType, String message);

    /**
     * 发送紧急插单通知
     *
     * @param userId  用户 ID
     * @param planId  计划 ID
     * @param message 消息内容
     */
    void sendUrgentInsertNotification(Long userId, Long planId, String message);

    /**
     * 验证 Push Token 是否有效
     *
     * @param pushToken Expo Push Token
     * @return true if valid, false otherwise
     */
    boolean validatePushToken(String pushToken);
}
