package com.cretas.aims.dto.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import java.time.LocalDateTime;

/**
 * AI报告提示词配置 DTO
 *
 * 用于管理不同类型报告的AI提示词模板配置:
 * - 支持按报告类型配置不同的提示词模板
 * - 支持工厂级别的自定义配置
 * - 支持配置分析方向和优先级
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "AI报告提示词配置DTO")
public class AIReportPromptConfigDTO {

    /**
     * 配置ID
     */
    @Schema(description = "配置ID", example = "uuid-string")
    private String id;

    /**
     * 工厂ID（可选）
     * - null: 平台级配置（所有工厂默认）
     * - 具体工厂ID: 工厂级配置（覆盖平台配置）
     */
    @Schema(description = "工厂ID，null表示平台级配置", example = "F001")
    private String factoryId;

    /**
     * 报告类型
     * daily - 日报
     * weekly - 周报
     * monthly - 月报
     * quarterly - 季报
     * yearly - 年报
     */
    @NotBlank(message = "报告类型不能为空")
    @Pattern(regexp = "^(daily|weekly|monthly|quarterly|yearly)$",
             message = "报告类型必须是 daily/weekly/monthly/quarterly/yearly 之一")
    @Schema(description = "报告类型", example = "weekly",
            allowableValues = {"daily", "weekly", "monthly", "quarterly", "yearly"})
    private String reportType;

    /**
     * 提示词模板
     * 支持变量占位符: {startDate}, {endDate}, {factoryName}, {reportPeriod} 等
     */
    @NotBlank(message = "提示词模板不能为空")
    @Schema(description = "提示词模板，支持变量占位符",
            example = "请分析{factoryName}在{startDate}至{endDate}期间的生产数据，生成{reportPeriod}报告...")
    private String promptTemplate;

    /**
     * 分析方向列表 (JSON字符串)
     * 定义AI分析报告时应关注的重点方向
     * 如: ["成本分析", "产量趋势", "质量指标", "效率提升"]
     */
    @Schema(description = "分析方向列表(JSON数组字符串)",
            example = "[\"成本分析\", \"产量趋势\", \"质量指标\", \"效率提升\"]")
    private String analysisDirections;

    /**
     * 是否启用
     */
    @NotNull(message = "启用状态不能为空")
    @Builder.Default
    @Schema(description = "是否启用", example = "true")
    private Boolean isActive = true;

    /**
     * 优先级（数值越高优先级越高）
     * 当同一报告类型有多个配置时，使用优先级最高的
     */
    @Builder.Default
    @Schema(description = "优先级，数值越高优先级越高", example = "100")
    private Integer priority = 0;

    /**
     * 配置名称（可选，用于显示）
     */
    @Schema(description = "配置名称", example = "周报默认模板")
    private String configName;

    /**
     * 配置描述
     */
    @Schema(description = "配置描述", example = "适用于生产型工厂的周报生成模板")
    private String description;

    /**
     * 最大响应token数
     */
    @Builder.Default
    @Schema(description = "最大响应token数", example = "4000")
    private Integer maxTokens = 4000;

    /**
     * 温度参数 (0.0-2.0)
     * 控制AI回复的创造性
     */
    @Builder.Default
    @Schema(description = "温度参数(0.0-2.0)", example = "0.7")
    private Double temperature = 0.7;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间", accessMode = Schema.AccessMode.READ_ONLY)
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @Schema(description = "更新时间", accessMode = Schema.AccessMode.READ_ONLY)
    private LocalDateTime updatedAt;

    /**
     * 创建者用户名
     */
    @Schema(description = "创建者用户名", accessMode = Schema.AccessMode.READ_ONLY)
    private String createdBy;

    /**
     * 最后修改者用户名
     */
    @Schema(description = "最后修改者用户名", accessMode = Schema.AccessMode.READ_ONLY)
    private String updatedBy;
}
