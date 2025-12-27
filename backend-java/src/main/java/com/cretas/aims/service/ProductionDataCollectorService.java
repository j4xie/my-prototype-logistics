package com.cretas.aims.service;

import com.cretas.aims.entity.*;
import com.cretas.aims.event.BatchCompletedEvent;
import com.cretas.aims.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 生产数据收集服务
 * 负责在批次完成时收集训练数据，并检查是否需要触发模型训练
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProductionDataCollectorService {

    private final TrainingDataRepository trainingDataRepository;
    private final ModelVersionRepository modelVersionRepository;
    private final BatchWorkSessionRepository batchWorkSessionRepository;
    private final UserRepository userRepository;
    private final EquipmentRepository equipmentRepository;
    private final ProductTypeRepository productTypeRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    @Value("${ml.training.min-data-count:50}")
    private int minTrainingDataCount;

    @Value("${ml.training.retrain-threshold:1.2}")
    private double retrainThreshold;

    /**
     * 监听批次完成事件，异步收集训练数据
     */
    @Async
    @EventListener
    @Transactional
    public void onBatchCompleted(BatchCompletedEvent event) {
        ProductionBatch batch = event.getBatch();
        String factoryId = event.getFactoryId();
        Long batchId = event.getBatchId();

        log.info("收到批次完成事件: factoryId={}, batchId={}", factoryId, batchId);

        try {
            // 检查是否已有记录，避免重复
            if (trainingDataRepository.existsByFactoryIdAndBatchId(factoryId, batchId)) {
                log.info("批次 {} 的训练数据已存在，跳过", batchId);
                return;
            }

            // 收集特征数据
            TrainingDataRecord record = collectTrainingData(batch, event.getCompletedAt());

            // 保存记录
            trainingDataRepository.save(record);
            log.info("已保存批次 {} 的训练数据记录", batchId);

            // 检查是否需要触发训练
            checkAndTriggerTraining(factoryId);

        } catch (Exception e) {
            log.error("收集批次 {} 训练数据失败: {}", batchId, e.getMessage(), e);
        }
    }

    /**
     * 收集批次的训练数据
     */
    private TrainingDataRecord collectTrainingData(ProductionBatch batch, LocalDateTime completedAt) {
        String factoryId = batch.getFactoryId();

        // 获取参与该批次的工人列表
        List<BatchWorkSession> workSessions = batchWorkSessionRepository.findByBatchId(batch.getId());

        // 计算工人特征
        WorkerFeatures workerFeatures = calculateWorkerFeatures(workSessions, factoryId);

        // 计算产品复杂度
        int productComplexity = getProductComplexity(batch.getProductTypeId());

        // 计算设备特征
        EquipmentFeatures equipmentFeatures = calculateEquipmentFeatures(batch.getEquipmentId());

        // 计算实际效率 (件/人/小时)
        BigDecimal actualEfficiency = calculateActualEfficiency(batch, workerFeatures.workerCount);

        // 计算实际工时
        BigDecimal actualDurationHours = calculateActualDuration(batch);

        // 计算质量合格率
        BigDecimal qualityPassRate = calculateQualityPassRate(batch);

        return TrainingDataRecord.builder()
                .factoryId(factoryId)
                .batchId(batch.getId())
                // 时间特征
                .hourOfDay(completedAt.getHour())
                .dayOfWeek(completedAt.getDayOfWeek().getValue())
                .isOvertime(completedAt.getHour() >= 18 || completedAt.getHour() < 6)
                // 工人特征
                .workerCount(workerFeatures.workerCount)
                .avgWorkerExperienceDays(workerFeatures.avgExperienceDays)
                .avgSkillLevel(workerFeatures.avgSkillLevel)
                .temporaryWorkerRatio(workerFeatures.temporaryWorkerRatio)
                // 产品特征
                .productComplexity(productComplexity)
                .productType(batch.getProductTypeId())
                // 设备特征
                .equipmentAgeDays(equipmentFeatures.ageDays)
                .equipmentUtilization(equipmentFeatures.utilization)
                // 实际结果 (标签)
                .actualEfficiency(actualEfficiency)
                .actualDurationHours(actualDurationHours)
                .qualityPassRate(qualityPassRate)
                // 元数据
                .recordedAt(completedAt)
                .build();
    }

    /**
     * 计算工人特征
     */
    private WorkerFeatures calculateWorkerFeatures(List<BatchWorkSession> workSessions, String factoryId) {
        WorkerFeatures features = new WorkerFeatures();

        if (workSessions == null || workSessions.isEmpty()) {
            features.workerCount = 1;
            features.avgExperienceDays = 30;
            features.avgSkillLevel = new BigDecimal("2.5");
            features.temporaryWorkerRatio = BigDecimal.ZERO;
            return features;
        }

        features.workerCount = workSessions.size();

        int totalExperience = 0;
        BigDecimal totalSkillLevel = BigDecimal.ZERO;
        int temporaryCount = 0;

        for (BatchWorkSession session : workSessions) {
            Optional<User> userOpt = userRepository.findById(session.getEmployeeId());
            if (userOpt.isPresent()) {
                User user = userOpt.get();

                // 计算工作经验（从创建时间到现在的天数）
                if (user.getCreatedAt() != null) {
                    long days = ChronoUnit.DAYS.between(user.getCreatedAt(), LocalDateTime.now());
                    totalExperience += (int) Math.min(days, 3650); // 最多10年
                }

                // 技能等级（从level字段推断，假设level越低越高级）
                int level = user.getLevel() != null ? user.getLevel() : 50;
                BigDecimal skillLevel = new BigDecimal(Math.max(1, Math.min(5, 5 - level / 25)));
                totalSkillLevel = totalSkillLevel.add(skillLevel);

                // 判断是否临时工（根据roleCode或其他字段）
                String roleCode = user.getRoleCode();
                if (roleCode != null && roleCode.contains("temporary")) {
                    temporaryCount++;
                }
            }
        }

        features.avgExperienceDays = features.workerCount > 0
                ? totalExperience / features.workerCount : 30;
        features.avgSkillLevel = features.workerCount > 0
                ? totalSkillLevel.divide(new BigDecimal(features.workerCount), 2, RoundingMode.HALF_UP)
                : new BigDecimal("2.5");
        features.temporaryWorkerRatio = features.workerCount > 0
                ? new BigDecimal(temporaryCount).divide(new BigDecimal(features.workerCount), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return features;
    }

    /**
     * 获取产品复杂度
     */
    private int getProductComplexity(String productTypeId) {
        if (productTypeId == null) {
            return 5; // 默认中等复杂度
        }

        try {
            Optional<ProductType> productTypeOpt = productTypeRepository.findById(productTypeId);
            if (productTypeOpt.isPresent()) {
                ProductType productType = productTypeOpt.get();
                // 如果ProductType有complexity字段则使用，否则根据其他字段估算
                // 这里假设使用处理步骤数或其他逻辑
                return 5; // 默认值，可根据实际字段调整
            }
        } catch (Exception e) {
            log.warn("获取产品复杂度失败: {}", e.getMessage());
        }
        return 5;
    }

    /**
     * 计算设备特征
     */
    private EquipmentFeatures calculateEquipmentFeatures(Long equipmentId) {
        EquipmentFeatures features = new EquipmentFeatures();
        features.ageDays = 365; // 默认1年
        features.utilization = new BigDecimal("0.7"); // 默认70%利用率

        if (equipmentId == null) {
            return features;
        }

        try {
            Optional<FactoryEquipment> equipmentOpt = equipmentRepository.findById(equipmentId);
            if (equipmentOpt.isPresent()) {
                FactoryEquipment equipment = equipmentOpt.get();

                // 计算设备年龄
                if (equipment.getCreatedAt() != null) {
                    long days = ChronoUnit.DAYS.between(equipment.getCreatedAt(), LocalDateTime.now());
                    features.ageDays = (int) Math.min(days, 3650);
                }

                // 设备利用率（如果有运行时间记录的话）
                // 这里使用默认值
            }
        } catch (Exception e) {
            log.warn("获取设备特征失败: {}", e.getMessage());
        }

        return features;
    }

    /**
     * 计算实际效率 (件/人/小时)
     */
    private BigDecimal calculateActualEfficiency(ProductionBatch batch, int workerCount) {
        BigDecimal actualQuantity = batch.getActualQuantity();
        Integer durationMinutes = batch.getWorkDurationMinutes();

        if (actualQuantity == null || durationMinutes == null || durationMinutes <= 0 || workerCount <= 0) {
            return null;
        }

        // 效率 = 实际产量 / (工人数 * 工作小时数)
        BigDecimal hours = new BigDecimal(durationMinutes).divide(new BigDecimal(60), 4, RoundingMode.HALF_UP);
        BigDecimal totalManHours = hours.multiply(new BigDecimal(workerCount));

        if (totalManHours.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        return actualQuantity.divide(totalManHours, 2, RoundingMode.HALF_UP);
    }

    /**
     * 计算实际工时
     */
    private BigDecimal calculateActualDuration(ProductionBatch batch) {
        if (batch.getStartTime() == null || batch.getEndTime() == null) {
            return null;
        }

        long minutes = Duration.between(batch.getStartTime(), batch.getEndTime()).toMinutes();
        return new BigDecimal(minutes).divide(new BigDecimal(60), 2, RoundingMode.HALF_UP);
    }

    /**
     * 计算质量合格率
     */
    private BigDecimal calculateQualityPassRate(ProductionBatch batch) {
        if (batch.getYieldRate() != null) {
            // yieldRate是百分比(如98.5)，转换为小数(0.985)
            return batch.getYieldRate().divide(new BigDecimal(100), 4, RoundingMode.HALF_UP);
        }

        BigDecimal goodQuantity = batch.getGoodQuantity();
        BigDecimal actualQuantity = batch.getActualQuantity();

        if (goodQuantity == null || actualQuantity == null || actualQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            return new BigDecimal("1.0"); // 默认100%合格
        }

        return goodQuantity.divide(actualQuantity, 4, RoundingMode.HALF_UP);
    }

    /**
     * 检查是否需要触发模型训练
     */
    private void checkAndTriggerTraining(String factoryId) {
        long dataCount = trainingDataRepository.countByFactoryId(factoryId);

        if (dataCount < minTrainingDataCount) {
            log.debug("工厂 {} 数据量 {} 不足 {}，暂不触发训练",
                    factoryId, dataCount, minTrainingDataCount);
            return;
        }

        // 检查是否需要重新训练
        Optional<ModelVersion> currentModelOpt = modelVersionRepository
                .findByFactoryIdAndModelTypeAndIsActiveTrue(factoryId, "efficiency");

        boolean needTraining = false;
        if (currentModelOpt.isEmpty()) {
            // 没有模型，需要训练
            needTraining = true;
            log.info("工厂 {} 无效率预测模型，需要训练", factoryId);
        } else {
            ModelVersion currentModel = currentModelOpt.get();
            // 数据量增加超过阈值，需要重新训练
            int currentDataCount = currentModel.getTrainingDataCount() != null
                    ? currentModel.getTrainingDataCount() : 0;
            if (dataCount > currentDataCount * retrainThreshold) {
                needTraining = true;
                log.info("工厂 {} 数据量从 {} 增加到 {}，超过阈值 {}，需要重新训练",
                        factoryId, currentDataCount, dataCount, retrainThreshold);
            }
        }

        if (needTraining) {
            triggerModelTraining(factoryId);
        }
    }

    /**
     * 触发模型训练
     */
    public void triggerModelTraining(String factoryId) {
        log.info("触发工厂 {} 的模型训练", factoryId);

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("factory_id", factoryId);
            request.put("model_types", List.of("efficiency", "duration", "quality"));

            String url = aiServiceUrl + "/ml/train";
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);

            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                log.info("模型训练请求成功: {}", response);
            } else {
                log.warn("模型训练请求失败: {}", response);
            }
        } catch (Exception e) {
            log.error("触发模型训练失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 手动触发数据收集（用于补录历史数据）
     */
    @Transactional
    public int collectHistoricalData(String factoryId, List<ProductionBatch> completedBatches) {
        int count = 0;
        for (ProductionBatch batch : completedBatches) {
            if (!trainingDataRepository.existsByFactoryIdAndBatchId(factoryId, batch.getId())) {
                LocalDateTime completedAt = batch.getEndTime() != null
                        ? batch.getEndTime() : LocalDateTime.now();
                TrainingDataRecord record = collectTrainingData(batch, completedAt);
                trainingDataRepository.save(record);
                count++;
            }
        }
        log.info("已补录工厂 {} 的 {} 条历史训练数据", factoryId, count);
        return count;
    }

    /**
     * 获取工厂的训练数据统计
     */
    public Map<String, Object> getTrainingDataStats(String factoryId) {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCount", trainingDataRepository.countByFactoryId(factoryId));
        stats.put("avgEfficiency", trainingDataRepository.getAverageEfficiency(factoryId));
        stats.put("efficiencyStdDev", trainingDataRepository.getEfficiencyStdDev(factoryId));
        stats.put("productTypeDistribution", trainingDataRepository.countByProductType(factoryId));

        // 检查是否有可用模型
        boolean hasEfficiencyModel = modelVersionRepository
                .existsByFactoryIdAndModelTypeAndIsActiveTrue(factoryId, "efficiency");
        stats.put("hasEfficiencyModel", hasEfficiencyModel);

        return stats;
    }

    // ==================== 内部辅助类 ====================

    private static class WorkerFeatures {
        int workerCount = 1;
        int avgExperienceDays = 30;
        BigDecimal avgSkillLevel = new BigDecimal("2.5");
        BigDecimal temporaryWorkerRatio = BigDecimal.ZERO;
    }

    private static class EquipmentFeatures {
        int ageDays = 365;
        BigDecimal utilization = new BigDecimal("0.7");
    }
}
