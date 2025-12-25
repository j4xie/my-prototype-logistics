package com.joolun.mall.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.joolun.mall.entity.Merchant;
import com.joolun.mall.entity.MerchantNotification;
import com.joolun.mall.mapper.MerchantMapper;
import com.joolun.mall.mapper.MerchantNotificationMapper;
import com.joolun.mall.service.MerchantNotificationService;
import com.joolun.mall.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 商家通知服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MerchantNotificationServiceImpl extends ServiceImpl<MerchantNotificationMapper, MerchantNotification>
        implements MerchantNotificationService {

    private final MerchantMapper merchantMapper;
    private final SmsService smsService;

    @Override
    public IPage<MerchantNotification> pageNotifications(IPage<MerchantNotification> page, MerchantNotification query) {
        return baseMapper.selectPage1(page, query);
    }

    @Override
    public IPage<MerchantNotification> getByMerchantId(IPage<MerchantNotification> page, Long merchantId, String category) {
        LambdaQueryWrapper<MerchantNotification> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MerchantNotification::getMerchantId, merchantId)
               .ne(MerchantNotification::getInAppStatus, 3) // 排除已删除
               .orderByDesc(MerchantNotification::getCreateTime);

        if (category != null && !category.isEmpty()) {
            wrapper.eq(MerchantNotification::getCategory, category);
        }

        return baseMapper.selectPage(page, wrapper);
    }

    @Override
    public int getUnreadCount(Long merchantId) {
        return baseMapper.countUnreadByMerchantId(merchantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean markAsRead(Long id) {
        MerchantNotification notification = baseMapper.selectById(id);
        if (notification == null) {
            return false;
        }

        notification.setInAppStatus(2); // 已读
        notification.setInAppReadTime(LocalDateTime.now());
        notification.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(notification) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int batchMarkAsRead(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        return baseMapper.batchMarkRead(ids);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean markAsRead(List<Long> ids) {
        return batchMarkAsRead(ids) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int markAllAsRead(Long merchantId) {
        LambdaUpdateWrapper<MerchantNotification> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(MerchantNotification::getMerchantId, merchantId)
               .eq(MerchantNotification::getInAppStatus, 1) // 只更新已发送的
               .set(MerchantNotification::getInAppStatus, 2)
               .set(MerchantNotification::getInAppReadTime, LocalDateTime.now())
               .set(MerchantNotification::getUpdateTime, LocalDateTime.now());
        return baseMapper.update(null, wrapper);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MerchantNotification sendNotification(Long merchantId, String title, String content, String category,
                                                  String relatedKeyword, String relatedProductIds,
                                                  boolean enableSms, Long createdBy, String createdByName) {
        // 获取商户信息
        Merchant merchant = merchantMapper.selectById(merchantId);
        if (merchant == null) {
            log.warn("商户不存在: {}", merchantId);
            return null;
        }

        // 创建通知
        MerchantNotification notification = new MerchantNotification();
        notification.setMerchantId(merchantId);
        notification.setUserId(merchant.getUserId());
        notification.setPhone(merchant.getContactPhone());
        notification.setTitle(title);
        notification.setContent(content);
        notification.setSummary(content.length() > 100 ? content.substring(0, 100) + "..." : content);
        notification.setCategory(category);
        notification.setPriority(0);
        notification.setRelatedKeyword(relatedKeyword);
        notification.setRelatedProductIds(relatedProductIds);

        // 站内消息状态
        notification.setInAppStatus(1); // 已发
        notification.setInAppSentTime(LocalDateTime.now());

        // 短信状态
        notification.setSmsEnabled(enableSms ? 1 : 0);
        notification.setSmsStatus(enableSms ? 1 : 0); // 1=待发

        notification.setCreatedBy(createdBy);
        notification.setCreatedByName(createdByName);
        notification.setCreateTime(LocalDateTime.now());

        baseMapper.insert(notification);

        // 如果启用短信，异步发送
        if (enableSms && merchant.getContactPhone() != null) {
            sendSms(notification.getId());
        }

        return notification;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean sendSms(Long notificationId) {
        MerchantNotification notification = baseMapper.selectById(notificationId);
        if (notification == null || notification.getPhone() == null) {
            return false;
        }

        try {
            // 准备短信参数
            Map<String, String> params = new HashMap<>();
            params.put("keyword", notification.getRelatedKeyword() != null ?
                    notification.getRelatedKeyword() : "商品");
            params.put("url", "https://mall.cretas.cn/n/" + notificationId);

            // 发送短信
            smsService.send(notification.getPhone(), "PRODUCT_FOUND", params,
                    notification.getMerchantId(), notificationId);

            // 更新状态
            notification.setSmsStatus(2); // 已发
            notification.setSmsSentTime(LocalDateTime.now());
            notification.setSmsResult("发送成功");
            notification.setUpdateTime(LocalDateTime.now());
            baseMapper.updateById(notification);

            return true;
        } catch (Exception e) {
            log.error("发送短信失败: notificationId={}", notificationId, e);

            notification.setSmsStatus(3); // 发送失败
            notification.setSmsResult(e.getMessage());
            notification.setUpdateTime(LocalDateTime.now());
            baseMapper.updateById(notification);

            return false;
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteNotification(Long id) {
        MerchantNotification notification = baseMapper.selectById(id);
        if (notification == null) {
            return false;
        }

        notification.setInAppStatus(3); // 已删除
        notification.setUpdateTime(LocalDateTime.now());
        return baseMapper.updateById(notification) > 0;
    }
}
