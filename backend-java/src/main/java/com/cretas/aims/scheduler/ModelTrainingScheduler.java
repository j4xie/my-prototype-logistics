package com.cretas.aims.scheduler;

import com.cretas.aims.entity.ModelVersion;
import com.cretas.aims.repository.ModelVersionRepository;
import com.cretas.aims.repository.TrainingDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 模型训练调度器
 * 定期检查各工厂的训练数据量，在满足条件时触发模型训练
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ModelTrainingScheduler {

    private final TrainingDataRepository trainingDataRepository;
    private final ModelVersionRepository modelVersionRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${ml.training.min-data-count:50}")
    private int minTrainingDataCount;

    @Value("${ml.training.retrain-threshold:1.2}")
    private double retrainThreshold;

    @Value("${ml.training.enabled:true}")
    private boolean trainingEnabled;

    /**
     * 每天凌晨2点检查是否需要训练模型
     * cron: 秒 分 时 日 月 周
     */
    @Scheduled(cron = "${ml.training.schedule:0 0 2 * * ?}")
    public void scheduledTrainingCheck() {
        if (!trainingEnabled) {
            log.debug("模型训练已禁用，跳过定时检查");
            return;
        }

        log.info("开始定时模型训练检查...");

        try {
            checkAndTrainModels();
        } catch (Exception e) {
            log.error("定时模型训练检查失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 检查所有工厂并按需训练模型
     */
    public void checkAndTrainModels() {
        // 获取所有有训练数据的工厂
        List<String> factories = trainingDataRepository.findDistinctFactoryIds();

        log.info("发现 {} 个工厂有训练数据", factories.size());

        for (String factoryId : factories) {
            try {
                checkAndTrainFactory(factoryId);
            } catch (Exception e) {
                log.error("检查工厂 {} 训练状态失败: {}", factoryId, e.getMessage());
            }
        }
    }

    /**
     * 检查单个工厂是否需要训练
     */
    private void checkAndTrainFactory(String factoryId) {
        long dataCount = trainingDataRepository.countByFactoryId(factoryId);

        log.debug("工厂 {} 当前数据量: {}", factoryId, dataCount);

        if (dataCount < minTrainingDataCount) {
            log.debug("工厂 {} 数据量 {} 不足最小要求 {}，跳过",
                    factoryId, dataCount, minTrainingDataCount);
            return;
        }

        // 检查每种模型类型
        String[] modelTypes = {"efficiency", "duration", "quality"};

        for (String modelType : modelTypes) {
            if (needsTraining(factoryId, modelType, dataCount)) {
                triggerTraining(factoryId, List.of(modelType));
            }
        }
    }

    /**
     * 判断是否需要训练特定类型的模型
     */
    private boolean needsTraining(String factoryId, String modelType, long currentDataCount) {
        Optional<ModelVersion> modelOpt = modelVersionRepository
                .findByFactoryIdAndModelTypeAndIsActiveTrue(factoryId, modelType);

        if (modelOpt.isEmpty()) {
            // 没有该类型的模型，需要训练
            log.info("工厂 {} 无 {} 模型，需要训练", factoryId, modelType);
            return true;
        }

        ModelVersion model = modelOpt.get();

        // 检查模型质量
        if (!model.hasGoodQuality()) {
            log.info("工厂 {} 的 {} 模型质量不佳 (R²={}), 需要重新训练",
                    factoryId, modelType, model.getR2Score());
            return true;
        }

        // 检查数据量增长
        int trainedDataCount = model.getTrainingDataCount() != null
                ? model.getTrainingDataCount() : 0;

        if (currentDataCount > trainedDataCount * retrainThreshold) {
            log.info("工厂 {} 数据量从 {} 增长到 {}，超过阈值 {}，需要重新训练 {} 模型",
                    factoryId, trainedDataCount, currentDataCount, retrainThreshold, modelType);
            return true;
        }

        return false;
    }

    /**
     * 触发模型训练
     */
    public void triggerTraining(String factoryId, List<String> modelTypes) {
        log.info("触发工厂 {} 的模型训练，类型: {}", factoryId, modelTypes);

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("factory_id", factoryId);
            request.put("model_types", modelTypes);

            String url = aiServiceUrl + "/ml/train";
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);

            if (response != null) {
                Boolean success = (Boolean) response.get("success");
                if (Boolean.TRUE.equals(success)) {
                    log.info("工厂 {} 模型训练请求成功: {}", factoryId, response);

                    // 更新模型版本记录
                    updateModelVersionFromResponse(factoryId, modelTypes, response);
                } else {
                    log.warn("工厂 {} 模型训练请求失败: {}", factoryId, response.get("error"));
                }
            }
        } catch (Exception e) {
            log.error("触发工厂 {} 模型训练失败: {}", factoryId, e.getMessage(), e);
        }
    }

    /**
     * 根据训练响应更新模型版本
     */
    @SuppressWarnings("unchecked")
    private void updateModelVersionFromResponse(String factoryId, List<String> modelTypes,
                                                  Map<String, Object> response) {
        Map<String, Object> results = (Map<String, Object>) response.get("results");
        if (results == null) {
            return;
        }

        for (String modelType : modelTypes) {
            Map<String, Object> result = (Map<String, Object>) results.get(modelType);
            if (result == null || !Boolean.TRUE.equals(result.get("success"))) {
                continue;
            }

            try {
                // 停用旧模型
                modelVersionRepository.deactivateModelsByType(factoryId, modelType);

                // 创建新模型版本记录
                ModelVersion newVersion = ModelVersion.builder()
                        .factoryId(factoryId)
                        .modelType(modelType)
                        .version((String) result.get("version"))
                        .trainingDataCount(((Number) result.get("training_samples")).intValue())
                        .rmse(result.get("rmse") != null
                                ? new java.math.BigDecimal(result.get("rmse").toString()) : null)
                        .r2Score(result.get("r2_score") != null
                                ? new java.math.BigDecimal(result.get("r2_score").toString()) : null)
                        .modelPath((String) result.get("model_path"))
                        .isActive(true)
                        .status("trained")
                        .build();

                modelVersionRepository.save(newVersion);
                log.info("已保存工厂 {} 的 {} 模型新版本: {}", factoryId, modelType, newVersion.getVersion());

            } catch (Exception e) {
                log.error("保存模型版本记录失败: {}", e.getMessage(), e);
            }
        }
    }

    /**
     * 手动触发所有工厂的模型训练检查
     */
    public Map<String, Object> manualTrainingCheck() {
        Map<String, Object> result = new HashMap<>();
        List<String> factories = trainingDataRepository.findDistinctFactoryIds();

        result.put("factoriesChecked", factories.size());
        result.put("minDataCount", minTrainingDataCount);

        Map<String, Object> factoryStatus = new HashMap<>();
        for (String factoryId : factories) {
            long dataCount = trainingDataRepository.countByFactoryId(factoryId);
            boolean hasModel = modelVersionRepository
                    .existsByFactoryIdAndModelTypeAndIsActiveTrue(factoryId, "efficiency");

            Map<String, Object> status = new HashMap<>();
            status.put("dataCount", dataCount);
            status.put("hasEfficiencyModel", hasModel);
            status.put("meetsMinimum", dataCount >= minTrainingDataCount);

            factoryStatus.put(factoryId, status);

            // 如果满足条件，触发训练
            if (dataCount >= minTrainingDataCount) {
                checkAndTrainFactory(factoryId);
                status.put("trainingTriggered", true);
            }
        }

        result.put("factories", factoryStatus);
        return result;
    }

    /**
     * 获取训练状态摘要
     */
    public Map<String, Object> getTrainingStatus() {
        Map<String, Object> status = new HashMap<>();

        List<String> factories = trainingDataRepository.findDistinctFactoryIds();
        List<String> factoriesWithModels = modelVersionRepository.findDistinctFactoryIdsWithActiveModels();

        status.put("totalFactories", factories.size());
        status.put("factoriesWithModels", factoriesWithModels.size());
        status.put("trainingEnabled", trainingEnabled);
        status.put("minDataCount", minTrainingDataCount);
        status.put("retrainThreshold", retrainThreshold);

        return status;
    }
}
