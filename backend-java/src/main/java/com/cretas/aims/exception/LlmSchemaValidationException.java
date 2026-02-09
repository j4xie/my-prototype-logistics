package com.cretas.aims.exception;

/**
 * LLM Schema 验证异常
 *
 * 当 LLM 返回的响应不符合预期 Schema 或业务规则时抛出此异常。
 * 此异常会触发用户确认流程，而不是直接执行意图。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
public class LlmSchemaValidationException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * 验证失败类型
     */
    private final ValidationFailureType failureType;

    /**
     * 原始输入
     */
    private final String userInput;

    /**
     * 原始 LLM 响应
     */
    private final String rawResponse;

    public LlmSchemaValidationException(String message) {
        super(message);
        this.failureType = ValidationFailureType.UNKNOWN;
        this.userInput = null;
        this.rawResponse = null;
    }

    public LlmSchemaValidationException(String message, Throwable cause) {
        super(message, cause);
        this.failureType = ValidationFailureType.PARSE_ERROR;
        this.userInput = null;
        this.rawResponse = null;
    }

    public LlmSchemaValidationException(String message, ValidationFailureType failureType) {
        super(message);
        this.failureType = failureType;
        this.userInput = null;
        this.rawResponse = null;
    }

    public LlmSchemaValidationException(String message, ValidationFailureType failureType,
                                         String userInput, String rawResponse) {
        super(message);
        this.failureType = failureType;
        this.userInput = userInput;
        this.rawResponse = rawResponse;
    }

    public ValidationFailureType getFailureType() {
        return failureType;
    }

    public String getUserInput() {
        return userInput;
    }

    public String getRawResponse() {
        return rawResponse;
    }

    /**
     * 验证失败类型枚举
     */
    public enum ValidationFailureType {
        /**
         * JSON 解析失败
         */
        PARSE_ERROR("响应格式解析失败"),

        /**
         * 意图代码不存在
         */
        UNKNOWN_INTENT_CODE("未知的意图代码"),

        /**
         * 置信度异常
         */
        INVALID_CONFIDENCE("置信度值异常"),

        /**
         * 必需字段缺失
         */
        MISSING_REQUIRED_FIELD("缺少必需字段"),

        /**
         * 业务规则校验失败
         */
        BUSINESS_RULE_VIOLATION("业务规则校验失败"),

        /**
         * 未知错误
         */
        UNKNOWN("未知验证错误");

        private final String description;

        ValidationFailureType(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }
}
