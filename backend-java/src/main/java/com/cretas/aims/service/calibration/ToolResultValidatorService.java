package com.cretas.aims.service.calibration;

import java.util.Map;

/**
 * 工具执行结果验证器
 *
 * 判断工具执行结果是否"有效"，用于扩展纠错 Agent 的触发条件：
 * 1. 空结果检测：查询返回空数据
 * 2. 意图匹配度检测：结果是否符合用户的查询意图
 * 3. 数据质量检测：结果是否完整、准确
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface ToolResultValidatorService {

    /**
     * 验证工具执行结果
     *
     * @param userInput   用户原始输入
     * @param toolName    工具名称
     * @param params      工具参数
     * @param resultJson  工具执行结果 (JSON 字符串)
     * @return 验证结果
     */
    ValidationResult validate(
            String userInput,
            String toolName,
            Map<String, Object> params,
            String resultJson
    );

    /**
     * 验证结果
     */
    record ValidationResult(
            boolean isValid,           // 结果是否有效
            ValidationIssue issue,     // 问题类型
            String issueDescription,   // 问题描述
            double matchScore,         // 意图匹配度 (0-1)
            Map<String, Object> extractedConditions,  // 从用户输入提取的条件
            Map<String, Object> actualResults,        // 实际结果摘要
            String correctionHint      // 纠错建议
    ) {
        /**
         * 创建有效结果
         */
        public static ValidationResult valid() {
            return new ValidationResult(true, null, null, 1.0, null, null, null);
        }

        /**
         * 创建无效结果
         */
        public static ValidationResult invalid(ValidationIssue issue, String description, String hint) {
            return new ValidationResult(false, issue, description, 0.0, null, null, hint);
        }

        /**
         * 创建带匹配度的结果
         */
        public static ValidationResult withMatchScore(
                ValidationIssue issue,
                String description,
                double matchScore,
                Map<String, Object> conditions,
                Map<String, Object> results,
                String hint
        ) {
            boolean isValid = matchScore >= 0.7;  // 70% 以上认为有效
            return new ValidationResult(isValid, issue, description, matchScore, conditions, results, hint);
        }
    }

    /**
     * 验证问题类型
     */
    enum ValidationIssue {
        EMPTY_RESULT,           // 结果为空
        NO_MATCH,               // 完全不匹配用户意图
        PARTIAL_MATCH,          // 部分匹配（如：查特定批次，返回了所有数据）
        CONDITION_IGNORED,      // 条件被忽略
        DATA_INCOMPLETE,        // 数据不完整
        FORMAT_ERROR            // 格式错误
    }
}
