package com.cretas.aims.dto.decoration;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.List;

/**
 * AI布局生成请求DTO
 *
 * <p>字段集对齐前端 {@code AILayoutGenerateRequest} (types/decoration.ts:281-292)：
 * 前端发的 {@code currentLayout / stylePreference / currentTheme / pageType / operationType}
 * 必须能反序列化进来，否则后端拿到的只有 prompt，丢失上下文。
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "AI布局生成请求")
public class AILayoutRequest {

    @Schema(description = "用户描述/提示词", example = "我希望首页能突出显示今日统计和快捷操作")
    private String prompt;

    @Schema(description = "当前布局 (用于增量修改) — 对齐前端 HomeModule[]")
    private List<HomeLayoutDTO.ModuleConfig> currentLayout;

    @Schema(description = "风格偏好 (前端 stylePreference)", example = "minimal",
            allowableValues = {"minimal", "data-intensive", "action-focused"})
    private String stylePreference;

    @Schema(description = "当前主题 (用于增量修改)")
    private HomeLayoutDTO.ThemeConfig currentTheme;

    @Schema(description = "页面类型", example = "home")
    private String pageType;

    @Schema(description = "操作类型", example = "generate",
            allowableValues = {"generate", "add_component", "update_style"})
    private String operationType;

    @Schema(description = "工厂ID (前端 redundantly 发送)")
    private String factoryId;

    // ===== 保留旧字段以兼容现有 caller =====

    @Schema(description = "布局风格 (旧字段)", example = "modern")
    private String style;

    @Schema(description = "布局模式 (旧字段)", example = "balanced")
    private String layoutMode;

    @Schema(description = "需要包含的模块ID列表 (旧字段)")
    private List<String> includedModules;

    @Schema(description = "需要排除的模块ID列表 (旧字段)")
    private List<String> excludedModules;

    @Schema(description = "网格列数 (旧字段)", example = "2")
    private Integer gridColumns;

    @Schema(description = "是否启用时段布局 (旧字段)", example = "false")
    private Boolean timeBasedEnabled;

    @Schema(description = "用户角色 (旧字段)", example = "factory_admin")
    private String userRole;

    @Schema(description = "偏好设置 (旧字段)")
    private Preferences preferences;

    /**
     * 偏好设置
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "用户偏好设置")
    public static class Preferences {

        @Schema(description = "是否偏好紧凑布局", example = "false")
        private Boolean compactLayout;

        @Schema(description = "首选颜色方案", example = "light")
        private String colorScheme;

        @Schema(description = "高优先级模块列表")
        private List<String> priorityModules;

        @Schema(description = "是否显示图表", example = "true")
        private Boolean showCharts;

        @Schema(description = "是否显示快捷操作", example = "true")
        private Boolean showQuickActions;
    }
}
