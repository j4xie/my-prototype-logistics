package com.cretas.aims.dto;

import com.cretas.aims.entity.enums.ReportMode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkReportSubmitRequest {

    private Long batchId;

    @NotBlank(message = "reportType不能为空")
    private String reportType;

    /** P0-15: 报工模式，不传默认 MODE_1 */
    private ReportMode reportMode;

    /** P0-15 MODE_3 专用: 工人 ID 列表 */
    private List<Long> workerIds;

    private String schemaId;

    @NotNull(message = "reportDate不能为空")
    private LocalDate reportDate;

    private String reporterName;
    private String processCategory;
    private String productName;

    @DecimalMin(value = "0.01", message = "产量必须大于0")
    private BigDecimal outputQuantity;
    private BigDecimal goodQuantity;
    private BigDecimal defectQuantity;

    private Integer totalWorkMinutes;
    private Integer totalWorkers;
    private BigDecimal operationVolume;

    private List<Map<String, Object>> hourEntries;
    private List<Map<String, Object>> nonProductionEntries;

    private LocalTime productionStartTime;
    private LocalTime productionEndTime;

    private Map<String, Object> customFields;
    private List<String> photos;
    private String containerSequence;
}
