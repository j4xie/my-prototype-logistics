package com.cretas.aims.dto.calibration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 恢复提示 DTO
 * 用于封装失败恢复时注入给 LLM 的提示信息
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecoveryPrompt {

    /**
     * 系统提示（给 LLM 的指令）
     * 包含错误分析和恢复策略说明
     */
    private String systemPrompt;

    /**
     * 用户提示（修改后的用户查询）
     * 在原始查询基础上添加错误上下文
     */
    private String userPrompt;

    /**
     * 可操作的建议列表
     * 具体的恢复步骤或替代方案
     */
    private List<String> suggestions;

    /**
     * 替代工具名称
     * 如果失败的工具无法恢复，推荐的替代工具
     */
    private String alternativeTool;

    /**
     * 替代工具的描述
     */
    private String alternativeToolDescription;

    /**
     * 失败类型
     */
    private FailureType failureType;

    /**
     * 原始错误消息
     */
    private String originalError;

    /**
     * 失败的工具名称
     */
    private String failedToolName;

    /**
     * 参数修复建议
     * key: 参数名, value: 修复建议
     */
    private Map<String, Object> parameterFixes;

    /**
     * 是否应该重试
     */
    private boolean shouldRetry;

    /**
     * 当前重试次数
     */
    private int currentRetryCount;

    /**
     * 最大重试次数
     */
    private int maxRetryCount;

    /**
     * 预计恢复成功率（0-1）
     */
    private Double estimatedSuccessRate;

    /**
     * 是否需要用户确认
     * 某些恢复操作可能需要用户干预
     */
    @Builder.Default
    private boolean requiresUserConfirmation = false;

    /**
     * 用户确认提示
     */
    private String userConfirmationPrompt;

    /**
     * 创建一个简单的恢复提示
     */
    public static RecoveryPrompt simple(String systemPrompt, String userPrompt, List<String> suggestions) {
        return RecoveryPrompt.builder()
            .systemPrompt(systemPrompt)
            .userPrompt(userPrompt)
            .suggestions(suggestions)
            .shouldRetry(true)
            .maxRetryCount(2)
            .build();
    }

    /**
     * 创建一个无法恢复的提示
     */
    public static RecoveryPrompt unrecoverable(String reason, FailureType failureType) {
        return RecoveryPrompt.builder()
            .systemPrompt("无法自动恢复此错误：" + reason)
            .userPrompt(null)
            .failureType(failureType)
            .shouldRetry(false)
            .build();
    }

    /**
     * 创建需要替代工具的提示
     */
    public static RecoveryPrompt withAlternative(
            String systemPrompt,
            String failedTool,
            String alternativeTool,
            String alternativeDescription) {
        return RecoveryPrompt.builder()
            .systemPrompt(systemPrompt)
            .failedToolName(failedTool)
            .alternativeTool(alternativeTool)
            .alternativeToolDescription(alternativeDescription)
            .shouldRetry(true)
            .build();
    }

    /**
     * 判断是否有替代工具
     */
    public boolean hasAlternativeTool() {
        return alternativeTool != null && !alternativeTool.isEmpty();
    }

    /**
     * 判断是否有参数修复建议
     */
    public boolean hasParameterFixes() {
        return parameterFixes != null && !parameterFixes.isEmpty();
    }

    /**
     * 判断是否可以继续重试
     */
    public boolean canRetry() {
        return shouldRetry && currentRetryCount < maxRetryCount;
    }

    /**
     * 获取完整的恢复上下文（用于日志和调试）
     */
    public String getRecoveryContext() {
        StringBuilder sb = new StringBuilder();
        sb.append("=== Recovery Context ===\n");
        sb.append("Failure Type: ").append(failureType != null ? failureType.getCode() : "UNKNOWN").append("\n");
        sb.append("Failed Tool: ").append(failedToolName != null ? failedToolName : "N/A").append("\n");
        sb.append("Original Error: ").append(originalError != null ? originalError : "N/A").append("\n");
        sb.append("Should Retry: ").append(shouldRetry).append("\n");
        sb.append("Retry Count: ").append(currentRetryCount).append("/").append(maxRetryCount).append("\n");
        if (alternativeTool != null) {
            sb.append("Alternative Tool: ").append(alternativeTool).append("\n");
        }
        if (suggestions != null && !suggestions.isEmpty()) {
            sb.append("Suggestions:\n");
            for (int i = 0; i < suggestions.size(); i++) {
                sb.append("  ").append(i + 1).append(". ").append(suggestions.get(i)).append("\n");
            }
        }
        return sb.toString();
    }
}
