package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.Notification;
import com.cretas.aims.entity.enums.FactoryUserRole;
import com.cretas.aims.entity.enums.NotificationType;

import java.util.List;
import java.util.Map;

/**
 * 通知服务接口
 * 提供调度预案、告警、系统消息等的 App 内推送通知功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
public interface NotificationService {

    // ==================== 发送通知 ====================

    /**
     * 发送广播通知（简化方法，用于系统事件）
     *
     * @param factoryId      工厂ID
     * @param notificationType 通知类型代码 (如 "QUALITY_DISPOSITION_EXECUTED")
     * @param title          标题
     * @param content        内容
     * @param metadata       附加数据
     */
    default void sendNotification(String factoryId, String notificationType, String title,
                                   String content, Map<String, Object> metadata) {
        // 默认实现：调用广播方法
        sendToAllUsers(factoryId, title, content, NotificationType.SYSTEM, notificationType, null);
    }

    /**
     * 发送通知给指定用户
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @param title     标题
     * @param content   内容
     * @param type      通知类型
     * @param source    来源 (SCHEDULING, ALERT, BATCH, QUALITY, SYSTEM)
     * @param sourceId  关联的业务ID
     * @return 创建的通知
     */
    Notification sendNotification(String factoryId, Long userId, String title, String content,
                                   NotificationType type, String source, String sourceId);

    /**
     * 发送通知给工厂所有用户
     *
     * @param factoryId 工厂ID
     * @param title     标题
     * @param content   内容
     * @param type      通知类型
     * @param source    来源
     * @param sourceId  关联的业务ID
     * @return 创建的通知 (userId=null 表示广播)
     */
    Notification sendToAllUsers(String factoryId, String title, String content,
                                 NotificationType type, String source, String sourceId);

    /**
     * 发送通知给指定角色的所有用户
     *
     * @param factoryId 工厂ID
     * @param role      目标角色
     * @param title     标题
     * @param content   内容
     * @param type      通知类型
     * @param source    来源
     * @param sourceId  关联的业务ID
     * @return 创建的通知列表
     */
    List<Notification> sendToRole(String factoryId, FactoryUserRole role, String title,
                                   String content, NotificationType type, String source, String sourceId);

    /**
     * 发送通知给多个用户
     *
     * @param factoryId 工厂ID
     * @param userIds   用户ID列表
     * @param title     标题
     * @param content   内容
     * @param type      通知类型
     * @param source    来源
     * @param sourceId  关联的业务ID
     * @return 创建的通知列表
     */
    List<Notification> sendToUsers(String factoryId, List<Long> userIds, String title,
                                    String content, NotificationType type, String source, String sourceId);

    // ==================== 调度专用通知 ====================

    /**
     * 发送调度计划创建通知
     *
     * @param factoryId   工厂ID
     * @param scheduleId  排程ID
     * @param planDetails 计划详情 (用于生成通知内容)
     */
    void notifyScheduleCreated(String factoryId, String scheduleId, Map<String, Object> planDetails);

    /**
     * 发送调度计划确认通知
     *
     * @param factoryId  工厂ID
     * @param scheduleId 排程ID
     * @param confirmedBy 确认人
     */
    void notifyScheduleConfirmed(String factoryId, String scheduleId, String confirmedBy);

    /**
     * 发送延期告警通知
     *
     * @param factoryId    工厂ID
     * @param scheduleId   排程ID
     * @param delayReason  延期原因
     * @param efficiency   实际效率
     */
    void notifyScheduleDelayed(String factoryId, String scheduleId, String delayReason, double efficiency);

    /**
     * 发送紧急插单通知
     *
     * @param factoryId    工厂ID
     * @param scheduleId   排程ID
     * @param impactSummary 影响概述
     */
    void notifyUrgentInsert(String factoryId, String scheduleId, String impactSummary);

    // ==================== 查询通知 ====================

    /**
     * 获取用户的通知列表 (分页)
     *
     * @param factoryId   工厂ID
     * @param userId      用户ID
     * @param pageRequest 分页参数
     * @return 分页结果
     */
    PageResponse<Notification> getNotifications(String factoryId, Long userId, PageRequest pageRequest);

    /**
     * 获取用户的未读通知数量
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @return 未读数量
     */
    long getUnreadCount(String factoryId, Long userId);

    /**
     * 获取最近的通知
     *
     * @param factoryId 工厂ID
     * @param limit     数量限制
     * @return 通知列表
     */
    List<Notification> getRecentNotifications(String factoryId, int limit);

    // ==================== 更新通知 ====================

    /**
     * 标记通知为已读
     *
     * @param factoryId      工厂ID
     * @param notificationId 通知ID
     */
    void markAsRead(String factoryId, Long notificationId);

    /**
     * 标记用户所有通知为已读
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @return 更新的数量
     */
    int markAllAsRead(String factoryId, Long userId);

    /**
     * 删除通知
     *
     * @param factoryId      工厂ID
     * @param notificationId 通知ID
     */
    void deleteNotification(String factoryId, Long notificationId);
}
