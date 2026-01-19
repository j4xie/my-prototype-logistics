package com.cretas.aims.dto.preprocess;

import com.cretas.aims.dto.conversation.EntitySlot;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 预处理后的查询 - 存储用户输入经过预处理后的结果
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreprocessedQuery {

    /**
     * 原始用户输入
     */
    private String originalInput;

    /**
     * 处理后的输入
     */
    private String processedInput;

    /**
     * 重写后的查询
     */
    private String rewrittenQuery;

    /**
     * 是否经过重写
     */
    private boolean wasRewritten;

    /**
     * 所做的修改列表
     */
    private List<String> changesMade;

    /**
     * 假设列表
     */
    private List<String> assumptions;

    /**
     * 质量分数 (0.0 - 1.0)
     */
    private double qualityScore;

    /**
     * 提取的参数
     */
    private Map<String, Object> extractedParams;

    /**
     * 解析的引用映射
     */
    private Map<EntitySlot.SlotType, String> resolvedReferences;

    /**
     * 标准化的时间范围
     */
    private TimeRange normalizedTimeRange;

    /**
     * 重写置信度 (0.0 - 1.0)
     */
    private double rewriteConfidence;

    /**
     * 时间范围内部类
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeRange {
        /**
         * 开始时间
         */
        private LocalDateTime start;

        /**
         * 结束时间
         */
        private LocalDateTime end;

        /**
         * 原始表达式
         */
        private String originalExpression;
    }
}
