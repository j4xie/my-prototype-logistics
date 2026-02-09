package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 质检结果 DTO（用于评估处置）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "质检结果")
public class QualityCheckResultDTO {

    @NotBlank(message = "质检记录ID不能为空")
    @Schema(description = "质检记录ID", example = "INS-2025-001", required = true)
    private String inspectionId;

    @NotNull(message = "生产批次ID不能为空")
    @Schema(description = "生产批次ID", example = "123", required = true)
    private Long productionBatchId;

    @NotNull(message = "检验员ID不能为空")
    @Schema(description = "检验员ID", example = "22", required = true)
    private Long inspectorId;

    @Schema(description = "检验日期", example = "2025-12-31")
    private LocalDate inspectionDate;

    @NotNull(message = "样本数量不能为空")
    @Schema(description = "样本数量", example = "100", required = true)
    private BigDecimal sampleSize;

    @NotNull(message = "合格数量不能为空")
    @Schema(description = "合格数量", example = "96", required = true)
    private BigDecimal passCount;

    @NotNull(message = "不合格数量不能为空")
    @Schema(description = "不合格数量", example = "4", required = true)
    private BigDecimal failCount;

    @Schema(description = "合格率", example = "96.00")
    private BigDecimal passRate;

    @Schema(description = "质检结果",
            example = "PASS",
            allowableValues = {"PASS", "FAIL", "CONDITIONAL"})
    private String result;

    @Schema(description = "备注说明")
    private String notes;
}
