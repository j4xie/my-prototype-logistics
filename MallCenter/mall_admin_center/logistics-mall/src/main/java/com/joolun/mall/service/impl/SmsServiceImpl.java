package com.joolun.mall.service.impl;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.teaopenapi.models.Config;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.joolun.mall.entity.NotificationTemplate;
import com.joolun.mall.entity.SmsSendRecord;
import com.joolun.mall.mapper.NotificationTemplateMapper;
import com.joolun.mall.mapper.SmsSendRecordMapper;
import com.joolun.mall.service.SmsService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 短信服务实现
 * 集成阿里云短信服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmsServiceImpl implements SmsService {

    private final SmsSendRecordMapper recordMapper;
    private final NotificationTemplateMapper templateMapper;
    private final ObjectMapper objectMapper;

    @Value("${sms.aliyun.access-key:}")
    private String accessKey;

    @Value("${sms.aliyun.access-secret:}")
    private String accessSecret;

    @Value("${sms.aliyun.sign-name:白垩纪食品}")
    private String signName;

    @Value("${sms.aliyun.endpoint:dysmsapi.aliyuncs.com}")
    private String endpoint;

    @Value("${sms.daily-limit:100}")
    private int dailyLimit;

    @Value("${sms.enabled:false}")
    private boolean smsEnabled;

    private Client aliyunClient;

    /**
     * 初始化阿里云客户端
     */
    @PostConstruct
    public void init() {
        if (smsEnabled && accessKey != null && !accessKey.isEmpty()
                && accessSecret != null && !accessSecret.isEmpty()) {
            try {
                Config config = new Config()
                        .setAccessKeyId(accessKey)
                        .setAccessKeySecret(accessSecret)
                        .setEndpoint(endpoint);
                aliyunClient = new Client(config);
                log.info("阿里云短信客户端初始化成功");
            } catch (Exception e) {
                log.error("阿里云短信客户端初始化失败", e);
            }
        } else {
            log.info("短信服务未启用或配置不完整，将使用模拟模式");
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SmsSendRecord send(String phone, String templateCode, Map<String, String> params,
                               Long merchantId, Long notificationId) {
        // 检查限额
        if (!checkDailyLimit(merchantId)) {
            log.warn("商户今日短信发送已达上限: merchantId={}", merchantId);
            SmsSendRecord record = createRecord(phone, templateCode, params, merchantId, notificationId);
            record.setStatus(3); // 发送失败
            record.setResultCode("LIMIT_EXCEEDED");
            record.setResultMessage("今日发送次数已达上限");
            recordMapper.insert(record);
            return record;
        }

        // 获取模板
        NotificationTemplate template = templateMapper.selectByCode(templateCode);
        String aliyunTemplateId = template != null ? template.getSmsTemplateId() : null;

        // 创建发送记录
        SmsSendRecord record = createRecord(phone, templateCode, params, merchantId, notificationId);
        record.setStatus(1); // 发送中
        recordMapper.insert(record);

        try {
            // 调用阿里云API发送短信
            String bizId = sendSmsViaAliyun(phone, aliyunTemplateId, params);

            // 更新发送结果
            record.setStatus(2); // 成功
            record.setSendTime(LocalDateTime.now());
            record.setResultCode("OK");
            record.setResultMessage("发送成功");
            record.setBizId(bizId);
            recordMapper.updateById(record);

            log.info("短信发送成功: phone={}, templateCode={}, bizId={}", phone, templateCode, bizId);

        } catch (Exception e) {
            log.error("短信发送失败: phone={}, templateCode={}", phone, templateCode, e);

            record.setStatus(3); // 失败
            record.setSendTime(LocalDateTime.now());
            record.setResultCode("ERROR");
            record.setResultMessage(e.getMessage());
            recordMapper.updateById(record);
        }

        return record;
    }

    @Override
    public boolean checkDailyLimit(Long merchantId) {
        int todayCount = getTodaySendCount(merchantId);
        return todayCount < dailyLimit;
    }

    @Override
    public int getTodaySendCount(Long merchantId) {
        return recordMapper.countTodaySendByMerchant(merchantId, LocalDate.now());
    }

    @Override
    public int getDailyLimit() {
        return dailyLimit;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean retry(Long recordId) {
        SmsSendRecord record = recordMapper.selectById(recordId);
        if (record == null || record.getStatus() != 3) {
            return false;
        }

        // 重置状态
        record.setStatus(1); // 发送中
        record.setResultCode(null);
        record.setResultMessage(null);
        recordMapper.updateById(record);

        try {
            // 重新发送
            NotificationTemplate template = templateMapper.selectByCode(record.getTemplateId());
            String aliyunTemplateId = template != null ? template.getSmsTemplateId() : null;

            Map<String, String> params = null;
            if (record.getTemplateParams() != null) {
                try {
                    params = objectMapper.readValue(record.getTemplateParams(), Map.class);
                } catch (Exception e) {
                    log.warn("解析模板参数失败", e);
                }
            }

            String bizId = sendSmsViaAliyun(record.getPhone(), aliyunTemplateId, params);

            record.setStatus(2); // 成功
            record.setSendTime(LocalDateTime.now());
            record.setResultCode("OK");
            record.setResultMessage("重试成功");
            record.setBizId(bizId);
            recordMapper.updateById(record);

            return true;

        } catch (Exception e) {
            log.error("短信重试失败: recordId={}", recordId, e);

            record.setStatus(3); // 失败
            record.setResultCode("RETRY_FAILED");
            record.setResultMessage(e.getMessage());
            recordMapper.updateById(record);

            return false;
        }
    }

    /**
     * 创建发送记录
     */
    private SmsSendRecord createRecord(String phone, String templateCode, Map<String, String> params,
                                        Long merchantId, Long notificationId) {
        SmsSendRecord record = new SmsSendRecord();
        record.setPhone(phone);
        record.setTemplateId(templateCode);
        try {
            record.setTemplateParams(params != null ? objectMapper.writeValueAsString(params) : null);
        } catch (Exception e) {
            log.warn("序列化模板参数失败", e);
        }
        record.setMerchantId(merchantId);
        record.setNotificationId(notificationId);
        record.setFeeCount(1);
        record.setCreateTime(LocalDateTime.now());
        return record;
    }

    /**
     * 调用阿里云短信API
     */
    private String sendSmsViaAliyun(String phone, String templateId, Map<String, String> params) throws Exception {
        // 如果未启用短信或客户端未初始化，使用模拟模式
        if (!smsEnabled || aliyunClient == null) {
            log.info("短信服务模拟模式: phone={}, templateId={}, params={}", phone, templateId, params);
            return "MOCK_" + System.currentTimeMillis();
        }

        // 构建发送请求
        SendSmsRequest request = new SendSmsRequest()
                .setPhoneNumbers(phone)
                .setSignName(signName)
                .setTemplateCode(templateId);

        // 设置模板参数
        if (params != null && !params.isEmpty()) {
            request.setTemplateParam(objectMapper.writeValueAsString(params));
        }

        // 发送短信
        SendSmsResponse response = aliyunClient.sendSms(request);

        // 检查响应
        if (response.getBody() != null) {
            String code = response.getBody().getCode();
            String message = response.getBody().getMessage();
            String bizId = response.getBody().getBizId();

            if ("OK".equals(code)) {
                log.info("短信发送成功: phone={}, bizId={}", phone, bizId);
                return bizId;
            } else {
                log.error("短信发送失败: code={}, message={}", code, message);
                throw new RuntimeException("短信发送失败: " + message);
            }
        }

        throw new RuntimeException("短信服务响应异常");
    }
}
