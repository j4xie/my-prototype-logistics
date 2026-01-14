package com.cretas.aims.dto.decoration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.List;

/**
 * 布局建议DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "布局智能建议")
public class LayoutSuggestionDTO {

    @Schema(description = "建议列表")
    private List<Suggestion> suggestions;

    @Schema(description = "基于用户行为的分析")
    private BehaviorAnalysis behaviorAnalysis;

    @Schema(description = "生成时间戳")
    private Long timestamp;

    /**
     * 单条建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "单条建议")
    public static class Suggestion {

        @Schema(description = "建议ID")
        private String id;

        @Schema(description = "建议类型", example = "module_reorder")
        private String type;

        @Schema(description = "建议标题")
        private String title;

        @Schema(description = "建议描述")
        private String description;

        @Schema(description = "置信度(0-1)", example = "0.9")
        private Double confidence;

        @Schema(description = "影响的模块ID")
        private String targetModuleId;

        @Schema(description = "建议的操作", example = "move_up")
        private String action;

        @Schema(description = "建议的新位置")
        private Integer suggestedPosition;

        @Schema(description = "预期收益描述")
        private String expectedBenefit;
    }

    /**
     * 行为分析
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "用户行为分析")
    public static class BehaviorAnalysis {

        @Schema(description = "最常用模块列表")
        private List<ModuleUsage> mostUsedModules;

        @Schema(description = "最少使用模块列表")
        private List<ModuleUsage> leastUsedModules;

        @Schema(description = "使用高峰时段")
        private List<String> peakUsageHours;

        @Schema(description = "分析周期(天)", example = "7")
        private Integer analysisPeriodDays;
    }

    /**
     * 模块使用情况
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "模块使用情况")
    public static class ModuleUsage {

        @Schema(description = "模块ID")
        private String moduleId;

        @Schema(description = "模块名称")
        private String moduleName;

        @Schema(description = "点击次数")
        private Integer clickCount;

        @Schema(description = "使用占比", example = "0.35")
        private Double usagePercentage;
    }
}
