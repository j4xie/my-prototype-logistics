package com.cretas.aims.service.impl;

import com.cretas.aims.entity.AlertThreshold;
import com.cretas.aims.entity.ProductionAlert;
import com.cretas.aims.event.ProductionAlertEvent;
import com.cretas.aims.repository.AlertThresholdRepository;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.repository.ProductionAlertRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.service.AnomalyDetectionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.Query;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * 异常检测服务实现
 *
 * 检测逻辑:
 * 1. 加载工厂的启用阈值规则
 * 2. 对每条规则:
 *    - 静态阈值 (LESS_THAN/GREATER_THAN): 查询最近3个批次的平均值，与阈值比较
 *    - 动态基线 (DEVIATION_BELOW/DEVIATION_ABOVE): 计算N天滚动平均，比较近期偏差
 * 3. 违规则创建 ProductionAlert 实体
 * 4. CRITICAL 级别设置 AI 分析标志
 * 5. 发布 Spring ApplicationEvent 用于通知
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
@Service
public class AnomalyDetectionServiceImpl implements AnomalyDetectionService {

    private static final Logger log = LoggerFactory.getLogger(AnomalyDetectionServiceImpl.class);

    /** Number of recent batches to average for current metric value */
    private static final int RECENT_BATCH_COUNT = 3;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private AlertThresholdRepository thresholdRepository;

    @Autowired
    private ProductionAlertRepository alertRepository;

    @Autowired
    private ProductionBatchRepository batchRepository;

    @Autowired
    private FactoryRepository factoryRepository;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public int detectAnomalies(String factoryId) {
        log.info("开始异常检测: factoryId={}", factoryId);

        List<AlertThreshold> thresholds = thresholdRepository.findByFactoryIdAndEnabled(factoryId, true);
        if (thresholds.isEmpty()) {
            log.debug("工厂 {} 无启用的阈值规则，跳过检测", factoryId);
            return 0;
        }

        int alertCount = 0;
        for (AlertThreshold threshold : thresholds) {
            try {
                boolean violated = evaluateThreshold(factoryId, threshold);
                if (violated) {
                    alertCount++;
                }
            } catch (Exception e) {
                log.warn("评估阈值规则失败: factoryId={}, metric={}, error={}",
                        factoryId, threshold.getMetricName(), e.getMessage());
            }
        }

        log.info("异常检测完成: factoryId={}, 新告警数={}", factoryId, alertCount);
        return alertCount;
    }

    @Override
    @Transactional
    public int detectAnomaliesForAllFactories() {
        List<String> factoryIds = factoryRepository.findAllActiveFactoryIds();
        log.info("对 {} 个活跃工厂执行异常检测", factoryIds.size());

        int totalAlerts = 0;
        for (String factoryId : factoryIds) {
            try {
                totalAlerts += detectAnomalies(factoryId);
            } catch (Exception e) {
                log.error("工厂 {} 异常检测失败: {}", factoryId, e.getMessage(), e);
            }
        }
        return totalAlerts;
    }

