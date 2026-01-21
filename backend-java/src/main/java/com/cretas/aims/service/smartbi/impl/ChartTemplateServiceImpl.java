package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import com.cretas.aims.repository.smartbi.SmartBiChartTemplateRepository;
import com.cretas.aims.service.smartbi.ChartTemplateService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 图表模板服务实现
 *
 * 特性：
 * - 使用 ConcurrentHashMap 进行本地缓存
 * - 支持工厂级别配置覆盖全局配置
 * - 支持热重载，无需重启服务
 * - 智能图表类型推荐
 *
 * 缓存键格式：
 * - 全局配置: {templateCode}
 * - 工厂配置: {templateCode}:{factoryId}
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChartTemplateServiceImpl implements ChartTemplateService {

    private final SmartBiChartTemplateRepository templateRepository;
    private final ObjectMapper objectMapper;

    /**
     * 模板缓存
     * Key: {templateCode} 或 {templateCode}:{factoryId}
     * Value: SmartBiChartTemplate
     */
    private final Map<String, SmartBiChartTemplate> templateCache = new ConcurrentHashMap<>();

    /**
     * 指标到模板的映射缓存
     * Key: metricCode
     * Value: List<templateCode>
     */
    private final Map<String, List<String>> metricToTemplatesCache = new ConcurrentHashMap<>();

    /**
     * 分类到模板的映射缓存
     * Key: category
     * Value: List<SmartBiChartTemplate>
     */
    private final Map<String, List<SmartBiChartTemplate>> categoryCache = new ConcurrentHashMap<>();

    /**
     * 初始化时加载所有模板配置到缓存
     */
    @PostConstruct
    public void init() {
        log.info("初始化图表模板缓存...");
        try {
            reload();
            log.info("图表模板缓存初始化完成，共加载 {} 条配置", templateCache.size());
        } catch (Exception e) {
            log.warn("图表模板缓存初始化失败（表可能不存在），将使用空缓存: {}", e.getMessage());
        }
    }

    // ==================== 查询方法 ====================

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> getAllTemplates() {
        if (templateCache.isEmpty()) {
            log.debug("缓存为空，从数据库加载所有模板");
            return templateRepository.findByIsActiveTrue();
        }
        return new ArrayList<>(templateCache.values().stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                .collect(Collectors.toList()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> getTemplatesByCategory(String category) {
        return categoryCache.computeIfAbsent(category, key -> {
            log.debug("加载分类模板列表: category={}", category);
            return templateRepository.findByCategoryAndIsActiveTrue(category);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> getTemplatesForMetric(String metricCode) {
        List<String> templateCodes = metricToTemplatesCache.get(metricCode);

        if (templateCodes == null || templateCodes.isEmpty()) {
            log.debug("指标 {} 没有关联的模板，返回空列表", metricCode);
            return Collections.emptyList();
        }

        return templateCodes.stream()
                .map(code -> templateCache.get(code))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public SmartBiChartTemplate getTemplate(String templateCode, String factoryId) {
        // 先查工厂级别配置
        if (factoryId != null) {
            String factoryCacheKey = buildCacheKey(templateCode, factoryId);
            SmartBiChartTemplate factoryTemplate = templateCache.get(factoryCacheKey);
            if (factoryTemplate != null) {
                return factoryTemplate;
            }

            // 从数据库查询工厂配置
            Optional<SmartBiChartTemplate> dbTemplate = templateRepository
                    .findByTemplateCodeAndFactoryIdAndIsActiveTrue(templateCode, factoryId);
            if (dbTemplate.isPresent()) {
                templateCache.put(factoryCacheKey, dbTemplate.get());
                return dbTemplate.get();
            }
        }

        // 回退到全局配置
        String globalCacheKey = buildCacheKey(templateCode, null);
        SmartBiChartTemplate globalTemplate = templateCache.get(globalCacheKey);

        if (globalTemplate != null) {
            return globalTemplate;
        }

        // 从数据库查询全局配置
        Optional<SmartBiChartTemplate> dbGlobalTemplate = templateRepository
                .findGlobalTemplate(templateCode);
        if (dbGlobalTemplate.isPresent()) {
            templateCache.put(globalCacheKey, dbGlobalTemplate.get());
            return dbGlobalTemplate.get();
        }

        log.debug("未找到模板配置: templateCode={}, factoryId={}", templateCode, factoryId);
        return null;
    }

    // ==================== 构建图表方法 ====================

    @Override
    public Map<String, Object> buildChart(String templateCode, Map<String, Object> data) {
        return buildChart(templateCode, data, null);
    }

    @Override
    public Map<String, Object> buildChart(String templateCode, Map<String, Object> data, String factoryId) {
        SmartBiChartTemplate template = getTemplate(templateCode, factoryId);

        if (template == null) {
            log.warn("未找到模板 {}，返回空配置", templateCode);
            return Collections.emptyMap();
        }

        Map<String, Object> chartConfig = new LinkedHashMap<>();

        try {
            // 1. 加载模板基础配置
            chartConfig.put("chartType", template.getChartType());
            chartConfig.put("templateCode", templateCode);
            chartConfig.put("title", template.getTitle());

            // 2. 合并模板选项
            if (template.getOptionsJson() != null && !template.getOptionsJson().isEmpty()) {
                Map<String, Object> options = objectMapper.readValue(
                        template.getOptionsJson(),
                        new TypeReference<Map<String, Object>>() {});
                chartConfig.put("options", options);
            }

            // 3. 应用数据映射
            if (template.getDataMappingJson() != null && !template.getDataMappingJson().isEmpty()) {
                Map<String, String> dataMapping = objectMapper.readValue(
                        template.getDataMappingJson(),
                        new TypeReference<Map<String, String>>() {});

                Map<String, Object> mappedData = new LinkedHashMap<>();
                for (Map.Entry<String, String> mapping : dataMapping.entrySet()) {
                    String targetField = mapping.getKey();
                    String sourceField = mapping.getValue();
                    if (data.containsKey(sourceField)) {
                        mappedData.put(targetField, data.get(sourceField));
                    }
                }
                chartConfig.put("data", mappedData);
            } else {
                // 无映射配置时直接使用原始数据
                chartConfig.put("data", data);
            }

            // 4. 添加样式配置
            if (template.getStyleJson() != null && !template.getStyleJson().isEmpty()) {
                Map<String, Object> style = objectMapper.readValue(
                        template.getStyleJson(),
                        new TypeReference<Map<String, Object>>() {});
                chartConfig.put("style", style);
            }

            log.debug("成功构建图表配置: templateCode={}, chartType={}", templateCode, template.getChartType());

        } catch (Exception e) {
            log.error("构建图表配置失败: templateCode={}, error={}", templateCode, e.getMessage(), e);
            chartConfig.put("error", "构建图表配置失败: " + e.getMessage());
        }

        return chartConfig;
    }

    // ==================== 图表类型推荐 ====================

    @Override
    public String recommendChartType(String metricCode, int dataPointCount, boolean hasTimeDimension) {
        // 1. 首先检查是否有关联的模板
        List<String> templateCodes = metricToTemplatesCache.get(metricCode);
        if (templateCodes != null && !templateCodes.isEmpty()) {
            SmartBiChartTemplate template = templateCache.get(templateCodes.get(0));
            if (template != null) {
                log.debug("指标 {} 使用关联模板的图表类型: {}", metricCode, template.getChartType());
                return template.getChartType();
            }
        }

        // 2. 时间序列数据推荐折线图
        if (hasTimeDimension && dataPointCount > 1) {
            log.debug("指标 {} 有时间维度且数据点 > 1，推荐 LINE", metricCode);
            return "LINE";
        }

        // 3. 比率/占比类指标
        String lowerMetricCode = metricCode.toLowerCase();
        if (lowerMetricCode.contains("ratio") || lowerMetricCode.contains("rate")) {
            // 单个比率值使用仪表盘，多个比率值使用雷达图
            if (dataPointCount <= 1) {
                log.debug("指标 {} 为比率类型且单值，推荐 GAUGE", metricCode);
                return "GAUGE";
            } else {
                log.debug("指标 {} 为比率类型且多值，推荐 RADAR", metricCode);
                return "RADAR";
            }
        }

        // 4. 结构/构成类指标
        if (lowerMetricCode.contains("structure") || lowerMetricCode.contains("composition")
                || lowerMetricCode.contains("distribution")) {
            log.debug("指标 {} 为结构类型，推荐 PIE", metricCode);
            return "PIE";
        }

        // 5. 默认使用柱状图
        log.debug("指标 {} 使用默认图表类型 BAR", metricCode);
        return "BAR";
    }

    // ==================== 缓存管理方法 ====================

    @Override
    public void reload() {
        log.info("重新加载图表模板缓存...");

        // 清除所有缓存
        templateCache.clear();
        metricToTemplatesCache.clear();
        categoryCache.clear();

        // 重新加载所有启用的模板配置
        List<SmartBiChartTemplate> allTemplates = templateRepository.findAll()
                .stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                .collect(Collectors.toList());

        for (SmartBiChartTemplate template : allTemplates) {
            // 加入模板缓存
            String cacheKey = buildCacheKey(template.getTemplateCode(), template.getFactoryId());
            templateCache.put(cacheKey, template);

            // 构建指标到模板的映射
            buildMetricMapping(template);
        }

        log.info("图表模板缓存重新加载完成，共加载 {} 条配置", templateCache.size());
    }

    // ==================== CRUD 方法 ====================

    @Override
    @Transactional
    public SmartBiChartTemplate createTemplate(SmartBiChartTemplate template) {
        log.info("创建图表模板: code={}, category={}, chartType={}",
                template.getTemplateCode(), template.getCategory(), template.getChartType());

        // 检查是否已存在
        Optional<SmartBiChartTemplate> existing = templateRepository
                .findByTemplateCodeAndFactoryId(template.getTemplateCode(), template.getFactoryId());
        if (existing.isPresent()) {
            throw new IllegalArgumentException("模板已存在: templateCode=" + template.getTemplateCode()
                    + ", factoryId=" + template.getFactoryId());
        }

        SmartBiChartTemplate saved = templateRepository.save(template);

        // 更新缓存
        String cacheKey = buildCacheKey(saved.getTemplateCode(), saved.getFactoryId());
        templateCache.put(cacheKey, saved);
        buildMetricMapping(saved);
        invalidateCategoryCache(saved.getCategory());

        log.info("图表模板创建完成: id={}", saved.getId());
        return saved;
    }

    @Override
    @Transactional
    public SmartBiChartTemplate updateTemplate(Long id, SmartBiChartTemplate template) {
        SmartBiChartTemplate existing = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("模板不存在: id=" + id));

        log.info("更新图表模板: id={}, code={}", id, existing.getTemplateCode());

        // 保留原有ID和代码
        template.setId(id);
        template.setTemplateCode(existing.getTemplateCode());

        SmartBiChartTemplate saved = templateRepository.save(template);

        // 更新缓存
        String cacheKey = buildCacheKey(saved.getTemplateCode(), saved.getFactoryId());
        templateCache.put(cacheKey, saved);

        // 重新构建指标映射
        reload();

        log.info("图表模板更新完成: id={}", id);
        return saved;
    }

    @Override
    @Transactional
    public void deleteTemplate(Long id) {
        SmartBiChartTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("模板不存在: id=" + id));

        log.info("删除图表模板: id={}, code={}", id, template.getTemplateCode());

        // 软删除
        templateRepository.delete(template);

        // 移除缓存
        String cacheKey = buildCacheKey(template.getTemplateCode(), template.getFactoryId());
        templateCache.remove(cacheKey);
        invalidateCategoryCache(template.getCategory());

        // 重新构建指标映射
        rebuildMetricMappingCache();

        log.info("图表模板删除完成: id={}", id);
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建缓存键
     */
    private String buildCacheKey(String templateCode, String factoryId) {
        if (factoryId == null) {
            return templateCode;
        }
        return templateCode + ":" + factoryId;
    }

    /**
     * 构建指标到模板的映射
     */
    private void buildMetricMapping(SmartBiChartTemplate template) {
        if (template.getMetricCodes() == null || template.getMetricCodes().isEmpty()) {
            return;
        }

        try {
            // 假设 metricCodes 是逗号分隔的字符串或 JSON 数组
            String metricCodesStr = template.getMetricCodes();
            List<String> metricCodes;

            if (metricCodesStr.startsWith("[")) {
                // JSON 数组格式
                metricCodes = objectMapper.readValue(metricCodesStr, new TypeReference<List<String>>() {});
            } else {
                // 逗号分隔格式
                metricCodes = Arrays.asList(metricCodesStr.split(","));
            }

            for (String metricCode : metricCodes) {
                String trimmedCode = metricCode.trim();
                metricToTemplatesCache.computeIfAbsent(trimmedCode, k -> new ArrayList<>())
                        .add(template.getTemplateCode());
            }
        } catch (Exception e) {
            log.warn("解析模板指标映射失败: templateCode={}, metricCodes={}, error={}",
                    template.getTemplateCode(), template.getMetricCodes(), e.getMessage());
        }
    }

    /**
     * 重新构建指标映射缓存
     */
    private void rebuildMetricMappingCache() {
        metricToTemplatesCache.clear();
        for (SmartBiChartTemplate template : templateCache.values()) {
            buildMetricMapping(template);
        }
    }

    /**
     * 清除指定分类的缓存
     */
    private void invalidateCategoryCache(String category) {
        if (category != null) {
            categoryCache.remove(category);
        }
    }
}
