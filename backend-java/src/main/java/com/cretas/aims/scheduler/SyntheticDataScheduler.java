package com.cretas.aims.scheduler;

import com.cretas.aims.ai.synthetic.SyntheticDataConfig;
import com.cretas.aims.ai.synthetic.SyntheticDataService;
import com.cretas.aims.ai.synthetic.SyntheticDataService.SyntheticDataStats;
import com.cretas.aims.ai.synthetic.SyntheticDataService.SyntheticGenerationResult;
import com.cretas.aims.entity.intent.FactoryAILearningConfig;
import com.cretas.aims.repository.FactoryAILearningConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 合成数据生成调度器
 *
 * 定期为启用合成数据的工厂生成训练样本，
 * 在模型训练调度器（每天凌晨2点）之前运行，确保训练数据充足。
 *
 * @author Cretas Team
 * @since 2026-01-22
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SyntheticDataScheduler {

    private final SyntheticDataService syntheticDataService;
    private final SyntheticDataConfig syntheticDataConfig;
    private final FactoryAILearningConfigRepository factoryAILearningConfigRepository;

    /**
     * 是否启用定时合成数据生成
     */
    @Value("${ai.synthetic.enabled:true}")
    private boolean syntheticEnabled;

    /**
     * 每个意图默认生成的样本数
     */
    @Value("${ai.synthetic.samples-per-intent:20}")
    private int defaultSamplesPerIntent;

    /**
     * 最后一次执行时间
     */
    private LocalDateTime lastExecutionTime;

    /**
     * 最后一次执行结果
     */
    private Map<String, Object> lastExecutionResult;

    /**
     * 每天凌晨1点生成合成数据
     * 在模型训练（凌晨2点）之前运行，确保训练数据充足
     *
     * cron: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 1 * * ?")
    public void dailySyntheticGeneration() {
        if (!syntheticEnabled) {
            log.debug("合成数据生成已禁用，跳过定时任务");
            return;
        }

        if (!syntheticDataConfig.isEnabled()) {
            log.debug("合成数据配置已禁用，跳过定时任务");
            return;
        }

        log.info("========== 开始定时合成数据生成任务 ==========");
        long startTime = System.currentTimeMillis();

        try {
            // 获取所有启用合成数据的工厂
            List<FactoryAILearningConfig> enabledFactories = factoryAILearningConfigRepository
                    .findBySyntheticEnabledTrue();

            log.info("发现 {} 个工厂启用了合成数据生成", enabledFactories.size());

            Map<String, Object> executionResult = new HashMap<>();
            List<Map<String, Object>> factoryResults = new ArrayList<>();
            int totalSavedSamples = 0;
            int successCount = 0;
            int failureCount = 0;

            for (FactoryAILearningConfig factoryConfig : enabledFactories) {
                String factoryId = factoryConfig.getFactoryId();
                try {
                    log.info("开始为工厂 {} 生成合成数据...", factoryId);

                    // 为工厂的所有意图生成合成数据
                    List<SyntheticGenerationResult> results = syntheticDataService
                            .generateForAllIntents(factoryId, defaultSamplesPerIntent);

                    // 汇总结果
                    int factorySaved = results.stream()
                            .mapToInt(SyntheticGenerationResult::getSaved)
                            .sum();
                    int factoryGenerated = results.stream()
                            .mapToInt(SyntheticGenerationResult::getGenerated)
                            .sum();
                    long successIntents = results.stream()
                            .filter(SyntheticGenerationResult::isSuccess)
                            .count();

                    Map<String, Object> factoryResult = new HashMap<>();
                    factoryResult.put("factoryId", factoryId);
                    factoryResult.put("intentsProcessed", results.size());
                    factoryResult.put("successIntents", successIntents);
                    factoryResult.put("totalGenerated", factoryGenerated);
                    factoryResult.put("totalSaved", factorySaved);
                    factoryResults.add(factoryResult);

                    totalSavedSamples += factorySaved;
                    successCount++;

                    log.info("工厂 {} 合成数据生成完成: 处理 {} 个意图, 成功 {}, 保存 {} 个样本",
                            factoryId, results.size(), successIntents, factorySaved);

                } catch (Exception e) {
                    log.error("工厂 {} 合成数据生成失败: {}", factoryId, e.getMessage(), e);
                    failureCount++;

                    Map<String, Object> factoryResult = new HashMap<>();
                    factoryResult.put("factoryId", factoryId);
                    factoryResult.put("error", e.getMessage());
                    factoryResults.add(factoryResult);
                }
            }

            long duration = System.currentTimeMillis() - startTime;

            // 记录执行结果
            executionResult.put("executionTime", LocalDateTime.now());
            executionResult.put("factoriesProcessed", enabledFactories.size());
            executionResult.put("successCount", successCount);
            executionResult.put("failureCount", failureCount);
            executionResult.put("totalSavedSamples", totalSavedSamples);
            executionResult.put("durationMs", duration);
            executionResult.put("factories", factoryResults);

            this.lastExecutionTime = LocalDateTime.now();
            this.lastExecutionResult = executionResult;

            log.info("========== 定时合成数据生成任务完成 ==========");
            log.info("处理工厂数: {}, 成功: {}, 失败: {}, 总保存样本: {}, 耗时: {}ms",
                    enabledFactories.size(), successCount, failureCount, totalSavedSamples, duration);

        } catch (Exception e) {
            log.error("定时合成数据生成任务异常: {}", e.getMessage(), e);

            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("executionTime", LocalDateTime.now());
            errorResult.put("error", e.getMessage());
            this.lastExecutionTime = LocalDateTime.now();
            this.lastExecutionResult = errorResult;
        }
    }

    /**
     * 手动触发指定工厂的合成数据生成
     *
     * @param factoryId 工厂ID
     * @return 生成结果
     */
    public Map<String, Object> manualTrigger(String factoryId) {
        log.info("手动触发工厂 {} 的合成数据生成", factoryId);
        Map<String, Object> result = new HashMap<>();

        try {
            // 检查全局开关
            if (!syntheticDataConfig.isEnabled()) {
                result.put("success", false);
                result.put("message", "合成数据生成已被全局禁用");
                return result;
            }

            // 检查工厂是否启用合成数据
            FactoryAILearningConfig factoryConfig = factoryAILearningConfigRepository
                    .findByFactoryId(factoryId)
                    .orElse(null);

            if (factoryConfig == null) {
                result.put("success", false);
                result.put("message", "工厂 " + factoryId + " 未配置AI学习");
                return result;
            }

            if (!factoryConfig.isSyntheticEnabled()) {
                result.put("success", false);
                result.put("message", "工厂 " + factoryId + " 未启用合成数据生成");
                if (factoryConfig.getSyntheticDisabledReason() != null) {
                    result.put("disabledReason", factoryConfig.getSyntheticDisabledReason());
                }
                return result;
            }

            // 执行生成
            long startTime = System.currentTimeMillis();
            List<SyntheticGenerationResult> generationResults = syntheticDataService
                    .generateForAllIntents(factoryId, defaultSamplesPerIntent);

            // 汇总结果
            int totalSaved = generationResults.stream()
                    .mapToInt(SyntheticGenerationResult::getSaved)
                    .sum();
            int totalGenerated = generationResults.stream()
                    .mapToInt(SyntheticGenerationResult::getGenerated)
                    .sum();
            long successIntents = generationResults.stream()
                    .filter(SyntheticGenerationResult::isSuccess)
                    .count();
            long duration = System.currentTimeMillis() - startTime;

            result.put("success", true);
            result.put("factoryId", factoryId);
            result.put("intentsProcessed", generationResults.size());
            result.put("successIntents", successIntents);
            result.put("totalGenerated", totalGenerated);
            result.put("totalSaved", totalSaved);
            result.put("durationMs", duration);
            result.put("details", generationResults);

            log.info("工厂 {} 手动触发合成数据生成完成: 处理 {} 个意图, 保存 {} 个样本",
                    factoryId, generationResults.size(), totalSaved);

        } catch (Exception e) {
            log.error("手动触发工厂 {} 合成数据生成失败", factoryId, e);
            result.put("success", false);
            result.put("message", "生成失败: " + e.getMessage());
        }

        return result;
    }

    /**
     * 获取合成数据生成状态
     *
     * @return 状态信息
     */
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new HashMap<>();

        // 全局配置状态
        status.put("schedulerEnabled", syntheticEnabled);
        status.put("configEnabled", syntheticDataConfig.isEnabled());
        status.put("defaultSamplesPerIntent", defaultSamplesPerIntent);

        // 工厂统计
        long enabledCount = factoryAILearningConfigRepository.countSyntheticEnabledFactories();
        long disabledCount = factoryAILearningConfigRepository.countSyntheticDisabledFactories();
        status.put("syntheticEnabledFactories", enabledCount);
        status.put("syntheticDisabledFactories", disabledCount);

        // 最后执行信息
        status.put("lastExecutionTime", lastExecutionTime);
        status.put("lastExecutionResult", lastExecutionResult);

        // 各工厂的合成数据统计
        List<String> enabledFactoryIds = factoryAILearningConfigRepository.findSyntheticEnabledFactoryIds();
        List<Map<String, Object>> factoryStats = new ArrayList<>();

        for (String factoryId : enabledFactoryIds) {
            try {
                SyntheticDataStats stats = syntheticDataService.getStats(factoryId);
                Map<String, Object> factoryStat = new HashMap<>();
                factoryStat.put("factoryId", factoryId);
                factoryStat.put("realSampleCount", stats.getRealSampleCount());
                factoryStat.put("syntheticSampleCount", stats.getSyntheticSampleCount());
                factoryStat.put("syntheticRatio", stats.getSyntheticRatio());
                factoryStat.put("maxAllowedRatio", stats.getMaxAllowedRatio());
                factoryStat.put("canGenerateMore", stats.canGenerateMore());
                factoryStats.add(factoryStat);
            } catch (Exception e) {
                log.warn("获取工厂 {} 统计信息失败: {}", factoryId, e.getMessage());
            }
        }

        status.put("factoryStats", factoryStats);

        return status;
    }
}
