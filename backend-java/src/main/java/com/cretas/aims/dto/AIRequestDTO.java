package com.cretas.aims.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

/**
 * AI API请求DTO类
 */
public class AIRequestDTO {

    /**
     * AI批次成本分析请求
     */
    @Data
    @Schema(description = "AI批次成本分析请求")
    public static class BatchCostAnalysisRequest {
        @NotNull(message = "批次ID不能为空")
        @Schema(description = "批次ID", required = true)
        private Long batchId;

        @Schema(description = "自定义问题（可选）")
        private String question;

        @Schema(description = "会话ID（用于多轮对话）")
        private String sessionId;

        @Schema(description = "分析类型", example = "default", allowableValues = {"default", "deep", "comparison"})
        private String analysisType = "default";
    }

    /**
     * AI时间范围成本分析请求
     */
    @Data
    @Schema(description = "AI时间范围成本分析请求")
    public static class TimeRangeAnalysisRequest {
        @NotNull(message = "开始日期不能为空")
        @Schema(description = "开始日期", required = true, example = "2025-11-01")
        private LocalDate startDate;

        @NotNull(message = "结束日期不能为空")
        @Schema(description = "结束日期", required = true, example = "2025-11-30")
        private LocalDate endDate;

        @Schema(description = "分析维度", example = "overall", allowableValues = {"overall", "daily", "weekly"})
        private String dimension = "overall";

        @Schema(description = "自定义问题（可选）")
        private String question;

        @Schema(description = "是否启用AI思考过程（关闭可加速响应）", example = "false")
        private Boolean enableThinking = false;

        @Schema(description = "思考预算Token数（仅enableThinking=true时有效）", example = "20")
        private Integer thinkingBudget = 20;
    }

    /**
     * AI对比分析请求
     */
    @Data
    @Schema(description = "AI批次对比分析请求")
    public static class ComparativeAnalysisRequest {
        @NotNull(message = "批次ID列表不能为空")
        @Schema(description = "要对比的批次ID列表（2-5个）", required = true)
        private List<String> batchIds;

        @Schema(description = "对比维度", example = "cost", allowableValues = {"cost", "efficiency", "quality", "comprehensive"})
        private String dimension = "comprehensive";

        @Schema(description = "自定义问题（可选）")
        private String question;
    }

    /**
     * AI对话请求
     */
    @Data
    @Schema(description = "AI对话请求")
    public static class ConversationRequest {
        @NotNull(message = "会话ID不能为空")
        @Schema(description = "会话ID", required = true)
        private String sessionId;

        @NotNull(message = "用户消息不能为空")
        @Schema(description = "用户消息", required = true)
        private String message;

        @Schema(description = "上下文批次ID（可选）")
        private Long contextBatchId;
    }

    /**
     * AI报告生成请求
     */
    @Data
    @Schema(description = "AI报告生成请求")
    public static class ReportGenerationRequest {
        @NotNull(message = "报告类型不能为空")
        @Schema(description = "报告类型", required = true, allowableValues = {"batch", "weekly", "monthly", "custom"})
        private String reportType;

        @Schema(description = "批次ID（批次报告时必填）")
        private Long batchId;

        @Schema(description = "开始日期（周报/月报/自定义报告时必填）")
        private LocalDate startDate;

        @Schema(description = "结束日期（周报/月报/自定义报告时必填）")
        private LocalDate endDate;

        @Schema(description = "报告标题（可选）")
        private String title;

        @Schema(description = "包含的分析维度", example = "[\"cost\", \"efficiency\", \"quality\"]")
        private List<String> dimensions;
    }
}
