package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * 客如云POS开放平台配置
 *
 * 配置项通过环境变量注入，禁止硬编码:
 * - KERUYUN_APP_KEY: 客如云分配的应用Key
 * - KERUYUN_APP_SECRET: 客如云分配的应用密钥
 * - KERUYUN_API_BASE_URL: API基础地址 (默认 https://open.keruyun.com)
 * - KERUYUN_WEBHOOK_SECRET: Webhook回调签名密钥
 *
 * @author Cretas Team
 * @since 2026-03-12
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "cretas.pos.keruyun")
public class KeruyunConfig {

    /**
     * 客如云开放平台分配的应用Key
     */
    private String appKey;

    /**
     * 客如云开放平台分配的应用密钥
     */
    private String appSecret;

    /**
     * API基础地址
     * 默认: https://open.keruyun.com
     */
    private String apiBaseUrl = "https://open.keruyun.com";

    /**
     * Webhook回调签名密钥
     * 用于验证客如云推送回调的签名合法性
     */
    private String webhookSecret;

    /**
     * API调用超时时间 (毫秒)
     */
    private int timeout = 30000;

    /**
     * 连接超时时间 (毫秒)
     */
    private int connectTimeout = 10000;

    @PostConstruct
    public void init() {
        log.info("客如云POS配置初始化:");
        log.info("  - apiBaseUrl: {}", apiBaseUrl);
        log.info("  - appKey configured: {}", appKey != null && !appKey.isEmpty());
        log.info("  - appSecret configured: {}", appSecret != null && !appSecret.isEmpty());
        log.info("  - webhookSecret configured: {}", webhookSecret != null && !webhookSecret.isEmpty());
        log.info("  - timeout: {}ms, connectTimeout: {}ms", timeout, connectTimeout);
    }
}
