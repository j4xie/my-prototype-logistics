package com.joolun.mall.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import com.joolun.mall.entity.MerchantNotification;

import java.util.List;

/**
 * 商家通知服务接口
 */
public interface MerchantNotificationService extends IService<MerchantNotification> {

    /**
     * 分页查询通知
     */
    IPage<MerchantNotification> pageNotifications(IPage<MerchantNotification> page, MerchantNotification query);

    /**
     * 获取商户的通知列表
     */
    IPage<MerchantNotification> getByMerchantId(IPage<MerchantNotification> page, Long merchantId, String category);

    /**
     * 获取未读通知数量
     */
    int getUnreadCount(Long merchantId);

    /**
     * 标记通知为已读
     */
    boolean markAsRead(Long id);

    /**
     * 批量标记已读
     */
    int batchMarkAsRead(List<Long> ids);

    /**
     * 批量标记已读 (别名方法)
     */
    boolean markAsRead(List<Long> ids);

    /**
     * 标记所有为已读
     */
    int markAllAsRead(Long merchantId);

    /**
     * 发送通知
     * @param merchantId 商户ID
     * @param title 标题
     * @param content 内容
     * @param category 类型
     * @param relatedKeyword 关联关键词
     * @param relatedProductIds 关联商品
     * @param enableSms 是否发送短信
     * @param createdBy 创建人
     * @param createdByName 创建人姓名
     */
    MerchantNotification sendNotification(Long merchantId, String title, String content, String category,
                                          String relatedKeyword, String relatedProductIds,
                                          boolean enableSms, Long createdBy, String createdByName);

    /**
     * 发送短信
     */
    boolean sendSms(Long notificationId);

    /**
     * 删除通知
     */
    boolean deleteNotification(Long id);
}
