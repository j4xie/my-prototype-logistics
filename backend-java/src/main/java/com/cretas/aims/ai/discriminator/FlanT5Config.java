package com.cretas.aims.ai.discriminator;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for Flan-T5 Discriminator Service.
 *
 * <p>This configuration class contains all parameters for the JudgeRLVR
 * discriminator, including model paths, pruning thresholds, and auto-tuning settings.
 *
 * @author Cretas AI Team
 * @since 1.0.0
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "cretas.ai.flan-t5")
public class FlanT5Config {

    // ==================== Model Configuration ====================

    /**
     * Whether Flan-T5 discriminator is enabled
     */
    private boolean enabled = false;

    /**
     * Path to the Flan-T5 model directory
     * Default: /www/wwwroot/cretas/models/flan-t5-base
     */
    private String modelPath = "/www/wwwroot/cretas/models/flan-t5-base";

    /**
     * Maximum input sequence length
     */
    private int maxLength = 512;

    /**
     * Batch size for batch inference
     */
    private int batchSize = 10;

    /**
     * Model engine to use: "PyTorch" or "ONNX"
     */
    private String engine = "PyTorch";

    // ==================== Pruning Configuration ====================

    /**
     * Pruning threshold - candidates with score below this are pruned
     * 平衡方案: 0.3 (误剪率 < 1%)
     */
    private double pruneThreshold = 0.3;

    /**
     * Minimum number of candidates to keep after pruning
     * Even if all scores are low, at least this many candidates are kept
     */
    private int minKeepCandidates = 2;

    /**
     * Safe mode threshold for write operations (更宽松)
     * Used for CREATE, UPDATE, DELETE intents
     */
    private double safeModePruneThreshold = 0.15;

    /**
     * Whether to use safe mode for write operations
     */
    private boolean safeModeEnabled = true;

    // ==================== Triggering Configuration ====================

    /**
     * Minimum confidence to trigger discriminator
     * Below this confidence, discriminator is used to prune candidates
     */
    private double triggerMinConfidence = 0.58;

    /**
     * Maximum confidence to trigger discriminator
     * Above this confidence, skip discriminator (already confident enough)
     */
    private double triggerMaxConfidence = 0.85;

    // ==================== Auto-Tuning Configuration ====================

    /**
     * Window size for auto-tuning (number of records to evaluate)
     */
    private int autoTuneWindow = 1000;

    /**
     * Target mis-prune rate (ratio of correct answers wrongly pruned)
     */
    private double targetMisPruneRate = 0.01;

    /**
     * Minimum threshold allowed (auto-tuner won't go below this)
     */
    private double minThreshold = 0.1;

    /**
     * Maximum threshold allowed (auto-tuner won't go above this)
     */
    private double maxThreshold = 0.5;

    /**
     * Threshold adjustment step size
     */
    private double adjustmentStep = 0.05;

    // ==================== Cache Configuration ====================

    /**
     * Whether to enable result caching
     */
    private boolean cacheEnabled = true;

    /**
     * Cache TTL in seconds
     */
    private int cacheTtlSeconds = 600;

    /**
     * Maximum cache size
     */
    private int maxCacheSize = 10000;

    // ==================== Performance Configuration ====================

    /**
     * Timeout for single inference call (milliseconds)
     */
    private int inferenceTimeoutMs = 100;

    /**
     * Timeout for batch inference call (milliseconds)
     */
    private int batchTimeoutMs = 500;

    /**
     * Whether to enable async inference
     */
    private boolean asyncEnabled = true;

    // ==================== Prompt Templates ====================

    /**
     * Zero-shot prompt template
     * Placeholders: {input}, {intentCode}, {intentDescription}
     */
    private String zeroShotPromptTemplate =
            "判断用户输入是否匹配意图。用户输入: {input} 意图: {intentCode} - {intentDescription} 输出是或否:";

    /**
     * Few-shot prompt template (with examples)
     */
    private String fewShotPromptTemplate =
            "判断用户输入是否匹配意图。\n" +
            "示例1: 输入'查看今天销售' 意图'sales_overview' → 是\n" +
            "示例2: 输入'删除销售记录' 意图'sales_overview' → 否\n" +
            "输入: {input} 意图: {intentCode} 输出是或否:";

    /**
     * Whether to use few-shot prompting (more accurate but longer)
     */
    private boolean useFewShot = false;

    // ==================== Monitoring Configuration ====================

    /**
     * Whether to enable metrics collection
     */
    private boolean metricsEnabled = true;

    /**
     * Whether to log all judgments (verbose mode)
     */
    private boolean verboseLogging = false;

    // ==================== Fallback Configuration ====================

    /**
     * Whether to enable DashScope fallback when local model fails
     */
    private boolean dashScopeFallbackEnabled = true;

    /**
     * DashScope model to use for fallback
     */
    private String dashScopeFallbackModel = "qwen-turbo";

    /**
     * Timeout for DashScope fallback call (milliseconds)
     */
    private int dashScopeFallbackTimeoutMs = 5000;
}
