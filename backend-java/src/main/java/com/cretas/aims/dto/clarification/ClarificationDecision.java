package com.cretas.aims.dto.clarification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 澄清决策 DTO
 *
 * 智能判断是否需要触发澄清机制：
 * - 检查业务关键词（时间、物料名、数量）
 * - 区分"模糊但可推断"和"确实缺失信息"
 * - 只在真正缺少必要信息时触发澄清
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClarificationDecision {

    /**
     * 是否需要澄清
     */
    private boolean needClarification;

    /**
     * 澄清原因
     */
    private String reason;

    /**
     * 缺失的槽位列表
     */
    @Builder.Default
    private List<String> missingSlots = new ArrayList<>();

    /**
     * 不进行澄清时的置信度
     * 表示直接执行的风险程度 (0-1)
     * - 高置信度: 可直接执行
     * - 低置信度: 建议澄清但不强制
     */
    private double confidenceWithoutClarification;

    /**
     * 澄清类型
     */
    private ClarificationType clarificationType;

    /**
     * 推荐的澄清问题
     */
    @Builder.Default
    private List<String> suggestedQuestions = new ArrayList<>();

    /**
     * 已检测到的实体信息
     * key: 槽位名称, value: 检测到的值
     */
    @Builder.Default
    private Map<String, Object> detectedEntities = new HashMap<>();

    /**
     * 推断的默认值
     * key: 槽位名称, value: 推断的默认值
     */
    @Builder.Default
    private Map<String, Object> inferredDefaults = new HashMap<>();

    /**
     * 澄清优先级 (1-10, 10 最高)
     * 用于决定是否打断用户流程
     */
    @Builder.Default
    private int priority = 5;

    /**
     * 是否可以使用推断值继续执行
     */
    private boolean canProceedWithInference;

    /**
     * 推断说明（如果使用推断值）
     */
    private String inferenceExplanation;

    /**
     * 澄清类型枚举
     */
    public enum ClarificationType {
        /**
         * 时间缺失
         */
        MISSING_TIME,

        /**
         * 物料/实体缺失
         */
        MISSING_ENTITY,

        /**
         * 操作不明确
         */
        AMBIGUOUS_ACTION,

        /**
         * 参数不完整
         */
        INCOMPLETE_PARAMS,

        /**
         * 指代未解析
         */
        UNRESOLVED_REFERENCE,

        /**
         * 多意图歧义
         */
        MULTI_INTENT_AMBIGUITY,

        /**
         * 无需澄清
         */
        NONE
    }

    /**
     * 创建不需要澄清的决策
     */
    public static ClarificationDecision noNeed(double confidence) {
        return ClarificationDecision.builder()
                .needClarification(false)
                .confidenceWithoutClarification(confidence)
                .clarificationType(ClarificationType.NONE)
                .canProceedWithInference(true)
                .build();
    }

    /**
     * 创建需要澄清的决策
     */
    public static ClarificationDecision need(
            ClarificationType type,
            String reason,
            List<String> missingSlots,
            double confidence) {
        return ClarificationDecision.builder()
                .needClarification(true)
                .reason(reason)
                .missingSlots(missingSlots != null ? missingSlots : new ArrayList<>())
                .confidenceWithoutClarification(confidence)
                .clarificationType(type)
                .canProceedWithInference(false)
                .build();
    }

    /**
     * 创建可推断但建议澄清的决策
     */
    public static ClarificationDecision inferrable(
            ClarificationType type,
            String reason,
            Map<String, Object> inferredDefaults,
            String inferenceExplanation,
            double confidence) {
        return ClarificationDecision.builder()
                .needClarification(false) // 不强制澄清
                .reason(reason)
                .confidenceWithoutClarification(confidence)
                .clarificationType(type)
                .inferredDefaults(inferredDefaults != null ? inferredDefaults : new HashMap<>())
                .canProceedWithInference(true)
                .inferenceExplanation(inferenceExplanation)
                .priority(3) // 低优先级，可选澄清
                .build();
    }

    /**
     * 添加检测到的实体
     */
    public void addDetectedEntity(String slotName, Object value) {
        if (detectedEntities == null) {
            detectedEntities = new HashMap<>();
        }
        detectedEntities.put(slotName, value);
    }

    /**
     * 添加推断的默认值
     */
    public void addInferredDefault(String slotName, Object value) {
        if (inferredDefaults == null) {
            inferredDefaults = new HashMap<>();
        }
        inferredDefaults.put(slotName, value);
    }

    /**
     * 添加建议问题
     */
    public void addSuggestedQuestion(String question) {
        if (suggestedQuestions == null) {
            suggestedQuestions = new ArrayList<>();
        }
        suggestedQuestions.add(question);
    }

    /**
     * 添加缺失槽位
     */
    public void addMissingSlot(String slotName) {
        if (missingSlots == null) {
            missingSlots = new ArrayList<>();
        }
        if (!missingSlots.contains(slotName)) {
            missingSlots.add(slotName);
        }
    }

    /**
     * 是否有缺失槽位
     */
    public boolean hasMissingSlots() {
        return missingSlots != null && !missingSlots.isEmpty();
    }

    /**
     * 是否有推断默认值
     */
    public boolean hasInferredDefaults() {
        return inferredDefaults != null && !inferredDefaults.isEmpty();
    }
}
