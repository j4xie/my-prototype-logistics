package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.entity.FactorySchedulingConfig;
import com.cretas.aims.repository.FactorySchedulingConfigRepository;
import com.cretas.aims.repository.WorkerAllocationFeedbackRepository;
import com.cretas.aims.service.scheduling.SkuComplexityService;
import com.cretas.aims.service.scheduling.TempWorkerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class SkuComplexityServiceImpl implements SkuComplexityService {

    private final JdbcTemplate jdbcTemplate;
    private final FactorySchedulingConfigRepository configRepository;
    private final WorkerAllocationFeedbackRepository feedbackRepository;
    private final TempWorkerService tempWorkerService;

    // SKU复杂度缓存
    private final Map<String, Map<String, SkuProfile>> skuProfileCache = new ConcurrentHashMap<>();

    // 复杂度等级与技能要求映射
    private static final Map<Integer, Integer> COMPLEXITY_SKILL_MAP = Map.of(
            1, 1,  // 非常简单 -> 技能1
            2, 1,  // 简单 -> 技能1
            3, 2,  // 中等 -> 技能2
            4, 3,  // 复杂 -> 技能3
            5, 4   // 非常复杂 -> 技能4
    );

    @Override
    public int getSkuComplexity(String factoryId, String skuCode) {
        Optional<SkuProfile> profile = getSkuProfile(factoryId, skuCode);
        return profile.map(SkuProfile::getEffectiveComplexity).orElse(3); // 默认中等
    }

    @Override
    public Optional<SkuProfile> getSkuProfile(String factoryId, String skuCode) {
        // 先检查缓存
        Map<String, SkuProfile> factoryCache = skuProfileCache.get(factoryId);
        if (factoryCache != null && factoryCache.containsKey(skuCode)) {
            return Optional.of(factoryCache.get(skuCode));
        }

        // 从数据库加载
        try {
            String sql = "SELECT * FROM sku_feature_profile WHERE factory_id = ? AND sku_code = ?";
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, factoryId, skuCode);

            if (results.isEmpty()) {
                return Optional.empty();
            }

            Map<String, Object> row = results.get(0);
            SkuProfile profile = mapRowToProfile(row);

            // 缓存结果
            skuProfileCache.computeIfAbsent(factoryId, k -> new ConcurrentHashMap<>())
                    .put(skuCode, profile);

            return Optional.of(profile);
        } catch (Exception e) {
            log.error("Error loading SKU profile for {}/{}", factoryId, skuCode, e);
            return Optional.empty();
        }
    }

    @Override
    @Transactional
    public void setSkuComplexity(String factoryId, String skuCode, int complexityLevel) {
        String sql = """
            INSERT INTO sku_feature_profile (factory_id, sku_code, manual_complexity, min_skill_required)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                manual_complexity = VALUES(manual_complexity),
                min_skill_required = VALUES(min_skill_required),
                updated_at = NOW()
            """;

        int minSkill = COMPLEXITY_SKILL_MAP.getOrDefault(complexityLevel, 2);
        jdbcTemplate.update(sql, factoryId, skuCode, complexityLevel, minSkill);

        // 清除缓存
        Map<String, SkuProfile> factoryCache = skuProfileCache.get(factoryId);
        if (factoryCache != null) {
            factoryCache.remove(skuCode);
        }

        log.info("Set SKU {} complexity to {} (min skill: {})", skuCode, complexityLevel, minSkill);
    }

    @Override
    public double learnSkuComplexity(String factoryId, String skuCode) {
        // 基于历史数据学习复杂度
        // 复杂度 = f(平均处理时间, 失败率, 效率方差)

        String sql = """
            SELECT
                AVG(actual_efficiency) as avg_efficiency,
                STDDEV(actual_efficiency) as efficiency_std,
                COUNT(*) as sample_count
            FROM worker_allocation_feedback
            WHERE factory_id = ? AND task_type LIKE ?
            AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
            """;

        try {
            Map<String, Object> stats = jdbcTemplate.queryForMap(sql, factoryId, "%" + skuCode + "%");

            double avgEfficiency = stats.get("avg_efficiency") != null ?
                    ((Number) stats.get("avg_efficiency")).doubleValue() : 0.8;
            double efficiencyStd = stats.get("efficiency_std") != null ?
                    ((Number) stats.get("efficiency_std")).doubleValue() : 0.1;
            int sampleCount = stats.get("sample_count") != null ?
                    ((Number) stats.get("sample_count")).intValue() : 0;

            if (sampleCount < 10) {
                return 3.0; // 样本不足，返回中等复杂度
            }

            // 复杂度计算公式:
            // 低效率 + 高方差 = 高复杂度
            double baseComplexity = (1 - avgEfficiency) * 5 + efficiencyStd * 10;
            double learnedComplexity = Math.max(1, Math.min(5, baseComplexity));

            // 更新数据库
            String updateSql = """
                UPDATE sku_feature_profile
                SET learned_complexity = ?, avg_efficiency = ?, sample_count = ?, updated_at = NOW()
                WHERE factory_id = ? AND sku_code = ?
                """;
            jdbcTemplate.update(updateSql, learnedComplexity, avgEfficiency, sampleCount, factoryId, skuCode);

            log.info("Learned SKU {} complexity: {} (efficiency: {}, samples: {})",
                    skuCode, learnedComplexity, avgEfficiency, sampleCount);

            return learnedComplexity;
        } catch (Exception e) {
            log.error("Error learning SKU complexity for {}/{}", factoryId, skuCode, e);
            return 3.0;
        }
    }

    @Override
    public double calculateMatchScore(String factoryId, Long workerId, String skuCode, int workerSkillLevel) {
        int skuComplexity = getSkuComplexity(factoryId, skuCode);
        int requiredSkill = COMPLEXITY_SKILL_MAP.getOrDefault(skuComplexity, 2);

        // 获取工厂配置
        FactorySchedulingConfig config = configRepository.findByFactoryId(factoryId)
                .orElse(FactorySchedulingConfig.createDefault(factoryId));

        double complexityWeight = config.getSkuComplexityWeight() != null ?
                config.getSkuComplexityWeight() : 0.15;

        // 检查是否临时工
        boolean isTempWorker = tempWorkerService.isTempWorker(factoryId, workerId);
        boolean isLowComplexitySku = skuComplexity <= 2;

        double matchScore = 0.0;

        if (workerSkillLevel >= requiredSkill) {
            // 技能达标: 基础加分
            matchScore = complexityWeight;

            // 技能略高于要求: 额外加分 (最佳匹配)
            int skillGap = workerSkillLevel - requiredSkill;
            if (skillGap == 1) {
                matchScore += 0.05; // 最佳匹配加分
            } else if (skillGap > 2) {
                matchScore -= 0.03; // 高技能做简单任务，轻微惩罚
            }
        } else if (isTempWorker && isLowComplexitySku) {
            // 临时工 + 低复杂度SKU: 培训机会
            matchScore = complexityWeight * 0.8; // 允许但略低分数
            log.debug("Training opportunity: temp worker {} on low complexity SKU {}", workerId, skuCode);
        } else {
            // 技能不达标: 惩罚
            int skillGap = requiredSkill - workerSkillLevel;
            matchScore = -complexityWeight * skillGap * 0.5;
        }

        return matchScore;
    }

    @Override
    public List<Long> getQualifiedWorkers(String factoryId, String skuCode) {
        int skuComplexity = getSkuComplexity(factoryId, skuCode);
        int requiredSkill = COMPLEXITY_SKILL_MAP.getOrDefault(skuComplexity, 2);

        String sql = """
            SELECT worker_id FROM worker_feature_profile
            WHERE factory_id = ? AND current_skill_level >= ?
            ORDER BY current_skill_level DESC
            """;

        try {
            return jdbcTemplate.queryForList(sql, Long.class, factoryId, requiredSkill);
        } catch (Exception e) {
            log.error("Error getting qualified workers for {}/{}", factoryId, skuCode, e);
            return Collections.emptyList();
        }
    }

    @Override
    public List<String> getTrainingSkus(String factoryId) {
        // 返回复杂度 <= 2 的SKU
        String sql = """
            SELECT sku_code FROM sku_feature_profile
            WHERE factory_id = ?
            AND (manual_complexity <= 2 OR (manual_complexity IS NULL AND learned_complexity <= 2.5))
            ORDER BY COALESCE(manual_complexity, learned_complexity)
            """;

        try {
            return jdbcTemplate.queryForList(sql, String.class, factoryId);
        } catch (Exception e) {
            log.error("Error getting training SKUs for {}", factoryId, e);
            return Collections.emptyList();
        }
    }

    @Override
    public List<String> getExpertSkus(String factoryId) {
        // 返回复杂度 >= 4 的SKU
        String sql = """
            SELECT sku_code FROM sku_feature_profile
            WHERE factory_id = ?
            AND (manual_complexity >= 4 OR (manual_complexity IS NULL AND learned_complexity >= 3.5))
            ORDER BY COALESCE(manual_complexity, learned_complexity) DESC
            """;

        try {
            return jdbcTemplate.queryForList(sql, String.class, factoryId);
        } catch (Exception e) {
            log.error("Error getting expert SKUs for {}", factoryId, e);
            return Collections.emptyList();
        }
    }

    @Override
    @Transactional
    public void updateSkuStats(String factoryId, String skuCode, double efficiency, int processTimeMinutes, boolean success) {
        String sql = """
            INSERT INTO sku_feature_profile (factory_id, sku_code, sample_count, avg_efficiency, avg_process_time_minutes, failure_rate)
            VALUES (?, ?, 1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                sample_count = sample_count + 1,
                avg_efficiency = (avg_efficiency * sample_count + ?) / (sample_count + 1),
                avg_process_time_minutes = (avg_process_time_minutes * sample_count + ?) / (sample_count + 1),
                failure_rate = (failure_rate * sample_count + ?) / (sample_count + 1),
                updated_at = NOW()
            """;

        double failureValue = success ? 0.0 : 1.0;

        try {
            jdbcTemplate.update(sql, factoryId, skuCode, efficiency, processTimeMinutes, failureValue,
                    efficiency, processTimeMinutes, failureValue);

            // 清除缓存
            Map<String, SkuProfile> factoryCache = skuProfileCache.get(factoryId);
            if (factoryCache != null) {
                factoryCache.remove(skuCode);
            }
        } catch (Exception e) {
            log.error("Error updating SKU stats for {}/{}", factoryId, skuCode, e);
        }
    }

    @Override
    public List<SkuComplexityDrift> detectComplexityDrift(String factoryId) {
        List<SkuComplexityDrift> drifts = new ArrayList<>();

        String sql = """
            SELECT sku_code, manual_complexity, learned_complexity
            FROM sku_feature_profile
            WHERE factory_id = ? AND sample_count >= 20
            """;

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, factoryId);

            for (Map<String, Object> row : rows) {
                String skuCode = (String) row.get("sku_code");
                Integer manualComplexity = (Integer) row.get("manual_complexity");
                Double learnedComplexity = row.get("learned_complexity") != null ?
                        ((Number) row.get("learned_complexity")).doubleValue() : null;

                if (manualComplexity != null && learnedComplexity != null) {
                    double drift = Math.abs(manualComplexity - learnedComplexity);

                    if (drift >= 1.0) { // 漂移超过1个等级
                        SkuComplexityDrift driftInfo = new SkuComplexityDrift();
                        driftInfo.setSkuCode(skuCode);
                        driftInfo.setPreviousComplexity(manualComplexity);
                        driftInfo.setCurrentComplexity(learnedComplexity);
                        driftInfo.setDriftMagnitude(drift);
                        driftInfo.setDriftDirection(learnedComplexity > manualComplexity ? "UP" : "DOWN");
                        driftInfo.setSuggestedAction(
                                drift >= 2.0 ? "建议立即更新复杂度设置" : "建议观察后更新");
                        drifts.add(driftInfo);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error detecting complexity drift for {}", factoryId, e);
        }

        return drifts;
    }

    // ========== Helper Methods ==========

    private SkuProfile mapRowToProfile(Map<String, Object> row) {
        SkuProfile profile = new SkuProfile();
        profile.setSkuCode((String) row.get("sku_code"));
        profile.setSkuName((String) row.get("sku_name"));

        Integer manual = (Integer) row.get("manual_complexity");
        Double learned = row.get("learned_complexity") != null ?
                ((Number) row.get("learned_complexity")).doubleValue() : null;

        profile.setManualComplexity(manual != null ? manual : 0);
        profile.setLearnedComplexity(learned != null ? learned : 3.0);

        // 有效复杂度: 人工设置优先
        profile.setEffectiveComplexity(manual != null ? manual : (int) Math.round(profile.getLearnedComplexity()));

        profile.setMinSkillRequired(row.get("min_skill_required") != null ?
                ((Number) row.get("min_skill_required")).intValue() : 1);
        profile.setPreferredWorkerType((String) row.getOrDefault("preferred_worker_type", "ANY"));
        profile.setAvgProcessTimeMinutes(row.get("avg_process_time_minutes") != null ?
                ((Number) row.get("avg_process_time_minutes")).intValue() : 30);
        profile.setAvgEfficiency(row.get("avg_efficiency") != null ?
                ((Number) row.get("avg_efficiency")).doubleValue() : 0.0);
        profile.setFailureRate(row.get("failure_rate") != null ?
                ((Number) row.get("failure_rate")).doubleValue() : 0.0);
        profile.setSampleCount(row.get("sample_count") != null ?
                ((Number) row.get("sample_count")).intValue() : 0);

        return profile;
    }
}
