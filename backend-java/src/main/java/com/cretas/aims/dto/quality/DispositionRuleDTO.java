package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 处置规则 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "处置规则")
public class DispositionRuleDTO {

    @Schema(description = "规则ID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String id;

    @Schema(description = "工厂ID", example = "F001")
    private String factoryId;

    @Schema(description = "规则名称", example = "高合格率自动放行")
    private String ruleName;

    @Schema(description = "规则描述", example = "当合格率 >= 95% 时自动放行")
    private String description;

    @Schema(description = "最低合格率阈值", example = "95.00")
    private BigDecimal minPassRate;

    @Schema(description = "最高缺陷率阈值", example = "5.00")
    private BigDecimal maxDefectRate;

    @Schema(description = "处置动作", example = "RELEASE")
    private String action;

    @Schema(description = "是否需要审批", example = "false")
    private Boolean requiresApproval;

    @Schema(description = "审批级别", example = "SUPERVISOR")
    private String approvalLevel;

    @Schema(description = "规则优先级", example = "10")
    private Integer priority;

    @Schema(description = "规则版本", example = "1")
    private Integer version;

    @Schema(description = "是否启用", example = "true")
    private Boolean enabled;

    @Schema(description = "创建时间", example = "2025-12-31T10:00:00")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间", example = "2025-12-31T10:00:00")
    private LocalDateTime updatedAt;
}
