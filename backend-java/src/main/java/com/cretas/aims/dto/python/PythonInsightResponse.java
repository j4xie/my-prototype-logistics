package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Python AI 洞察生成响应 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonInsightResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 错误消息 (失败时)
     */
    private String message;

    /**
     * 洞察列表
     */
    private List<Insight> insights;

    /**
     * 执行摘要
     */
    private String executiveSummary;

    /**
     * 关键发现
     */
    private List<String> keyFindings;

    /**
     * 建议行动
     */
    private List<ActionRecommendation> recommendedActions;

    /**
     * 风险提示
     */
    private List<RiskAlert> riskAlerts;

    /**
     * 处理时间 (毫秒)
     */
    private Long processingTimeMs;

    /**
     * 洞察
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Insight {

        /**
         * 洞察类型 (summary, trend, anomaly, comparison, correlation)
         */
        private String type;

        /**
         * 洞察标题
         */
        private String title;

        /**
         * 洞察内容
         */
        private String content;

        /**
         * 重要性 (high, medium, low)
         */
        private String importance;

        /**
         * 置信度 (0-1)
         */
        private Double confidence;

        /**
         * 相关指标
         */
        private List<String> relatedMetrics;

        /**
         * 数据支撑
         */
        private String dataEvidence;

        /**
         * 图标 (用于前端显示)
         */
        private String icon;
    }

    /**
     * 行动建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActionRecommendation {

        /**
         * 建议标题
         */
        private String title;

        /**
         * 建议描述
         */
        private String description;

        /**
         * 优先级 (high, medium, low)
         */
        private String priority;

        /**
         * 预期影响
         */
        private String expectedImpact;

        /**
         * 负责部门
         */
        private String responsibleDepartment;

        /**
         * 建议时间框架
         */
        private String timeframe;
    }

    /**
     * 风险提示
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskAlert {

        /**
         * 风险类型
         */
        private String riskType;

        /**
         * 风险描述
         */
        private String description;

        /**
         * 风险等级 (critical, high, medium, low)
         */
        private String level;

        /**
         * 触发指标
         */
        private String triggerMetric;

        /**
         * 触发阈值
         */
        private String threshold;

        /**
         * 当前值
         */
        private String currentValue;

        /**
         * 缓解建议
         */
        private String mitigation;
    }
}
