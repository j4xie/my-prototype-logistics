package com.cretas.aims.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 分类器结果 DTO
 *
 * 包含分类器返回的意图预测结果。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-26
 */
@Data
public class ClassifierResult {

    /**
     * 最高置信度的意图代码
     */
    private String intentCode;

    /**
     * 最高置信度
     */
    private double confidence;

    /**
     * 结果来源 (CLASSIFIER)
     */
    private String source = "CLASSIFIER";

    /**
     * 分类延迟（毫秒）
     */
    private long latencyMs;

    /**
     * Top-K 预测列表
     */
    private List<PredictionEntry> predictions = new ArrayList<>();

    /**
     * 单个预测条目
     */
    @Data
    public static class PredictionEntry {
        /**
         * 意图代码
         */
        private String intent;

        /**
         * 置信度
         */
        private double confidence;

        /**
         * 排名
         */
        private int rank;
    }

    /**
     * 获取指定排名的预测
     *
     * @param rank 排名（1-based）
     * @return 预测条目，如果不存在返回 null
     */
    public PredictionEntry getPredictionByRank(int rank) {
        return predictions.stream()
                .filter(p -> p.getRank() == rank)
                .findFirst()
                .orElse(null);
    }

    /**
     * 获取指定意图的置信度
     *
     * @param intentCode 意图代码
     * @return 置信度，如果不存在返回 -1
     */
    public double getConfidenceForIntent(String intentCode) {
        return predictions.stream()
                .filter(p -> p.getIntent().equals(intentCode))
                .mapToDouble(PredictionEntry::getConfidence)
                .findFirst()
                .orElse(-1);
    }

    /**
     * 检查是否包含指定意图
     *
     * @param intentCode 意图代码
     * @return 是否包含
     */
    public boolean containsIntent(String intentCode) {
        return predictions.stream()
                .anyMatch(p -> p.getIntent().equals(intentCode));
    }
}
