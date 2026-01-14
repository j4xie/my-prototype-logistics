package com.cretas.aims.dto.wage;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * 效率记录请求 DTO
 * 用于记录工人的计件数据，通常由AI检测系统调用
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "效率记录请求")
public class EfficiencyRecordRequest {

    /**
     * 工人ID
     */
    @NotNull(message = "工人ID不能为空")
    @Schema(description = "工人ID", example = "1", required = true)
    private Long workerId;

    /**
     * 完成件数
     */
    @NotNull(message = "完成件数不能为空")
    @Min(value = 0, message = "完成件数不能为负数")
    @Schema(description = "完成件数", example = "100", required = true)
    private Integer pieceCount;

    /**
     * 工作时长（分钟）
     * 可选，用于计算效率
     */
    @Min(value = 0, message = "工作时长不能为负数")
    @Schema(description = "工作时长（分钟）", example = "60")
    private Integer workMinutes;

    /**
     * 工序类型
     * 例如: CUTTING(分切), DEBONING(脱骨), PACKAGING(包装)等
     */
    @Schema(description = "工序类型", example = "CUTTING")
    private String processStageType;

    /**
     * 工作日期
     * 可选，默认为当天
     */
    @Schema(description = "工作日期，默认为当天", example = "2026-01-14")
    private LocalDate workDate;

    /**
     * 工位ID
     * 可选，用于标识工人的工位
     */
    @Schema(description = "工位ID", example = "WS001")
    private String workstationId;

    /**
     * 产品类型ID
     * 可选，用于关联不同的计件规则
     */
    @Schema(description = "产品类型ID", example = "PT001")
    private String productTypeId;

    /**
     * 合格件数
     * 可选，默认等于 pieceCount
     */
    @Min(value = 0, message = "合格件数不能为负数")
    @Schema(description = "合格件数", example = "98")
    private Integer qualifiedCount;

    /**
     * 备注
     */
    @Schema(description = "备注", example = "AI自动检测")
    private String notes;
}
