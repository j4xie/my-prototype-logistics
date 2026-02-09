package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import java.util.Map;

/**
 * 创建AI配额规则请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "创建AI配额规则请求")
public class CreateAIQuotaRuleRequest {

    @Schema(description = "工厂ID（null表示创建全局默认规则）")
    private String factoryId;

    @Schema(description = "周配额（次/周）", example = "20", required = true)
    @NotNull(message = "周配额不能为空")
    @Min(value = 0, message = "周配额不能小于0")
    @Max(value = 10000, message = "周配额不能大于10000")
    private Integer weeklyQuota;

    @Schema(description = "角色配额系数", example = "{\"dispatcher\": 2.0, \"quality_inspector\": 1.5}")
    private Map<String, Double> roleMultipliers;

    @Schema(description = "配额重置周期（1=周一, 7=周日）", example = "1")
    @Min(value = 1, message = "重置周期必须在1-7之间")
    @Max(value = 7, message = "重置周期必须在1-7之间")
    private Integer resetDayOfWeek;

    @Schema(description = "是否启用", example = "true")
    private Boolean enabled;

    @Schema(description = "优先级（数字越大优先级越高）", example = "0")
    private Integer priority;

    @Schema(description = "规则描述")
    private String description;
}
