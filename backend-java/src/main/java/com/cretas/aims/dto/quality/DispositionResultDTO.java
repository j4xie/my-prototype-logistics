package com.cretas.aims.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 处置执行结果 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "处置执行结果")
public class DispositionResultDTO {

    @Schema(description = "处置记录ID", example = "DISP-2025-001")
    private String dispositionId;

    @Schema(description = "执行状态",
            example = "EXECUTED",
            allowableValues = {"EXECUTED", "PENDING_APPROVAL", "APPROVED", "REJECTED"})
    private String status;

    @Schema(description = "执行的处置动作", example = "RELEASE")
    private String executedAction;

    @Schema(description = "执行消息", example = "处置已执行: 放行")
    private String message;

    @Schema(description = "下一步操作说明", example = "批次已放行，可以进入下一工序")
    private String nextSteps;

    @Schema(description = "批次新状态", example = "PASSED")
    private String newBatchStatus;

    @Schema(description = "是否启动审批流程", example = "false")
    private Boolean approvalInitiated;

    @Schema(description = "审批请求ID（如果启动了审批）")
    private String approvalRequestId;

    @Schema(description = "审计日志ID")
    private String auditLogId;

    @Schema(description = "执行时间", example = "2025-12-31T10:30:00")
    private LocalDateTime executedAt;
}
