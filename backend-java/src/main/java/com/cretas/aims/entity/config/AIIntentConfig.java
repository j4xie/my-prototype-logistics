package com.cretas.aims.entity.config;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;

import javax.persistence.*;

/**
 * AI意图配置实体
 *
 * 用于配置化管理AI服务的意图识别:
 * - 定义不同类型的AI问题意图
 * - 配置敏感度级别和审批要求
 * - 管理角色权限和配额消耗
 * - 支持关键词匹配规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Entity
@Table(name = "ai_intent_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"intent_code"}),
       indexes = {
           @Index(name = "idx_intent_category", columnList = "intent_category"),
           @Index(name = "idx_intent_sensitivity", columnList = "sensitivity_level"),
           @Index(name = "idx_intent_is_active", columnList = "is_active")
       })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIIntentConfig extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @org.hibernate.annotations.GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(length = 36)
    private String id;

    /**
     * 意图代码 (唯一标识)
     * 如: COST_ANALYSIS, BATCH_UPDATE, FORM_GENERATION, SCHEDULE_OPTIMIZATION
     */
    @Column(name = "intent_code", nullable = false, length = 50)
    private String intentCode;

    /**
     * 意图名称 (显示用)
     * 如: 成本分析, 批次更新, 表单生成, 排程优化
     */
    @Column(name = "intent_name", nullable = false, length = 100)
    private String intentName;

    /**
     * 意图分类
     * ANALYSIS - 数据分析类 (只读)
     * DATA_OP - 数据操作类 (可能修改数据)
     * FORM - 表单生成类
     * SCHEDULE - 排程相关
     * SYSTEM - 系统管理类
     */
    @Column(name = "intent_category", length = 50)
    private String intentCategory;

    /**
     * 敏感度级别
     * LOW - 低敏感 (普通查询)
     * MEDIUM - 中敏感 (业务分析)
     * HIGH - 高敏感 (数据修改)
     * CRITICAL - 关键操作 (需要审批)
     */
    @Column(name = "sensitivity_level", length = 20)
    @Builder.Default
    private String sensitivityLevel = "LOW";

    /**
     * 允许的角色列表 (JSON数组)
     * 如: ["factory_super_admin", "dispatcher", "manager"]
     * 空数组或null表示所有角色都可以
     */
    @Column(name = "required_roles", columnDefinition = "JSON")
    private String requiredRoles;

    /**
     * 配额消耗值
     * 每次调用消耗的配额单位
     */
    @Column(name = "quota_cost")
    @Builder.Default
    private Integer quotaCost = 1;

    /**
     * 缓存有效期 (分钟)
     * 0 = 不缓存
     */
    @Column(name = "cache_ttl_minutes")
    @Builder.Default
    private Integer cacheTtlMinutes = 0;

    /**
     * 是否需要审批
     * 仅CRITICAL级别生效
     */
    @Column(name = "requires_approval")
    @Builder.Default
    private Boolean requiresApproval = false;

    /**
     * 审批链ID (关联ApprovalChainConfig)
     */
    @Column(name = "approval_chain_id", length = 36)
    private String approvalChainId;

    /**
     * 触发关键词列表 (JSON数组)
     * 用于意图识别的关键词匹配
     * 如: ["成本", "分析", "预算", "费用"]
     */
    @Column(name = "keywords", columnDefinition = "JSON")
    private String keywords;

    /**
     * 正则匹配规则 (可选)
     * 用于更精确的意图匹配
     */
    @Column(name = "regex_pattern", length = 500)
    private String regexPattern;

    /**
     * 意图描述
     */
    @Column(name = "description", length = 500)
    private String description;

    /**
     * 处理器类名 (可选)
     * 用于路由到特定的处理方法
     * 如: CostAnalysisHandler, FormGenerationHandler
     */
    @Column(name = "handler_class", length = 200)
    private String handlerClass;

    /**
     * 最大响应token数
     */
    @Column(name = "max_tokens")
    @Builder.Default
    private Integer maxTokens = 2000;

    /**
     * 响应模板 (可选的Prompt模板)
     */
    @Column(name = "response_template", columnDefinition = "TEXT")
    private String responseTemplate;

    /**
     * 是否启用
     */
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    /**
     * 优先级 (用于多个意图匹配时的优先级)
     * 数值越高优先级越高
     */
    @Column(name = "priority")
    @Builder.Default
    private Integer priority = 0;

    /**
     * 扩展元数据 (JSON)
     */
    @Column(name = "metadata", columnDefinition = "JSON")
    private String metadata;

    /**
     * 判断是否需要管理员权限
     */
    public boolean requiresAdminRole() {
        return "HIGH".equals(sensitivityLevel) || "CRITICAL".equals(sensitivityLevel);
    }

    /**
     * 判断是否为数据修改类操作
     */
    public boolean isDataOperation() {
        return "DATA_OP".equals(intentCategory);
    }

    /**
     * 判断是否需要审批流程
     */
    public boolean needsApproval() {
        return Boolean.TRUE.equals(requiresApproval) && "CRITICAL".equals(sensitivityLevel);
    }
}
