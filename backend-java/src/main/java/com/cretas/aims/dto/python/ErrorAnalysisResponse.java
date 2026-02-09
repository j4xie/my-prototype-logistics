package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python Error Analysis 服务响应 DTO
 *
 * 包含以下响应类型：
 * - CategoryStats: 分类统计
 * - MethodStats: 匹配方法统计
 * - AggregateResponse: 日维度聚合统计响应
 * - FailurePattern: 单个失败模式
 * - FailurePatternResponse: 失败模式识别响应
 * - KeywordExtractionResponse: 关键词提取响应
 * - ApiResponse: 通用 API 响应包装
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public class ErrorAnalysisResponse {

    /**
     * 意图分类统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryStats {

        /**
         * 该分类的请求数量
         */
        private Integer count;

        /**
         * 该分类的成功率 (0.0-1.0)
         */
        private Double successRate;
    }

    /**
     * 匹配方法统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MethodStats {

        /**
         * 使用该方法的请求数量
         */
        private Integer count;

        /**
         * 该方法的平均置信度 (0.0-1.0)
         */
        private Double avgConfidence;
    }

    /**
     * 日维度聚合统计响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AggregateResponse {

        // ==================== 总体统计 ====================

        /**
         * 总请求数
         */
        private Integer totalRequests;

        /**
         * 匹配成功数
         */
        private Integer matchedCount;

        /**
         * 未匹配数
         */
        private Integer unmatchedCount;

        // ==================== LLM 相关 ====================

        /**
         * LLM 降级调用次数
         */
        private Integer llmFallbackCount;

        // ==================== 信号分类 ====================

        /**
         * 强信号数量
         */
        private Integer strongSignalCount;

        /**
         * 弱信号数量
         */
        private Integer weakSignalCount;

        // ==================== 用户确认 ====================

        /**
         * 需要确认的请求数
         */
        private Integer confirmationRequested;

        /**
         * 用户确认数
         */
        private Integer userConfirmedCount;

        /**
         * 用户拒绝数
         */
        private Integer userRejectedCount;

        // ==================== 执行结果 ====================

        /**
         * 已执行数
         */
        private Integer executedCount;

        /**
         * 执行失败数
         */
        private Integer failedCount;

        /**
         * 已取消数
         */
        private Integer cancelledCount;

        // ==================== 错误归因 ====================

        /**
         * 规则缺失数
         */
        private Integer ruleMissCount;

        /**
         * 歧义匹配数
         */
        private Integer ambiguousCount;

        /**
         * 误匹配数
         */
        private Integer falsePositiveCount;

        /**
         * 用户取消数
         */
        private Integer userCancelCount;

        /**
         * 系统错误数
         */
        private Integer systemErrorCount;

        // ==================== 置信度 ====================

        /**
         * 平均置信度 (0.0-1.0)
         */
        private Double avgConfidence;

        // ==================== 分布统计 ====================

        /**
         * 按意图分类的统计
         * key: 分类名称, value: 统计信息
         */
        private Map<String, CategoryStats> intentCategoryStats;

        /**
         * 按匹配方法的统计
         * key: 方法名称, value: 统计信息
         */
        private Map<String, MethodStats> matchMethodStats;

        /**
         * 置信度分布
         * key: 置信度区间 (如 "0.8-0.9"), value: 数量
         */
        private Map<String, Integer> confidenceDistribution;
    }

    /**
     * 单个失败模式
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailurePattern {

        /**
         * 用户输入（标准化后）
         */
        private String userInput;

        /**
         * 出现次数
         */
        private Integer count;

        /**
         * 匹配到的意图（如果有）
         */
        private String matchedIntent;

        /**
         * 错误归因类型
         */
        private String errorAttribution;

        /**
         * 示例输入列表
         */
        private List<String> samples;
    }

    /**
     * 失败模式识别响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailurePatternResponse {

        /**
         * 识别出的失败模式列表
         */
        private List<FailurePattern> patterns;
    }

    /**
     * 关键词提取响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeywordExtractionResponse {

        /**
         * 提取的关键词列表（按频率排序）
         */
        private List<String> keywords;
    }

    /**
     * 通用 API 响应包装
     *
     * @param <T> 响应数据类型
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApiResponse<T> {

        /**
         * 是否成功
         */
        private Boolean success;

        /**
         * 响应数据
         */
        private T data;

        /**
         * 消息（错误时为错误信息）
         */
        private String message;
    }
}
