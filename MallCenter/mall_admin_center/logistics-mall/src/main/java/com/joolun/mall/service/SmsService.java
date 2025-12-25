package com.joolun.mall.service;

import com.joolun.mall.entity.SmsSendRecord;

import java.util.Map;

/**
 * 短信服务接口
 */
public interface SmsService {

    /**
     * 发送短信
     * @param phone 手机号
     * @param templateCode 模板代码
     * @param params 模板参数
     * @param merchantId 商户ID
     * @param notificationId 关联通知ID
     * @return 发送记录
     */
    SmsSendRecord send(String phone, String templateCode, Map<String, String> params,
                       Long merchantId, Long notificationId);

    /**
     * 检查是否达到发送限额
     */
    boolean checkDailyLimit(Long merchantId);

    /**
     * 获取今日发送数量
     */
    int getTodaySendCount(Long merchantId);

    /**
     * 获取发送配额
     */
    int getDailyLimit();

    /**
     * 重试失败的短信
     */
    boolean retry(Long recordId);
}
