package com.cretas.aims.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import lombok.Getter;

/**
 * 讯飞语音服务配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Configuration
@Getter
public class IFlytekConfig {

    /**
     * 讯飞 APPID
     */
    @Value("${cretas.iflytek.appid:}")
    private String appId;

    /**
     * 讯飞 APIKey
     */
    @Value("${cretas.iflytek.api-key:}")
    private String apiKey;

    /**
     * 讯飞 APISecret
     */
    @Value("${cretas.iflytek.api-secret:}")
    private String apiSecret;

    /**
     * 语音听写 WebSocket 地址
     */
    @Value("${cretas.iflytek.iat-url:wss://iat-api.xfyun.cn/v2/iat}")
    private String iatUrl;

    /**
     * 语言 (zh_cn: 中文普通话, en_us: 英语)
     */
    @Value("${cretas.iflytek.language:zh_cn}")
    private String language;

    /**
     * 领域 (iat: 日常用语, medical: 医疗)
     */
    @Value("${cretas.iflytek.domain:iat}")
    private String domain;

    /**
     * 方言 (mandarin: 普通话, cantonese: 粤语)
     */
    @Value("${cretas.iflytek.accent:mandarin}")
    private String accent;

    /**
     * 是否返回标点符号
     */
    @Value("${cretas.iflytek.ptt:true}")
    private boolean ptt;

    /**
     * 检查配置是否完整
     */
    public boolean isConfigured() {
        return appId != null && !appId.isEmpty()
            && apiKey != null && !apiKey.isEmpty()
            && apiSecret != null && !apiSecret.isEmpty();
    }
}
