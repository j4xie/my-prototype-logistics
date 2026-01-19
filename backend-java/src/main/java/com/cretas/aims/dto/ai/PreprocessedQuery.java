package com.cretas.aims.dto.ai;

import com.cretas.aims.config.TimeNormalizationRules.TimeRange;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 预处理后的查询
 *
 * 包含查询预处理的所有结果：
 * - 原始输入和处理后文本
 * - 归一化的时间范围
 * - 解析的实体引用
 * - 质量评估分数
 * - LLM 改写结果（如果触发）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreprocessedQuery {

    // ==================== 输入输出 ====================

    /**
     * 原始用户输入
     */
    private String originalInput;

    /**
     * 规则预处理后的文本
     */
    private String normalizedText;

    /**
     * LLM 改写后的文本（如果有）
     */
    private String rewrittenText;

    /**
     * 最终使用的查询文本
     * 优先级: rewrittenText > normalizedText > originalInput
     */
    private String finalQuery;

    // ==================== 时间归一化结果 ====================

    /**
     * 提取的时间范围列表
     */
    @Builder.Default
    private List<TimeRange> extractedTimeRanges = new ArrayList<>();

    /**
     * 主要时间范围（第一个或最相关的）
     */
    private TimeRange primaryTimeRange;

    /**
     * 原始时间表达式列表
     */
    @Builder.Default
    private List<String> originalTimeExpressions = new ArrayList<>();

    // ==================== 口语标准化结果 ====================

    /**
     * 找到的口语表达
     */
    @Builder.Default
    private List<String> foundColloquials = new ArrayList<>();

    /**
     * 标准化后的表达
     */
    @Builder.Default
    private List<String> standardizedExpressions = new ArrayList<>();

    // ==================== 指代消解结果 ====================

    /**
     * 解析的实体引用映射
     * key: 指代词/代词, value: 解析后的实体
     */
    @Builder.Default
    private Map<String, ResolvedReference> resolvedReferences = new HashMap<>();

    /**
     * 未解析的指代词列表
     */
    @Builder.Default
    private List<String> unresolvedReferences = new ArrayList<>();

    // ==================== 质量评估 ====================

    /**
     * 查询质量分数 (0-1)
     */
    @Builder.Default
    private double qualityScore = 1.0;

    /**
     * 质量评估详情
     */
    private QualityAssessment qualityAssessment;

    // ==================== LLM 改写信息 ====================

    /**
     * 是否触发了 LLM 改写
     */
    private boolean llmRewriteTriggered;

    /**
     * LLM 改写的变更说明
     */
    @Builder.Default
    private List<String> rewriteChanges = new ArrayList<>();

    /**
     * LLM 改写的假设说明
     */
    @Builder.Default
    private List<String> rewriteAssumptions = new ArrayList<>();

    /**
     * LLM 改写置信度
     */
    private Double rewriteConfidence;

    // ==================== 处理元数据 ====================

    /**
     * 处理时间戳
     */
    @Builder.Default
    private LocalDateTime processedAt = LocalDateTime.now();

    /**
     * 处理耗时(ms)
     */
    private Long processingTimeMs;

    /**
     * 处理步骤记录
     */
    @Builder.Default
    private List<ProcessingStep> processingSteps = new ArrayList<>();

    // ==================== 便捷方法 ====================

    /**
     * 获取最终查询文本
     */
    public String getFinalQuery() {
        if (finalQuery != null && !finalQuery.isEmpty()) {
            return finalQuery;
        }
        if (rewrittenText != null && !rewrittenText.isEmpty()) {
            return rewrittenText;
        }
        if (normalizedText != null && !normalizedText.isEmpty()) {
            return normalizedText;
        }
        return originalInput;
    }

    /**
     * 是否进行了文本修改
     */
    public boolean isModified() {
        return !originalInput.equals(getFinalQuery());
    }

    /**
     * 是否有时间范围
     */
    public boolean hasTimeRange() {
        return primaryTimeRange != null ||
               (extractedTimeRanges != null && !extractedTimeRanges.isEmpty());
    }

    /**
     * 是否有未解析的引用
     */
    public boolean hasUnresolvedReferences() {
        return unresolvedReferences != null && !unresolvedReferences.isEmpty();
    }

    /**
     * 是否需要 LLM 改写（基于质量分数）
     */
    public boolean needsLlmRewrite(double threshold) {
        return qualityScore < threshold;
    }

    /**
     * 添加处理步骤
     */
    public void addProcessingStep(String stepName, String description, long durationMs) {
        if (processingSteps == null) {
            processingSteps = new ArrayList<>();
        }
        processingSteps.add(ProcessingStep.of(stepName, description, durationMs));
    }

    /**
     * 添加解析的引用
     */
    public void addResolvedReference(String reference, String entityType, String entityId, String entityName) {
        if (resolvedReferences == null) {
            resolvedReferences = new HashMap<>();
        }
        resolvedReferences.put(reference, ResolvedReference.of(entityType, entityId, entityName, reference));
    }

    /**
     * 添加未解析的引用
     */
    public void addUnresolvedReference(String reference) {
        if (unresolvedReferences == null) {
            unresolvedReferences = new ArrayList<>();
        }
        if (!unresolvedReferences.contains(reference)) {
            unresolvedReferences.add(reference);
        }
    }

    // ==================== 内部类 ====================

    /**
     * 解析的引用
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor(staticName = "of")
    public static class ResolvedReference {
        /** 实体类型 */
        private String entityType;
        /** 实体ID */
        private String entityId;
        /** 实体名称 */
        private String entityName;
        /** 原始引用文本 */
        private String originalReference;
    }

    /**
     * 质量评估结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QualityAssessment {
        /**
         * 总分 (0-1)
         */
        private double totalScore;

        /**
         * 长度评分 (0-1)
         * 过短 (<5字) 扣分
         */
        private double lengthScore;

        /**
         * 指代完整性评分 (0-1)
         * 未解析指代词扣分
         */
        private double referenceScore;

        /**
         * 时间明确性评分 (0-1)
         * 模糊时间未指定范围扣分
         */
        private double timeScore;

        /**
         * 结构完整性评分 (0-1)
         * 是否包含动词+名词结构
         */
        private double structureScore;

        /**
         * 扣分原因列表
         */
        @Builder.Default
        private List<String> deductionReasons = new ArrayList<>();

        /**
         * 改进建议列表
         */
        @Builder.Default
        private List<String> improvementSuggestions = new ArrayList<>();

        /**
         * 添加扣分原因
         */
        public void addDeductionReason(String reason) {
            if (deductionReasons == null) {
                deductionReasons = new ArrayList<>();
            }
            deductionReasons.add(reason);
        }

        /**
         * 添加改进建议
         */
        public void addSuggestion(String suggestion) {
            if (improvementSuggestions == null) {
                improvementSuggestions = new ArrayList<>();
            }
            improvementSuggestions.add(suggestion);
        }
    }

    /**
     * 处理步骤记录
     */
    @Data
    @AllArgsConstructor(staticName = "of")
    public static class ProcessingStep {
        /** 步骤名称 */
        private String stepName;
        /** 步骤描述 */
        private String description;
        /** 耗时(ms) */
        private long durationMs;
    }

    // ==================== 静态工厂方法 ====================

    /**
     * 创建仅包含原始输入的预处理结果（未做任何处理）
     */
    public static PreprocessedQuery passThrough(String input) {
        return PreprocessedQuery.builder()
                .originalInput(input)
                .normalizedText(input)
                .finalQuery(input)
                .qualityScore(1.0)
                .processedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建初始化的预处理结果（用于后续填充）
     *
     * @param input 原始输入
     * @return 初始化的 PreprocessedQuery 实例
     */
    public static PreprocessedQuery createInitial(String input) {
        return PreprocessedQuery.builder()
                .originalInput(input)
                .processedAt(LocalDateTime.now())
                .build();
    }
}
