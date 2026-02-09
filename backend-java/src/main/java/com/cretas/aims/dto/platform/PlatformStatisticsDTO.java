package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 平台统计数据DTO
 * 用于平台管理员查看全平台的汇总统计信息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "平台统计数据")
public class PlatformStatisticsDTO {

    @Schema(description = "工厂总数", example = "15")
    private Integer totalFactories;

    @Schema(description = "活跃工厂数", example = "12")
    private Integer activeFactories;

    @Schema(description = "不活跃工厂数", example = "3")
    private Integer inactiveFactories;

    @Schema(description = "用户总数", example = "450")
    private Integer totalUsers;

    @Schema(description = "活跃用户数", example = "420")
    private Integer activeUsers;

    @Schema(description = "批次总数", example = "1250")
    private Long totalBatches;

    @Schema(description = "已完成批次数", example = "1100")
    private Long completedBatches;

    @Schema(description = "今日总产量(kg)", example = "15000.5")
    private Double totalProductionToday;

    @Schema(description = "AI配额已使用量", example = "1200")
    private Integer totalAIQuotaUsed;

    @Schema(description = "AI配额总限制", example = "10000")
    private Integer totalAIQuotaLimit;

    @Schema(description = "系统健康状态", example = "healthy", allowableValues = {"healthy", "warning", "critical"})
    private String systemHealth;
}
