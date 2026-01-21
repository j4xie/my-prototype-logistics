package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import org.hibernate.annotations.GenericGenerator;

import javax.persistence.*;

/**
 * AI Agent 规则配置实体
 *
 * <p>用于配置 AI Agent 的触发条件和工具链，支持事件驱动的自动化处理。
 *
 * <p>触发类型：
 * <ul>
 *   <li>SOP_UPLOAD: SOP 文档上传时触发</li>
 *   <li>BATCH_COMPLETE: 生产批次完成时触发</li>
 *   <li>QUALITY_ALERT: 质量告警时触发</li>
 *   <li>SCHEDULE_CHANGE: 排产变更时触发</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity(name = "AiAgentRule")
@Table(name = "ai_agent_rules",
       indexes = {
           @Index(name = "idx_agent_rule_factory", columnList = "factory_id"),
           @Index(name = "idx_agent_rule_trigger", columnList = "trigger_type, trigger_entity"),
           @Index(name = "idx_agent_rule_active", columnList = "is_active"),
           @Index(name = "idx_agent_rule_priority", columnList = "priority")
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AiAgentRule extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(length = 36)
    private String id;

    /**
     * 工厂ID，DEFAULT表示全局规则
     */
    @Builder.Default
    @Column(name = "factory_id", length = 50)
    private String factoryId = "DEFAULT";

    /**
     * 触发类型
     * SOP_UPLOAD, SKU_CREATE, MANUAL
     */
    @Column(name = "trigger_type", nullable = false, length = 50)
    private String triggerType;

    /**
     * 触发实体
     * SOP, SKU, ORDER
     */
    @Column(name = "trigger_entity", length = 50)
    private String triggerEntity;

    /**
     * 规则名称
     */
    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;

    /**
     * 规则描述
     */
    @Column(name = "rule_description", columnDefinition = "TEXT")
    private String ruleDescription;

    /**
     * 工具链配置 (JSON 对象)
     * 格式:
     * {
     *   "executionOrder": "SEQUENTIAL",
     *   "tools": [
     *     {
     *       "toolName": "sop_parse_document",
     *       "order": 1,
     *       "paramsMapping": {"fileUrl": "${input.fileUrl}"},
     *       "outputKey": "parsedSop"
     *     }
     *   ]
     * }
     */
    @Column(name = "tool_chain_config", columnDefinition = "JSON", nullable = false)
    private String toolChainConfig;

    /**
     * 是否使用LLM动态选择工具
     */
    @Builder.Default
    @Column(name = "use_llm_selection")
    private Boolean useLlmSelection = false;

    /**
     * LLM选择工具的Prompt
     */
    @Column(name = "llm_selection_prompt", columnDefinition = "TEXT")
    private String llmSelectionPrompt;

    /**
     * 条件表达式 (SpEL)
     * 如：${sopType} == "PRODUCTION"
     */
    @Column(name = "condition_expression", length = 500)
    private String conditionExpression;

    /**
     * 优先级（数值越小越优先匹配）
     */
    @Builder.Default
    @Column(name = "priority")
    private Integer priority = 100;

    /**
     * 是否启用
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    // ==================== 触发类型常量 ====================

    public static final String TRIGGER_SOP_UPLOAD = "SOP_UPLOAD";
    public static final String TRIGGER_BATCH_COMPLETE = "BATCH_COMPLETE";
    public static final String TRIGGER_QUALITY_ALERT = "QUALITY_ALERT";
    public static final String TRIGGER_SCHEDULE_CHANGE = "SCHEDULE_CHANGE";

    // ==================== 失败策略常量 ====================

    public static final String FAILURE_CONTINUE = "CONTINUE";
    public static final String FAILURE_STOP = "STOP";
    public static final String FAILURE_RETRY = "RETRY";
}
