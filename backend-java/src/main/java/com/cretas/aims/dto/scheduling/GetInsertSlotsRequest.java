package com.cretas.aims.dto.scheduling;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 获取可插单时段请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "获取可插单时段请求")
public class GetInsertSlotsRequest {

    @Schema(description = "产品类型ID", required = true)
    @NotNull(message = "产品类型不能为空")
    private String productTypeId;

    @Schema(description = "需求数量 (kg)", required = true)
    @NotNull(message = "需求数量不能为空")
    @DecimalMin(value = "0.01", message = "需求数量必须大于0")
    private BigDecimal requiredQuantity;

    @Schema(description = "交期", required = true)
    @NotNull(message = "交期不能为空")
    @Future(message = "交期必须是未来时间")
    private LocalDateTime deadline;

    @Schema(description = "紧急程度: normal/urgent/critical")
    private String urgencyLevel = "normal";

    @Schema(description = "客户订单号")
    private String customerOrderNumber;

    @Schema(description = "客户名称")
    private String customerName;

    @Schema(description = "指定产线ID（可选）")
    private String preferredProductionLineId;

    @Schema(description = "是否只返回无影响的时段")
    private Boolean noImpactOnly = false;

    @Schema(description = "最低推荐分数筛选 (0-100)")
    @Min(value = 0, message = "最低推荐分数不能小于0")
    @Max(value = 100, message = "最低推荐分数不能大于100")
    private Integer minRecommendScore = 0;
}
