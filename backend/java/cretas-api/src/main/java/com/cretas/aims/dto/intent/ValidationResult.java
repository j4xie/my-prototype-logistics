package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Drools 规则验证结果对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationResult {

    /**
     * 验证是否通过
     */
    @Builder.Default
    private boolean valid = true;

    /**
     * 违规项列表
     */
    @Builder.Default
    private List<Violation> violations = new ArrayList<>();

    /**
     * 建议列表
     */
    @Builder.Default
    private List<String> recommendations = new ArrayList<>();

    /**
     * 触发的规则列表
     */
    @Builder.Default
    private List<String> firedRules = new ArrayList<>();

    /**
     * 添加违规项
     *
     * @param title    违规标题
     * @param message  违规详细信息
     * @param severity 严重级别（HIGH, MEDIUM, LOW）
     */
    public void addViolation(String title, String message, String severity) {
        this.violations.add(new Violation(title, message, severity));
    }

    /**
     * 添加建议
     *
     * @param recommendation 建议内容
     */
    public void addRecommendation(String recommendation) {
        this.recommendations.add(recommendation);
    }

    /**
     * 记录触发的规则
     *
     * @param ruleName 规则名称
     */
    public void addFiredRule(String ruleName) {
        this.firedRules.add(ruleName);
    }

    /**
     * 是否有高严重级别的违规
     */
    public boolean hasHighSeverityViolations() {
        return violations.stream()
                .anyMatch(v -> "HIGH".equalsIgnoreCase(v.getSeverity()));
    }

    /**
     * 获取所有违规信息的摘要
     */
    public String getViolationsSummary() {
        if (violations.isEmpty()) {
            return "无违规";
        }
        StringBuilder sb = new StringBuilder();
        for (Violation v : violations) {
            sb.append("[").append(v.getSeverity()).append("] ")
              .append(v.getTitle()).append(": ")
              .append(v.getMessage()).append("\n");
        }
        return sb.toString();
    }

    /**
     * 违规项详情
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Violation {
        /**
         * 违规标题
         */
        private String title;

        /**
         * 违规详细信息
         */
        private String message;

        /**
         * 严重级别
         * 可选值: HIGH, MEDIUM, LOW
         */
        private String severity;
    }
}
