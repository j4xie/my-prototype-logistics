package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 处置历史记录 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "处置历史记录")
public class DispositionHistoryDTO {

    @Schema(description = "审计日志ID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String id;

    @Schema(description = "生产批次ID", example = "123")
    private Long batchId;

    @Schema(description = "质检记录ID", example = "INS-2025-001")
    private String inspectionId;

    @Schema(description = "处置动作", example = "RELEASE")
    private String action;

    @Schema(description = "处置动作描述", example = "放行")
    private String actionDescription;

    @Schema(description = "处置原因", example = "质检合格，符合放行条件")
    private String reason;

    @Schema(description = "合格率", example = "96.5")
    private BigDecimal passRate;

    @Schema(description = "缺陷率", example = "3.5")
    private BigDecimal defectRate;

    @Schema(description = "质量等级", example = "A")
    private String qualityGrade;

    @Schema(description = "执行人ID", example = "22")
    private Long executorId;

    @Schema(description = "执行人姓名", example = "张三")
    private String executorName;

    @Schema(description = "执行人角色", example = "QUALITY_INSPECTOR")
    private String executorRole;

    @Schema(description = "是否需要审批", example = "false")
    private Boolean requiresApproval;

    @Schema(description = "审批状态", example = "APPROVED")
    private String approvalStatus;

    @Schema(description = "审批人姓名", example = "李四")
    private String approverName;

    @Schema(description = "审批时间", example = "2025-12-31T11:00:00")
    private LocalDateTime approvedAt;

    @Schema(description = "处置状态", example = "PASSED")
    private String newStatus;

    @Schema(description = "执行时间", example = "2025-12-31T10:30:00")
    private LocalDateTime createdAt;
}
