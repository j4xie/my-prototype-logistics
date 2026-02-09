package com.cretas.aims.dto.scheduling;

import com.cretas.aims.entity.enums.MixedBatchType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.DecimalMax;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Min;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 混批规则DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "混批规则配置")
public class MixedBatchRuleDTO {

    @Schema(description = "规则ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "规则类型")
    private MixedBatchType ruleType;

    @Schema(description = "规则类型显示名称")
    private String ruleTypeDisplayName;

    @Schema(description = "是否启用")
    private Boolean isEnabled;

    @Schema(description = "最大交期间隔 (小时)")
    @Min(value = 1, message = "交期间隔至少1小时")
    private Integer maxDeadlineGapHours;

    @Schema(description = "最小换型节省时间 (分钟)")
    @Min(value = 0, message = "节省时间不能为负")
    private Integer minSwitchSavingMinutes;

    @Schema(description = "工艺相似度阈值 (0-1)")
    @DecimalMin(value = "0", message = "相似度不能小于0")
    @DecimalMax(value = "1", message = "相似度不能大于1")
    private BigDecimal processSimilarityThreshold;

    @Schema(description = "最大合并订单数")
    @Min(value = 2, message = "至少合并2个订单")
    private Integer maxOrdersPerGroup;

    @Schema(description = "最大合并数量 (kg)")
    private BigDecimal maxTotalQuantity;

    @Schema(description = "是否自动合并")
    private Boolean autoMerge;

    @Schema(description = "是否需要审批")
    private Boolean requireApproval;

    @Schema(description = "备注")
    private String notes;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
