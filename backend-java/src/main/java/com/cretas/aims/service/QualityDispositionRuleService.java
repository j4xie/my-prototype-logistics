package com.cretas.aims.service;

import com.cretas.aims.entity.QualityInspection;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 质检处置规则服务接口
 *
 * 根据质检结果评估并确定处置动作：
 * - 放行 (RELEASE)
 * - 条件放行 (CONDITIONAL_RELEASE)
 * - 返工 (REWORK)
 * - 报废 (SCRAP)
 * - 特批申请 (SPECIAL_APPROVAL)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-30
 */
public interface QualityDispositionRuleService {

    /**
     * 评估质检结果并返回推荐处置动作
     *
     * @param factoryId 工厂ID
     * @param inspection 质检记录
     * @return 处置评估结果
     */
    DispositionResult evaluateDisposition(String factoryId, QualityInspection inspection);

    /**
     * 评估质检结果（带额外上下文）
     *
     * @param factoryId 工厂ID
     * @param inspection 质检记录
     * @param context 额外上下文信息
     * @return 处置评估结果
     */
    DispositionResult evaluateDisposition(
            String factoryId,
            QualityInspection inspection,
            Map<String, Object> context
    );

    /**
     * 检查是否可以直接放行（无需审批）
     *
     * @param factoryId 工厂ID
     * @param inspection 质检记录
     * @return 是否可直接放行
     */
    boolean canDirectRelease(String factoryId, QualityInspection inspection);

    /**
     * 检查是否需要特批流程
     *
     * @param factoryId 工厂ID
     * @param inspection 质检记录
     * @param requestedAction 请求的处置动作
     * @return 是否需要特批
     */
    boolean requiresSpecialApproval(
            String factoryId,
            QualityInspection inspection,
            DispositionAction requestedAction
    );

    /**
     * 执行处置动作
     *
     * @param factoryId 工厂ID
     * @param inspection 质检记录
     * @param action 处置动作
     * @param executorId 执行人ID
     * @param reason 处置原因
     * @return 执行结果
     */
    DispositionExecutionResult executeDisposition(
            String factoryId,
            QualityInspection inspection,
            DispositionAction action,
            Long executorId,
            String reason
    );

    /**
     * 处置动作枚举
     */
    enum DispositionAction {
        /**
         * 直接放行 - 质检合格
         */
        RELEASE("放行"),

        /**
         * 条件放行 - 有限期或有条件使用
         */
        CONDITIONAL_RELEASE("条件放行"),

        /**
         * 返工 - 可修复的不合格
         */
        REWORK("返工"),

        /**
         * 报废 - 无法修复的严重不合格
         */
        SCRAP("报废"),

        /**
         * 特批申请 - 超出常规规则，需要高级审批
         */
        SPECIAL_APPROVAL("特批申请"),

        /**
         * 待定 - 需要进一步检测或评估
         */
        HOLD("待定");

        private final String description;

        DispositionAction(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 处置评估结果
     */
    @Data
    @Builder
    class DispositionResult {
        /**
         * 推荐的处置动作
         */
        private DispositionAction recommendedAction;

        /**
         * 是否需要审批
         */
        private boolean requiresApproval;

        /**
         * 触发的规则名称
         */
        private String triggeredRuleName;

        /**
         * 规则配置ID
         */
        private String ruleConfigId;

        /**
         * 规则版本
         */
        private Integer ruleVersion;

        /**
         * 置信度 (0-100)
         */
        private BigDecimal confidence;

        /**
         * 评估理由
         */
        private String reason;

        /**
         * 可选的备选动作
         */
        private DispositionAction[] alternativeActions;

        /**
         * 评估上下文（用于审计）
         */
        private Map<String, Object> evaluationContext;
    }

    /**
     * 处置执行结果
     */
    @Data
    @Builder
    class DispositionExecutionResult {
        /**
         * 是否执行成功
         */
        private boolean success;

        /**
         * 执行的动作
         */
        private DispositionAction executedAction;

        /**
         * 是否已启动审批流程
         */
        private boolean approvalInitiated;

        /**
         * 审批请求ID（如果启动了审批）
         */
        private String approvalRequestId;

        /**
         * 审计日志ID
         */
        private String auditLogId;

        /**
         * 执行消息
         */
        private String message;

        /**
         * 批次新状态
         */
        private String newBatchStatus;
    }
}
