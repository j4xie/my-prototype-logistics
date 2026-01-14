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
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "模块配置")
    public static class ModuleConfig {

        @Schema(description = "模块ID", example = "today_stats")
        private String id;

        @Schema(description = "模块类型", example = "stats")
        private String type;

        @Schema(description = "是否可见", example = "true")
        private Boolean visible;

        @Schema(description = "排序序号", example = "1")
        private Integer order;

        @Schema(description = "列跨度", example = "2")
        private Integer colSpan;

        @Schema(description = "行跨度", example = "1")
        private Integer rowSpan;

        @Schema(description = "模块标题")
        private String title;

        @Schema(description = "模块图标")
        private String icon;

        @Schema(description = "额外配置")
        private Map<String, Object> config;
    }

    /**
     * 主题配置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "主题配置")
    public static class ThemeConfig {

        @Schema(description = "主题色", example = "#1890ff")
        private String primaryColor;

        @Schema(description = "背景色", example = "#f5f5f5")
        private String backgroundColor;

        @Schema(description = "卡片圆角", example = "8")
        private Integer cardRadius;

        @Schema(description = "卡片间距", example = "12")
        private Integer cardGap;

        @Schema(description = "字体大小比例", example = "1.0")
        private Double fontScale;

        @Schema(description = "是否紧凑模式", example = "false")
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
