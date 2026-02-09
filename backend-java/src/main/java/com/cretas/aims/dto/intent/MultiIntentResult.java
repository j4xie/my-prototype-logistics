package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 多意图识别结果 - 存储复合意图的识别结果
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-16
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MultiIntentResult {

    /**
     * 执行策略枚举
     */
    public enum ExecutionStrategy {
        PARALLEL,       // 并行执行
        SEQUENTIAL,     // 串行执行
        USER_CONFIRM    // 用户确认后执行
    }

    /**
     * 是否为多意图
     */
    private boolean isMultiIntent;

    /**
     * 意图列表
     */
    private List<SingleIntentMatch> intents;

    /**
     * 执行策略
     */
    private ExecutionStrategy executionStrategy;

    /**
     * 总体置信度 (0.0 - 1.0)
     */
    private double overallConfidence;

    /**
     * 推理说明
     */
    private String reasoning;

    /**
     * 单个意图匹配结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SingleIntentMatch {
        /**
         * 意图编码
         */
        private String intentCode;

        /**
         * 意图名称
         */
        private String intentName;

        /**
         * 置信度 (0.0 - 1.0)
         */
        private double confidence;

        /**
         * 提取的参数
         */
        private Map<String, Object> extractedParams;

        /**
         * 推理说明
         */
        private String reasoning;

        /**
         * 执行顺序
         */
        private int executionOrder;
    }

    /**
     * 判断是否需要用户确认
     *
     * @return 如果需要用户确认返回true
     */
    public boolean requiresUserConfirmation() {
        return executionStrategy == ExecutionStrategy.USER_CONFIRM
            || overallConfidence < 0.7
            || (intents != null && intents.size() > 3);
    }
}
