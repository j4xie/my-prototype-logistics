package com.cretas.aims.dto.approval;

import com.cretas.aims.entity.config.ApprovalChainConfig.DecisionType;
import com.cretas.aims.entity.config.ApprovalWorkflowEdge;
import com.cretas.aims.entity.config.ApprovalWorkflowNode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 创建审批工作流请求 DTO.
 *
 * <p>Wire contract for {@code POST /api/mobile/{factoryId}/approval-workflows}.
 * Sprint 3 Track-I (C-APPROVAL-EDITOR-1) 2026-05-16.
 *
 * <p>服务端管 (不接受 wire):
 * <ul>
 *   <li>{@code id} — Hibernate UUID2 生成</li>
 *   <li>{@code factoryId} — 来自 {@code @PathVariable}</li>
 *   <li>{@code version} 默认 1</li>
 *   <li>{@code publishStatus} 默认 'draft'</li>
 *   <li>{@code enabled} 默认 true</li>
 *   <li>{@code priority} 默认 0</li>
 *   <li>audit timestamps — BaseEntity-managed</li>
 * </ul>
 *
 * <p>{@code nodes} / {@code edges} 接受 List 形式 (Jackson 反序列化), service 层
 * serialize 进 {@code ApprovalWorkflow.nodesJson} / {@code edgesJson} JSONB 列.
 *
 * @see com.cretas.aims.entity.config.ApprovalWorkflow
 */
@Data
@Schema(description = "创建审批工作流请求")
public class CreateApprovalWorkflowRequest {

    @Schema(description = "决策类型", example = "QUALITY_RELEASE",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "决策类型不能为空")
    private DecisionType decisionType;

    @Schema(description = "工作流名称", example = "质检放行 - 并行会签",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "工作流名称不能为空")
    @Size(max = 100, message = "工作流名称长度不能超过100个字符")
    private String name;

    @Schema(description = "工作流描述")
    @Size(max = 500, message = "工作流描述长度不能超过500个字符")
    private String description;

    @Schema(description = "节点列表 (≥ 1, 必含 type=start 且 唯一)",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotEmpty(message = "节点列表不能为空")
    private List<ApprovalWorkflowNode> nodes;

    @Schema(description = "边列表 (可为空但非 null)",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "边列表不能为 null")
    private List<ApprovalWorkflowEdge> edges;

    @Schema(description = "入口节点 ID (必须匹配 nodes 中某 type=start 的节点)",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "入口节点ID不能为空")
    @Size(max = 50, message = "入口节点ID长度不能超过50个字符")
    private String startNodeId;

    @Schema(description = "优先级 (数值越大越优先), 不传时由服务端默认 0", example = "0")
    private Integer priority;

    @Schema(description = "是否启用, 不传时由服务端默认 true", example = "true")
    private Boolean enabled;
}
