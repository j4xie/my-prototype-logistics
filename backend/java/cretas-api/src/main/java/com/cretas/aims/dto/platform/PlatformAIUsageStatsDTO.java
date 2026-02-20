package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 平台AI使用统计DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "平台AI使用统计")
public class PlatformAIUsageStatsDTO {

    @Schema(description = "当前周次 (ISO 8601格式: YYYY-Www)")
    private String currentWeek;

    @Schema(description = "本周平台总使用量")
    private Long totalUsed;

    @Schema(description = "各工厂使用情况")
    private List<FactoryUsageInfo> factories;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "工厂使用情况")
    public static class FactoryUsageInfo {
        @Schema(description = "工厂ID")
        private String factoryId;

        @Schema(description = "工厂名称")
        private String factoryName;

        @Schema(description = "每周配额")
        private Integer weeklyQuota;

        @Schema(description = "本周已使用次数")
        private Long used;

        @Schema(description = "剩余次数")
        private Long remaining;

        @Schema(description = "使用率（百分比字符串，保留2位小数）")
        private String utilization;
    }
}
