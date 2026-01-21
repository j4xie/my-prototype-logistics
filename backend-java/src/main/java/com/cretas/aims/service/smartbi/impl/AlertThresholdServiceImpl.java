package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.entity.smartbi.SmartBiAlertThreshold;
import com.cretas.aims.repository.smartbi.SmartBiAlertThresholdRepository;
import com.cretas.aims.service.smartbi.AlertThresholdService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 告警阈值服务实现
 *
 * 特性：
 * - 使用 ConcurrentHashMap 进行本地缓存
 * - 支持工厂级别配置覆盖全局配置
 * - 支持热重载，无需重启服务
 *
 * 缓存键格式：
 * - 全局配置: {thresholdType}:{metricCode}
 * - 工厂配置: {thresholdType}:{metricCode}:{factoryId}
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertThresholdServiceImpl implements AlertThresholdService {

    private final SmartBiAlertThresholdRepository thresholdRepository;

    /**
     * 阈值缓存
     * Key: {thresholdType}:{metricCode} 或 {thresholdType}:{metricCode}:{factoryId}
     * Value: SmartBiAlertThreshold
     */
    private final Map<String, SmartBiAlertThreshold> thresholdCache = new ConcurrentHashMap<>();

    /**
     * 类型列表缓存
     * Key: thresholdType
     * Value: List<SmartBiAlertThreshold>
     */
    private final Map<String, List<SmartBiAlertThreshold>> typeCache = new ConcurrentHashMap<>();

    /**
     * 初始化时加载所有阈值配置到缓存
     */
    @PostConstruct
    public void init() {
        log.info("初始化告警阈值缓存...");
        reload();
        log.info("告警阈值缓存初始化完成，共加载 {} 条配置", thresholdCache.size());
    }

    // ==================== 查询方法 ====================

    @Override
    @Transactional(readOnly = true)
    public SmartBiAlertThreshold getThreshold(String thresholdType, String metricCode) {
        String cacheKey = buildCacheKey(thresholdType, metricCode, null);

        return thresholdCache.computeIfAbsent(cacheKey, key -> {
            log.debug("缓存未命中，从数据库加载阈值: type={}, metric={}", thresholdType, metricCode);
            return thresholdRepository.findGlobalThreshold(thresholdType, metricCode).orElse(null);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public SmartBiAlertThreshold getThreshold(String thresholdType, String metricCode, String factoryId) {
        if (factoryId == null) {
            return getThreshold(thresholdType, metricCode);
        }

        // 先查工厂级别配置
        String factoryCacheKey = buildCacheKey(thresholdType, metricCode, factoryId);
        SmartBiAlertThreshold factoryThreshold = thresholdCache.get(factoryCacheKey);

        if (factoryThreshold != null) {
            return factoryThreshold;
        }

        // 从数据库查询工厂配置
        List<SmartBiAlertThreshold> thresholds = thresholdRepository.findThresholdWithFallback(
                thresholdType, metricCode, factoryId);

        if (!thresholds.isEmpty()) {
            SmartBiAlertThreshold threshold = thresholds.get(0);
            // 缓存结果
            String actualKey = buildCacheKey(thresholdType, metricCode, threshold.getFactoryId());
            thresholdCache.put(actualKey, threshold);
            return threshold;
        }

        // 没有找到配置
        log.debug("未找到阈值配置: type={}, metric={}, factoryId={}", thresholdType, metricCode, factoryId);
        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiAlertThreshold> getThresholdsByType(String thresholdType) {
        return typeCache.computeIfAbsent(thresholdType, key -> {
            log.debug("加载类型阈值列表: type={}", thresholdType);
            return thresholdRepository.findByThresholdTypeAndIsActiveTrue(thresholdType);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiAlertThreshold> getThresholdsByType(String thresholdType, String factoryId) {
        String cacheKey = thresholdType + ":" + (factoryId != null ? factoryId : "GLOBAL");

        return typeCache.computeIfAbsent(cacheKey, key -> {
            log.debug("加载类型阈值列表: type={}, factoryId={}", thresholdType, factoryId);
            if (factoryId == null) {
                return thresholdRepository.findByThresholdTypeAndIsActiveTrue(thresholdType);
            }
            return thresholdRepository.findByThresholdTypeAndFactoryId(thresholdType, factoryId);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> getAllThresholdTypes() {
        return thresholdRepository.findAllThresholdTypes();
    }

    // ==================== 更新方法 ====================

    @Override
    @Transactional
    public void updateThreshold(Long id, BigDecimal warningValue, BigDecimal criticalValue) {
        SmartBiAlertThreshold threshold = thresholdRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("阈值配置不存在: id=" + id));

        log.info("更新阈值配置: id={}, 原警告值={}, 新警告值={}, 原严重值={}, 新严重值={}",
                id, threshold.getWarningValue(), warningValue,
                threshold.getCriticalValue(), criticalValue);

        threshold.setWarningValue(warningValue);
        threshold.setCriticalValue(criticalValue);
        thresholdRepository.save(threshold);

        // 更新缓存
        String cacheKey = buildCacheKey(threshold.getThresholdType(),
                threshold.getMetricCode(), threshold.getFactoryId());
        thresholdCache.put(cacheKey, threshold);

        // 清除类型缓存
        invalidateTypeCache(threshold.getThresholdType());

        log.info("阈值配置更新完成: id={}", id);
    }

    @Override
    @Transactional
    public SmartBiAlertThreshold saveThreshold(SmartBiAlertThreshold threshold) {
        log.info("保存阈值配置: type={}, metric={}, factoryId={}",
                threshold.getThresholdType(), threshold.getMetricCode(), threshold.getFactoryId());

        SmartBiAlertThreshold saved = thresholdRepository.save(threshold);

        // 更新缓存
        String cacheKey = buildCacheKey(saved.getThresholdType(),
                saved.getMetricCode(), saved.getFactoryId());
        thresholdCache.put(cacheKey, saved);

        // 清除类型缓存
        invalidateTypeCache(saved.getThresholdType());

        log.info("阈值配置保存完成: id={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public void deleteThreshold(Long id) {
        SmartBiAlertThreshold threshold = thresholdRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("阈值配置不存在: id=" + id));

        log.info("删除阈值配置: id={}, type={}, metric={}",
                id, threshold.getThresholdType(), threshold.getMetricCode());

        // 软删除
        thresholdRepository.delete(threshold);

        // 移除缓存
        String cacheKey = buildCacheKey(threshold.getThresholdType(),
                threshold.getMetricCode(), threshold.getFactoryId());
        thresholdCache.remove(cacheKey);

        // 清除类型缓存
        invalidateTypeCache(threshold.getThresholdType());

        log.info("阈值配置删除完成: id={}", id);
    }

    // ==================== 告警检查方法 ====================

    @Override
    public String checkAlert(String thresholdType, String metricCode, BigDecimal value) {
        return checkAlert(thresholdType, metricCode, null, value);
    }

    @Override
    public String checkAlert(String thresholdType, String metricCode, String factoryId, BigDecimal value) {
        SmartBiAlertThreshold threshold = getThreshold(thresholdType, metricCode, factoryId);

        if (threshold == null) {
            log.debug("未找到阈值配置，返回 NORMAL: type={}, metric={}", thresholdType, metricCode);
            return "NORMAL";
        }

        String alertLevel = threshold.getAlertLevel(value);

        if (!"NORMAL".equals(alertLevel)) {
            log.info("触发告警: type={}, metric={}, value={}, level={}",
                    thresholdType, metricCode, value, alertLevel);
        }

        return alertLevel;
    }

    // ==================== 缓存管理方法 ====================

    @Override
    public void reload() {
        log.info("重新加载告警阈值缓存...");

        // 清除所有缓存
        thresholdCache.clear();
        typeCache.clear();

        // 重新加载所有启用的阈值配置
        List<SmartBiAlertThreshold> allThresholds = thresholdRepository.findAll()
                .stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                .collect(Collectors.toList());

        for (SmartBiAlertThreshold threshold : allThresholds) {
            String cacheKey = buildCacheKey(threshold.getThresholdType(),
                    threshold.getMetricCode(), threshold.getFactoryId());
            thresholdCache.put(cacheKey, threshold);
        }

        log.info("告警阈值缓存重新加载完成，共加载 {} 条配置", thresholdCache.size());
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建缓存键
     */
    private String buildCacheKey(String thresholdType, String metricCode, String factoryId) {
        if (factoryId == null) {
            return thresholdType + ":" + metricCode;
        }
        return thresholdType + ":" + metricCode + ":" + factoryId;
    }

    /**
     * 清除指定类型的缓存
     */
    private void invalidateTypeCache(String thresholdType) {
        typeCache.entrySet().removeIf(entry -> entry.getKey().startsWith(thresholdType));
    }
}
