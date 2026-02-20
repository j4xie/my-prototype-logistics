package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 平台报表数据 DTO
 * 用于平台管理员查看跨工厂的综合报表数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "平台报表数据")
public class PlatformReportDTO {

    @Schema(description = "报表摘要")
    private ReportSummary summary;

    @Schema(description = "趋势数据")
    private List<TrendData> trends;

    @Schema(description = "工厂排行榜")
    private List<FactoryRanking> topFactories;

    @Schema(description = "报表类型", example = "production")
    private String reportType;

    @Schema(description = "时间周期", example = "month")
    private String timePeriod;

    /**
     * 报表摘要
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReportSummary {
        @Schema(description = "总营收 (元)", example = "1258600")
        private Double totalRevenue;

        @Schema(description = "总产量 (吨)", example = "3420.5")
        private Double totalProduction;

        @Schema(description = "总订单数", example = "856")
        private Integer totalOrders;

        @Schema(description = "平均质量分数", example = "96.8")
        private Double averageQualityScore;

        @Schema(description = "同比变化率 (%)", example = "12.5")
        private Double changePercentage;
    }

    /**
     * 趋势数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendData {
        @Schema(description = "周期标签", example = "第1周")
        private String period;

        @Schema(description = "数值", example = "285.3")
        private Double value;

        @Schema(description = "变化率 (%)", example = "12.5")
        private Double change;
    }

    /**
     * 工厂排行
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FactoryRanking {
        @Schema(description = "工厂ID", example = "F001")
        private String factoryId;

        @Schema(description = "工厂名称", example = "上海工厂")
        private String name;

        @Schema(description = "产量 (吨)", example = "856.2")
        private Double production;

        @Schema(description = "营收 (元)", example = "345600")
        private Double revenue;

        @Schema(description = "效率 (%)", example = "94.5")
        private Double efficiency;

        @Schema(description = "质量分数", example = "98.2")
        private Double qualityScore;

        @Schema(description = "排名", example = "1")
        private Integer rank;
    }
}
