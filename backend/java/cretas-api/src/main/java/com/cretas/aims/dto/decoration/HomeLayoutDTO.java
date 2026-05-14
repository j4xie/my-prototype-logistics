package com.cretas.aims.dto.decoration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 首页布局DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "首页布局配置")
public class HomeLayoutDTO {

    @Schema(description = "布局ID")
    private Long id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "模块配置列表")
    private List<ModuleConfig> modules;

    @Schema(description = "主题配置")
    private ThemeConfig theme;

    @Schema(description = "网格列数", example = "2")
    private Integer gridColumns;

    @Schema(description = "状态: 0草稿 1发布", example = "1")
    private Integer status;

    @Schema(description = "版本号", example = "1")
    private Integer version;

    @Schema(description = "是否AI生成: 0否 1是", example = "0")
    private Integer aiGenerated;

    @Schema(description = "AI生成时使用的提示词")
    private String aiPrompt;

    @Schema(description = "是否启用时段布局: 0否 1是", example = "0")
    private Integer timeBasedEnabled;

    @Schema(description = "早间布局配置")
    private List<ModuleConfig> morningModules;

    @Schema(description = "午间布局配置")
    private List<ModuleConfig> afternoonModules;

    @Schema(description = "晚间布局配置")
    private List<ModuleConfig> eveningModules;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    /**
     * 模块配置
     *
     * <p>字段集对齐前端 {@code HomeModule} (types/decoration.ts): 同时支持
     * 新的 {@code gridPosition}/{@code gridSize}/{@code name} 形态 和 老的
     * {@code order}/{@code colSpan}/{@code rowSpan}/{@code title} 形态。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "模块配置")
    public static class ModuleConfig {

        @Schema(description = "模块ID", example = "stats_grid")
        private String id;

        @Schema(description = "模块类型", example = "stats_grid",
                allowableValues = {"welcome", "ai_insight", "stats_grid", "quick_actions", "dev_tools"})
        private String type;

        @Schema(description = "模块显示名称", example = "数据统计")
        private String name;

        @Schema(description = "是否可见", example = "true")
        private Boolean visible;

        @Schema(description = "Bento 网格位置")
        private GridPosition gridPosition;

        @Schema(description = "Bento 网格尺寸")
        private GridSize gridSize;

        @Schema(description = "排序序号 (旧字段, 保留兼容)", example = "1")
        private Integer order;

        @Schema(description = "列跨度 (旧字段, 保留兼容)", example = "2")
        private Integer colSpan;

        @Schema(description = "行跨度 (旧字段, 保留兼容)", example = "1")
        private Integer rowSpan;

        @Schema(description = "模块标题 (旧字段, 保留兼容)")
        private String title;

        @Schema(description = "模块图标")
        private String icon;

        @Schema(description = "额外配置")
        private Map<String, Object> config;
    }

    /**
     * Bento 网格位置 (对齐前端 HomeModule.gridPosition)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Bento 网格位置")
    public static class GridPosition {
        @Schema(description = "X 坐标 (0-based)", example = "0")
        private Integer x;

        @Schema(description = "Y 坐标 (0-based)", example = "0")
        private Integer y;
    }

    /**
     * Bento 网格尺寸 (对齐前端 HomeModule.gridSize, w/h ∈ {1,2})
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Bento 网格尺寸")
    public static class GridSize {
        @Schema(description = "宽度 (1 或 2)", example = "2")
        private Integer w;

        @Schema(description = "高度 (1 或 2)", example = "1")
        private Integer h;
    }

    /**
     * 主题配置
     *
     * <p>字段集对齐前端 {@code ThemeConfig} (types/decoration.ts:85-93)。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "主题配置")
    public static class ThemeConfig {

        @Schema(description = "主题色", example = "#2E7D32")
        private String primaryColor;

        @Schema(description = "次要色 (前端字段)", example = "#4CAF50")
        private String secondaryColor;

        @Schema(description = "背景色", example = "#F5F5F5")
        private String backgroundColor;

        @Schema(description = "卡片圆角 (前端字段)", example = "12")
        private Integer cardBorderRadius;

        @Schema(description = "AI 卡片渐变色 (前端字段, 2 个 hex)")
        private java.util.List<String> aiCardGradient;

        @Schema(description = "文字色 (前端字段)", example = "#212121")
        private String textColor;

        @Schema(description = "卡片背景色 (前端字段)", example = "#FFFFFF")
        private String cardBackgroundColor;

        // ===== 旧字段保留兼容现有 caller =====

        @Schema(description = "卡片圆角 (旧字段, 等价 cardBorderRadius)", example = "8")
        private Integer cardRadius;

        @Schema(description = "卡片间距 (旧字段)", example = "12")
        private Integer cardGap;

        @Schema(description = "字体大小比例 (旧字段)", example = "1.0")
        private Double fontScale;

        @Schema(description = "是否紧凑模式 (旧字段)", example = "false")
        private Boolean compactMode;
    }

    /**
     * 使用统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "使用统计")
    public static class UsageStats {

        @Schema(description = "模块点击统计")
        private Map<String, Integer> moduleClicks;

        @Schema(description = "最后更新时间")
        private LocalDateTime lastUpdated;
    }

    /**
     * 保存布局请求
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "保存布局请求")
    public static class SaveRequest {

        @Schema(description = "模块配置列表")
        private List<ModuleConfig> modules;

        @Schema(description = "主题配置")
        private ThemeConfig theme;

        @Schema(description = "网格列数", example = "2")
        private Integer gridColumns;

        @Schema(description = "是否启用时段布局", example = "false")
        private Boolean timeBasedEnabled;

        @Schema(description = "早间布局配置")
        private List<ModuleConfig> morningModules;

        @Schema(description = "午间布局配置")
        private List<ModuleConfig> afternoonModules;

        @Schema(description = "晚间布局配置")
        private List<ModuleConfig> eveningModules;
    }
}
