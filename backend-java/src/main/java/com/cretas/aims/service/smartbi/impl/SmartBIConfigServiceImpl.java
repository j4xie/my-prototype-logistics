package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.ConfigOperationResult;
import com.cretas.aims.entity.smartbi.*;
import com.cretas.aims.repository.smartbi.*;
import com.cretas.aims.service.smartbi.SmartBIConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SmartBI 配置管理服务实现
 *
 * <p>实现统一的配置管理功能：
 * <ul>
 *   <li>提供 CRUD 操作</li>
 *   <li>管理内存缓存</li>
 *   <li>支持配置热重载</li>
 *   <li>记录配置变更日志</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmartBIConfigServiceImpl implements SmartBIConfigService {

    private final AiIntentConfigRepository intentConfigRepository;
    private final SmartBiAlertThresholdRepository alertThresholdRepository;
    private final SmartBiIncentiveRuleRepository incentiveRuleRepository;
    private final SmartBiDictionaryRepository dictionaryRepository;
    private final SmartBiMetricFormulaRepository metricFormulaRepository;
    private final CacheManager cacheManager;

    // 内存缓存
    private final Map<String, List<AiIntentConfig>> intentCache = new ConcurrentHashMap<>();
    private final Map<String, List<SmartBiAlertThreshold>> thresholdCache = new ConcurrentHashMap<>();
    private final Map<String, List<SmartBiIncentiveRule>> incentiveRuleCache = new ConcurrentHashMap<>();
    private final Map<String, List<SmartBiDictionary>> dictionaryCache = new ConcurrentHashMap<>();
    private final Map<String, List<SmartBiMetricFormula>> metricFormulaCache = new ConcurrentHashMap<>();

    // 最后更新时间
    private LocalDateTime lastIntentUpdate;
    private LocalDateTime lastThresholdUpdate;
    private LocalDateTime lastIncentiveRuleUpdate;
    private LocalDateTime lastFieldMappingUpdate;
    private LocalDateTime lastMetricFormulaUpdate;

    @PostConstruct
    public void init() {
        log.info("初始化 SmartBI 配置缓存...");
        try {
            reloadAll();
        } catch (Exception e) {
            log.warn("SmartBI 配置缓存初始化失败（表可能不存在）: {}", e.getMessage());
        }
    }

    // ==================== 意图配置 ====================

    @Override
    public List<AiIntentConfig> listIntents(String category) {
        if (category != null && !category.isEmpty()) {
            return intentConfigRepository.findByIntentCategoryAndIsActiveTrueOrderByPriorityAsc(category);
        }
        return intentConfigRepository.findByIsActiveTrueOrderByPriorityAsc();
    }

    @Override
    @Transactional
    public ConfigOperationResult createIntent(AiIntentConfig config) {
        try {
            // 验证唯一性
            if (intentConfigRepository.existsByIntentCodeAndIsActiveTrue(config.getIntentCode())) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_INTENT,
                        "意图代码已存在: " + config.getIntentCode());
            }

            config.setIsActive(true);
            AiIntentConfig saved = intentConfigRepository.save(config);
            log.info("创建意图配置: intentCode={}", config.getIntentCode());

            // 刷新缓存
            refreshIntentCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    ConfigOperationResult.OPERATION_CREATE,
                    "意图配置创建成功", 1);
        } catch (Exception e) {
            log.error("创建意图配置失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    "创建失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult updateIntent(Long id, AiIntentConfig config) {
        try {
            Optional<AiIntentConfig> existingOpt = intentConfigRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_INTENT,
                        "意图配置不存在: id=" + id);
            }

            AiIntentConfig existing = existingOpt.get();
            updateIntentFields(existing, config);
            intentConfigRepository.save(existing);
            log.info("更新意图配置: id={}, intentCode={}", id, existing.getIntentCode());

            // 刷新缓存
            refreshIntentCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    ConfigOperationResult.OPERATION_UPDATE,
                    "意图配置更新成功", 1);
        } catch (Exception e) {
            log.error("更新意图配置失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    "更新失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult deleteIntent(Long id) {
        try {
            Optional<AiIntentConfig> existingOpt = intentConfigRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_INTENT,
                        "意图配置不存在: id=" + id);
            }

            AiIntentConfig existing = existingOpt.get();
            existing.setIsActive(false);
            existing.softDelete();
            intentConfigRepository.save(existing);
            log.info("删除意图配置: id={}, intentCode={}", id, existing.getIntentCode());

            // 刷新缓存
            refreshIntentCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    ConfigOperationResult.OPERATION_DELETE,
                    "意图配置删除成功", 1);
        } catch (Exception e) {
            log.error("删除意图配置失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    "删除失败: " + e.getMessage());
        }
    }

    @Override
    public ConfigOperationResult reloadIntents() {
        try {
            int count = refreshIntentCache();
            log.info("重载意图配置缓存: count={}", count);
            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    ConfigOperationResult.OPERATION_RELOAD,
                    "意图配置重载成功", count);
        } catch (Exception e) {
            log.error("重载意图配置失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INTENT,
                    "重载失败: " + e.getMessage());
        }
    }

    // ==================== 告警阈值 ====================

    @Override
    public List<SmartBiAlertThreshold> listThresholds(String type) {
        if (type != null && !type.isEmpty()) {
            return alertThresholdRepository.findByThresholdTypeAndIsActiveTrue(type);
        }
        return alertThresholdRepository.findAll();
    }

    @Override
    @Transactional
    public ConfigOperationResult createThreshold(SmartBiAlertThreshold threshold) {
        try {
            // 验证唯一性
            if (alertThresholdRepository.existsByThresholdTypeAndMetricCodeAndFactoryId(
                    threshold.getThresholdType(), threshold.getMetricCode(), threshold.getFactoryId())) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                        "阈值配置已存在: " + threshold.getThresholdType() + "/" + threshold.getMetricCode());
            }

            threshold.setIsActive(true);
            alertThresholdRepository.save(threshold);
            log.info("创建告警阈值: type={}, metricCode={}",
                    threshold.getThresholdType(), threshold.getMetricCode());

            // 刷新缓存
            refreshThresholdCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    ConfigOperationResult.OPERATION_CREATE,
                    "阈值配置创建成功", 1);
        } catch (Exception e) {
            log.error("创建告警阈值失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    "创建失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult updateThreshold(Long id, SmartBiAlertThreshold threshold) {
        try {
            Optional<SmartBiAlertThreshold> existingOpt = alertThresholdRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                        "阈值配置不存在: id=" + id);
            }

            SmartBiAlertThreshold existing = existingOpt.get();
            updateThresholdFields(existing, threshold);
            alertThresholdRepository.save(existing);
            log.info("更新告警阈值: id={}, metricCode={}", id, existing.getMetricCode());

            // 刷新缓存
            refreshThresholdCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    ConfigOperationResult.OPERATION_UPDATE,
                    "阈值配置更新成功", 1);
        } catch (Exception e) {
            log.error("更新告警阈值失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    "更新失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult deleteThreshold(Long id) {
        try {
            Optional<SmartBiAlertThreshold> existingOpt = alertThresholdRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                        "阈值配置不存在: id=" + id);
            }

            SmartBiAlertThreshold existing = existingOpt.get();
            existing.setIsActive(false);
            existing.softDelete();
            alertThresholdRepository.save(existing);
            log.info("删除告警阈值: id={}, metricCode={}", id, existing.getMetricCode());

            // 刷新缓存
            refreshThresholdCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    ConfigOperationResult.OPERATION_DELETE,
                    "阈值配置删除成功", 1);
        } catch (Exception e) {
            log.error("删除告警阈值失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    "删除失败: " + e.getMessage());
        }
    }

    @Override
    public ConfigOperationResult reloadThresholds() {
        try {
            int count = refreshThresholdCache();
            log.info("重载告警阈值缓存: count={}", count);
            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    ConfigOperationResult.OPERATION_RELOAD,
                    "阈值配置重载成功", count);
        } catch (Exception e) {
            log.error("重载告警阈值失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_THRESHOLD,
                    "重载失败: " + e.getMessage());
        }
    }

    // ==================== 激励规则 ====================

    @Override
    public List<SmartBiIncentiveRule> listIncentiveRules(String ruleCode) {
        if (ruleCode != null && !ruleCode.isEmpty()) {
            return incentiveRuleRepository.findByRuleCodeAndIsActiveTrueOrderBySortOrderAsc(ruleCode);
        }
        return incentiveRuleRepository.findByIsActiveTrueOrderByRuleCodeAscSortOrderAsc();
    }

    @Override
    @Transactional
    public ConfigOperationResult createIncentiveRule(SmartBiIncentiveRule rule) {
        try {
            rule.setIsActive(true);
            incentiveRuleRepository.save(rule);
            log.info("创建激励规则: ruleCode={}, levelName={}",
                    rule.getRuleCode(), rule.getLevelName());

            // 刷新缓存
            refreshIncentiveRuleCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    ConfigOperationResult.OPERATION_CREATE,
                    "激励规则创建成功", 1);
        } catch (Exception e) {
            log.error("创建激励规则失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    "创建失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult updateIncentiveRule(Long id, SmartBiIncentiveRule rule) {
        try {
            Optional<SmartBiIncentiveRule> existingOpt = incentiveRuleRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                        "激励规则不存在: id=" + id);
            }

            SmartBiIncentiveRule existing = existingOpt.get();
            updateIncentiveRuleFields(existing, rule);
            incentiveRuleRepository.save(existing);
            log.info("更新激励规则: id={}, ruleCode={}", id, existing.getRuleCode());

            // 刷新缓存
            refreshIncentiveRuleCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    ConfigOperationResult.OPERATION_UPDATE,
                    "激励规则更新成功", 1);
        } catch (Exception e) {
            log.error("更新激励规则失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    "更新失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult deleteIncentiveRule(Long id) {
        try {
            Optional<SmartBiIncentiveRule> existingOpt = incentiveRuleRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                        "激励规则不存在: id=" + id);
            }

            SmartBiIncentiveRule existing = existingOpt.get();
            existing.setIsActive(false);
            existing.softDelete();
            incentiveRuleRepository.save(existing);
            log.info("删除激励规则: id={}, ruleCode={}", id, existing.getRuleCode());

            // 刷新缓存
            refreshIncentiveRuleCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    ConfigOperationResult.OPERATION_DELETE,
                    "激励规则删除成功", 1);
        } catch (Exception e) {
            log.error("删除激励规则失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    "删除失败: " + e.getMessage());
        }
    }

    @Override
    public ConfigOperationResult reloadIncentiveRules() {
        try {
            int count = refreshIncentiveRuleCache();
            log.info("重载激励规则缓存: count={}", count);
            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    ConfigOperationResult.OPERATION_RELOAD,
                    "激励规则重载成功", count);
        } catch (Exception e) {
            log.error("重载激励规则失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_INCENTIVE_RULE,
                    "重载失败: " + e.getMessage());
        }
    }

    // ==================== 字段映射 ====================

    @Override
    public List<SmartBiDictionary> listFieldMappings(String dictType) {
        if (dictType != null && !dictType.isEmpty()) {
            return dictionaryRepository.findByDictTypeAndIsActiveTrueOrderByPriorityAsc(dictType);
        }
        return dictionaryRepository.findAll();
    }

    @Override
    @Transactional
    public ConfigOperationResult createFieldMapping(SmartBiDictionary mapping) {
        try {
            // 验证唯一性
            if (dictionaryRepository.existsByDictTypeAndNameAndFactoryId(
                    mapping.getDictType(), mapping.getName(), mapping.getFactoryId())) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                        "字段映射已存在: " + mapping.getDictType() + "/" + mapping.getName());
            }

            mapping.setIsActive(true);
            dictionaryRepository.save(mapping);
            log.info("创建字段映射: dictType={}, name={}", mapping.getDictType(), mapping.getName());

            // 刷新缓存
            refreshDictionaryCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    ConfigOperationResult.OPERATION_CREATE,
                    "字段映射创建成功", 1);
        } catch (Exception e) {
            log.error("创建字段映射失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    "创建失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult updateFieldMapping(Long id, SmartBiDictionary mapping) {
        try {
            Optional<SmartBiDictionary> existingOpt = dictionaryRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                        "字段映射不存在: id=" + id);
            }

            SmartBiDictionary existing = existingOpt.get();
            updateDictionaryFields(existing, mapping);
            dictionaryRepository.save(existing);
            log.info("更新字段映射: id={}, name={}", id, existing.getName());

            // 刷新缓存
            refreshDictionaryCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    ConfigOperationResult.OPERATION_UPDATE,
                    "字段映射更新成功", 1);
        } catch (Exception e) {
            log.error("更新字段映射失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    "更新失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult deleteFieldMapping(Long id) {
        try {
            Optional<SmartBiDictionary> existingOpt = dictionaryRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                        "字段映射不存在: id=" + id);
            }

            SmartBiDictionary existing = existingOpt.get();
            existing.setIsActive(false);
            existing.softDelete();
            dictionaryRepository.save(existing);
            log.info("删除字段映射: id={}, name={}", id, existing.getName());

            // 刷新缓存
            refreshDictionaryCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    ConfigOperationResult.OPERATION_DELETE,
                    "字段映射删除成功", 1);
        } catch (Exception e) {
            log.error("删除字段映射失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    "删除失败: " + e.getMessage());
        }
    }

    @Override
    public ConfigOperationResult reloadFieldMappings() {
        try {
            int count = refreshDictionaryCache();
            log.info("重载字段映射缓存: count={}", count);
            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    ConfigOperationResult.OPERATION_RELOAD,
                    "字段映射重载成功", count);
        } catch (Exception e) {
            log.error("重载字段映射失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_FIELD_MAPPING,
                    "重载失败: " + e.getMessage());
        }
    }

    // ==================== 指标公式 ====================

    @Override
    public List<SmartBiMetricFormula> listMetricFormulas(String formulaType) {
        if (formulaType != null && !formulaType.isEmpty()) {
            return metricFormulaRepository.findByFormulaTypeAndIsActiveTrue(formulaType);
        }
        return metricFormulaRepository.findByIsActiveTrueOrderByMetricCodeAsc();
    }

    @Override
    @Transactional
    public ConfigOperationResult createMetricFormula(SmartBiMetricFormula formula) {
        try {
            // 验证唯一性
            if (metricFormulaRepository.existsByMetricCodeAndIsActiveTrue(formula.getMetricCode())) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                        "指标公式已存在: " + formula.getMetricCode());
            }

            formula.setIsActive(true);
            metricFormulaRepository.save(formula);
            log.info("创建指标公式: metricCode={}", formula.getMetricCode());

            // 刷新缓存
            refreshMetricFormulaCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    ConfigOperationResult.OPERATION_CREATE,
                    "指标公式创建成功", 1);
        } catch (Exception e) {
            log.error("创建指标公式失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    "创建失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult updateMetricFormula(Long id, SmartBiMetricFormula formula) {
        try {
            Optional<SmartBiMetricFormula> existingOpt = metricFormulaRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                        "指标公式不存在: id=" + id);
            }

            SmartBiMetricFormula existing = existingOpt.get();
            updateMetricFormulaFields(existing, formula);
            metricFormulaRepository.save(existing);
            log.info("更新指标公式: id={}, metricCode={}", id, existing.getMetricCode());

            // 刷新缓存
            refreshMetricFormulaCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    ConfigOperationResult.OPERATION_UPDATE,
                    "指标公式更新成功", 1);
        } catch (Exception e) {
            log.error("更新指标公式失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    "更新失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public ConfigOperationResult deleteMetricFormula(Long id) {
        try {
            Optional<SmartBiMetricFormula> existingOpt = metricFormulaRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ConfigOperationResult.error(
                        ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                        "指标公式不存在: id=" + id);
            }

            SmartBiMetricFormula existing = existingOpt.get();
            existing.setIsActive(false);
            existing.softDelete();
            metricFormulaRepository.save(existing);
            log.info("删除指标公式: id={}, metricCode={}", id, existing.getMetricCode());

            // 刷新缓存
            refreshMetricFormulaCache();

            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    ConfigOperationResult.OPERATION_DELETE,
                    "指标公式删除成功", 1);
        } catch (Exception e) {
            log.error("删除指标公式失败: id={}, error={}", id, e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    "删除失败: " + e.getMessage());
        }
    }

    @Override
    public ConfigOperationResult reloadMetricFormulas() {
        try {
            int count = refreshMetricFormulaCache();
            log.info("重载指标公式缓存: count={}", count);
            return ConfigOperationResult.success(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    ConfigOperationResult.OPERATION_RELOAD,
                    "指标公式重载成功", count);
        } catch (Exception e) {
            log.error("重载指标公式失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_METRIC_FORMULA,
                    "重载失败: " + e.getMessage());
        }
    }

    // ==================== 全局操作 ====================

    @Override
    public ConfigOperationResult reloadAll() {
        try {
            int intentCount = refreshIntentCache();
            int thresholdCount = refreshThresholdCache();
            int incentiveRuleCount = refreshIncentiveRuleCache();
            int dictionaryCount = refreshDictionaryCache();
            int metricFormulaCount = refreshMetricFormulaCache();

            int totalCount = intentCount + thresholdCount + incentiveRuleCount
                    + dictionaryCount + metricFormulaCount;

            log.info("重载所有配置缓存: intent={}, threshold={}, incentiveRule={}, dictionary={}, metricFormula={}, total={}",
                    intentCount, thresholdCount, incentiveRuleCount, dictionaryCount, metricFormulaCount, totalCount);

            // 清除 Spring Cache
            if (cacheManager != null) {
                cacheManager.getCacheNames().forEach(cacheName -> {
                    var cache = cacheManager.getCache(cacheName);
                    if (cache != null) {
                        cache.clear();
                    }
                });
            }

            Map<String, Integer> counts = new HashMap<>();
            counts.put("intents", intentCount);
            counts.put("thresholds", thresholdCount);
            counts.put("incentiveRules", incentiveRuleCount);
            counts.put("fieldMappings", dictionaryCount);
            counts.put("metricFormulas", metricFormulaCount);

            return ConfigOperationResult.builder()
                    .success(true)
                    .configType(ConfigOperationResult.CONFIG_TYPE_ALL)
                    .operationType(ConfigOperationResult.OPERATION_RELOAD)
                    .message("所有配置重载成功")
                    .data(counts)
                    .affectedCount(totalCount)
                    .timestamp(LocalDateTime.now())
                    .build();
        } catch (Exception e) {
            log.error("重载所有配置失败: {}", e.getMessage(), e);
            return ConfigOperationResult.error(
                    ConfigOperationResult.CONFIG_TYPE_ALL,
                    "重载失败: " + e.getMessage());
        }
    }

    @Override
    public Map<String, Object> getConfigStatus() {
        Map<String, Object> status = new HashMap<>();

        // 配置数量
        Map<String, Long> counts = new HashMap<>();
        counts.put("intents", intentConfigRepository.count());
        counts.put("thresholds", alertThresholdRepository.count());
        counts.put("incentiveRules", incentiveRuleRepository.count());
        counts.put("fieldMappings", dictionaryRepository.count());
        counts.put("metricFormulas", metricFormulaRepository.count());
        status.put("counts", counts);

        // 缓存大小
        Map<String, Integer> cacheSizes = new HashMap<>();
        cacheSizes.put("intents", intentCache.values().stream().mapToInt(List::size).sum());
        cacheSizes.put("thresholds", thresholdCache.values().stream().mapToInt(List::size).sum());
        cacheSizes.put("incentiveRules", incentiveRuleCache.values().stream().mapToInt(List::size).sum());
        cacheSizes.put("fieldMappings", dictionaryCache.values().stream().mapToInt(List::size).sum());
        cacheSizes.put("metricFormulas", metricFormulaCache.values().stream().mapToInt(List::size).sum());
        status.put("cacheSizes", cacheSizes);

        // 最后更新时间
        Map<String, LocalDateTime> lastUpdates = new HashMap<>();
        lastUpdates.put("intents", lastIntentUpdate);
        lastUpdates.put("thresholds", lastThresholdUpdate);
        lastUpdates.put("incentiveRules", lastIncentiveRuleUpdate);
        lastUpdates.put("fieldMappings", lastFieldMappingUpdate);
        lastUpdates.put("metricFormulas", lastMetricFormulaUpdate);
        status.put("lastUpdates", lastUpdates);

        // 系统信息
        status.put("serverTime", LocalDateTime.now());
        status.put("cacheEnabled", cacheManager != null);

        return status;
    }

    // ==================== 私有辅助方法 ====================

    private int refreshIntentCache() {
        intentCache.clear();
        List<AiIntentConfig> allIntents = intentConfigRepository.findByIsActiveTrueOrderByPriorityAsc();
        intentCache.put("all", allIntents);

        // 按分类分组
        Map<String, List<AiIntentConfig>> byCategory = new HashMap<>();
        for (AiIntentConfig intent : allIntents) {
            byCategory.computeIfAbsent(intent.getIntentCategory(), k -> new ArrayList<>()).add(intent);
        }
        intentCache.putAll(byCategory);

        lastIntentUpdate = LocalDateTime.now();
        return allIntents.size();
    }

    private int refreshThresholdCache() {
        thresholdCache.clear();
        List<SmartBiAlertThreshold> allThresholds = alertThresholdRepository.findAll();
        thresholdCache.put("all", allThresholds);
        lastThresholdUpdate = LocalDateTime.now();
        return allThresholds.size();
    }

    private int refreshIncentiveRuleCache() {
        incentiveRuleCache.clear();
        List<SmartBiIncentiveRule> allRules = incentiveRuleRepository.findByIsActiveTrueOrderByRuleCodeAscSortOrderAsc();
        incentiveRuleCache.put("all", allRules);
        lastIncentiveRuleUpdate = LocalDateTime.now();
        return allRules.size();
    }

    private int refreshDictionaryCache() {
        dictionaryCache.clear();
        List<SmartBiDictionary> allMappings = dictionaryRepository.findAll();
        dictionaryCache.put("all", allMappings);
        lastFieldMappingUpdate = LocalDateTime.now();
        return allMappings.size();
    }

    private int refreshMetricFormulaCache() {
        metricFormulaCache.clear();
        List<SmartBiMetricFormula> allFormulas = metricFormulaRepository.findByIsActiveTrueOrderByMetricCodeAsc();
        metricFormulaCache.put("all", allFormulas);
        lastMetricFormulaUpdate = LocalDateTime.now();
        return allFormulas.size();
    }

    private void updateIntentFields(AiIntentConfig existing, AiIntentConfig updated) {
        if (updated.getIntentName() != null) existing.setIntentName(updated.getIntentName());
        if (updated.getIntentCategory() != null) existing.setIntentCategory(updated.getIntentCategory());
        if (updated.getKeywords() != null) existing.setKeywords(updated.getKeywords());
        if (updated.getPatterns() != null) existing.setPatterns(updated.getPatterns());
        if (updated.getExamples() != null) existing.setExamples(updated.getExamples());
        if (updated.getResponseTemplate() != null) existing.setResponseTemplate(updated.getResponseTemplate());
        if (updated.getFollowUpQuestions() != null) existing.setFollowUpQuestions(updated.getFollowUpQuestions());
        if (updated.getAnalysisService() != null) existing.setAnalysisService(updated.getAnalysisService());
        if (updated.getMethodName() != null) existing.setMethodName(updated.getMethodName());
        if (updated.getPriority() != null) existing.setPriority(updated.getPriority());
        if (updated.getConfidenceThreshold() != null) existing.setConfidenceThreshold(updated.getConfidenceThreshold());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
    }

    private void updateThresholdFields(SmartBiAlertThreshold existing, SmartBiAlertThreshold updated) {
        if (updated.getWarningValue() != null) existing.setWarningValue(updated.getWarningValue());
        if (updated.getCriticalValue() != null) existing.setCriticalValue(updated.getCriticalValue());
        if (updated.getComparisonOperator() != null) existing.setComparisonOperator(updated.getComparisonOperator());
        if (updated.getUnit() != null) existing.setUnit(updated.getUnit());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
    }

    private void updateIncentiveRuleFields(SmartBiIncentiveRule existing, SmartBiIncentiveRule updated) {
        if (updated.getRuleName() != null) existing.setRuleName(updated.getRuleName());
        if (updated.getLevelName() != null) existing.setLevelName(updated.getLevelName());
        if (updated.getMinValue() != null) existing.setMinValue(updated.getMinValue());
        if (updated.getMaxValue() != null) existing.setMaxValue(updated.getMaxValue());
        if (updated.getRewardRate() != null) existing.setRewardRate(updated.getRewardRate());
        if (updated.getRewardAmount() != null) existing.setRewardAmount(updated.getRewardAmount());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getSortOrder() != null) existing.setSortOrder(updated.getSortOrder());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
    }

    private void updateDictionaryFields(SmartBiDictionary existing, SmartBiDictionary updated) {
        if (updated.getName() != null) existing.setName(updated.getName());
        if (updated.getAliases() != null) existing.setAliases(updated.getAliases());
        if (updated.getParentName() != null) existing.setParentName(updated.getParentName());
        if (updated.getMetadata() != null) existing.setMetadata(updated.getMetadata());
        if (updated.getSource() != null) existing.setSource(updated.getSource());
        if (updated.getPriority() != null) existing.setPriority(updated.getPriority());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
    }

    private void updateMetricFormulaFields(SmartBiMetricFormula existing, SmartBiMetricFormula updated) {
        if (updated.getMetricName() != null) existing.setMetricName(updated.getMetricName());
        if (updated.getFormulaType() != null) existing.setFormulaType(updated.getFormulaType());
        if (updated.getBaseField() != null) existing.setBaseField(updated.getBaseField());
        if (updated.getFormulaExpression() != null) existing.setFormulaExpression(updated.getFormulaExpression());
        if (updated.getAggregation() != null) existing.setAggregation(updated.getAggregation());
        if (updated.getUnit() != null) existing.setUnit(updated.getUnit());
        if (updated.getFormatPattern() != null) existing.setFormatPattern(updated.getFormatPattern());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getIsActive() != null) existing.setIsActive(updated.getIsActive());
    }
}
