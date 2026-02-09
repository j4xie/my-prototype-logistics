package com.cretas.aims.dto.wage;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * 工资单生成请求 DTO
 * 用于为单个工人生成指定周期的工资单
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "工资单生成请求")
public class PayrollGenerateRequest {

    /**
     * 工人ID
     */
    @NotNull(message = "工人ID不能为空")
    @Schema(description = "工人ID", example = "1", required = true)
    private Long workerId;

    /**
     * 周期开始日期
     */
    @NotNull(message = "周期开始日期不能为空")
    @Schema(description = "周期开始日期", example = "2026-01-01", required = true)
    private LocalDate periodStart;

    /**
     * 周期结束日期
     */
    @NotNull(message = "周期结束日期不能为空")
    @Schema(description = "周期结束日期", example = "2026-01-31", required = true)
    private LocalDate periodEnd;
}
