package com.cretas.aims.dto.clarification;

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
 * 指代消解结果 DTO
 *
 * 实现会话级指代消解：
 * - 识别代词："它"、"这个"、"那批"、"上面提到的"
 * - 从会话历史中查找指代对象
 * - 使用 LLM 辅助复杂指代消解
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReferenceResult {

    /**
     * 原始文本
     */
    private String originalText;

    /**
     * 消解后的文本
     */
    private String resolvedText;

    /**
     * 已解析的指代映射
     * key: 原始指代词, value: 解析后的实体/文本
     */
    @Builder.Default
    private Map<String, String> resolvedReferences = new HashMap<>();

    /**
     * 消解置信度 (0-1)
     */
    private double confidence;

    /**
     * 是否成功消解
     */
    private boolean resolved;

    /**
     * 未能消解的指代词列表
     */
    @Builder.Default
    private List<String> unresolvedReferences = new ArrayList<>();

    /**
     * 消解详情列表
     */
    @Builder.Default
    private List<ResolvedItem> resolvedItems = new ArrayList<>();

    /**
     * 消解方法
     */
    private ResolutionMethod resolutionMethod;

    /**
     * 处理耗时(ms)
     */
    private long processingTimeMs;

    /**
     * 处理时间戳
     */
    @Builder.Default
    private LocalDateTime processedAt = LocalDateTime.now();

    /**
     * 消解方法枚举
     */
    public enum ResolutionMethod {
        /**
         * 会话上下文消解（从最近对话中查找）
         */
        CONTEXT,

        /**
         * 实体槽位消解（从槽位缓存中查找）
         */
        SLOT,

        /**
         * LLM 辅助消解（调用大模型推理）
         */
        LLM,

        /**
         * 规则消解（基于规则映射）
         */
        RULE,

        /**
         * 混合消解（多种方法组合）
         */
        HYBRID,

        /**
         * 未消解
         */
        NONE
    }

    /**
     * 单个指代消解详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResolvedItem {
        /**
         * 原始指代词
         */
        private String reference;

        /**
         * 消解后的文本
         */
        private String resolvedTo;

        /**
         * 实体类型（如果是实体引用）
         */
        private String entityType;

        /**
         * 实体ID（如果是实体引用）
         */
        private String entityId;

        /**
         * 消解来源
         */
        private String source;

        /**
         * 消解置信度
         */
        private double confidence;

        /**
         * 消解方法
         */
        private ResolutionMethod method;

        /**
         * 原文中的位置（起始索引）
         */
        private int startIndex;

        /**
         * 原文中的位置（结束索引）
         */
        private int endIndex;
    }

    /**
     * 创建成功消解的结果
     */
    public static ReferenceResult success(
            String originalText,
            String resolvedText,
            Map<String, String> resolvedReferences,
            ResolutionMethod method,
            double confidence) {
        return ReferenceResult.builder()
                .originalText(originalText)
                .resolvedText(resolvedText)
                .resolvedReferences(resolvedReferences != null ? resolvedReferences : new HashMap<>())
                .resolved(true)
                .confidence(confidence)
                .resolutionMethod(method)
                .processedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建部分消解的结果
     */
    public static ReferenceResult partial(
            String originalText,
            String resolvedText,
            Map<String, String> resolvedReferences,
            List<String> unresolvedReferences,
            double confidence) {
        return ReferenceResult.builder()
                .originalText(originalText)
                .resolvedText(resolvedText)
                .resolvedReferences(resolvedReferences != null ? resolvedReferences : new HashMap<>())
                .unresolvedReferences(unresolvedReferences != null ? unresolvedReferences : new ArrayList<>())
                .resolved(true)
                .confidence(confidence)
                .resolutionMethod(ResolutionMethod.HYBRID)
                .processedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建无指代的结果（原文无指代词）
     */
    public static ReferenceResult noReference(String text) {
        return ReferenceResult.builder()
                .originalText(text)
                .resolvedText(text)
                .resolved(true)
                .confidence(1.0)
                .resolutionMethod(ResolutionMethod.NONE)
                .processedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建消解失败的结果
     */
    public static ReferenceResult failed(String originalText, List<String> unresolvedReferences) {
        return ReferenceResult.builder()
                .originalText(originalText)
                .resolvedText(originalText)
                .unresolvedReferences(unresolvedReferences != null ? unresolvedReferences : new ArrayList<>())
                .resolved(false)
                .confidence(0.0)
                .resolutionMethod(ResolutionMethod.NONE)
                .processedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 添加消解项
     */
    public void addResolvedItem(ResolvedItem item) {
        if (resolvedItems == null) {
            resolvedItems = new ArrayList<>();
        }
        resolvedItems.add(item);

        // 同步更新 resolvedReferences 映射
        if (resolvedReferences == null) {
            resolvedReferences = new HashMap<>();
        }
        resolvedReferences.put(item.getReference(), item.getResolvedTo());
    }

    /**
     * 添加未解析的指代
     */
    public void addUnresolvedReference(String reference) {
        if (unresolvedReferences == null) {
            unresolvedReferences = new ArrayList<>();
        }
        if (!unresolvedReferences.contains(reference)) {
            unresolvedReferences.add(reference);
        }
    }

    /**
     * 是否有未解析的指代
     */
    public boolean hasUnresolvedReferences() {
        return unresolvedReferences != null && !unresolvedReferences.isEmpty();
    }

    /**
     * 是否文本被修改
     */
    public boolean isModified() {
        return originalText != null && resolvedText != null && !originalText.equals(resolvedText);
    }

    /**
     * 获取消解数量
     */
    public int getResolutionCount() {
        return resolvedReferences != null ? resolvedReferences.size() : 0;
    }
}
