package com.cretas.aims.dto.smartbi;

import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SmartBI 意图识别结果 DTO
 *
 * 包含完整的意图识别信息：
 * - 识别出的意图类型
 * - 置信度评分
 * - 提取的参数
 * - 时间范围
 * - 维度信息
 * - 实体列表
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntentResult {

    // ==================== 核心字段 ====================

    /**
     * 识别出的意图
     */
    private SmartBIIntent intent;

    /**
     * 置信度评分 (0.0 - 1.0)
     * 0.0: 完全不确定
     * 0.7: LLM fallback 阈值
     * 1.0: 完全确定
     */
    private double confidence;

    /**
     * 提取的查询参数
     * key: 参数名（如 metric, aggregation）
     * value: 参数值
     */
    @Builder.Default
    private Map<String, Object> parameters = new HashMap<>();

    // ==================== 时间相关 ====================

    /**
     * 解析出的时间范围
     */
    private DateRange timeRange;

    // ==================== 维度相关 ====================

    /**
     * 分析维度
     * 如：按部门、按区域、按产品、按人员
     */
    private String dimension;

    /**
     * 识别出的实体列表
     * 如：部门名称、区域名称、人名、产品名等
     */
    @Builder.Default
    private List<String> entities = new ArrayList<>();

    // ==================== 元信息 ====================

    /**
     * 是否需要 LLM Fallback
     * 当置信度低于阈值时为 true
     */
    private boolean needsLLMFallback;

    /**
     * 原始用户查询
     */
    private String originalQuery;

    /**
     * 匹配到的关键词列表
     */
    @Builder.Default
    private List<String> matchedKeywords = new ArrayList<>();

    /**
     * 匹配方法
     * KEYWORD: 关键词匹配
     * PATTERN: 正则模式匹配
     * SEMANTIC: 语义匹配
     * LLM: LLM Fallback
     */
    private String matchMethod;

    /**
     * 候选意图列表（用于歧义处理）
     */
    @Builder.Default
    private List<CandidateIntent> candidates = new ArrayList<>();

    /**
     * 处理耗时（毫秒）
     */
    private long processingTimeMs;

    // ==================== 嵌套类 ====================

    /**
     * 候选意图
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CandidateIntent {
        /**
         * 意图
         */
        private SmartBIIntent intent;

        /**
         * 置信度
         */
        private double confidence;

        /**
         * 匹配到的关键词
         */
        private List<String> matchedKeywords;
    }

    // ==================== 便捷方法 ====================

    /**
     * 创建成功的意图识别结果
     *
     * @param intent 意图
     * @param confidence 置信度
     * @param originalQuery 原始查询
     * @return IntentResult
     */
    public static IntentResult success(SmartBIIntent intent, double confidence, String originalQuery) {
        return IntentResult.builder()
                .intent(intent)
                .confidence(confidence)
                .originalQuery(originalQuery)
                .needsLLMFallback(false)
                .matchMethod("KEYWORD")
                .build();
    }

    /**
     * 创建需要 LLM Fallback 的结果
     *
     * @param originalQuery 原始查询
     * @param confidence 当前置信度
     * @return IntentResult
     */
    public static IntentResult needsFallback(String originalQuery, double confidence) {
        return IntentResult.builder()
                .intent(SmartBIIntent.UNKNOWN)
                .confidence(confidence)
                .originalQuery(originalQuery)
                .needsLLMFallback(true)
                .matchMethod("PENDING_LLM")
                .build();
    }

    /**
     * 创建未知意图结果
     *
     * @param originalQuery 原始查询
     * @return IntentResult
     */
    public static IntentResult unknown(String originalQuery) {
        return IntentResult.builder()
                .intent(SmartBIIntent.UNKNOWN)
                .confidence(0.0)
                .originalQuery(originalQuery)
                .needsLLMFallback(true)
                .matchMethod("UNKNOWN")
                .build();
    }

    /**
     * 判断意图是否有效
     */
    public boolean isValid() {
        return intent != null && intent != SmartBIIntent.UNKNOWN;
    }

    /**
     * 判断是否高置信度
     *
     * @param threshold 阈值
     * @return 是否高于阈值
     */
    public boolean isHighConfidence(double threshold) {
        return confidence >= threshold;
    }

    /**
     * 判断是否高置信度（默认阈值 0.7）
     */
    public boolean isHighConfidence() {
        return isHighConfidence(0.7);
    }

    /**
     * 添加参数
     *
     * @param key 参数名
     * @param value 参数值
     * @return this（链式调用）
     */
    public IntentResult addParameter(String key, Object value) {
        if (this.parameters == null) {
            this.parameters = new HashMap<>();
        }
        this.parameters.put(key, value);
        return this;
    }

    /**
     * 添加实体
     *
     * @param entity 实体名称
     * @return this（链式调用）
     */
    public IntentResult addEntity(String entity) {
        if (this.entities == null) {
            this.entities = new ArrayList<>();
        }
        this.entities.add(entity);
        return this;
    }

    /**
     * 获取指定类型的参数
     *
     * @param key 参数名
     * @param clazz 类型
     * @param <T> 泛型
     * @return 参数值
     */
    @SuppressWarnings("unchecked")
    public <T> T getParameter(String key, Class<T> clazz) {
        if (parameters == null) {
            return null;
        }
        Object value = parameters.get(key);
        if (value == null) {
            return null;
        }
        if (clazz.isInstance(value)) {
            return (T) value;
        }
        return null;
    }

    /**
     * 获取字符串参数
     *
     * @param key 参数名
     * @return 参数值
     */
    public String getStringParameter(String key) {
        return getParameter(key, String.class);
    }

    /**
     * 获取整数参数
     *
     * @param key 参数名
     * @return 参数值
     */
    public Integer getIntParameter(String key) {
        Object value = parameters != null ? parameters.get(key) : null;
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return null;
    }
}
