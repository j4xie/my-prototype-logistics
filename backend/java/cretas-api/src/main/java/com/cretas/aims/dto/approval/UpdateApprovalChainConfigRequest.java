package com.cretas.aims.dto.approval;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新审批链配置请求 DTO (Rule 17.1 cleanup — Issue #384 batch 6 final).
 *
 * <p>替代 {@code @RequestBody ApprovalChainConfig} 实体直绑模式. 隔离 wire contract
 * 与 {@link com.cretas.aims.entity.config.ApprovalChainConfig} 持久化模型.
 *
 * <p>Per {@link com.cretas.aims.service.impl.ApprovalChainServiceImpl#updateConfig},
 * the service iterates each mutable field with an {@code if (... != null)} guard, so
 * leaving a wire field absent preserves the existing DB value. Service-owned fields
 * not included here:
 * <ul>
 *   <li>{@code id} — path variable, immutable</li>
 *   <li>{@code factoryId} — immutable (cross-factory edit rejected by service)</li>
 *   <li>{@code decisionType} — service code does NOT call {@code setDecisionType}
 *       (decision type is part of the unique constraint and treated as immutable)</li>
 *   <li>{@code enabled} — managed via {@code PATCH /toggle} endpoint</li>
 *   <li>{@code version} — auto-incremented by service</li>
 *   <li>audit timestamps — BaseEntity-managed</li>
 * </ul>
 *
 * @see com.cretas.aims.entity.config.ApprovalChainConfig
 * @see <a href="https://github.com/j4xie/my-prototype-logistics/issues/384">Issue #384 Rule 17.1 batch 6</a>
 * @since 2026-05-11
 */
@Data
@Schema(description = "更新审批链配置请求")
public class UpdateApprovalChainConfigRequest {

    @Schema(description = "配置名称", example = "一级审批 - 质量放行")
    @Size(max = 100, message = "配置名称长度不能超过100个字符")
    private String name;

    @Schema(description = "配置描述")
    @Size(max = 500, message = "配置描述长度不能超过500个字符")
    private String description;

    @Schema(description = "触发条件 (JSON 字符串)")
    private String triggerCondition;

    @Schema(description = "审批级别 (1=一级审批, 2=二级审批, ...)", example = "1")
    @Min(value = 1, message = "审批级别必须大于0")
    private Integer approvalLevel;

    @Schema(description = "必需审批人数", example = "1")
    @Min(value = 1, message = "必需审批人数必须大于0")
    private Integer requiredApprovers;

    @Schema(description = "可审批角色列表 (JSON 数组)")
    private String approverRoles;

    @Schema(description = "可审批用户ID列表 (JSON 数组)")
    private String approverUserIds;

    @Schema(description = "超时时间 (分钟)", example = "120")
    private Integer timeoutMinutes;

    @Schema(description = "超时后升级到的配置ID")
    @Size(max = 36, message = "升级配置ID长度不能超过36个字符")
    private String escalationConfigId;

    @Schema(description = "自动审批条件 (JSON 字符串)")
    private String autoApproveCondition;

    @Schema(description = "自动拒绝条件 (JSON 字符串)")
    private String autoRejectCondition;

    @Schema(description = "优先级 (数值越大优先级越高)", example = "0")
    private Integer priority;
}
