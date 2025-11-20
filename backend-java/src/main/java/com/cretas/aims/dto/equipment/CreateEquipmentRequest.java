package com.cretas.aims.dto.equipment;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Positive;
import javax.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 创建设备请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "创建设备请求")
public class CreateEquipmentRequest {

    @Schema(description = "设备名称", required = true)
    @NotBlank(message = "设备名称不能为空")
    private String name;

    @Schema(description = "设备类型")
    private String type;

    @Schema(description = "设备型号")
    private String model;

    @Schema(description = "制造商")
    private String manufacturer;

    @Schema(description = "序列号")
    private String serialNumber;

    @Schema(description = "购买日期")
    private LocalDate purchaseDate;

    @Schema(description = "购买价格")
    @PositiveOrZero(message = "购买价格必须大于等于0")
    private BigDecimal purchasePrice;

    @Schema(description = "折旧年限")
    @Positive(message = "折旧年限必须大于0")
    private Integer depreciationYears;

    @Schema(description = "每小时成本")
    @PositiveOrZero(message = "每小时成本必须大于等于0")
    private BigDecimal hourlyCost;

    @Schema(description = "功率(千瓦)")
    @PositiveOrZero(message = "功率必须大于等于0")
    private BigDecimal powerConsumptionKw;

    @Schema(description = "设备位置")
    private String location;

    @Schema(description = "维护间隔(小时)")
    @Positive(message = "维护间隔必须大于0")
    private Integer maintenanceIntervalHours;

    @Schema(description = "保修到期日")
    private LocalDate warrantyExpiryDate;

    @Schema(description = "备注")
    private String notes;
}