package com.cretas.aims.dto.quality;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 处置申请请求 DTO
 * 用于 POST /quality-disposition/apply 端点
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DispositionApplyRequest {

    /**
     * 质检记录ID
     */
    @NotBlank(message = "质检记录ID不能为空")
    private String inspectionId;

    /**
     * 生产批次ID
     */
    @NotNull(message = "生产批次ID不能为空")
    private Long batchId;

    /**
     * 处置动作代码 (RELEASE, REWORK, SCRAP, HOLD 等)
     */
    @NotBlank(message = "处置动作不能为空")
    private String actionCode;

    /**
     * 申请原因
     */
    @NotBlank(message = "申请原因不能为空")
    private String reason;

    /**
     * 申请人ID
     */
    @NotNull(message = "申请人ID不能为空")
    private Long applicantId;

    /**
     * 申请人姓名
     */
    private String applicantName;

    /**
     * 紧急程度 (LOW, MEDIUM, HIGH, URGENT)
     */
    private String urgency;

    /**
     * 附加说明
     */
    private String additionalNotes;
}
