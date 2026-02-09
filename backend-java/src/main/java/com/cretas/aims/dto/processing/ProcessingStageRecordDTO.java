package com.cretas.aims.dto.processing;

import com.cretas.aims.entity.enums.ProcessingStageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 加工环节记录DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessingStageRecordDTO {
    private Long id;

    @NotNull(message = "生产批次ID不能为空")
    private Long productionBatchId;

    @NotNull(message = "环节类型不能为空")
    private ProcessingStageType stageType;

    private String stageName;
    private Integer stageOrder;

    // ==================== 时间数据 ====================
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer durationMinutes;

    // ==================== 重量/数量数据 ====================
    private BigDecimal inputWeight;
    private BigDecimal outputWeight;
    private BigDecimal lossWeight;
    private BigDecimal lossRate;

    // ==================== 温度数据 ====================
    private BigDecimal ambientTemperature;
    private BigDecimal productTemperature;
    private BigDecimal targetTemperature;

    // ==================== 质量数据 ====================
    private Integer passCount;
    private Integer failCount;
    private BigDecimal passRate;
    private Integer reworkCount;

    // ==================== 设备数据 ====================
    private Long equipmentId;
    private String equipmentName;
    private Integer equipmentRunTime;
    private Integer equipmentDowntime;
    private BigDecimal equipmentOee;

    // ==================== 资源消耗数据 ====================
    private BigDecimal waterUsage;
    private BigDecimal powerUsage;
    private BigDecimal auxiliaryUsage;
    private String auxiliaryName;

    // ==================== 特殊环节数据 ====================
    private BigDecimal dripLoss;
    private BigDecimal thicknessSd;
    private BigDecimal marinadeAbsorption;
    private BigDecimal phValue;
    private BigDecimal salinity;
    private Integer atpResult;
    private BigDecimal microPassRate;
    private BigDecimal ccpPassRate;

    // ==================== 操作员信息 ====================
    private Long operatorId;
    private String operatorName;
    private Integer workerCount;

    // ==================== 其他 ====================
    private String notes;
    private String extraData;

    // ==================== 统计/对比数据 (用于AI分析) ====================
    private BigDecimal avgLossRate;
    private BigDecimal avgPassRate;
    private Double avgDuration;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
