/**
 * Copyright (C) 2018-2019
 * All rights reserved, Designed By www.joolun.com
 */
package com.joolun.web.api;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.joolun.common.core.domain.AjaxResult;
import com.joolun.common.core.redis.RedisCache;
import com.joolun.mall.entity.SmsSendRecord;
import com.joolun.mall.service.SmsSendRecordService;
import com.joolun.weixin.entity.WxUser;
import com.joolun.weixin.service.WxUserService;
import com.joolun.web.utils.WxTokenHelper;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.TimeUnit;

/**
 * 认证API - 手机号验证码登录
 *
 * @author JL
 * @date 2024-12-25
 */
@Slf4j
@RestController
@AllArgsConstructor
@RequestMapping("/weixin/api/ma/auth")
public class AuthApi {

    private final WxUserService wxUserService;
    private final SmsSendRecordService smsSendRecordService;
    private final RedisCache redisCache;
    private final WxTokenHelper wxTokenHelper;

    private static final String SMS_CODE_PREFIX = "sms:code:";
    private static final int SMS_CODE_EXPIRE_MINUTES = 5;

    /**
     * 发送短信验证码
     * @param params 请求参数: phone - 手机号
     * @return 结果
     */
    @PostMapping("/sms/send")
    public AjaxResult sendSmsCode(@RequestBody Map<String, String> params) {
        String phone = params.get("phone");

        if (phone == null || !phone.matches("^1[3-9]\\d{9}$")) {
            return AjaxResult.error("请输入正确的手机号");
        }

        // 检查发送频率 (1分钟内不能重复发送)
        String cacheKey = SMS_CODE_PREFIX + phone;
        String existingCode = redisCache.getCacheObject(cacheKey);
        if (existingCode != null) {
            return AjaxResult.error("验证码已发送，请稍后再试");
        }

        // 生成6位验证码
        String code = String.format("%06d", new Random().nextInt(1000000));

        // TODO: 接入真实短信服务发送验证码
        // 此处模拟发送，实际应调用短信服务商API
        log.info("发送验证码: {} -> {}", phone, code);

        // 保存验证码到Redis
        redisCache.setCacheObject(cacheKey, code, SMS_CODE_EXPIRE_MINUTES, TimeUnit.MINUTES);

        // 记录发送记录
        SmsSendRecord record = new SmsSendRecord();
        record.setPhone(phone);
        record.setCode(code);
        record.setStatus(2); // 发送成功 (2=成功)
        record.setSendTime(LocalDateTime.now());
        record.setExpireTime(LocalDateTime.now().plusMinutes(SMS_CODE_EXPIRE_MINUTES));
        smsSendRecordService.save(record);

        return AjaxResult.success("验证码已发送");
    }

    /**
     * 手机号验证码登录
     * @param params 请求参数: phone - 手机号, code - 验证码
     * @return 登录结果
     */
    @PostMapping("/phone-login")
    public AjaxResult phoneLogin(@RequestBody Map<String, String> params) {
        String phone = params.get("phone");
        String code = params.get("code");

        if (phone == null || code == null) {
            return AjaxResult.error("手机号和验证码不能为空");
        }

        // 验证验证码
        String cacheKey = SMS_CODE_PREFIX + phone;
        String cachedCode = redisCache.getCacheObject(cacheKey);
        if (cachedCode == null) {
            return AjaxResult.error("验证码已过期，请重新获取");
        }
        if (!cachedCode.equals(code)) {
            return AjaxResult.error("验证码错误");
        }

        // 验证成功，删除验证码
        redisCache.deleteObject(cacheKey);

        // 查找或创建用户
        WxUser wxUser = wxUserService.getOne(Wrappers.<WxUser>lambdaQuery()
                .eq(WxUser::getPhone, phone));

        if (wxUser == null) {
            // 创建新用户
            wxUser = new WxUser();
            wxUser.setPhone(phone);
            wxUser.setNickName("用户" + phone.substring(7)); // 使用手机后4位作为昵称
            wxUser.setCreateTime(LocalDateTime.now());
            wxUserService.save(wxUser);
        }

        // 生成JWT登录凭证
        Map<String, String> tokens = wxTokenHelper.createTokens(wxUser);

        Map<String, Object> result = new HashMap<>();
        result.put("user", wxUser);
        result.put("accessToken", tokens.get("accessToken"));
        result.put("refreshToken", tokens.get("refreshToken"));

        return AjaxResult.success(result);
    }
}
