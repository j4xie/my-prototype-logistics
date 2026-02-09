package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.entity.FactoryTempWorker;
import com.cretas.aims.repository.FactorySchedulingConfigRepository;
import com.cretas.aims.repository.FactoryTempWorkerRepository;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.scheduling.FactorySchedulingConfigService;
import com.cretas.aims.service.scheduling.SkuComplexityService;
import com.cretas.aims.service.scheduling.TempWorkerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class FactorySchedulingConfigServiceImpl implements FactorySchedulingConfigService {

    private final FactorySchedulingConfigRepository configRepository;
    private final FactoryTempWorkerRepository tempWorkerRepository;
    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final TempWorkerService tempWorkerService;
    private final SkuComplexityService skuComplexityService;
    private final JdbcTemplate jdbcTemplate;

    // 自适应学习参数
    private static final double MAX_WEIGHT_ADJUSTMENT = 0.1;
    private static final int MIN_SAMPLES = 50;

    @Override
    public FactorySchedulingConfig getOrCreateConfig(String factoryId) {
        return configRepository.findByFactoryId(factoryId)
                .orElseGet(() -> {
                    log.info("Creating default config for factory: {}", factoryId);
                    FactorySchedulingConfig config = FactorySchedulingConfig.createDefault(factoryId);
                    return configRepository.save(config);
                });
    }

    @Override
    @Transactional
    public FactorySchedulingConfig updateConfig(String factoryId, FactorySchedulingConfig newConfig) {
        FactorySchedulingConfig existing = getOrCreateConfig(factoryId);

        // 更新非空字段
        if (newConfig.getEnabled() != null) existing.setEnabled(newConfig.getEnabled());
        if (newConfig.getDiversityEnabled() != null) existing.setDiversityEnabled(newConfig.getDiversityEnabled());
        if (newConfig.getLinucbWeight() != null) existing.setLinucbWeight(newConfig.getLinucbWeight());
        if (newConfig.getFairnessWeight() != null) existing.setFairnessWeight(newConfig.getFairnessWeight());
        if (newConfig.getSkillMaintenanceWeight() != null) existing.setSkillMaintenanceWeight(newConfig.getSkillMaintenanceWeight());
        if (newConfig.getRepetitionWeight() != null) existing.setRepetitionWeight(newConfig.getRepetitionWeight());
        if (newConfig.getSkillDecayDays() != null) existing.setSkillDecayDays(newConfig.getSkillDecayDays());
        if (newConfig.getFairnessPeriodDays() != null) existing.setFairnessPeriodDays(newConfig.getFairnessPeriodDays());
        if (newConfig.getTempWorkerLinucbFactor() != null) existing.setTempWorkerLinucbFactor(newConfig.getTempWorkerLinucbFactor());
        if (newConfig.getTempWorkerFairnessFactor() != null) existing.setTempWorkerFairnessFactor(newConfig.getTempWorkerFairnessFactor());
        if (newConfig.getSkuComplexityWeight() != null) existing.setSkuComplexityWeight(newConfig.getSkuComplexityWeight());
        if (newConfig.getAdaptiveLearningEnabled() != null) existing.setAdaptiveLearningEnabled(newConfig.getAdaptiveLearningEnabled());
        if (newConfig.getLearningRate() != null) existing.setLearningRate(newConfig.getLearningRate());
        if (newConfig.getEfficiencyTarget() != null) existing.setEfficiencyTarget(newConfig.getEfficiencyTarget());
        if (newConfig.getDiversityTarget() != null) existing.setDiversityTarget(newConfig.getDiversityTarget());

        log.info("Updated config for factory: {}", factoryId);
        return configRepository.save(existing);
    }

    @Override
    @Transactional
    public void performAdaptiveLearning(String factoryId) {
        FactorySchedulingConfig config = getOrCreateConfig(factoryId);

        if (!Boolean.TRUE.equals(config.getAdaptiveLearningEnabled())) {
            log.debug("Adaptive learning disabled for factory: {}", factoryId);
            return;
        }

        // 获取近期统计数据
        LocalDateTime since = LocalDateTime.now().minusDays(7);
        long sampleCount = feedbackRepository.countByFactoryIdAndCreatedAtAfter(factoryId, since);

        if (sampleCount < config.getMinSamplesForAdaptation()) {
            log.debug("Not enough samples for adaptation: {} < {}", sampleCount, config.getMinSamplesForAdaptation());
            return;
        }

        // 计算当前效率和多样性
        Double currentEfficiency = calculateCurrentEfficiency(factoryId, since);
        Double currentDiversity = calculateCurrentDiversity(factoryId, since);

        if (currentEfficiency == null || currentDiversity == null) {
            log.warn("Unable to calculate metrics for factory: {}", factoryId);
            return;
        }

        double learningRate = config.getLearningRate() != null ? config.getLearningRate() : 0.05;
        double efficiencyTarget = config.getEfficiencyTarget() != null ? config.getEfficiencyTarget() : 0.85;
        double diversityTarget = config.getDiversityTarget() != null ? config.getDiversityTarget() : 0.70;

        // 保存旧参数用于日志
        double oldLinucbWeight = config.getLinucbWeight();
        double oldFairnessWeight = config.getFairnessWeight();
        double oldSkillWeight = config.getSkillMaintenanceWeight();
        double oldRepetitionWeight = config.getRepetitionWeight();

        String triggerReason = null;
        boolean adjusted = false;

        // 效率低于目标: 增加LinUCB权重
        if (currentEfficiency < efficiencyTarget) {
            double adjustment = learningRate * (efficiencyTarget - currentEfficiency);
            adjustment = Math.min(adjustment, MAX_WEIGHT_ADJUSTMENT);

            config.setLinucbWeight(Math.min(0.8, config.getLinucbWeight() + adjustment));
            config.setRepetitionWeight(Math.max(0.05, config.getRepetitionWeight() - adjustment / 2));

            triggerReason = "EFFICIENCY_LOW";
            adjusted = true;
            log.info("Efficiency {} < target {}, increasing LinUCB weight by {}",
                    currentEfficiency, efficiencyTarget, adjustment);
        }

        // 多样性低于目标: 增加公平性和技能维护权重
        if (currentDiversity < diversityTarget) {
            double adjustment = learningRate * (diversityTarget - currentDiversity);
            adjustment = Math.min(adjustment, MAX_WEIGHT_ADJUSTMENT);

            config.setFairnessWeight(Math.min(0.3, config.getFairnessWeight() + adjustment));
            config.setSkillMaintenanceWeight(Math.min(0.3, config.getSkillMaintenanceWeight() + adjustment));

            if (triggerReason == null) {
                triggerReason = "DIVERSITY_LOW";
            } else {
                triggerReason += "_AND_DIVERSITY_LOW";
            }
            adjusted = true;
            log.info("Diversity {} < target {}, increasing fairness/skill weights by {}",
                    currentDiversity, diversityTarget, adjustment);
        }

        if (adjusted) {
            // 归一化权重
            normalizeWeights(config);

            // 更新配置
            config.setLastAdaptationAt(LocalDateTime.now());
            config.setAdaptationCount(config.getAdaptationCount() + 1);
            configRepository.save(config);

            // 记录日志
            logAdaptation(factoryId, triggerReason,
                    oldLinucbWeight, oldFairnessWeight, oldSkillWeight, oldRepetitionWeight,
                    config.getLinucbWeight(), config.getFairnessWeight(),
                    config.getSkillMaintenanceWeight(), config.getRepetitionWeight(),
                    currentEfficiency, currentDiversity, (int) sampleCount);
        }
    }

    @Override
    @Transactional
    public void detectAndHandleAnomalies(String factoryId) {
        FactorySchedulingConfig config = getOrCreateConfig(factoryId);

        if (!Boolean.TRUE.equals(config.getAnomalyDetectionEnabled())) {
            return;
        }

        LocalDateTime since = LocalDateTime.now().minusDays(1);
        Double currentEfficiency = calculateCurrentEfficiency(factoryId, since);

        if (currentEfficiency == null) return;

        double anomalyThreshold = config.getEfficiencyAnomalyThreshold() != null ?
                config.getEfficiencyAnomalyThreshold() : 0.50;

        if (currentEfficiency < anomalyThreshold) {
            log.warn("Anomaly detected for factory {}: efficiency {} < threshold {}",
                    factoryId, currentEfficiency, anomalyThreshold);

            // 记录异常
            logAdaptation(factoryId, "ANOMALY_DETECTED",
                    config.getLinucbWeight(), config.getFairnessWeight(),
                    config.getSkillMaintenanceWeight(), config.getRepetitionWeight(),
                    null, null, null, null, currentEfficiency, null, 0);

            // 如果连续多次异常，重置为默认参数
            // (这里简化处理，实际应该追踪连续异常次数)
        }
    }

    @Override
    public EffectiveConfig getEffectiveConfig(String factoryId, Long workerId) {
        FactorySchedulingConfig baseConfig = getOrCreateConfig(factoryId);
        EffectiveConfig effective = new EffectiveConfig();

        // 检查是否临时工
        boolean isTempWorker = tempWorkerService.isTempWorker(factoryId, workerId);
        effective.setTempWorker(isTempWorker);

        if (isTempWorker) {
            // 临时工: 应用调整因子
            TempWorkerService.TempWorkerAdjustment adjustment =
                    tempWorkerService.calculateAdjustment(factoryId, workerId);

            effective.setLinucbWeight(baseConfig.getLinucbWeight() * adjustment.getLinucbFactor());
            effective.setFairnessWeight(baseConfig.getFairnessWeight() * adjustment.getFairnessFactor());
            effective.setSkillMaintenanceWeight(baseConfig.getSkillMaintenanceWeight());
            effective.setRepetitionWeight(baseConfig.getRepetitionWeight());
            effective.setSkillDecayDays(adjustment.getSkillDecayDays());
            effective.setRepetitionDays(baseConfig.getRepetitionDays());
            effective.setMaxConsecutiveDays(adjustment.getMaxConsecutiveDays() > 0 ?
                    adjustment.getMaxConsecutiveDays() : baseConfig.getMaxConsecutiveDays());

            // 获取技能等级
            Optional<FactoryTempWorker> tw = tempWorkerRepository.findByFactoryIdAndWorkerId(factoryId, workerId);
            effective.setWorkerSkillLevel(tw.map(FactoryTempWorker::getCurrentSkillLevel).orElse(1));
        } else {
            // 正式工: 使用标准参数
            effective.setLinucbWeight(baseConfig.getLinucbWeight());
            effective.setFairnessWeight(baseConfig.getFairnessWeight());
            effective.setSkillMaintenanceWeight(baseConfig.getSkillMaintenanceWeight());
            effective.setRepetitionWeight(baseConfig.getRepetitionWeight());
            effective.setSkillDecayDays(baseConfig.getSkillDecayDays());
            effective.setRepetitionDays(baseConfig.getRepetitionDays());
            effective.setMaxConsecutiveDays(baseConfig.getMaxConsecutiveDays());

            // 从特征表获取技能等级
            try {
                Integer skillLevel = jdbcTemplate.queryForObject(
                        "SELECT current_skill_level FROM worker_feature_profile WHERE factory_id = ? AND worker_id = ?",
                        Integer.class, factoryId, workerId);
                effective.setWorkerSkillLevel(skillLevel != null ? skillLevel : 3);
            } catch (Exception e) {
                effective.setWorkerSkillLevel(3); // 默认中等
            }
        }

        return effective;
    }

    // ========== Helper Methods ==========

    private Double calculateCurrentEfficiency(String factoryId, LocalDateTime since) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT AVG(actual_efficiency) FROM worker_allocation_feedback WHERE factory_id = ? AND created_at > ?",
                    Double.class, factoryId, since);
        } catch (Exception e) {
            log.error("Error calculating efficiency for {}", factoryId, e);
            return null;
        }
    }

    private Double calculateCurrentDiversity(String factoryId, LocalDateTime since) {
        try {
            // 计算工序分布熵作为多样性指标
            String sql = """
                SELECT stage_type, COUNT(*) as cnt
                FROM worker_allocation_feedback
                WHERE factory_id = ? AND created_at > ? AND stage_type IS NOT NULL
                GROUP BY stage_type
                """;

            var results = jdbcTemplate.queryForList(sql, factoryId, since);
            if (results.isEmpty()) return null;

            int total = results.stream().mapToInt(r -> ((Number) r.get("cnt")).intValue()).sum();
            if (total == 0) return null;

            double entropy = 0;
            for (var row : results) {
                double p = ((Number) row.get("cnt")).doubleValue() / total;
                if (p > 0) {
                    entropy -= p * Math.log(p);
                }
            }

            // 归一化到0-1
            double maxEntropy = Math.log(results.size());
            return maxEntropy > 0 ? entropy / maxEntropy : 0;
        } catch (Exception e) {
            log.error("Error calculating diversity for {}", factoryId, e);
            return null;
        }
    }

    private void normalizeWeights(FactorySchedulingConfig config) {
        double total = config.getLinucbWeight() + config.getFairnessWeight() +
                config.getSkillMaintenanceWeight() + config.getRepetitionWeight();

        if (total > 1.0) {
            config.setLinucbWeight(config.getLinucbWeight() / total);
            config.setFairnessWeight(config.getFairnessWeight() / total);
            config.setSkillMaintenanceWeight(config.getSkillMaintenanceWeight() / total);
            config.setRepetitionWeight(config.getRepetitionWeight() / total);
        }
    }

    private void logAdaptation(String factoryId, String reason,
                               Double oldLinucb, Double oldFairness, Double oldSkill, Double oldRepetition,
                               Double newLinucb, Double newFairness, Double newSkill, Double newRepetition,
                               Double efficiency, Double diversity, int samples) {
        try {
            String sql = """
                INSERT INTO scheduling_adaptation_log
                (factory_id, trigger_reason, old_linucb_weight, old_fairness_weight,
                 old_skill_maintenance_weight, old_repetition_weight, new_linucb_weight,
                 new_fairness_weight, new_skill_maintenance_weight, new_repetition_weight,
                 current_efficiency, current_diversity, sample_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
            jdbcTemplate.update(sql, factoryId, reason,
                    oldLinucb, oldFairness, oldSkill, oldRepetition,
                    newLinucb, newFairness, newSkill, newRepetition,
                    efficiency, diversity, samples);
        } catch (Exception e) {
            log.error("Error logging adaptation for {}", factoryId, e);
        }
    }
}
