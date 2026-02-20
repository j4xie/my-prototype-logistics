package com.cretas.aims.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
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

    private String schemaId;

    @NotNull(message = "reportDate不能为空")
    private LocalDate reportDate;

    private String reporterName;
    private String processCategory;
    private String productName;

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
}
