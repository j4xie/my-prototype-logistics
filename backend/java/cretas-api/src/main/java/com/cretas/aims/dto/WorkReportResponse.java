package com.cretas.aims.dto;

import com.cretas.aims.entity.ProductionReport;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkReportResponse {

    private Long id;
    private String factoryId;
    private Long batchId;
    private Long workerId;
    private String reportType;
    private String schemaId;
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

    private ProductionReport.Status status;
    private Boolean syncedToSmartbi;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
