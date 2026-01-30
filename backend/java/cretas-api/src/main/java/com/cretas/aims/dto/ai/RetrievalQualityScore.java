package com.cretas.aims.dto.ai;

/**
 * 检索质量评分枚举 (CRAG 核心)
 *
 * 用于评估检索结果的相关性。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public enum RetrievalQualityScore {

    /**
     * 正确 - 高相关性 (>0.8)
     * 处理方式: 直接使用检索结果
     */
    CORRECT("正确", 0.8, 1.0),

    /**
     * 模糊 - 中等相关性 (0.5-0.8)
     * 处理方式: 知识分解 + 过滤
     */
    AMBIGUOUS("模糊", 0.5, 0.8),

    /**
     * 错误 - 低相关性 (<0.5)
     * 处理方式: 丢弃 + 触发补充检索
     */
    INCORRECT("错误", 0.0, 0.5);

    private final String displayName;
    private final double minScore;
    private final double maxScore;

    RetrievalQualityScore(String displayName, double minScore, double maxScore) {
        this.displayName = displayName;
        this.minScore = minScore;
        this.maxScore = maxScore;
    }

    public String getDisplayName() {
        return displayName;
    }

    /**
     * 根据分数返回质量等级
     */
    public static RetrievalQualityScore fromScore(double score) {
        if (score >= 0.8) return CORRECT;
        if (score >= 0.5) return AMBIGUOUS;
        return INCORRECT;
    }
}
