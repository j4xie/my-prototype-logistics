package com.cretas.aims.entity.config;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;

import javax.persistence.*;
import java.util.List;

/**
 * 审批链路配置实体
 *
 * 用于配置化审批流程：
 * - 什么操作需要审批
 * - 谁有权审批
 * - 多级审批规则
 * - 升级规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
@Entity
@Table(name = "approval_chain_configs",
       uniqueConstraints = @UniqueConstraint(columnNames = {"factory_id", "decision_type", "name"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalChainConfig extends BaseEntity {

    @Id
    @GeneratedValue(generator = "uuid2")
    @org.hibernate.annotations.GenericGenerator(name = "uuid2", strategy = "uuid2")
    @Column(length = 36)
    private String id;

    /**
     * 工厂ID
     */
    @Column(name = "factory_id", nullable = false, length = 50)
    private String factoryId;

    /**
     * 决策类型
     * 如：FORCE_INSERT, QUALITY_RELEASE, SUPPLIER_APPROVAL, BATCH_STATUS_CHANGE
     */
    @Column(name = "decision_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private DecisionType decisionType;

    /**
     * 配置名称
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 配置描述
     */
    @Column(name = "description", length = 500)
    private String description;

    /**
     * 触发条件 (JSON格式的规则表达式)
     * 例如: {"impactLevel": "HIGH", "delayMinutes": ">60"}
     */
    @Column(name = "trigger_condition", columnDefinition = "TEXT")
    private String triggerCondition;

    /**
     * 审批级别 (1=一级审批, 2=二级审批, ...)
     */
    @Column(name = "approval_level", nullable = false)
    private Integer approvalLevel;

    /**
     * 必需审批人数 (如2表示需要至少2人审批)
     */
    @Column(name = "required_approvers")
    @Builder.Default
    private Integer requiredApprovers = 1;

    /**
     * 可审批角色列表 (JSON数组)
     * 例如: ["factory_super_admin", "department_admin"]
     */
    @Column(name = "approver_roles", columnDefinition = "TEXT")
    private String approverRoles;

    /**
     * 可审批用户ID列表 (JSON数组，可选)
     */
    @Column(name = "approver_user_ids", columnDefinition = "TEXT")
    private String approverUserIds;

    /**
     * 超时时间 (分钟)
     */
    @Column(name = "timeout_minutes")
    private Integer timeoutMinutes;

    /**
     * 超时后升级到的配置ID
     */
    @Column(name = "escalation_config_id", length = 36)
    private String escalationConfigId;

    /**
     * 自动审批条件 (JSON格式)
     * 满足条件时可自动审批通过
     */
    @Column(name = "auto_approve_condition", columnDefinition = "TEXT")
    private String autoApproveCondition;

    /**
     * 自动拒绝条件 (JSON格式)
     */
    @Column(name = "auto_reject_condition", columnDefinition = "TEXT")
    private String autoRejectCondition;

    /**
     * 优先级 (数值越大优先级越高)
     */
    @Column(name = "priority")
    @Builder.Default
    private Integer priority = 0;

    /**
     * 是否启用
     */
    @Column(name = "enabled")
    @Builder.Default
    private Boolean enabled = true;

    /**
     * 配置版本
     */
    @Column(name = "version")
    @Builder.Default
    private Integer version = 1;

    /**
     * 决策类型枚举
     */
    public enum DecisionType {
        /**
         * 强制插单
         */
        FORCE_INSERT,

        /**
         * 质检放行
         */
        QUALITY_RELEASE,

        /**
         * 质检特批
         */
        QUALITY_EXCEPTION,

        /**
         * 批次状态变更
         */
        BATCH_STATUS_CHANGE,

        /**
         * 供应商准入
         */
        SUPPLIER_APPROVAL,

        /**
         * 供应商状态变更 (暂停/恢复)
         */
        SUPPLIER_STATUS_CHANGE,

        /**
         * 原材料处置 (报废/冻结)
         */
        MATERIAL_DISPOSAL,

        /**
         * 生产计划变更
         */
        PRODUCTION_PLAN_CHANGE,

        /**
         * 设备状态变更
         */
        EQUIPMENT_STATUS_CHANGE,

        /**
         * 其他自定义
         */
        CUSTOM
    }
}
