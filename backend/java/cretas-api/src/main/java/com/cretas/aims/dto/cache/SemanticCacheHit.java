package com.cretas.aims.dto.cache;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.IntentMatchResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 语义缓存命中结果
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SemanticCacheHit {

    /**
     * 缓存命中类型
     */
    public enum HitType {
        /**
         * 精确匹配 (哈希相同)
         */
        EXACT,

        /**
         * 语义匹配 (向量相似度高于阈值)
         */
        SEMANTIC,

        /**
         * 未命中
         */
        MISS
    }

    /**
     * 命中类型
     */
    private HitType hitType;

    /**
     * 缓存ID
     */
    private Long cacheId;

    /**
     * 相似度分数 (0-1)
     * EXACT 类型为 1.0
     * SEMANTIC 类型为实际相似度
     * MISS 类型为 0.0
     */
    private Double similarity;

    /**
     * 缓存的意图代码
     */
    private String intentCode;

    /**
     * 缓存的意图识别结果 (JSON)
     */
    private String intentResultJson;

    /**
     * 缓存的执行结果 (JSON)
     */
    private String executionResultJson;

    /**
     * 解析后的意图匹配结果
     */
    private IntentMatchResult intentMatchResult;

    /**
     * 解析后的执行结果
     */
    private IntentExecuteResponse executeResponse;

    /**
     * 缓存创建时间 (毫秒时间戳)
     */
    private Long cachedAt;

    /**
     * 查询延迟 (毫秒)
     */
    private Long queryLatencyMs;

    /**
     * 检查是否有执行结果
     */
    public boolean hasExecutionResult() {
        return executionResultJson != null && !executionResultJson.isEmpty();
    }

    /**
     * 检查是否为有效命中
     */
    public boolean isHit() {
        return hitType != null && hitType != HitType.MISS;
    }

    /**
     * 检查是否为精确匹配
     */
    public boolean isExactMatch() {
        return hitType == HitType.EXACT;
    }

    /**
     * 检查是否为语义匹配
     */
    public boolean isSemanticMatch() {
        return hitType == HitType.SEMANTIC;
    }

    /**
     * 获取查询延迟 (别名方法)
     */
    public Long getLatencyMs() {
        return queryLatencyMs;
    }

    /**
     * 获取执行结果 JSON (别名方法)
     */
    public String getExecutionResult() {
        return executionResultJson;
    }

    /**
     * 获取意图识别结果 JSON (别名方法)
     */
    public String getIntentResult() {
        return intentResultJson;
    }

    /**
     * 创建未命中结果
     */
    public static SemanticCacheHit miss(long queryLatencyMs) {
        return SemanticCacheHit.builder()
            .hitType(HitType.MISS)
            .similarity(0.0)
            .queryLatencyMs(queryLatencyMs)
            .build();
    }

    /**
     * 创建精确命中结果
     */
    public static SemanticCacheHit exactHit(Long cacheId, String intentCode,
                                             String intentResultJson, String executionResultJson,
                                             long queryLatencyMs) {
        return SemanticCacheHit.builder()
            .hitType(HitType.EXACT)
            .cacheId(cacheId)
            .similarity(1.0)
            .intentCode(intentCode)
            .intentResultJson(intentResultJson)
            .executionResultJson(executionResultJson)
            .queryLatencyMs(queryLatencyMs)
            .build();
    }

    /**
     * 创建语义命中结果
     */
    public static SemanticCacheHit semanticHit(Long cacheId, double similarity,
                                                String intentCode,
                                                String intentResultJson, String executionResultJson,
                                                long queryLatencyMs) {
        return SemanticCacheHit.builder()
            .hitType(HitType.SEMANTIC)
            .cacheId(cacheId)
            .similarity(similarity)
            .intentCode(intentCode)
            .intentResultJson(intentResultJson)
            .executionResultJson(executionResultJson)
            .queryLatencyMs(queryLatencyMs)
            .build();
    }
}
