package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Python Error Analysis 服务请求 DTO
 *
 * 包含以下请求类型：
 * - IntentMatchRecordDTO: 意图匹配记录数据传输对象
 * - AggregateRequest: 日维度聚合统计请求
 * - FailurePatternRequest: 失败模式识别请求
 * - KeywordExtractionRequest: 关键词提取请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public class ErrorAnalysisRequest {

    /**
     * 意图匹配记录 DTO
     * 用于将 Java Entity 转换为 Python 服务可接收的格式
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntentMatchRecordDTO {

        /**
         * 记录ID
         */
        private String id;

        /**
         * 用户原始输入
         */
        private String userInput;

        /**
         * 标准化后的输入
         */
        private String normalizedInput;

        /**
         * 匹配的意图代码
         */
        private String matchedIntentCode;

        /**
         * 匹配的意图名称
         */
        private String matchedIntentName;

        /**
         * 匹配的意图分类
         */
        private String matchedIntentCategory;

        /**
         * 置信度分数 (0.0-1.0)
         */
        private Double confidenceScore;

        /**
         * 匹配方法: EXACT/REGEX/KEYWORD/SEMANTIC/FUSION/SIMILAR/LLM/DOMAIN_DEFAULT/NONE
         */
        private String matchMethod;

        /**
         * 是否为强信号
         */
        private Boolean isStrongSignal;

        /**
         * 是否需要用户确认
         */
        private Boolean requiresConfirmation;

        /**
         * 是否调用了LLM fallback
         */
        private Boolean llmCalled;

        /**
         * 用户是否确认
         */
        private Boolean userConfirmed;

        /**
         * 执行状态: PENDING/EXECUTED/FAILED/CANCELLED
         */
        private String executionStatus;

        /**
         * 错误归因: RULE_MISS/AMBIGUOUS/FALSE_POSITIVE/USER_CANCEL/SYSTEM_ERROR
         */
        private String errorAttribution;
    }

    /**
     * 日维度聚合统计请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AggregateRequest {

        /**
         * 意图匹配记录列表
         */
        private List<IntentMatchRecordDTO> records;
    }

    /**
     * 失败模式识别请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FailurePatternRequest {

        /**
         * 意图匹配记录列表
         */
        private List<IntentMatchRecordDTO> records;

        /**
         * 最小出现频率（低于此值的模式将被忽略）
         */
        private Integer minFrequency;
    }

    /**
     * 关键词提取请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeywordExtractionRequest {

        /**
         * 用户输入列表
         */
        private List<String> inputs;

        /**
         * 最小出现频率
         */
        private Integer minFrequency;

        /**
         * 返回的关键词数量
         */
        private Integer topN;
    }
}
