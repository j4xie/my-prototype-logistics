package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * 长文本处理配置
 *
 * 用于配置长文本在送入意图分类前的预处理行为：
 * - 触发摘要的字符阈值
 * - 摘要最大长度
 * - 停用词移除开关
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "cretas.ai.long-text")
public class LongTextConfig {

    /**
     * 是否启用长文本处理
     */
    private boolean enabled = true;

    /**
     * 触发摘要的字符阈值
     * 超过此长度的输入将被预处理
     */
    private int threshold = 300;

    /**
     * 摘要最大长度
     */
    private int summaryMaxLength = 100;

    /**
     * 是否启用停用词移除
     */
    private boolean stopwordRemovalEnabled = true;

    /**
     * 摘要缓存过期时间（秒）
     */
    private int cacheExpireSeconds = 300;

    /**
     * 摘要缓存最大条目数
     */
    private int cacheMaxSize = 1000;

    /**
     * LLM 调用超时时间（秒）
     * 使用较短的超时避免阻塞主流程
     */
    private int llmTimeout = 15;

    @PostConstruct
    public void init() {
        log.info("LongTextConfig initialized:");
        log.info("  - enabled: {}", enabled);
        log.info("  - threshold: {} chars", threshold);
        log.info("  - summaryMaxLength: {} chars", summaryMaxLength);
        log.info("  - stopwordRemovalEnabled: {}", stopwordRemovalEnabled);
        log.info("  - cacheExpireSeconds: {}s", cacheExpireSeconds);
        log.info("  - cacheMaxSize: {}", cacheMaxSize);
    }

    /**
     * 检查输入是否需要长文本处理
     *
     * @param input 用户输入
     * @return 是否需要处理
     */
    public boolean needsProcessing(String input) {
        if (!enabled || input == null) {
            return false;
        }
        return input.length() > threshold;
    }
}
