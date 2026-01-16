package com.cretas.aims.dto.decoration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.List;

/**
 * AI布局生成响应DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI布局生成响应")
public class AILayoutResponse {

    @Schema(description = "生成的布局配置")
    private HomeLayoutDTO layout;

    @Schema(description = "AI生成说明")
    private String explanation;

    @Schema(description = "生成耗时(毫秒)", example = "1500")
    private Long generationTimeMs;

    @Schema(description = "使用的AI模型", example = "llm-chat")
    private String modelUsed;

    @Schema(description = "备选布局方案")
    private List<HomeLayoutDTO> alternatives;

    @Schema(description = "设计建议列表")
    private List<DesignSuggestion> suggestions;

    /**
     * 设计建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "设计建议")
    public static class DesignSuggestion {

        @Schema(description = "建议类型", example = "layout_optimization")
        private String type;

        @Schema(description = "建议标题", example = "优化模块排列")
        private String title;

        @Schema(description = "建议描述")
        private String description;

        @Schema(description = "置信度(0-1)", example = "0.85")
        private Double confidence;

        @Schema(description = "相关模块ID")
        private String moduleId;

        @Schema(description = "建议的操作")
        private String action;
    }
}
