package com.cretas.aims.service;

import com.cretas.aims.config.SyntheticDataConfig;
import com.cretas.aims.entity.learning.SampleSource;
import com.cretas.aims.entity.learning.TrainingSample;
import com.cretas.aims.repository.learning.TrainingSampleRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 混合训练数据服务 (EnvScaler)
 *
 * 负责获取带权重的混合训练数据 (真实 + 合成)，
 * 应用配置的权重和比例限制。
 *
 * 核心功能:
 * 1. 获取真实样本 (权重 = 1.0)
 * 2. 获取合成样本 (权重 = synthetic_weight * confidence * grape_score)
 * 3. 应用比例限制 (max_ratio = 0.8)
 * 4. 导出加权训练数据
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MixedTrainingDataService {

    private final TrainingSampleRepository trainingSampleRepository;
    private final SyntheticDataConfig syntheticDataConfig;

    /**
     * 默认最低置信度阈值
     */
    private static final BigDecimal DEFAULT_MIN_CONFIDENCE = new BigDecimal("0.6");

    // ==================== 数据类 ====================

    /**
     * 带权重的训练样本
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeightedTrainingSample {
        /**
         * 用户输入
         */
        private String userInput;

        /**
         * 意图代码
         */
        private String intentCode;

        /**
         * 样本来源
         */
        private SampleSource source;

        /**
         * 训练权重 (真实样本=1.0, 合成样本=配置权重*置信度*GRAPE分数)
         */
        private double weight;

        /**
         * 原始样本ID (可选)
         */
        private Long sampleId;

        /**
         * 是否为合成样本
         */
        public boolean isSynthetic() {
            return SampleSource.SYNTHETIC.equals(source);
        }
    }

    /**
     * 混合训练数据集
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MixedTrainingDataSet {
        /**
         * 工厂ID
         */
        private String factoryId;

        /**
         * 所有加权样本
         */
        private List<WeightedTrainingSample> samples;

        /**
         * 真实样本数
         */
        private int realCount;

        /**
         * 合成样本数 (包含在训练集中的)
         */
        private int syntheticCount;

        /**
         * 合成样本总数 (数据库中的)
         */
        private int syntheticTotal;

        /**
         * 配置的最大合成比例
         */
        private double maxRatio;

        /**
         * 实际合成比例
         */
        private double actualRatio;

        /**
         * 配置的合成权重
         */
        private double syntheticWeight;

        /**
         * 总有效权重 (考虑权重后的等效样本数)
         */
        private double totalEffectiveWeight;

        /**
         * 获取总样本数
         */
        public int getTotalCount() {
            return realCount + syntheticCount;
        }
    }

    // ==================== 核心方法 ====================

    /**
     * 获取混合训练数据集
     *
     * @param factoryId     工厂ID
     * @param minConfidence 最低置信度 (可选，默认0.6)
     * @return 带权重的混合训练数据集
     */
    @Transactional(readOnly = true)
    public MixedTrainingDataSet getMixedTrainingData(String factoryId, BigDecimal minConfidence) {
        if (minConfidence == null) {
            minConfidence = DEFAULT_MIN_CONFIDENCE;
        }

        log.info("获取工厂 {} 的混合训练数据, 最低置信度: {}", factoryId, minConfidence);

        // 获取所有符合条件的样本
        List<TrainingSample> allSamples = trainingSampleRepository
                .findMixedTrainingReady(factoryId, minConfidence);

        // 分离真实和合成样本
        List<TrainingSample> realSamples = new ArrayList<>();
        List<TrainingSample> syntheticSamples = new ArrayList<>();

        for (TrainingSample sample : allSamples) {
            if (sample.isSynthetic()) {
                syntheticSamples.add(sample);
            } else {
                realSamples.add(sample);
            }
        }

        int realCount = realSamples.size();
        int syntheticTotal = syntheticSamples.size();

        log.debug("原始样本数: 真实={}, 合成={}", realCount, syntheticTotal);

        // 应用比例限制
        double maxRatio = syntheticDataConfig.getMaxRatio();
        int maxSyntheticAllowed = calculateMaxSyntheticAllowed(realCount, maxRatio);
        int syntheticUsed = Math.min(syntheticTotal, maxSyntheticAllowed);

        // 如果合成样本超过限制，取最高 GRAPE 分数的样本
        List<TrainingSample> selectedSynthetic;
        if (syntheticUsed < syntheticTotal) {
            selectedSynthetic = syntheticSamples.stream()
                    .sorted((a, b) -> {
                        BigDecimal scoreA = a.getGrapeScore() != null ? a.getGrapeScore() : BigDecimal.ZERO;
                        BigDecimal scoreB = b.getGrapeScore() != null ? b.getGrapeScore() : BigDecimal.ZERO;
                        return scoreB.compareTo(scoreA);  // 降序
                    })
                    .limit(syntheticUsed)
                    .collect(Collectors.toList());
            log.info("合成样本超过限制, 取 GRAPE 分数最高的 {} 个 (总共 {})", syntheticUsed, syntheticTotal);
        } else {
            selectedSynthetic = syntheticSamples;
        }

        // 转换为带权重的样本
        double syntheticBaseWeight = syntheticDataConfig.getSyntheticWeight();
        List<WeightedTrainingSample> weightedSamples = new ArrayList<>();
        double totalEffectiveWeight = 0.0;

        // 添加真实样本 (权重 = 1.0)
        for (TrainingSample sample : realSamples) {
            WeightedTrainingSample weighted = WeightedTrainingSample.builder()
                    .userInput(sample.getUserInput())
                    .intentCode(sample.getTrainingLabel())
                    .source(SampleSource.REAL)
                    .weight(1.0)
                    .sampleId(sample.getId())
                    .build();
            weightedSamples.add(weighted);
            totalEffectiveWeight += 1.0;
        }

        // 添加合成样本 (权重 = base_weight * confidence * grape_score)
        for (TrainingSample sample : selectedSynthetic) {
            double weight = sample.getTrainingWeight(syntheticBaseWeight);
            WeightedTrainingSample weighted = WeightedTrainingSample.builder()
                    .userInput(sample.getUserInput())
                    .intentCode(sample.getTrainingLabel())
                    .source(SampleSource.SYNTHETIC)
                    .weight(weight)
                    .sampleId(sample.getId())
                    .build();
            weightedSamples.add(weighted);
            totalEffectiveWeight += weight;
        }

        // 计算实际比例
        int totalCount = realCount + syntheticUsed;
        double actualRatio = totalCount > 0 ? (double) syntheticUsed / totalCount : 0;

        MixedTrainingDataSet dataSet = MixedTrainingDataSet.builder()
                .factoryId(factoryId)
                .samples(weightedSamples)
                .realCount(realCount)
                .syntheticCount(syntheticUsed)
                .syntheticTotal(syntheticTotal)
                .maxRatio(maxRatio)
                .actualRatio(actualRatio)
                .syntheticWeight(syntheticBaseWeight)
                .totalEffectiveWeight(totalEffectiveWeight)
                .build();

        log.info("混合训练数据准备完成: 真实={}, 合成={}(使用)/{}(总), 实际比例={:.1f}%, 有效权重={:.2f}",
                realCount, syntheticUsed, syntheticTotal, actualRatio * 100, totalEffectiveWeight);

        return dataSet;
    }

    /**
     * 导出混合训练数据 (用于 AI 服务)
     *
     * @param factoryId     工厂ID
     * @param minConfidence 最低置信度
     * @return 导出格式: List of [userInput, intentCode, weight]
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportMixedTrainingData(String factoryId, BigDecimal minConfidence) {
        MixedTrainingDataSet dataSet = getMixedTrainingData(factoryId, minConfidence);

        return dataSet.getSamples().stream()
                .map(sample -> {
                    Map<String, Object> row = new HashMap<>();
                    row.put("userInput", sample.getUserInput());
                    row.put("intentCode", sample.getIntentCode());
                    row.put("weight", sample.getWeight());
                    row.put("source", sample.getSource().name());
                    return row;
                })
                .collect(Collectors.toList());
    }

    /**
     * 获取混合训练数据统计
     *
     * @param factoryId     工厂ID
     * @param minConfidence 最低置信度
     * @return 统计信息
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getMixedTrainingStats(String factoryId, BigDecimal minConfidence) {
        if (minConfidence == null) {
            minConfidence = DEFAULT_MIN_CONFIDENCE;
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("factoryId", factoryId);
        stats.put("minConfidence", minConfidence);

        // 获取按来源统计
        List<Object[]> sourceStats = trainingSampleRepository
                .countMixedTrainingBySource(factoryId, minConfidence);

        long realCount = 0;
        long syntheticCount = 0;

        for (Object[] row : sourceStats) {
            String source = row[0] != null ? row[0].toString() : "REAL";
            long count = ((Number) row[1]).longValue();

            if ("SYNTHETIC".equals(source)) {
                syntheticCount = count;
            } else {
                realCount = count;
            }
        }

        long totalCount = realCount + syntheticCount;
        double maxRatio = syntheticDataConfig.getMaxRatio();
        int maxSyntheticAllowed = calculateMaxSyntheticAllowed((int) realCount, maxRatio);

        stats.put("realCount", realCount);
        stats.put("syntheticCount", syntheticCount);
        stats.put("totalCount", totalCount);
        stats.put("maxRatio", maxRatio);
        stats.put("syntheticWeight", syntheticDataConfig.getSyntheticWeight());
        stats.put("maxSyntheticAllowed", maxSyntheticAllowed);
        stats.put("currentRatio", totalCount > 0 ? (double) syntheticCount / totalCount : 0);
        stats.put("canUseAllSynthetic", syntheticCount <= maxSyntheticAllowed);

        return stats;
    }

    // ==================== 私有方法 ====================

    /**
     * 计算允许的最大合成样本数
     *
     * 给定真实样本数 R 和最大比例 maxRatio，
     * 计算允许的最大合成样本数 S，使得 S/(R+S) <= maxRatio
     *
     * 推导: S/(R+S) <= maxRatio
     *       S <= maxRatio * (R + S)
     *       S <= maxRatio * R + maxRatio * S
     *       S - maxRatio * S <= maxRatio * R
     *       S * (1 - maxRatio) <= maxRatio * R
     *       S <= maxRatio * R / (1 - maxRatio)
     *
     * @param realCount 真实样本数
     * @param maxRatio  最大合成比例
     * @return 允许的最大合成样本数
     */
    private int calculateMaxSyntheticAllowed(int realCount, double maxRatio) {
        if (maxRatio >= 1.0) {
            return Integer.MAX_VALUE;  // 无限制
        }
        if (maxRatio <= 0.0) {
            return 0;  // 不允许合成数据
        }
        return (int) Math.floor(realCount * maxRatio / (1 - maxRatio));
    }
}
