package com.cretas.aims.service;

import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.ai.PreprocessedQuery;
import com.cretas.aims.dto.intent.IntentMatchResult;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 结果验证服务
 * 验证意图执行结果的质量和相关性
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
public interface ResultValidatorService {

    /**
     * 执行完整验证流程
     *
     * @param response     意图执行响应
     * @param query        预处理后的查询
     * @param intentResult 意图匹配结果
     * @return 验证结果
     */
    ValidationResult validate(IntentExecuteResponse response,
                              PreprocessedQuery query,
                              IntentMatchResult intentResult);

    /**
     * 仅执行规则验证
     *
     * @param response 意图执行响应
     * @param query    预处理后的查询
     * @return 规则验证结果
     */
    RuleValidationResult validateWithRules(IntentExecuteResponse response,
                                           PreprocessedQuery query);

    /**
     * 执行语义验证（LLM）
     *
     * @param response          意图执行响应
     * @param originalQuery     原始用户查询
     * @param intentDescription 意图描述
     * @return 语义验证结果
     */
    SemanticValidationResult validateWithLLM(IntentExecuteResponse response,
                                             String originalQuery,
                                             String intentDescription);

    /**
     * 判断是否需要语义验证
     *
     * @param intentResult 意图匹配结果
     * @param ruleResult   规则验证结果
     * @return 是否需要语义验证
     */
    boolean requiresSemanticValidation(IntentMatchResult intentResult,
                                       RuleValidationResult ruleResult);

    // ==================== DTO 类 ====================

    /**
     * 验证结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ValidationResult {
        /**
         * 是否验证通过
         */
        private boolean valid;

        /**
         * 验证状态
         */
        private ValidationStatus status;

        /**
         * 验证问题列表
         */
        private List<ValidationIssue> issues;

        /**
         * 建议信息
         */
        private String suggestion;

        /**
         * 是否应该重试
         */
        private boolean shouldRetry;

        /**
         * 重试策略
         */
        private RetryStrategy retryStrategy;

        /**
         * 规则验证分数
         */
        private double ruleScore;

        /**
         * 语义验证分数
         */
        private Double semanticScore;

        /**
         * 验证状态枚举
         */
        public enum ValidationStatus {
            /**
             * 完全有效
             */
            VALID,
            /**
             * 部分有效
             */
            PARTIALLY_VALID,
            /**
             * 无效
             */
            INVALID,
            /**
             * 需要用户澄清
             */
            NEED_CLARIFICATION
        }

        /**
         * 重试策略枚举
         */
        public enum RetryStrategy {
            /**
             * 不重试
             */
            NONE,
            /**
             * 重写查询后重试
             */
            REWRITE_QUERY,
            /**
             * 使用不同工具
             */
            DIFFERENT_TOOL,
            /**
             * 需要用户补充信息
             */
            USER_INPUT
        }

        /**
         * 创建有效结果
         */
        public static ValidationResult valid() {
            return ValidationResult.builder()
                    .valid(true)
                    .status(ValidationStatus.VALID)
                    .issues(List.of())
                    .shouldRetry(false)
                    .retryStrategy(RetryStrategy.NONE)
                    .ruleScore(1.0)
                    .build();
        }

        /**
         * 创建无效结果
         */
        public static ValidationResult invalid(List<ValidationIssue> issues, String suggestion) {
            return ValidationResult.builder()
                    .valid(false)
                    .status(ValidationStatus.INVALID)
                    .issues(issues)
                    .suggestion(suggestion)
                    .shouldRetry(true)
                    .retryStrategy(RetryStrategy.USER_INPUT)
                    .ruleScore(0.0)
                    .build();
        }
    }

    /**
     * 验证问题
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ValidationIssue {
        /**
         * 问题类型
         */
        private IssueType type;

        /**
         * 相关字段
         */
        private String field;

        /**
         * 期望值
         */
        private String expected;

        /**
         * 实际值
         */
        private String actual;

        /**
         * 问题描述
         */
        private String message;

        /**
         * 问题类型枚举
         */
        public enum IssueType {
            /**
             * 结果为空
             */
            EMPTY_RESULT,
            /**
             * 时间范围不匹配
             */
            TIME_MISMATCH,
            /**
             * 实体不匹配
             */
            ENTITY_MISMATCH,
            /**
             * 缺少必需字段
             */
            MISSING_FIELD,
            /**
             * 答案不相关
             */
            IRRELEVANT_ANSWER,
            /**
             * 信息不完整
             */
            INCOMPLETE_INFO,
            /**
             * 数据类型错误
             */
            TYPE_MISMATCH,
            /**
             * 执行失败
             */
            EXECUTION_FAILED
        }
    }

    /**
     * 规则验证结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class RuleValidationResult {
        /**
         * 是否通过
         */
        private boolean passed;

        /**
         * 验证问题列表
         */
        private List<ValidationIssue> issues;

        /**
         * 分数 (0-1)
         */
        private double score;

        /**
         * 创建通过结果
         */
        public static RuleValidationResult passed() {
            return RuleValidationResult.builder()
                    .passed(true)
                    .issues(List.of())
                    .score(1.0)
                    .build();
        }

        /**
         * 创建失败结果
         */
        public static RuleValidationResult failed(List<ValidationIssue> issues, double score) {
            return RuleValidationResult.builder()
                    .passed(false)
                    .issues(issues)
                    .score(score)
                    .build();
        }
    }

    /**
     * 语义验证结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class SemanticValidationResult {
        /**
         * 是否相关
         */
        private boolean relevant;

        /**
         * 相关性分数 (0-1)
         */
        private double relevanceScore;

        /**
         * 推理说明
         */
        private String reasoning;

        /**
         * 缺失的信息
         */
        private List<String> missingInformation;

        /**
         * 建议的后续问题
         */
        private String suggestedFollowUp;

        /**
         * 是否解析成功
         */
        private boolean parseSuccess;

        /**
         * 创建相关结果
         */
        public static SemanticValidationResult relevant(double score, String reasoning) {
            return SemanticValidationResult.builder()
                    .relevant(true)
                    .relevanceScore(score)
                    .reasoning(reasoning)
                    .missingInformation(List.of())
                    .parseSuccess(true)
                    .build();
        }

        /**
         * 创建不相关结果
         */
        public static SemanticValidationResult irrelevant(double score, String reasoning,
                                                          List<String> missingInfo, String followUp) {
            return SemanticValidationResult.builder()
                    .relevant(false)
                    .relevanceScore(score)
                    .reasoning(reasoning)
                    .missingInformation(missingInfo)
                    .suggestedFollowUp(followUp)
                    .parseSuccess(true)
                    .build();
        }

        /**
         * 创建解析失败结果
         */
        public static SemanticValidationResult parseError() {
            return SemanticValidationResult.builder()
                    .relevant(false)
                    .relevanceScore(0.0)
                    .reasoning("LLM 响应解析失败")
                    .parseSuccess(false)
                    .build();
        }
    }
}
