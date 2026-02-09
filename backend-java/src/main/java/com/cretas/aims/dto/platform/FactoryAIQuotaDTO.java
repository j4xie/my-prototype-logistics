package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 工厂AI配额DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "工厂AI配额信息")
public class FactoryAIQuotaDTO {

    @Schema(description = "工厂ID")
    private String id;

    @Schema(description = "工厂名称")
    private String name;

    @Schema(description = "每周AI调用配额（次数）")
    private Integer aiWeeklyQuota;

    @Schema(description = "统计信息")
    private CountInfo _count;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "统计信息")
    public static class CountInfo {
        @Schema(description = "历史总调用次数")
        private Long aiUsageLogs;
    }
}
