package com.cretas.aims.ai.synthetic;

import com.cretas.aims.ai.synthetic.IntentSkelBuilder.IntentSkel;
import com.cretas.aims.ai.synthetic.IntentScenGenerator.SyntheticSample;
import com.cretas.aims.config.SyntheticDataConfig;
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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 合成数据生成服务 (EnvScaler)
 *
 * 负责编排合成数据生成流程:
 * 1. 构建意图骨架 (IntentSkelBuilder)
 * 2. 生成候选样本 (IntentScenGenerator)
 * 3. 验证样本有效性 (IntentValidator)
 * 4. GRAPE 筛选分布偏移风险 (GRAPEFilter)
 * 5. 持久化到 TrainingSample
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyntheticDataService {

    private final IntentSkelBuilder intentSkelBuilder;
    private final IntentScenGenerator intentScenGenerator;
    private final IntentValidator intentValidator;
    private final GRAPEFilter grapeFilter;
    private final TrainingSampleRepository trainingSampleRepository;
    private final SyntheticDataConfig syntheticDataConfig;

    // ==================== 生成结果 ====================

    /**
     * 合成数据生成结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyntheticGenerationResult {
        /**
         * 生成的候选样本数
         */
        private int generated;

        /**
         * 通过验证的样本数
         */
        private int validated;

        /**
         * GRAPE 筛选后的样本数
         */
        private int filtered;

        /**
         * 最终保存的样本数
         */
        private int saved;

        /**
         * 使用的骨架ID
         */
        private String skeletonId;

        /**
         * 生成耗时 (毫秒)
         */
        private long durationMs;

        /**
         * 错误信息 (如果有)
         */
        private String errorMessage;

        /**
         * 是否成功
         */
        public boolean isSuccess() {
            return errorMessage == null && saved > 0;
        }

        /**
         * 获取验证通过率
         */
        public double getValidationRate() {
            return generated > 0 ? (double) validated / generated : 0;
        }

        /**
         * 获取 GRAPE 筛选通过率
         */
        public double getFilterRate() {
            return validated > 0 ? (double) filtered / validated : 0;
        }
    }

    // ==================== 核心方法 ====================

    /**
     * 为指定意图生成合成数据
     *
     * @param intentCode  意图代码
     * @param factoryId   工厂ID
     * @param targetCount 目标生成数量
     * @return 生成结果
     */
    @Transactional
    public SyntheticGenerationResult generateForIntent(String intentCode, String factoryId, int targetCount) {
        long startTime = System.currentTimeMillis();
        log.info("开始为意图 {} 生成合成数据, 工厂: {}, 目标数量: {}", intentCode, factoryId, targetCount);

        try {
            // 检查合成数据比例限制
            if (!checkRatioLimit(factoryId)) {
                log.warn("工厂 {} 的合成数据比例已达上限，跳过生成", factoryId);
                return SyntheticGenerationResult.builder()
                        .generated(0)
                        .validated(0)
                        .filtered(0)
                        .saved(0)
                        .errorMessage("合成数据比例已达上限: " + syntheticDataConfig.getMaxSyntheticRatio())
                        .durationMs(System.currentTimeMillis() - startTime)
                        .build();
            }

            // Step 1: 构建意图骨架
            IntentSkel skeleton = intentSkelBuilder.buildFromHistory(intentCode, factoryId);
            if (skeleton == null) {
                log.warn("无法为意图 {} 构建骨架", intentCode);
                return SyntheticGenerationResult.builder()
                        .generated(0)
                        .validated(0)
                        .filtered(0)
                        .saved(0)
                        .errorMessage("无法构建意图骨架")
                        .durationMs(System.currentTimeMillis() - startTime)
                        .build();
            }
            String skeletonId = skeleton.getSkeletonId();
            log.debug("构建骨架成功: {}", skeletonId);

            // Step 2: 生成 3x 候选样本
            int candidateCount = targetCount * syntheticDataConfig.getCandidateMultiplier();
            List<SyntheticSample> candidates = intentScenGenerator.generate(skeleton, candidateCount);
            int generated = candidates.size();
            log.debug("生成候选样本: {} 个", generated);

            if (generated == 0) {
                return SyntheticGenerationResult.builder()
                        .generated(0)
                        .validated(0)
                        .filtered(0)
                        .saved(0)
                        .skeletonId(skeletonId)
                        .errorMessage("生成候选样本失败")
                        .durationMs(System.currentTimeMillis() - startTime)
                        .build();
            }

            // Step 3: 验证样本有效性
            List<SyntheticSample> validatedSamples = candidates.stream()
                    .filter(sample -> intentValidator.validate(sample).isValid())
                    .collect(Collectors.toList());
            int validated = validatedSamples.size();
            log.debug("验证通过样本: {} 个 (通过率: {:.2f}%)", validated,
                    generated > 0 ? (validated * 100.0 / generated) : 0);

            // Step 4: GRAPE 筛选
            List<SyntheticSample> filteredSamples = grapeFilter.filter(validatedSamples);
            int filtered = filteredSamples.size();
            log.debug("GRAPE 筛选通过: {} 个 (通过率: {:.2f}%)", filtered,
                    validated > 0 ? (filtered * 100.0 / validated) : 0);

            // Step 5: 限制最终数量并转换为 TrainingSample
            List<SyntheticSample> finalSamples = filteredSamples.stream()
                    .limit(targetCount)
                    .collect(Collectors.toList());

            List<TrainingSample> trainingSamples = finalSamples.stream()
                    .map(sample -> toTrainingSample(sample, factoryId))
                    .collect(Collectors.toList());

            // Step 6: 保存到数据库
            List<TrainingSample> savedSamples = trainingSampleRepository.saveAll(trainingSamples);
            int saved = savedSamples.size();

            long duration = System.currentTimeMillis() - startTime;
            log.info("意图 {} 合成数据生成完成: 生成={}, 验证={}, 筛选={}, 保存={}, 耗时={}ms",
                    intentCode, generated, validated, filtered, saved, duration);

            return SyntheticGenerationResult.builder()
                    .generated(generated)
                    .validated(validated)
                    .filtered(filtered)
                    .saved(saved)
                    .skeletonId(skeletonId)
                    .durationMs(duration)
                    .build();

        } catch (Exception e) {
            log.error("为意图 {} 生成合成数据失败", intentCode, e);
            return SyntheticGenerationResult.builder()
                    .generated(0)
                    .validated(0)
                    .filtered(0)
                    .saved(0)
                    .errorMessage("生成失败: " + e.getMessage())
                    .durationMs(System.currentTimeMillis() - startTime)
                    .build();
        }
    }

    /**
     * 将 SyntheticSample 转换为 TrainingSample 实体
     *
     * @param synthetic 合成样本
     * @param factoryId 工厂ID
     * @return TrainingSample 实体
     */
    private TrainingSample toTrainingSample(SyntheticSample synthetic, String factoryId) {
        TrainingSample sample = TrainingSample.createSynthetic(
                factoryId,
                synthetic.getUserInput(),
                synthetic.getIntentCode(),
                synthetic.getGeneratorConfidence(),
                synthetic.getSkeletonId()
        );

        // 设置 GRAPE 分数
        if (synthetic.getGrapeScore() != null) {
            sample.setGrapeScoreValue(synthetic.getGrapeScore().doubleValue());
        }

        // 显式确保 isStrongSignal 不为 null (Lombok Builder 可能有问题)
        sample.setIsStrongSignal(false);

        return sample;
    }

    /**
     * 为工厂的所有意图生成合成数据
     *
     * @param factoryId        工厂ID
     * @param samplesPerIntent 每个意图的目标样本数
     * @return 所有意图的生成结果列表
     */
    @Transactional
    public List<SyntheticGenerationResult> generateForAllIntents(String factoryId, int samplesPerIntent) {
        log.info("开始为工厂 {} 的所有意图生成合成数据, 每个意图 {} 个", factoryId, samplesPerIntent);

        // 获取工厂的所有意图代码
        List<String> intentCodes = intentSkelBuilder.getAvailableIntentCodes(factoryId);
        log.info("找到 {} 个意图需要生成合成数据", intentCodes.size());

        List<SyntheticGenerationResult> results = new ArrayList<>();
        int totalSaved = 0;

        for (String intentCode : intentCodes) {
            // 检查全局比例限制
            if (!checkRatioLimit(factoryId)) {
                log.warn("工厂 {} 的合成数据比例已达上限，停止生成", factoryId);
                break;
            }

            SyntheticGenerationResult result = generateForIntent(intentCode, factoryId, samplesPerIntent);
            results.add(result);
            totalSaved += result.getSaved();

            // 批次间隔，避免资源过载
            if (syntheticDataConfig.getBatchIntervalMs() > 0) {
                try {
                    Thread.sleep(syntheticDataConfig.getBatchIntervalMs());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("生成过程被中断");
                    break;
                }
            }
        }

        log.info("工厂 {} 合成数据生成完成: 处理 {} 个意图, 共保存 {} 个样本",
                factoryId, results.size(), totalSaved);

        return results;
    }

    /**
     * 检查合成数据比例是否在限制内
     *
     * @param factoryId 工厂ID
     * @return true 如果还可以继续生成合成数据
     */
    public boolean checkRatioLimit(String factoryId) {
        double maxRatio = syntheticDataConfig.getMaxSyntheticRatio();
        if (maxRatio >= 1.0) {
            // 无限制
            return true;
        }

        LocalDateTime since = LocalDateTime.now().minusDays(syntheticDataConfig.getRatioCalculationDays());
        List<Object[]> sourceStats = trainingSampleRepository.countBySource(factoryId, since);

        long realCount = 0;
        long syntheticCount = 0;

        for (Object[] stat : sourceStats) {
            String source = stat[0] != null ? stat[0].toString() : "REAL";
            long count = ((Number) stat[1]).longValue();

            if ("SYNTHETIC".equals(source)) {
                syntheticCount = count;
            } else {
                realCount = count;
            }
        }

        long totalCount = realCount + syntheticCount;
        if (totalCount == 0) {
            // 无样本时允许生成
            return true;
        }

        double currentRatio = (double) syntheticCount / totalCount;
        boolean withinLimit = currentRatio < maxRatio;

        if (!withinLimit) {
            log.debug("工厂 {} 合成数据比例检查: 当前 {:.2f}%, 上限 {:.2f}%, 不允许继续生成",
                    factoryId, currentRatio * 100, maxRatio * 100);
        }

        return withinLimit;
    }

    // ==================== 统计方法 ====================

    /**
     * 获取合成数据统计信息
     *
     * @param factoryId 工厂ID
     * @return 统计信息
     */
    public SyntheticDataStats getStats(String factoryId) {
        LocalDateTime since = LocalDateTime.now().minusDays(syntheticDataConfig.getRatioCalculationDays());
        List<Object[]> sourceStats = trainingSampleRepository.countBySource(factoryId, since);

        long realCount = 0;
        long syntheticCount = 0;

        for (Object[] stat : sourceStats) {
            String source = stat[0] != null ? stat[0].toString() : "REAL";
            long count = ((Number) stat[1]).longValue();

            if ("SYNTHETIC".equals(source)) {
                syntheticCount = count;
            } else {
                realCount = count;
            }
        }

        // 获取 GRAPE 分数分布
        List<Object[]> grapeDistribution = trainingSampleRepository.getGrapeScoreDistribution(factoryId);

        return SyntheticDataStats.builder()
                .factoryId(factoryId)
                .realSampleCount(realCount)
                .syntheticSampleCount(syntheticCount)
                .syntheticRatio(realCount + syntheticCount > 0
                        ? (double) syntheticCount / (realCount + syntheticCount) : 0)
                .maxAllowedRatio(syntheticDataConfig.getMaxSyntheticRatio())
                .grapeDistribution(grapeDistribution)
                .calculationPeriodDays(syntheticDataConfig.getRatioCalculationDays())
                .build();
    }

    /**
     * 合成数据统计信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyntheticDataStats {
        private String factoryId;
        private long realSampleCount;
        private long syntheticSampleCount;
        private double syntheticRatio;
        private double maxAllowedRatio;
        private List<Object[]> grapeDistribution;
        private int calculationPeriodDays;

        /**
         * 是否可以继续生成
         */
        public boolean canGenerateMore() {
            return syntheticRatio < maxAllowedRatio;
        }

        /**
         * 获取总样本数
         */
        public long getTotalSampleCount() {
            return realSampleCount + syntheticSampleCount;
        }
    }
}
