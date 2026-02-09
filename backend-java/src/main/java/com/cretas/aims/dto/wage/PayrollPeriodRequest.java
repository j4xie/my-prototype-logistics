package com.cretas.aims.dto.wage;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * 批量工资单生成请求 DTO
 * 用于批量生成工厂所有工人的工资单
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "批量工资单生成请求")
public class PayrollPeriodRequest {

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

    /**
     * 周期类型
     * DAILY: 日结, WEEKLY: 周结, MONTHLY: 月结
     */
    @Schema(description = "周期类型: DAILY/WEEKLY/MONTHLY", example = "MONTHLY")
    private String periodType;

    /**
     * 是否覆盖已存在的记录
     * 默认为 false，如果记录已存在则跳过
     */
    @Schema(description = "是否覆盖已存在的记录", example = "false")
    private Boolean overwriteExisting;

    /**
     * 是否包含未打卡的工人
     * 默认为 false，只为有效率记录的工人生成工资单
     */
    @Schema(description = "是否包含未打卡的工人", example = "false")
    private Boolean includeInactive;
}