    @Override
    public Map<String, Object> getAlertSummary(String factoryId) {
        Map<String, Object> summary = new HashMap<>();

        // Active alert counts
        long activeCount = alertRepository.countByFactoryIdAndStatus(factoryId, "ACTIVE");
        long criticalCount = alertRepository.countByFactoryIdAndStatusAndLevel(factoryId, "ACTIVE", "CRITICAL");
        long warningCount = alertRepository.countByFactoryIdAndStatusAndLevel(factoryId, "ACTIVE", "WARNING");

        // Resolved today
        LocalDateTime todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.MIN);
        LocalDateTime todayEnd = LocalDateTime.of(LocalDate.now(), LocalTime.MAX);
        List<ProductionAlert> resolvedToday = alertRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId, todayStart, todayEnd);
        long resolvedTodayCount = resolvedToday.stream()
                .filter(a -> "RESOLVED".equals(a.getStatus()) || "VERIFIED".equals(a.getStatus()))
                .count();

        // Average resolution time (hours) for recently resolved alerts
        double avgResolutionHours = computeAverageResolutionHours(factoryId);

        // Recent alerts (last 5)
        List<ProductionAlert> recentAlerts = alertRepository
                .findByFactoryIdOrderByCreatedAtDesc(factoryId, PageRequest.of(0, 5))
                .getContent();

        List<Map<String, Object>> recentAlertMaps = new ArrayList<>();
        for (ProductionAlert alert : recentAlerts) {
            Map<String, Object> alertMap = new LinkedHashMap<>();
            alertMap.put("id", alert.getId());
            alertMap.put("alertType", alert.getAlertType());
            alertMap.put("level", alert.getLevel());
            alertMap.put("status", alert.getStatus());
            alertMap.put("metricName", alert.getMetricName());
            alertMap.put("currentValue", alert.getCurrentValue());
            alertMap.put("baselineValue", alert.getBaselineValue());
            alertMap.put("description", alert.getDescription());
            alertMap.put("createdAt", alert.getCreatedAt() != null ? alert.getCreatedAt().toString() : null);
            recentAlertMaps.add(alertMap);
        }

        summary.put("activeCount", activeCount);
        summary.put("criticalCount", criticalCount);
        summary.put("warningCount", warningCount);
        summary.put("resolvedToday", resolvedTodayCount);
        summary.put("avgResolutionHours", Math.round(avgResolutionHours * 10.0) / 10.0);
        summary.put("recentAlerts", recentAlertMaps);

        return summary;
    }

    // ==================== Private Methods ====================

    /**
     * Evaluate a single threshold rule against current production data.
     * Returns true if the threshold was violated and an alert was created.
     */
    private boolean evaluateThreshold(String factoryId, AlertThreshold threshold) {
        String metricName = threshold.getMetricName();
        String comparison = threshold.getComparison();

        Double currentValue = queryRecentMetricAverage(factoryId, metricName, RECENT_BATCH_COUNT);
        if (currentValue == null) {
            log.debug("无法获取指标当前值: factoryId={}, metric={}", factoryId, metricName);
            return false;
        }

        boolean violated = false;
        Double baselineValue = null;
        Double thresholdValue = null;
        Double deviationPercent = null;

        if ("LESS_THAN".equals(comparison)) {
            // Static threshold: alert if current < threshold
            thresholdValue = threshold.getStaticThreshold();
            if (thresholdValue != null && currentValue < thresholdValue) {
                violated = true;
            }
        } else if ("GREATER_THAN".equals(comparison)) {
            // Static threshold: alert if current > threshold
            thresholdValue = threshold.getStaticThreshold();
            if (thresholdValue != null && currentValue > thresholdValue) {
                violated = true;
            }
        } else if ("DEVIATION_BELOW".equals(comparison)) {
            // Dynamic baseline: alert if current is deviationPercent% below rolling average
            int baselineDays = threshold.getBaselineDays() != null ? threshold.getBaselineDays() : 30;
            baselineValue = queryRollingAverage(factoryId, metricName, baselineDays);
            if (baselineValue != null && baselineValue > 0 && threshold.getDeviationPercent() != null) {
                deviationPercent = ((baselineValue - currentValue) / baselineValue) * 100.0;
                if (deviationPercent > threshold.getDeviationPercent()) {
                    violated = true;
                }
            }
        } else if ("DEVIATION_ABOVE".equals(comparison)) {
            // Dynamic baseline: alert if current is deviationPercent% above rolling average
            int baselineDays = threshold.getBaselineDays() != null ? threshold.getBaselineDays() : 30;
            baselineValue = queryRollingAverage(factoryId, metricName, baselineDays);
            if (baselineValue != null && baselineValue > 0 && threshold.getDeviationPercent() != null) {
                deviationPercent = ((currentValue - baselineValue) / baselineValue) * 100.0;
                if (deviationPercent > threshold.getDeviationPercent()) {
                    violated = true;
                }
            }
        } else {
            log.warn("未知的比较方式: {}", comparison);
            return false;
        }

        if (!violated) {
            return false;
        }

        // Check for duplicate active alerts (same factory + type + metric)
        List<ProductionAlert> existingActive = alertRepository.findByFactoryIdAndStatus(factoryId, "ACTIVE");
        boolean alreadyExists = existingActive.stream()
                .anyMatch(a -> threshold.getAlertType().equals(a.getAlertType())
                        && metricName.equals(a.getMetricName()));
        if (alreadyExists) {
            log.debug("已存在相同活跃告警，跳过: factoryId={}, type={}, metric={}",
                    factoryId, threshold.getAlertType(), metricName);
            return false;
        }

        // Create the alert
        String description = buildAlertDescription(threshold, currentValue, baselineValue, thresholdValue, deviationPercent);

        ProductionAlert alert = ProductionAlert.builder()
                .factoryId(factoryId)
                .alertType(threshold.getAlertType())
                .level(threshold.getLevel())
                .status("ACTIVE")
                .metricName(metricName)
                .currentValue(currentValue)
                .baselineValue(baselineValue)
                .thresholdValue(thresholdValue)
                .deviationPercent(deviationPercent)
                .description(description)
                .build();

        alertRepository.save(alert);

        log.info("创建生产告警: factoryId={}, type={}, level={}, metric={}, current={}, baseline={}",
                factoryId, threshold.getAlertType(), threshold.getLevel(),
                metricName, currentValue, baselineValue);

        // Publish event for notification
        eventPublisher.publishEvent(new ProductionAlertEvent(
                this,
                alert.getId(),
                factoryId,
                threshold.getAlertType(),
                threshold.getLevel(),
                description
        ));

        return true;
    }

    /**
     * Query the average value of a metric from the most recent N completed batches.
     */
    private Double queryRecentMetricAverage(String factoryId, String metricName, int batchCount) {
        String columnName = mapMetricToColumn(metricName);
        if (columnName == null) {
            return null;
        }

        String sql = "SELECT AVG(sub." + columnName + ") FROM (" +
                "SELECT " + columnName + " FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND deleted_at IS NULL " +
                "AND " + columnName + " IS NOT NULL " +
                "ORDER BY created_at DESC " +
                "LIMIT :batchCount" +
                ") sub";

        try {
            Query query = entityManager.createNativeQuery(sql);
            query.setParameter("factoryId", factoryId);
            query.setParameter("batchCount", batchCount);
            Object result = query.getSingleResult();
            return result != null ? ((Number) result).doubleValue() : null;
        } catch (Exception e) {
            log.debug("查询最近批次指标失败: metric={}, error={}", metricName, e.getMessage());
            return null;
        }
    }

    /**
     * Query the rolling average of a metric over the specified number of days.
     */
    private Double queryRollingAverage(String factoryId, String metricName, int days) {
        String columnName = mapMetricToColumn(metricName);
        if (columnName == null) {
            return null;
        }

        String sql = "SELECT AVG(" + columnName + ") FROM production_batches " +
                "WHERE factory_id = :factoryId " +
                "AND created_at > (NOW() - INTERVAL '" + days + " days') " +
                "AND deleted_at IS NULL " +
                "AND " + columnName + " IS NOT NULL";

        try {
            Query query = entityManager.createNativeQuery(sql);
            query.setParameter("factoryId", factoryId);
            Object result = query.getSingleResult();
            return result != null ? ((Number) result).doubleValue() : null;
        } catch (Exception e) {
            log.debug("查询滚动平均值失败: metric={}, days={}, error={}", metricName, days, e.getMessage());
            return null;
        }
    }

    /**
     * Map a metric name (from AlertThreshold) to the actual database column in production_batches.
     * Only allows known safe column names to prevent SQL injection.
     */
    private String mapMetricToColumn(String metricName) {
        if (metricName == null) {
            return null;
        }
        switch (metricName) {
            case "yield_rate":
                return "yield_rate";
            case "efficiency":
                return "efficiency";
            case "unit_cost":
                return "unit_cost";
            case "total_cost":
                return "total_cost";
            case "defect_quantity":
                return "defect_quantity";
            case "actual_quantity":
                return "actual_quantity";
            case "work_duration_minutes":
                return "work_duration_minutes";
            case "labor_cost":
                return "labor_cost";
            case "equipment_cost":
                return "equipment_cost";
            case "material_cost":
                return "material_cost";
            default:
                log.warn("未知的指标名称: {}", metricName);
                return null;
        }
    }

    /**
     * Build a human-readable description for the alert.
     */
    private String buildAlertDescription(AlertThreshold threshold, Double currentValue,
                                         Double baselineValue, Double thresholdValue,
                                         Double deviationPercent) {
        String metricLabel = getMetricLabel(threshold.getMetricName());
        String comparison = threshold.getComparison();

        String formattedCurrent = String.format("%.2f", currentValue);

        if ("LESS_THAN".equals(comparison) || "GREATER_THAN".equals(comparison)) {
            String op = "LESS_THAN".equals(comparison) ? "低于" : "高于";
            return String.format("%s当前值 %s %s阈值 %.2f",
                    metricLabel, formattedCurrent, op, thresholdValue);
        } else if ("DEVIATION_BELOW".equals(comparison) || "DEVIATION_ABOVE".equals(comparison)) {
            String direction = "DEVIATION_BELOW".equals(comparison) ? "低于" : "高于";
            return String.format("%s当前值 %s %s基线 %.2f，偏差 %.1f%%（阈值 %.1f%%）",
                    metricLabel, formattedCurrent, direction,
                    baselineValue != null ? baselineValue : 0.0,
                    deviationPercent != null ? deviationPercent : 0.0,
                    threshold.getDeviationPercent() != null ? threshold.getDeviationPercent() : 0.0);
        }
        return String.format("%s异常: 当前值 %s", metricLabel, formattedCurrent);
    }

    /**
     * Get a human-readable label for a metric name.
     */
    private String getMetricLabel(String metricName) {
        if (metricName == null) return "未知指标";
        switch (metricName) {
            case "yield_rate": return "良率";
            case "efficiency": return "效率";
            case "unit_cost": return "单位成本";
            case "total_cost": return "总成本";
            case "defect_quantity": return "缺陷数";
            case "actual_quantity": return "实际产量";
            case "work_duration_minutes": return "工作时长";
            case "labor_cost": return "人工成本";
            case "equipment_cost": return "设备成本";
            case "material_cost": return "原料成本";
            default: return metricName;
        }
    }

    /**
     * Compute the average resolution time (in hours) for alerts resolved in the last 30 days.
     */
    private double computeAverageResolutionHours(String factoryId) {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        List<ProductionAlert> resolved = alertRepository.findByStatusAndResolvedAtBefore("RESOLVED", LocalDateTime.now());

        long totalHours = 0;
        int count = 0;
        for (ProductionAlert alert : resolved) {
            if (!factoryId.equals(alert.getFactoryId())) {
                continue;
            }
            if (alert.getCreatedAt() != null && alert.getResolvedAt() != null
                    && alert.getResolvedAt().isAfter(thirtyDaysAgo)) {
                Duration duration = Duration.between(alert.getCreatedAt(), alert.getResolvedAt());
                totalHours += duration.toHours();
                count++;
            }
        }
        return count > 0 ? (double) totalHours / count : 0.0;
    }
}
