package com.cretas.aims.ai.synthetic;

import com.cretas.aims.entity.learning.SampleSource;
import com.cretas.aims.repository.learning.TrainingSampleRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 合成数据监控服务
 *
 * 监控合成数据的质量指标，包括：
 * 1. 真实 vs 合成样本数量对比
 * 2. 准确率趋势分析
 * 3. 分布漂移检测 (KL 散度近似)
 * 4. 熔断器触发状态
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyntheticDataMonitorService {

    private final TrainingSampleRepository trainingSampleRepository;
    private final SyntheticDataConfig syntheticDataConfig;

    // ==================== 指标数据类 ====================

    /**
     * 合成数据指标
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyntheticDataMetrics {
        /**
         * 统计日期
         */
        private LocalDate date;

        /**
         * 工厂ID
         */
        private String factoryId;

        /**
         * 真实样本数量
         */
        private long realSampleCount;

        /**
         * 合成样本数量
         */
        private long syntheticSampleCount;

        /**
         * 真实样本准确率
         */
        private Double realAccuracy;

        /**
         * 合成样本准确率
         */
        private Double syntheticAccuracy;

        /**
         * 混合准确率 (真实 + 合成)
         */
        private Double mixedAccuracy;

        /**
         * 7天准确率趋势 (正值表示上升)
         */
        private double accuracyTrend7d;

        /**
         * 分布漂移度 (KL 散度近似)
         */
        private double distributionDrift;

        /**
         * 熔断器是否触发
         */
        private boolean circuitBreakerTriggered;

        /**
         * 告警消息
         */
        private String alertMessage;

        /**
         * 是否健康
         */
        public boolean isHealthy() {
            return !circuitBreakerTriggered && alertMessage == null;
        }

        /**
         * 获取合成比例
         */
        public double getSyntheticRatio() {
            long total = realSampleCount + syntheticSampleCount;
            return total > 0 ? (double) syntheticSampleCount / total : 0.0;
        }
    }

    // ==================== 核心方法 ====================

    /**
     * 计算指定日期的合成数据指标
     *
     * @param factoryId 工厂ID
     * @param date 统计日期
     * @return 合成数据指标
     */
    public SyntheticDataMetrics calculateDailyMetrics(String factoryId, LocalDate date) {
        log.info("计算合成数据指标: factoryId={}, date={}", factoryId, date);

        LocalDateTime startOfDay = date.atStartOfDay();

        // 1. 查询样本数量
        Map<SampleSource, Long> sourceCounts = getSourceCounts(factoryId, startOfDay);
        long realCount = sourceCounts.getOrDefault(SampleSource.REAL, 0L);
        long syntheticCount = sourceCounts.getOrDefault(SampleSource.SYNTHETIC, 0L);

        // 2. 查询准确率
        Double realAccuracy = trainingSampleRepository.getRealAccuracy(factoryId, startOfDay);
        Double syntheticAccuracy = trainingSampleRepository.getSyntheticAccuracy(factoryId, startOfDay);
        Double mixedAccuracy = calculateMixedAccuracy(realAccuracy, syntheticAccuracy, realCount, syntheticCount);

        // 3. 计算7天趋势
        LocalDate weekAgo = date.minusDays(7);
        double trend = calculateTrend(factoryId, weekAgo, date);

        // 4. 计算分布漂移
        double drift = calculateKLDivergence(factoryId);

        // 5. 判断熔断器状态
        boolean circuitBreaker = checkCircuitBreaker(realAccuracy, syntheticAccuracy, drift);
        String alertMessage = generateAlertMessage(realAccuracy, syntheticAccuracy, drift, circuitBreaker);

        SyntheticDataMetrics metrics = SyntheticDataMetrics.builder()
            .date(date)
            .factoryId(factoryId)
            .realSampleCount(realCount)
            .syntheticSampleCount(syntheticCount)
            .realAccuracy(realAccuracy)
            .syntheticAccuracy(syntheticAccuracy)
            .mixedAccuracy(mixedAccuracy)
            .accuracyTrend7d(trend)
            .distributionDrift(drift)
            .circuitBreakerTriggered(circuitBreaker)
            .alertMessage(alertMessage)
            .build();

        log.info("合成数据指标计算完成: metrics={}", metrics);
        return metrics;
    }

    /**
     * 计算指定时间段的准确率趋势
     *
     * @param factoryId 工厂ID
     * @param from 开始日期
     * @param to 结束日期
     * @return 准确率变化值 (正值表示提升)
     */
    public double calculateTrend(String factoryId, LocalDate from, LocalDate to) {
        LocalDateTime fromDateTime = from.atStartOfDay();

        // 获取起始期准确率 (前半周期)
        LocalDate midPoint = from.plusDays(from.until(to).getDays() / 2);
        LocalDateTime midDateTime = midPoint.atStartOfDay();

        Double earlyAccuracy = trainingSampleRepository.getRealAccuracy(factoryId, fromDateTime);
        Double lateAccuracy = trainingSampleRepository.getRealAccuracy(factoryId, midDateTime);

        if (earlyAccuracy == null || lateAccuracy == null) {
            return 0.0;
        }

        return lateAccuracy - earlyAccuracy;
    }

    /**
     * 计算KL散度 (简化估算)
     *
     * 通过比较真实样本和合成样本在各意图上的分布差异来估算分布漂移。
     * 这是一个简化版本，使用意图分布的差异作为代理指标。
     *
     * @param factoryId 工厂ID
     * @return KL散度近似值 (0-1, 值越大表示漂移越严重)
     */
    public double calculateKLDivergence(String factoryId) {
        LocalDateTime since = LocalDateTime.now().minusDays(7);

        // 获取各来源的意图分布
        List<Object[]> intentStats = trainingSampleRepository.getIntentStatistics(factoryId, since);

        if (intentStats == null || intentStats.isEmpty()) {
            return 0.0;
        }

        // 计算真实样本的意图分布
        Map<String, Long> realDistribution = new HashMap<>();
        Map<String, Long> syntheticDistribution = new HashMap<>();
        long totalReal = 0;
        long totalSynthetic = 0;

        for (Object[] stat : intentStats) {
            String intentCode = (String) stat[0];
            Long count = ((Number) stat[1]).longValue();
            Long correctCount = stat[2] != null ? ((Number) stat[2]).longValue() : 0L;

            // 简化处理: 使用正确样本作为真实分布的代理
            // 错误样本可能表示合成样本的偏差
            realDistribution.merge(intentCode, correctCount, Long::sum);
            totalReal += correctCount;

            Long incorrectCount = count - correctCount;
            syntheticDistribution.merge(intentCode, incorrectCount, Long::sum);
            totalSynthetic += incorrectCount;
        }

        if (totalReal == 0 || totalSynthetic == 0) {
            return 0.0;
        }

        // 计算 Jensen-Shannon 散度 (对称版本的 KL 散度)
        double jsDivergence = 0.0;
        for (String intentCode : realDistribution.keySet()) {
            double p = (double) realDistribution.getOrDefault(intentCode, 0L) / totalReal;
            double q = (double) syntheticDistribution.getOrDefault(intentCode, 0L) / totalSynthetic;

            if (p > 0 && q > 0) {
                double m = (p + q) / 2;
                jsDivergence += 0.5 * (p * Math.log(p / m) + q * Math.log(q / m));
            } else if (p > 0) {
                jsDivergence += 0.5 * p * Math.log(2); // q=0 时的极限贡献
            } else if (q > 0) {
                jsDivergence += 0.5 * q * Math.log(2); // p=0 时的极限贡献
            }
        }

        // 归一化到 [0, 1] 区间 (JS 散度最大值为 log(2) ≈ 0.693)
        return Math.min(jsDivergence / Math.log(2), 1.0);
    }

    /**
     * 获取GRAPE分数统计
     *
     * @param factoryId 工厂ID
     * @return GRAPE分数分布统计 (LOW/MEDIUM/HIGH -> count)
     */
    public Map<String, Long> getGrapeScoreStats(String factoryId) {
        List<Object[]> distribution = trainingSampleRepository.getGrapeScoreDistribution(factoryId);

        Map<String, Long> stats = new HashMap<>();
        stats.put("LOW", 0L);
        stats.put("MEDIUM", 0L);
        stats.put("HIGH", 0L);

        if (distribution != null) {
            for (Object[] row : distribution) {
                String level = (String) row[0];
                Long count = ((Number) row[1]).longValue();
                stats.put(level, count);
            }
        }

        return stats;
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取各来源的样本数量
     */
    private Map<SampleSource, Long> getSourceCounts(String factoryId, LocalDateTime since) {
        List<Object[]> counts = trainingSampleRepository.countBySource(factoryId, since);
        Map<SampleSource, Long> result = new HashMap<>();

        if (counts != null) {
            for (Object[] row : counts) {
                SampleSource source = row[0] != null ? (SampleSource) row[0] : SampleSource.REAL;
                Long count = ((Number) row[1]).longValue();
                result.put(source, count);
            }
        }

        return result;
    }

    /**
     * 计算混合准确率 (加权平均)
     */
    private Double calculateMixedAccuracy(Double realAccuracy, Double syntheticAccuracy,
                                          long realCount, long syntheticCount) {
        if (realAccuracy == null && syntheticAccuracy == null) {
            return null;
        }

        long total = realCount + syntheticCount;
        if (total == 0) {
            return null;
        }

        double realWeight = (double) realCount / total;
        double syntheticWeight = (double) syntheticCount / total;

        double realPart = (realAccuracy != null ? realAccuracy : 0.0) * realWeight;
        double syntheticPart = (syntheticAccuracy != null ? syntheticAccuracy : 0.0) * syntheticWeight;

        return realPart + syntheticPart;
    }

    /**
     * 检查是否触发熔断器
     */
    private boolean checkCircuitBreaker(Double realAccuracy, Double syntheticAccuracy, double drift) {
        if (!syntheticDataConfig.isEnabled()) {
            return false;
        }

        double accuracyThreshold = syntheticDataConfig.getAccuracyThreshold().doubleValue();
        double driftThreshold = syntheticDataConfig.getDistributionDriftThreshold().doubleValue();

        // 条件1: 准确率差距过大
        if (realAccuracy != null && syntheticAccuracy != null) {
            double gap = realAccuracy - syntheticAccuracy;
            if (gap > (1.0 - accuracyThreshold)) {
                log.warn("熔断触发: 准确率差距过大, realAccuracy={}, syntheticAccuracy={}, gap={}",
                        realAccuracy, syntheticAccuracy, gap);
                return true;
            }
        }

        // 条件2: 分布漂移过大
        if (drift > driftThreshold) {
            log.warn("熔断触发: 分布漂移过大, drift={}, threshold={}",
                    drift, driftThreshold);
            return true;
        }

        return false;
    }

    /**
     * 生成告警消息
     */
    private String generateAlertMessage(Double realAccuracy, Double syntheticAccuracy,
                                         double drift, boolean circuitBreaker) {
        StringBuilder sb = new StringBuilder();

        double driftThreshold = syntheticDataConfig.getDistributionDriftThreshold().doubleValue();
        double accuracyThreshold = syntheticDataConfig.getAccuracyThreshold().doubleValue();

        // 准确率差距告警
        if (realAccuracy != null && syntheticAccuracy != null) {
            double gap = realAccuracy - syntheticAccuracy;
            if (gap > (1.0 - accuracyThreshold)) {
                sb.append(String.format("准确率差距告警: 真实%.2f%% vs 合成%.2f%% (差距%.2f%%); ",
                        realAccuracy * 100, syntheticAccuracy * 100, gap * 100));
            }
        }

        // 分布漂移告警
        if (drift > driftThreshold) {
            sb.append(String.format("分布漂移告警: KL散度=%.3f (阈值%.3f); ",
                    drift, driftThreshold));
        }

        // 熔断告警
        if (circuitBreaker) {
            sb.append("熔断器已触发: 合成数据生成已暂停");
        }

        return sb.length() > 0 ? sb.toString().trim() : null;
    }
}
