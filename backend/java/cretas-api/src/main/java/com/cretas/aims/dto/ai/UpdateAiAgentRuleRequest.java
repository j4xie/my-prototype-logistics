package com.cretas.aims.dto.ai;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新 AI Agent 规则请求 DTO (Rule 17.1 cleanup — Issue #384 batch 6 final).
 *
 * <p>替代 {@code @RequestBody AiAgentRule} 实体直绑模式. 隔离 wire contract
 * 与 {@link com.cretas.aims.entity.smartbi.AiAgentRule} 持久化模型 — 防止
 * {@code @Builder.Default} 字段 ({@code factoryId = "DEFAULT"},
 * {@code priority = 100}, {@code useLlmSelection = false}, {@code isActive = true})
 * 通过 {@code @NoArgsConstructor} 字段初始化器在 Jackson 反序列化时静默写入,
 * 进而隐式覆盖 PUT 请求的部分更新意图.
 *
 * <p>Per {@link com.cretas.aims.controller.AiAgentRuleController#updateRule}, only
 * the following fields are mutable on an existing rule (the controller iterates each
 * with implicit non-null contract — caller must supply all). All other entity fields
 * (id, factoryId, audit timestamps) are NOT mutable through this endpoint.
 *
 * <p>Note: 不同于 {@link CreateAiAgentRuleRequest}, 此处不强制 {@code triggerType} /
 * {@code ruleName} / {@code toolChainConfig} 必填 — 由 service 层依业务需求决定
 * (现有 controller 直接调 {@code setXxx(req.getXxx())}, 与之前实体绑定行为一致).
 *
 * @see com.cretas.aims.entity.smartbi.AiAgentRule
 * @see <a href="https://github.com/j4xie/my-prototype-logistics/issues/384">Issue #384 Rule 17.1 batch 6</a>
 * @since 2026-05-11
 */
@Data
@Schema(description = "更新 AI Agent 规则请求")
public class UpdateAiAgentRuleRequest {

    @Schema(description = "规则名称", example = "SOP上传自动解析")
    @Size(max = 100, message = "规则名称长度不能超过100个字符")
    private String ruleName;

    @Schema(description = "规则描述")
    private String ruleDescription;

    @Schema(description = "触发类型 (SOP_UPLOAD, BATCH_COMPLETE, QUALITY_ALERT, SCHEDULE_CHANGE)",
            example = "SOP_UPLOAD")
    @Size(max = 50, message = "触发类型长度不能超过50个字符")
    private String triggerType;

    @Schema(description = "触发实体 (SOP, SKU, ORDER, BATCH 等)", example = "SOP")
    @Size(max = 50, message = "触发实体长度不能超过50个字符")
    private String triggerEntity;

    @Schema(description = "工具链配置 (JSON 字符串)")
    private String toolChainConfig;

    @Schema(description = "是否使用 LLM 动态选择工具", example = "false")
    private Boolean useLlmSelection;

    @Schema(description = "LLM 选择工具的 Prompt")
    private String llmSelectionPrompt;

    @Schema(description = "条件表达式 (SpEL)", example = "${sopType} == 'PRODUCTION'")
    @Size(max = 500, message = "条件表达式长度不能超过500个字符")
    private String conditionExpression;

    @Schema(description = "优先级 (数值越小越优先匹配)", example = "100")
    private Integer priority;
}
