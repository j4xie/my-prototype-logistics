package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 意图分类响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassifierResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 原始输入文本
     */
    private String text;

    /**
     * 分类结果列表（按置信度降序）
     */
    private List<IntentResult> intents;

    /**
     * 最佳匹配意图
     */
    private IntentResult topIntent;

    /**
     * 错误消息（仅在失败时）
     */
    private String message;

    /**
     * 使用的设备（cuda/cpu）
     */
    private String device;

    /**
     * 单个意图结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntentResult {
        /**
         * 意图代码
         */
        private String intentCode;

        /**
         * 置信度（0-1）
         */
        private double confidence;

        /**
         * 标签 ID
         */
        private int labelId;
    }

    /**
     * 检查是否成功且有结果
     */
    public boolean hasResult() {
        return success && topIntent != null;
    }

    /**
     * 获取最佳匹配的意图代码
     */
    public String getTopIntentCode() {
        return topIntent != null ? topIntent.getIntentCode() : null;
    }

    /**
     * 获取最佳匹配的置信度
     */
    public double getTopConfidence() {
        return topIntent != null ? topIntent.getConfidence() : 0.0;
    }
}
