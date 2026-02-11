package com.cretas.aims.scheduler;

import com.cretas.aims.entity.ProductionAlert;
import com.cretas.aims.repository.ProductionAlertRepository;
import com.cretas.aims.service.AnomalyDetectionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 异常检测定时调度器
 *
 * 调度策略:
 * - 每2小时执行一次全量异常检测
 * - 每4小时自动验证已解决超过24小时的告警
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Component
public class AnomalyDetectionScheduler {

    private static final Logger log = LoggerFactory.getLogger(AnomalyDetectionScheduler.class);

    @Autowired
    private AnomalyDetectionService anomalyDetectionService;

    @Autowired
    private ProductionAlertRepository alertRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 每2小时执行全量异常检测
     */
    @Scheduled(cron = "0 0 */2 * * *")
    public void scheduledDetection() {
        log.info("开始定时异常检测...");
        try {
            int alertCount = anomalyDetectionService.detectAnomaliesForAllFactories();
            log.info("定时异常检测完成，新增 {} 条告警", alertCount);
        } catch (Exception e) {
            log.error("定时异常检测失败", e);
        }
    }

    /**
     * 每4小时自动验证已解决超过24小时的告警
     *
     * 逻辑:
     * - 查询 status=RESOLVED 且 resolved_at 超过24小时的告警
     * - 重新检查对应指标是否恢复正常
     * - 如果正常 -> VERIFIED（自动验证）
     * - 如果仍异常 -> 重新激活为 ACTIVE
     */
    @Scheduled(cron = "0 30 */4 * * *")
    @Transactional
    public void autoVerifyResolvedAlerts() {
        log.info("开始自动验证已解决告警...");
        try {
            LocalDateTime cutoffTime = LocalDateTime.now().minusHours(24);
            List<ProductionAlert> resolvedAlerts = alertRepository.findByStatusAndResolvedAtBefore("RESOLVED", cutoffTime);

            if (resolvedAlerts.isEmpty()) {
                log.debug("无需验证的告警");
                return;
            }

            int verifiedCount = 0;
            int reactivatedCount = 0;

            for (ProductionAlert alert : resolvedAlerts) {
                try {
                    boolean stillAbnormal = isMetricStillAbnormal(alert);

                    if (!stillAbnormal) {
                        // Metric recovered, mark as verified
                        alert.setStatus("VERIFIED");
                        alert.setVerifiedAt(LocalDateTime.now());
                        alert.setAutoVerified(true);
                        alertRepository.save(alert);
                        verifiedCount++;
                    } else {
                        // Metric still bad, reactivate the alert
                        alert.setStatus("ACTIVE");
                        alert.setResolvedAt(null);
                        alert.setResolvedBy(null);
                        alert.setResolutionNotes(alert.getResolutionNotes() != null
                                ? alert.getResolutionNotes() + " [自动重新激活: 指标仍异常]"
                                : "[自动重新激活: 指标仍异常]");
                        alertRepository.save(alert);
                        reactivatedCount++;
                    }
                } catch (Exception e) {
                    log.warn("验证告警失败: alertId={}, error={}", alert.getId(), e.getMessage());
                }
            }

            log.info("自动验证完成: 已验证={}, 重新激活={}, 总处理={}", verifiedCount, reactivatedCount, resolvedAlerts.size());
        } catch (Exception e) {
            log.error("自动验证已解决告警失败", e);
        }
    }

    /**
     * Check if the metric that triggered this alert is still abnormal.
     * Uses a simplified check: query the latest metric value and compare to threshold.
     */
    private boolean isMetricStillAbnormal(ProductionAlert alert) {
        if (alert.getMetricName() == null || alert.getFactoryId() == null) {
            return false;
        }

        String columnName = mapMetricToColumn(alert.getMetricName());
        if (columnName == null) {
            return false;
        }

        // Get the latest metric value
        String sql = "SELECT AVG(sub." + columnName + ") FROM (" +
                "SELECT " + columnName + " FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND deleted_at IS NULL " +
                "AND " + columnName + " IS NOT NULL " +
                "ORDER BY created_at DESC " +
                "LIMIT 3" +
                ") sub";

        try {
            Query query = entityManager.createNativeQuery(sql);
            query.setParameter("factoryId", alert.getFactoryId());
            Object result = query.getSingleResult();

            if (result == null) {
                return false;
            }

            double currentValue = ((Number) result).doubleValue();

            // Compare with the original threshold/baseline
            if (alert.getThresholdValue() != null) {
                // Static threshold comparison
                if (alert.getCurrentValue() != null && alert.getCurrentValue() < alert.getThresholdValue()) {
                    // Was LESS_THAN violation: still abnormal if still below
                    return currentValue < alert.getThresholdValue();
                } else {
                    // Was GREATER_THAN violation: still abnormal if still above
                    return currentValue > alert.getThresholdValue();
                }
            } else if (alert.getBaselineValue() != null && alert.getDeviationPercent() != null) {
                // Dynamic deviation: check if still deviating
                double deviation = Math.abs((currentValue - alert.getBaselineValue()) / alert.getBaselineValue()) * 100.0;
                return deviation > alert.getDeviationPercent();
            }
        } catch (Exception e) {
            log.debug("检查指标异常状态失败: alertId={}, error={}", alert.getId(), e.getMessage());
        }

        return false;
    }

    /**
     * Map metric name to database column (whitelist for SQL injection prevention).
     */
    private String mapMetricToColumn(String metricName) {
        if (metricName == null) return null;
        switch (metricName) {
            case "yield_rate": return "yield_rate";
            case "efficiency": return "efficiency";
            case "unit_cost": return "unit_cost";
            case "total_cost": return "total_cost";
            case "defect_quantity": return "defect_quantity";
            case "actual_quantity": return "actual_quantity";
            case "work_duration_minutes": return "work_duration_minutes";
            case "labor_cost": return "labor_cost";
            case "equipment_cost": return "equipment_cost";
            case "material_cost": return "material_cost";
            default: return null;
        }
    }
}
