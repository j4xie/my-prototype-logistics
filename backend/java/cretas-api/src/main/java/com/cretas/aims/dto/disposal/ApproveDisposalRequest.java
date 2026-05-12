package com.cretas.aims.dto.disposal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 审批报废记录请求 DTO.
 *
 * <p>Rule 17.1 cleanup (Issue #384 batch 5): replaces the
 * untyped {@code Map<String, Object>} body of
 * {@code PUT /api/mobile/{factoryId}/disposal-records/{id}/approve} with
 * a typed DTO. The previous Map-binding lost compile-time typing on the
 * {@code approverId} (Integer) and {@code approverName} (String) values
 * and silently swallowed {@code ClassCastException} via the catch-all.
 *
 * <p>Service-owned defaults filled by
 * {@link com.cretas.aims.service.DisposalRecordService#approveDisposal} —
 * <em>not</em> on the wire side:
 * <ul>
 *   <li>{@code isApproved} — set to {@code true} via {@code record.approve()}</li>
 *   <li>{@code approvalDate} — set to {@code LocalDateTime.now()} via {@code record.approve()}</li>
 * </ul>
 *
 * @author Cretas Team
 * @since 2026-05-11
 */
@Data
@Schema(description = "审批报废记录请求")
public class ApproveDisposalRequest {

    @Schema(description = "审批人ID", example = "1", required = true)
    @NotNull(message = "审批人ID不能为空")
    private Integer approverId;

    @Schema(description = "审批人姓名", example = "张三", required = true)
    @NotBlank(message = "审批人姓名不能为空")
    @Size(max = 100, message = "审批人姓名长度不能超过100个字符")
    private String approverName;
}
