package com.cretas.aims.ai.synthetic;

import com.cretas.aims.entity.intent.FactoryAILearningConfig;
import com.cretas.aims.repository.FactoryAILearningConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 合成数据熔断器服务
 * 监控合成数据生成质量，当质量下降时自动禁用合成数据生成
 *
 * 熔断条件:
 * 1. 准确率低于配置阈值
 * 2. 分布漂移超过配置阈值
 *
 * NOTE: 需要在 FactoryAILearningConfig 实体中添加以下字段:
 * - syntheticEnabled (Boolean): 合成数据是否启用
 * - syntheticDisabledReason (String): 禁用原因
 * - syntheticDisabledAt (LocalDateTime): 禁用时间
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyntheticCircuitBreaker {

    private final SyntheticDataMonitorService syntheticDataMonitorService;
    private final SyntheticDataConfig syntheticDataConfig;
    private final FactoryAILearningConfigRepository factoryAILearningConfigRepository;

    /**
     * 每日 02:30 执行熔断检查
     * 检查所有启用合成数据的工厂，评估昨日指标
     */
    @Scheduled(cron = "0 30 2 * * ?")
    @Transactional
    public void checkCircuitBreaker() {
        log.info("========== 开始执行合成数据熔断检查 ==========");

        try {
            // 获取所有启用合成数据的工厂配置
            List<FactoryAILearningConfig> configs = getSyntheticEnabledFactories();

            int checkedCount = 0;
            int trippedCount = 0;

            for (FactoryAILearningConfig config : configs) {
                String factoryId = config.getFactoryId();

                try {
                    // 计算昨日指标
                    LocalDate yesterday = LocalDate.now().minusDays(1);
                    SyntheticDataMonitorService.SyntheticDataMetrics metrics =
                        syntheticDataMonitorService.calculateDailyMetrics(factoryId, yesterday);

                    checkedCount++;

                    // 检查是否需要熔断
                    if (shouldTrip(metrics)) {
                        String reason = buildTripReason(metrics);
                        disableSynthetic(factoryId, reason);
                        trippedCount++;

                        log.warn("工厂 {} 合成数据熔断触发: {}", factoryId, reason);
                    } else {
                        log.debug("工厂 {} 合成数据质量正常: accuracy={}, drift={}",
                            factoryId, metrics.getMixedAccuracy(), metrics.getDistributionDrift());
                    }

                } catch (Exception e) {
                    log.error("工厂 {} 熔断检查失败: {}", factoryId, e.getMessage(), e);
                }
            }

            log.info("合成数据熔断检查完成: 检查 {} 个工厂, 触发熔断 {} 个",
                checkedCount, trippedCount);

        } catch (Exception e) {
            log.error("合成数据熔断检查任务异常: {}", e.getMessage(), e);
        }
    }

    /**
     * 禁用指定工厂的合成数据生成
     *
     * @param factoryId 工厂ID
     * @param reason 禁用原因
     */
    @Transactional
    public void disableSynthetic(String factoryId, String reason) {
        log.info("禁用工厂 {} 的合成数据生成: {}", factoryId, reason);

        Optional<FactoryAILearningConfig> configOpt =
            factoryAILearningConfigRepository.findByFactoryId(factoryId);

        if (configOpt.isEmpty()) {
            log.warn("工厂 {} 配置不存在，无法禁用合成数据", factoryId);
            return;
        }

        FactoryAILearningConfig config = configOpt.get();

        // NOTE: 需要在 FactoryAILearningConfig 中添加这些字段
        // config.setSyntheticEnabled(false);
        // config.setSyntheticDisabledReason(reason);
        // config.setSyntheticDisabledAt(LocalDateTime.now());

        // 临时实现：通过日志记录状态变更
        log.info("工厂 {} 合成数据已禁用，原因: {}, 时间: {}",
            factoryId, reason, LocalDateTime.now());

        factoryAILearningConfigRepository.save(config);

        // 发送告警通知（可选）
        sendAlert(factoryId, reason);
    }

    /**
     * 判断是否应该触发熔断
     *
     * @param metrics 合成数据指标
     * @return true 如果需要熔断
     */
    public boolean shouldTrip(SyntheticDataMonitorService.SyntheticDataMetrics metrics) {
        if (metrics == null) {
            log.warn("指标为空，跳过熔断检查");
            return false;
        }

        // 检查1: 准确率是否低于阈值
        BigDecimal accuracyThreshold = syntheticDataConfig.getAccuracyThreshold();
        Double mixedAccuracy = metrics.getMixedAccuracy();
        if (mixedAccuracy != null &&
            Double.compare(mixedAccuracy, accuracyThreshold.doubleValue()) < 0) {
            log.info("准确率 {} 低于阈值 {}", mixedAccuracy, accuracyThreshold);
            return true;
        }

        // 检查2: 分布漂移是否超过阈值
        BigDecimal driftThreshold = syntheticDataConfig.getDistributionDriftThreshold();
        double distributionDrift = metrics.getDistributionDrift();
        if (Double.compare(distributionDrift, driftThreshold.doubleValue()) > 0) {
            log.info("分布漂移 {} 超过阈值 {}", distributionDrift, driftThreshold);
            return true;
        }

        return false;
    }

    /**
     * 手动重置熔断器，重新启用合成数据生成
     *
     * @param factoryId 工厂ID
     */
    @Transactional
    public void resetCircuitBreaker(String factoryId) {
        log.info("手动重置工厂 {} 的合成数据熔断器", factoryId);

        Optional<FactoryAILearningConfig> configOpt =
            factoryAILearningConfigRepository.findByFactoryId(factoryId);

        if (configOpt.isEmpty()) {
            log.warn("工厂 {} 配置不存在，无法重置熔断器", factoryId);
            return;
        }

        FactoryAILearningConfig config = configOpt.get();

        // NOTE: 需要在 FactoryAILearningConfig 中添加这些字段
        // config.setSyntheticEnabled(true);
        // config.setSyntheticDisabledReason(null);
        // config.setSyntheticDisabledAt(null);

        log.info("工厂 {} 合成数据熔断器已重置，重新启用", factoryId);

        factoryAILearningConfigRepository.save(config);
    }

    /**
     * 获取所有启用合成数据的工厂配置
     *
     * @return 启用合成数据的工厂配置列表
     */
    private List<FactoryAILearningConfig> getSyntheticEnabledFactories() {
        // NOTE: 需要在 Repository 中添加 findBySyntheticEnabledTrue() 方法
        // 临时实现：使用现有的 autoLearnEnabled 作为代理
        return factoryAILearningConfigRepository.findByAutoLearnEnabledTrue();
    }

    /**
     * 构建熔断原因描述
     *
     * @param metrics 合成数据指标
     * @return 原因描述
     */
    private String buildTripReason(SyntheticDataMonitorService.SyntheticDataMetrics metrics) {
        StringBuilder reason = new StringBuilder();

        BigDecimal accuracyThreshold = syntheticDataConfig.getAccuracyThreshold();
        Double mixedAccuracy = metrics.getMixedAccuracy();
        if (mixedAccuracy != null &&
            Double.compare(mixedAccuracy, accuracyThreshold.doubleValue()) < 0) {
            reason.append(String.format("准确率过低(%.2f%% < %.2f%%)",
                mixedAccuracy * 100,
                accuracyThreshold.doubleValue() * 100));
        }

        BigDecimal driftThreshold = syntheticDataConfig.getDistributionDriftThreshold();
        double distributionDrift = metrics.getDistributionDrift();
        if (Double.compare(distributionDrift, driftThreshold.doubleValue()) > 0) {
            if (reason.length() > 0) {
                reason.append("; ");
            }
            reason.append(String.format("分布漂移过高(%.4f > %.4f)",
                distributionDrift,
                driftThreshold.doubleValue()));
        }

        return reason.length() > 0 ? reason.toString() : "未知原因";
    }

    /**
     * 发送告警通知（可选实现）
     *
     * @param factoryId 工厂ID
     * @param reason 告警原因
     */
    private void sendAlert(String factoryId, String reason) {
        // TODO: 集成告警服务（如钉钉、企业微信、邮件等）
        log.warn("[告警] 工厂 {} 合成数据熔断: {}", factoryId, reason);
    }

    /**
     * 获取指定工厂的熔断器状态
     *
     * @param factoryId 工厂ID
     * @return 熔断器状态信息
     */
    public CircuitBreakerStatus getStatus(String factoryId) {
        Optional<FactoryAILearningConfig> configOpt =
            factoryAILearningConfigRepository.findByFactoryId(factoryId);

        if (configOpt.isEmpty()) {
            return CircuitBreakerStatus.builder()
                .factoryId(factoryId)
                .exists(false)
                .build();
        }

        FactoryAILearningConfig config = configOpt.get();

        // NOTE: 实际实现需要读取 syntheticEnabled 等字段
        return CircuitBreakerStatus.builder()
            .factoryId(factoryId)
            .exists(true)
            .enabled(true) // 临时：应该从 config.getSyntheticEnabled() 读取
            .disabledReason(null) // 临时：应该从 config.getSyntheticDisabledReason() 读取
            .disabledAt(null) // 临时：应该从 config.getSyntheticDisabledAt() 读取
            .build();
    }

    /**
     * 熔断器状态 DTO
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class CircuitBreakerStatus {
        private String factoryId;
        private boolean exists;
        private boolean enabled;
        private String disabledReason;
        private LocalDateTime disabledAt;
    }
}
