package com.cretas.aims.dto.workflow;

import com.cretas.aims.entity.config.WorkflowRule;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

/**
 * 创建 / 更新 WorkflowRule 请求 DTO — Sprint 4 Wave 1 (C-WF-RULE-1).
 *
 * <p>服务端管 (不接受 wire): {@code id} (UUID), {@code factoryId} (path),
 * audit timestamps (BaseEntity).
 *
 * <p>{@code expression} 接受 {@code Map<String,Object>} (Jackson 反序列化),
 * service 层 serialize 进 {@code WorkflowRule.expression} JSONB 列.
 *
 * @since 2026-05-16
 */
@Data
@Schema(description = "工作流规则请求")
public class WorkflowRuleRequest {

    @Schema(description = "绑定的 ApprovalWorkflow.id",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "workflowId 不能为空")
    @Size(max = 36)
    private String workflowId;

    @Schema(description = "绑定到 condition 节点的 nodeId",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "nodeId 不能为空")
    @Size(max = 50)
    private String nodeId;

    @Schema(description = "可选 — edge-level rule (Sprint 4 Wave 1 暂不消费)")
    @Size(max = 50)
    private String edgeId;

    @Schema(description = "规则类型 (AMOUNT_THRESHOLD/DEPT_MATCH/ROLE_MATCH/SPEL_CUSTOM)",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "ruleType 不能为空")
    private WorkflowRule.RuleType ruleType;

    @Schema(description = "表达式 JSON (schema per ruleType — 详细见 WorkflowRule javadoc)",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "expression 不能为空")
    private Map<String, Object> expression;

    @Schema(description = "rule 命中后路由到的 nodeId")
    @Size(max = 50)
    private String trueTargetNodeId;

    @Schema(description = "rule 未命中时路由到的 nodeId. NULL = fall through 下一 rule")
    @Size(max = 50)
    private String falseTargetNodeId;

    @Schema(description = "优先级 — 数值越小越优先评估", example = "0")
    private Integer priority;

    @Schema(description = "是否启用", example = "true")
    private Boolean enabled;

    @Schema(description = "说明 (UI 显示)")
    @Size(max = 500)
    private String description;
}
