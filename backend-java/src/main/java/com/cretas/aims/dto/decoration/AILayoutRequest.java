package com.cretas.aims.dto.decoration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.List;

/**
 * AI布局生成请求DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI布局生成请求")
public class AILayoutRequest {

    @Schema(description = "用户描述/提示词", example = "我希望首页能突出显示今日统计和快捷操作")
    private String prompt;

    @Schema(description = "布局风格", example = "modern")
    private String style;

    @Schema(description = "布局模式", example = "balanced")
    private String layoutMode;

    @Schema(description = "需要包含的模块ID列表")
    private List<String> includedModules;

    @Schema(description = "需要排除的模块ID列表")
    private List<String> excludedModules;

    @Schema(description = "网格列数", example = "2")
    private Integer gridColumns;

    @Schema(description = "是否启用时段布局", example = "false")
    private Boolean timeBasedEnabled;

    @Schema(description = "用户角色", example = "factory_admin")
    private String userRole;

    @Schema(description = "偏好设置")
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
