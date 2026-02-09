package com.cretas.aims.dto.platform;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;

/**
 * 更新AI配额请求DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-11-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "更新AI配额请求")
public class UpdateAIQuotaRequest {

    @Schema(description = "新的每周配额（次数）", required = true, example = "120")
    @NotNull(message = "配额不能为空")
    @Min(value = 0, message = "配额不能小于0")
    @Max(value = 1000, message = "配额不能大于1000")
    private Integer weeklyQuota;
}
