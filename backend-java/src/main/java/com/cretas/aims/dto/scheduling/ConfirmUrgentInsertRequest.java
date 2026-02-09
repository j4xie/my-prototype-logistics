package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * 确认紧急插单请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "确认紧急插单请求")
public class ConfirmUrgentInsertRequest {

    @Schema(description = "选中的时段ID", required = true)
    @NotBlank(message = "时段ID不能为空")
    private String slotId;

    @Schema(description = "产品类型ID", required = true)
    @NotNull(message = "产品类型不能为空")
    private String productTypeId;

    @Schema(description = "计划数量 (kg)", required = true)
    @NotNull(message = "计划数量不能为空")
    @DecimalMin(value = "0.01", message = "计划数量必须大于0")
    private BigDecimal plannedQuantity;

    @Schema(description = "客户订单号")
    private String customerOrderNumber;

    @Schema(description = "客户名称")
    private String customerName;

    @Schema(description = "分配的工人ID列表")
    private List<Long> assignedWorkerIds;

    @Schema(description = "分配的设备ID列表")
    private List<String> assignedEquipmentIds;

    @Schema(description = "使用的原材料批次ID列表")
    private List<String> materialBatchIds;

    @Schema(description = "备注")
    @Size(max = 500, message = "备注不能超过500个字符")
    private String notes;

    @Schema(description = "紧急原因", required = true)
    @NotBlank(message = "紧急原因不能为空")
    private String urgentReason;

    @Schema(description = "请求交期")
    private String requestedDeadline;

    @Schema(description = "优先级 (1-10)")
    @Min(value = 1, message = "优先级最小为1")
    @Max(value = 10, message = "优先级最大为10")
    private Integer priority = 9;

    @Schema(description = "是否强制插入（跳过影响检查）")
    private Boolean forceInsert = false;
}
