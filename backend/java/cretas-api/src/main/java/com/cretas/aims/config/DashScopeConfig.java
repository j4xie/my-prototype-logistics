package com.cretas.aims.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;

/**
 * 阿里云 DashScope API 配置
 *
 * 支持通义千问系列模型：
 * - 文本模型: qwen-plus, qwen-turbo, qwen-max
 * - 视觉模型: qwen2.5-vl-3b-instruct, qwen-vl-plus
 *
 * API 格式兼容 OpenAI，支持思考模式 (Thinking Mode)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "cretas.ai.dashscope")
public class DashScopeConfig {

    /**
     * 是否启用 DashScope 直接调用
     */
    private boolean enabled = false;

    /**
     * DashScope API Key
     * 从环境变量 DASHSCOPE_API_KEY 获取
     */
    private String apiKey;

    /**
     * API 基础 URL (OpenAI 兼容格式)
     */
    private String baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";

    /**
     * 默认文本模型
     * 可选: qwen-turbo (快速), qwen-plus (平衡), qwen-max (最强)
     */
    private String model = "qwen-plus";

    /**
     * 纠错 Agent 模型 (CRITIC-style correction)
     * 使用轻量模型以降低成本，基于论文:
     * - CRITIC (ICLR 2024): 工具交互式批评
     * - Reflexion (NeurIPS 2023): 语言反思学习
     */
    private String correctionModel = "qwen-turbo";

    /**
     * 视觉模型
     * 用于图片识别 (设备铭牌、产品、标签等)
     */
    private String visionModel = "qwen2.5-vl-3b-instruct";

    /**
     * 最大 Token 数
     */
    private int maxTokens = 2000;

    /**
     * 温度参数 (0.0-2.0)
     * 较低的值使输出更确定，较高的值使输出更随机
     */
    private double temperature = 0.7;

    /**
     * 低温度 (用于需要精确输出的场景，如意图分类)
     */
    private double lowTemperature = 0.3;

    /**
     * API 调用超时 (秒)
     */
    private int timeout = 60;

    /**
     * 思考模式超时 (秒) - 思考模式需要更长时间
     */
    private int thinkingTimeout = 120;

    /**
     * 默认思考预算 (10-100)
     * 控制思考模式的深度
     */
    private int defaultThinkingBudget = 50;

    /**
     * 是否启用思考模式
     */
    private boolean thinkingEnabled = true;

    /**
     * 迁移开关 - 是否使用 DashScope 直接调用 (替代 Python 服务)
     */
    private MigrationConfig migration = new MigrationConfig();

    @Data
    public static class MigrationConfig {
        /**
         * 全局迁移开关
         */
        private boolean useDirect = false;

        /**
         * 意图分类迁移开关
         */
        private boolean intentClassify = false;

        /**
         * 成本分析迁移开关
         */
        private boolean costAnalysis = false;

        /**
         * 表单解析迁移开关
         */
        private boolean formParse = false;

        /**
         * 视觉识别迁移开关
         */
        private boolean vision = false;
    }

    @PostConstruct
    public void init() {
        log.info("DashScope Config initialized:");
        log.info("  - enabled: {}", enabled);
        log.info("  - baseUrl: {}", baseUrl);
        log.info("  - model: {}", model);
        log.info("  - correctionModel: {}", correctionModel);
        log.info("  - visionModel: {}", visionModel);
        log.info("  - apiKey configured: {}", apiKey != null && !apiKey.isEmpty());
        log.info("  - migration.useDirect: {}", migration.useDirect);

        if (enabled && (apiKey == null || apiKey.isEmpty())) {
            log.warn("DashScope is enabled but API key is not configured! Set DASHSCOPE_API_KEY environment variable.");
        }
    }

    /**
     * 检查 API 是否可用
     */
    public boolean isAvailable() {
        return enabled && apiKey != null && !apiKey.isEmpty();
    }

    /**
     * 获取完整的 chat completions URL
     */
    public String getChatCompletionsUrl() {
        return baseUrl + "/chat/completions";
    }

    /**
     * 检查是否应该使用直接调用（替代 Python）
     */
    public boolean shouldUseDirect(String feature) {
        if (!enabled || !migration.useDirect) {
            return false;
        }

        switch (feature) {
            case "intent-classify":
                return migration.intentClassify;
            case "cost-analysis":
                return migration.costAnalysis;
            case "form-parse":
                return migration.formParse;
            case "vision":
                return migration.vision;
            default:
                return false;
        }
    }
}
