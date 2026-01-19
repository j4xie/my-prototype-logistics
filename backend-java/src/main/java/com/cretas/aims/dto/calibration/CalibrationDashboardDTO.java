package com.cretas.aims.dto.calibration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 行为校准仪表盘数据传输对象
 * 用于展示 ET-Agent 行为校准系统的综合监控数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CalibrationDashboardDTO {

    /**
     * 当前指标卡片数据（4个核心指标）
     */
    private CurrentMetrics currentMetrics;

    /**
     * 趋势数据（历史指标列表）
     */
    private List<MetricsTrendItem> trendData;

    /**
     * 工具可靠性排名（按成功率排序的Top工具）
     */
    private List<ToolReliabilityItem> toolReliabilityRanking;

    /**
     * 最近的工具调用记录（最近20条）
     */
    private List<RecentToolCallItem> recentToolCalls;

    /**
     * 统计时间范围
     */
    private DateRange dateRange;

    /**
     * 当前指标卡片 - 4个核心指标
     */
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class CurrentMetrics {
        /**
         * 简洁性得分 (0-100)
         * 计算公式: (总调用 - 冗余调用) / 总调用 * 100
         */
        private BigDecimal concisenessScore;

        /**
         * 执行成功率 (0-100)
         * 计算公式: 成功调用 / 总调用 * 100
         */
        private BigDecimal successRate;

        /**
         * 推理效率 (0-100)
         * 基于token消耗计算，基准为1000 tokens/call
         */
        private BigDecimal reasoningEfficiency;

        /**
         * 综合得分 (0-100)
         * 计算公式: 简洁性*0.3 + 成功率*0.5 + 效率*0.2
         */
        private BigDecimal compositeScore;

        /**
         * 总调用次数
         */
        private Integer totalCalls;

        /**
         * 成功调用次数
         */
        private Integer successfulCalls;

        /**
         * 失败调用次数
         */
        private Integer failedCalls;

        /**
         * 冗余调用次数
         */
        private Integer redundantCalls;

        /**
         * 恢复的调用次数
         */
        private Integer recoveredCalls;

        /**
         * 与昨日对比的变化
         */
        private MetricsChange changeFromYesterday;

        /**
         * 指标统计日期
         */
        private LocalDate metricDate;
    }

    /**
     * 指标变化（用于显示与昨日对比）
     */
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MetricsChange {
        /**
         * 简洁性变化（百分点）
         */
        private BigDecimal concisenessChange;

        /**
         * 成功率变化（百分点）
         */
        private BigDecimal successRateChange;

        /**
         * 效率变化（百分点）
         */
        private BigDecimal efficiencyChange;

        /**
         * 综合得分变化（百分点）
         */
        private BigDecimal compositeScoreChange;
    }

    /**
     * 趋势数据项 - 用于图表展示
     */
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MetricsTrendItem {
        /**
         * 日期
         */
        private LocalDate date;

        /**
         * 简洁性得分
         */
        private BigDecimal concisenessScore;

        /**
         * 成功率
         */
        private BigDecimal successRate;

        /**
         * 推理效率
         */
        private BigDecimal reasoningEfficiency;

        /**
         * 综合得分
         */
        private BigDecimal compositeScore;

        /**
         * 总调用次数
         */
        private Integer totalCalls;

        /**
         * 成功调用次数
         */
        private Integer successfulCalls;

        /**
         * 冗余调用次数
         */
        private Integer redundantCalls;
    }

    /**
     * 工具可靠性项 - 用于排名展示
     */
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ToolReliabilityItem {
        /**
         * 排名
         */
        private Integer rank;

        /**
         * 工具名称
         */
        private String toolName;

        /**
         * 总调用次数
         */
        private Integer totalCalls;

        /**
         * 成功调用次数
         */
        private Integer successfulCalls;

        /**
         * 失败调用次数
         */
        private Integer failedCalls;

        /**
         * 成功率 (0-100)
         */
        private BigDecimal successRate;

        /**
         * 平均执行时间（毫秒）
         */
        private Integer avgExecutionTimeMs;

        /**
         * 常见错误类型
         */
        private List<String> commonErrors;
    }

    /**
     * 最近工具调用项
     */
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RecentToolCallItem {
        /**
         * 调用记录ID
         */
        private Long id;

        /**
         * 工具名称
         */
        private String toolName;

        /**
         * 意图代码
         */
        private String intentCode;

        /**
         * 执行状态
         */
        private String executionStatus;

        /**
         * 是否为冗余调用
         */
        private Boolean isRedundant;

        /**
         * 冗余原因
         */
        private String redundantReason;

        /**
         * 执行时间（毫秒）
         */
        private Integer executionTimeMs;

        /**
         * 输入token数
         */
        private Integer inputTokens;

        /**
         * 输出token数
         */
        private Integer outputTokens;

        /**
         * 是否已恢复
         */
        private Boolean recovered;

        /**
         * 恢复策略
         */
        private String recoveryStrategy;

        /**
         * 调用时间
         */
        private LocalDateTime callTime;

        /**
         * 会话ID
         */
        private String sessionId;
    }

    /**
     * 日期范围
     */
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DateRange {
        /**
         * 开始日期
         */
        private LocalDate startDate;

        /**
         * 结束日期
         */
        private LocalDate endDate;

        /**
         * 周期类型 (DAILY, WEEKLY, MONTHLY)
         */
        private String periodType;
    }
}
