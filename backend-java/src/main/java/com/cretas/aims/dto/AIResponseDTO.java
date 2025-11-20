package com.cretas.aims.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * AI API响应DTO类
 */
public class AIResponseDTO {

    /**
     * AI成本分析响应（批次/时间范围通用）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI成本分析响应")
    public static class CostAnalysisResponse {
        @Schema(description = "分析报告ID")
        private Long reportId;

        @Schema(description = "会话ID（用于多轮对话）")
        private String sessionId;

        @Schema(description = "分析结果")
        private AnalysisResult analysis;

        @Schema(description = "AI响应文本")
        private String aiResponse;

        @Schema(description = "生成时间")
        private LocalDateTime timestamp;

        @Schema(description = "AI使用的token数")
        private Integer tokensUsed;

        @Schema(description = "本次分析成本（元）")
        private BigDecimal cost;
    }

    /**
     * 分析结果详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI分析结果详情")
    public static class AnalysisResult {
        @Schema(description = "总成本")
        private BigDecimal totalCost;

        @Schema(description = "成本分解")
        private CostBreakdown costBreakdown;

        @Schema(description = "关键发现")
        private List<String> keyFindings;

        @Schema(description = "优化建议")
        private List<OptimizationSuggestion> suggestions;

        @Schema(description = "成本趋势（如果适用）")
        private String trend;

        @Schema(description = "对比基准（如果是对比分析）")
        private Map<String, Object> benchmark;
    }

    /**
     * 成本分解
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "成本分解")
    public static class CostBreakdown {
        @Schema(description = "原材料成本")
        private BigDecimal rawMaterials;

        @Schema(description = "人工成本")
        private BigDecimal labor;

        @Schema(description = "设备成本")
        private BigDecimal equipment;

        @Schema(description = "管理费用")
        private BigDecimal overhead;

        @Schema(description = "其他成本")
        private BigDecimal other;
    }

    /**
     * 优化建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI优化建议")
    public static class OptimizationSuggestion {
        @Schema(description = "建议类型", example = "cost_reduction")
        private String type;

        @Schema(description = "优先级", example = "high", allowableValues = {"high", "medium", "low"})
        private String priority;

        @Schema(description = "建议描述")
        private String description;

        @Schema(description = "预期节省金额")
        private BigDecimal expectedSavings;

        @Schema(description = "实施难度", example = "medium", allowableValues = {"easy", "medium", "hard"})
        private String difficulty;

        @Schema(description = "实施时间范围（天）")
        private Integer implementationDays;
    }

    /**
     * AI配额信息响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI配额信息响应")
    public static class QuotaInfoResponse {
        @Schema(description = "工厂ID")
        private String factoryId;

        @Schema(description = "总配额（元）")
        private BigDecimal totalQuota;

        @Schema(description = "已使用配额（元）")
        private BigDecimal usedQuota;

        @Schema(description = "剩余配额（元）")
        private BigDecimal remainingQuota;

        @Schema(description = "配额使用百分比")
        private Double usagePercentage;

        @Schema(description = "本月请求次数")
        private Integer requestCount;

        @Schema(description = "配额重置日期")
        private LocalDateTime resetDate;

        @Schema(description = "配额状态", allowableValues = {"active", "warning", "exhausted", "expired"})
        private String status;

        @Schema(description = "最近使用记录")
        private List<QuotaUsageRecord> recentUsage;
    }

    /**
     * 配额使用记录
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "配额使用记录")
    public static class QuotaUsageRecord {
        @Schema(description = "使用时间")
        private LocalDateTime timestamp;

        @Schema(description = "分析类型")
        private String analysisType;

        @Schema(description = "消耗金额（元）")
        private BigDecimal cost;

        @Schema(description = "Token数")
        private Integer tokens;
    }

    /**
     * AI对话响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI对话响应")
    public static class ConversationResponse {
        @Schema(description = "会话ID")
        private String sessionId;

        @Schema(description = "对话历史")
        private List<ConversationMessage> messages;

        @Schema(description = "会话创建时间")
        private LocalDateTime createdAt;

        @Schema(description = "最后更新时间")
        private LocalDateTime updatedAt;

        @Schema(description = "会话状态", allowableValues = {"active", "closed"})
        private String status;

        @Schema(description = "关联批次ID（如果有）")
        private Long contextBatchId;
    }

    /**
     * 对话消息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "对话消息")
    public static class ConversationMessage {
        @Schema(description = "消息ID")
        private Long id;

        @Schema(description = "角色", allowableValues = {"user", "assistant"})
        private String role;

        @Schema(description = "消息内容")
        private String content;

        @Schema(description = "消息时间")
        private LocalDateTime timestamp;

        @Schema(description = "Token数（仅AI响应）")
        private Integer tokens;
    }

    /**
     * AI报告列表响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI报告列表响应")
    public static class ReportListResponse {
        @Schema(description = "报告列表")
        private List<ReportSummary> reports;

        @Schema(description = "总数")
        private Integer total;

        @Schema(description = "当前页")
        private Integer page;

        @Schema(description = "每页大小")
        private Integer pageSize;
    }

    /**
     * 报告摘要
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI报告摘要")
    public static class ReportSummary {
        @Schema(description = "报告ID")
        private Long reportId;

        @Schema(description = "报告类型", allowableValues = {"batch", "weekly", "monthly", "custom"})
        private String reportType;

        @Schema(description = "报告标题")
        private String title;

        @Schema(description = "生成时间")
        private LocalDateTime createdAt;

        @Schema(description = "批次ID（如果是批次报告）")
        private Long batchId;

        @Schema(description = "批次编号（如果是批次报告）")
        private String batchNumber;

        @Schema(description = "时间范围开始")
        private LocalDateTime startDate;

        @Schema(description = "时间范围结束")
        private LocalDateTime endDate;

        @Schema(description = "总成本")
        private BigDecimal totalCost;

        @Schema(description = "关键发现数量")
        private Integer keyFindingsCount;

        @Schema(description = "建议数量")
        private Integer suggestionsCount;
    }

    /**
     * AI健康检查响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "AI服务健康检查响应")
    public static class HealthCheckResponse {
        @Schema(description = "服务状态", allowableValues = {"healthy", "degraded", "unavailable"})
        private String status;

        @Schema(description = "DeepSeek API可用性")
        private Boolean deepseekAvailable;

        @Schema(description = "响应时间（毫秒）")
        private Long responseTime;

        @Schema(description = "最后检查时间")
        private LocalDateTime lastCheckTime;

        @Schema(description = "错误信息（如果有）")
        private String errorMessage;
    }
}
