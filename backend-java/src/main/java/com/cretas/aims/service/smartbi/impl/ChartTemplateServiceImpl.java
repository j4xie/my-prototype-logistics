package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.dto.smartbi.DataFeatureResult;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import com.cretas.aims.repository.smartbi.SmartBiChartTemplateRepository;
import com.cretas.aims.service.smartbi.AnalysisPromptGenerator;
import com.cretas.aims.service.smartbi.AnalysisPromptGenerator.AnalysisContext;
import com.cretas.aims.service.smartbi.AnalysisPromptGenerator.GeneratedPrompt;
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
    private final DashScopeClient dashScopeClient;
    private final AnalysisPromptGenerator analysisPromptGenerator;

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
            return templateRepository.findByIsActiveTrueOrderBySortOrder();
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
            return templateRepository.findByCategoryAndIsActiveTrueOrderBySortOrder(category);
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
                    .findByTemplateCodeAndFactoryId(templateCode, factoryId);
            if (dbTemplate.isPresent() && Boolean.TRUE.equals(dbTemplate.get().getIsActive())) {
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
                .findByTemplateCodeAndFactoryIdIsNull(templateCode);
        if (dbGlobalTemplate.isPresent() && Boolean.TRUE.equals(dbGlobalTemplate.get().getIsActive())) {
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
            String chartType = template.getChartType() != null ? template.getChartType() : "LINE";
            chartConfig.put("chartType", chartType);
            chartConfig.put("templateCode", templateCode);
            chartConfig.put("title", template.getTemplateName());

            // 2. 处理数据
            Map<String, Object> processedData = data;
            if (template.getDataMapping() != null && !template.getDataMapping().isEmpty()) {
                Map<String, Object> dataMapping = objectMapper.readValue(
                        template.getDataMapping(),
                        new TypeReference<Map<String, Object>>() {});

                if (!dataMapping.containsKey("categories") && !dataMapping.containsKey("series")) {
                    // 简单映射：执行字段映射
                    Map<String, Object> mappedData = new LinkedHashMap<>();
                    for (Map.Entry<String, Object> mapping : dataMapping.entrySet()) {
                        String targetField = mapping.getKey();
                        Object sourceFieldObj = mapping.getValue();
                        if (sourceFieldObj instanceof String) {
                            String sourceField = (String) sourceFieldObj;
                            if (data.containsKey(sourceField)) {
                                mappedData.put(targetField, data.get(sourceField));
                            }
                        }
                    }
                    if (!mappedData.isEmpty()) {
                        processedData = mappedData;
                    }
                }
            }
            chartConfig.put("data", processedData);

            // 3. 构建 ECharts options
            Map<String, Object> options;
            if (template.getChartOptions() != null && !template.getChartOptions().isEmpty()) {
                // 使用模板配置的 options
                options = objectMapper.readValue(
                        template.getChartOptions(),
                        new TypeReference<Map<String, Object>>() {});
            } else {
                // 动态构建 ECharts options
                options = buildDynamicEChartsOptions(chartType, processedData, template.getTemplateName());
            }
            chartConfig.put("options", options);

            // 4. 添加布局配置（如果有）
            if (template.getLayoutConfig() != null && !template.getLayoutConfig().isEmpty()) {
                Map<String, Object> layout = objectMapper.readValue(
                        template.getLayoutConfig(),
                        new TypeReference<Map<String, Object>>() {});
                chartConfig.put("layout", layout);
            }

            log.debug("成功构建图表配置: templateCode={}, chartType={}", templateCode, chartType);

        } catch (Exception e) {
            log.error("构建图表配置失败: templateCode={}, error={}", templateCode, e.getMessage(), e);
            chartConfig.put("error", "构建图表配置失败: " + e.getMessage());
        }

        return chartConfig;
    }

    /**
     * 动态构建 ECharts options（当模板没有预定义 chart_options 时使用）
     */
    private Map<String, Object> buildDynamicEChartsOptions(String chartType, Map<String, Object> data, String title) {
        Map<String, Object> options = new LinkedHashMap<>();

        // 标题
        Map<String, Object> titleConfig = new LinkedHashMap<>();
        titleConfig.put("text", title != null ? title : "数据分析");
        titleConfig.put("left", "center");
        options.put("title", titleConfig);

        // 提示框
        Map<String, Object> tooltip = new LinkedHashMap<>();
        tooltip.put("trigger", "axis");
        options.put("tooltip", tooltip);

        // 图例
        Map<String, Object> legend = new LinkedHashMap<>();
        legend.put("bottom", 10);
        options.put("legend", legend);

        // 从数据中提取 xAxis 和 series
        List<String> categories = new ArrayList<>();
        List<Map<String, Object>> seriesList = new ArrayList<>();

        // 尝试识别数据结构
        if (data.containsKey("categories") && data.containsKey("series")) {
            // 标准格式
            Object cats = data.get("categories");
            if (cats instanceof List) {
                categories = (List<String>) cats;
            }
            Object ser = data.get("series");
            if (ser instanceof List) {
                for (Object item : (List<?>) ser) {
                    if (item instanceof Map) {
                        seriesList.add((Map<String, Object>) item);
                    }
                }
            }
        } else {
            // 尝试从 aggregatedData 格式解析
            // 格式: {指标名: [{period: "2024-01", value: 100}, ...]}
            for (Map.Entry<String, Object> entry : data.entrySet()) {
                String metricName = entry.getKey();
                Object value = entry.getValue();

                if (value instanceof List) {
                    List<?> dataList = (List<?>) value;
                    List<Object> seriesData = new ArrayList<>();

                    for (Object item : dataList) {
                        if (item instanceof Map) {
                            Map<?, ?> row = (Map<?, ?>) item;
                            // 提取 x 轴类目
                            Object period = row.get("period");
                            if (period == null) period = row.get("date");
                            if (period == null) period = row.get("time");
                            if (period == null) period = row.get("name");
                            if (period == null) period = row.get("category");

                            if (period != null && categories.size() < dataList.size()) {
                                String cat = String.valueOf(period);
                                if (!categories.contains(cat)) {
                                    categories.add(cat);
                                }
                            }

                            // 提取 y 轴数值
                            Object val = row.get("value");
                            if (val == null) val = row.get("amount");
                            if (val == null) val = row.get("total");
                            seriesData.add(val != null ? val : 0);
                        }
                    }

                    if (!seriesData.isEmpty()) {
                        Map<String, Object> series = new LinkedHashMap<>();
                        series.put("name", metricName);
                        series.put("type", chartType.toLowerCase().replace("_", ""));
                        series.put("data", seriesData);
                        seriesList.add(series);
                    }
                }
            }
        }

        // 如果没有解析到数据，创建空图表
        if (categories.isEmpty()) {
            categories = Arrays.asList("暂无数据");
        }
        if (seriesList.isEmpty()) {
            Map<String, Object> emptySeries = new LinkedHashMap<>();
            emptySeries.put("name", "数据");
            emptySeries.put("type", "line");
            emptySeries.put("data", Arrays.asList(0));
            seriesList.add(emptySeries);
        }

        // X 轴
        Map<String, Object> xAxis = new LinkedHashMap<>();
        xAxis.put("type", "category");
        xAxis.put("data", categories);
        options.put("xAxis", xAxis);

        // Y 轴
        Map<String, Object> yAxis = new LinkedHashMap<>();
        yAxis.put("type", "value");
        options.put("yAxis", yAxis);

        // 系列
        options.put("series", seriesList);

        log.debug("动态构建 ECharts options: categories={}, series={}", categories.size(), seriesList.size());

        return options;
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

    // ==================== AI 分析方法 ====================

    @Override
    public Map<String, Object> buildChartWithAnalysis(String templateCode, Map<String, Object> data, String factoryId) {
        // 1. 首先获取基础图表配置
        Map<String, Object> chartConfig = new LinkedHashMap<>(buildChart(templateCode, data, factoryId));

        // 2. 获取模板配置
        SmartBiChartTemplate template = getTemplate(templateCode, factoryId);
        if (template == null) {
            log.warn("未找到模板 {}，跳过 AI 分析", templateCode);
            chartConfig.put("aiAnalysis", null);
            return chartConfig;
        }

        // 3. 检查是否启用 AI 分析
        if (!Boolean.TRUE.equals(template.getAnalysisEnabled())) {
            log.debug("模板 {} 未启用 AI 分析", templateCode);
            chartConfig.put("aiAnalysis", null);
            return chartConfig;
        }

        // 4. 检查 DashScopeClient 是否可用
        if (dashScopeClient == null || !dashScopeClient.isAvailable()) {
            log.warn("DashScopeClient 不可用，跳过 AI 分析");
            chartConfig.put("aiAnalysis", "AI 分析服务未配置");
            return chartConfig;
        }

        // 5. 生成 AI 分析（使用动态 Prompt 生成器）
        try {
            // 检测数据类型
            String dataType = detectDataType(data);

            // 构建分析上下文
            AnalysisContext context = AnalysisContext.builder()
                    .dataType(dataType)
                    .aggregatedData(data)
                    .factoryId(factoryId)
                    .build();

            // 使用动态 Prompt 生成器
            GeneratedPrompt generatedPrompt = analysisPromptGenerator.generatePrompt(context);

            log.info("AI 分析使用模板类型: {}, 语言: {}",
                    generatedPrompt.getTemplateType(), generatedPrompt.getLanguage());

            // 如果模板配置了自定义分析提示词，则合并使用
            String userPrompt = generatedPrompt.getUserPrompt();
            String customPrompt = template.getAnalysisPrompt();
            if (customPrompt != null && !customPrompt.trim().isEmpty()) {
                try {
                    String dataJson = objectMapper.writeValueAsString(data);
                    String processedCustomPrompt = customPrompt.replace("{{dataJson}}", dataJson);
                    // 将自定义提示词作为额外要求添加
                    userPrompt = userPrompt + "\n\n## 额外分析要求:\n" + processedCustomPrompt;
                } catch (Exception e) {
                    log.debug("处理自定义分析提示词失败，使用默认提示词: {}", e.getMessage());
                }
            }

            log.debug("开始为模板 {} 生成 AI 分析，数据大小: {} 字节", templateCode,
                    data != null ? data.size() : 0);

            // 调用 LLM 生成分析
            String analysis = dashScopeClient.chat(
                    generatedPrompt.getSystemPrompt(),
                    userPrompt
            );

            chartConfig.put("aiAnalysis", analysis);
            chartConfig.put("analysisType", generatedPrompt.getTemplateType().name());
            log.debug("模板 {} AI 分析生成成功, 分析类型: {}",
                    templateCode, generatedPrompt.getTemplateType());

        } catch (Exception e) {
            log.error("生成 AI 分析失败: templateCode={}, error={}", templateCode, e.getMessage(), e);
            chartConfig.put("aiAnalysis", "AI 分析生成失败: " + e.getMessage());
        }

        return chartConfig;
    }

    /**
     * 从聚合数据中检测数据类型
     */
    private String detectDataType(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return "GENERAL";
        }

        // 检查是否有明确的数据类型标记
        if (data.containsKey("dataType")) {
            return String.valueOf(data.get("dataType"));
        }

        // 根据字段推断数据类型
        if (data.containsKey("totalAmount") || data.containsKey("byRegion")) {
            return "SALES";
        }
        if (data.containsKey("totalBudget") || data.containsKey("budgetVariance")
                || data.containsKey("totalCost")) {
            return "FINANCE";
        }
        if (data.containsKey("byDepartment") && !data.containsKey("totalAmount")) {
            return "DEPARTMENT";
        }

        return "GENERAL";
    }

    // ==================== 利润表专用模板方法 ====================

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> getProfitStatementTemplates() {
        return getProfitStatementTemplates(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> getProfitStatementTemplates(String factoryId) {
        log.debug("获取利润表专用模板: factoryId={}", factoryId);

        String[] templateCodes = SmartBiChartTemplate.getProfitStatementTemplateCodes();
        List<SmartBiChartTemplate> templates = new ArrayList<>();

        for (String templateCode : templateCodes) {
            SmartBiChartTemplate template = getTemplate(templateCode, factoryId);
            if (template != null) {
                templates.add(template);
            }
        }

        log.debug("找到 {} 个利润表专用模板", templates.size());
        return templates;
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

    // ==================== 智能模板匹配方法 ====================

    @Override
    public SmartBiChartTemplate matchBestTemplate(List<FieldMappingResult> fieldMappings, ExcelParseResponse parseResult) {
        return matchBestTemplate(fieldMappings, parseResult, null);
    }

    @Override
    public SmartBiChartTemplate matchBestTemplate(List<FieldMappingResult> fieldMappings,
                                                   ExcelParseResponse parseResult,
                                                   String factoryId) {
        log.info("开始智能匹配最佳图表模板: fieldMappings={}, factoryId={}",
                fieldMappings != null ? fieldMappings.size() : 0, factoryId);

        if (fieldMappings == null || fieldMappings.isEmpty()) {
            log.debug("字段映射为空，返回默认模板");
            return getDefaultTemplate(factoryId);
        }

        // 1. 提取已映射的标准字段集合
        Set<String> mappedFields = fieldMappings.stream()
                .filter(f -> f.getStandardField() != null)
                .map(FieldMappingResult::getStandardField)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        log.debug("已映射的标准字段: {}", mappedFields);

        // 2. 检测数据特征
        boolean hasTimeSeries = hasTimeSeries(parseResult);
        int rowCount = parseResult != null && parseResult.getRowCount() != null ? parseResult.getRowCount() : 0;

        log.debug("数据特征: hasTimeSeries={}, rowCount={}", hasTimeSeries, rowCount);

        // 3. 获取所有可用模板
        List<SmartBiChartTemplate> allTemplates = getAllTemplates();
        if (allTemplates.isEmpty()) {
            log.warn("没有可用的图表模板");
            return null;
        }

        // 4. 计算每个模板的匹配分数
        Map<SmartBiChartTemplate, Integer> scores = new LinkedHashMap<>();
        for (SmartBiChartTemplate template : allTemplates) {
            int score = calculateMatchScore(template, mappedFields, hasTimeSeries, rowCount);
            scores.put(template, score);
            log.trace("模板 {} 匹配分数: {}", template.getTemplateCode(), score);
        }

        // 5. 选择分数最高的模板
        SmartBiChartTemplate bestMatch = scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(getDefaultTemplate(factoryId));

        if (bestMatch != null) {
            int bestScore = scores.getOrDefault(bestMatch, 0);
            log.info("智能匹配完成: 最佳模板={}, 分数={}", bestMatch.getTemplateCode(), bestScore);
        }

        return bestMatch;
    }

    /**
     * 计算模板与数据特征的匹配分数
     *
     * @param template      图表模板
     * @param mappedFields  已映射的标准字段集合（小写）
     * @param hasTimeSeries 是否有时间序列
     * @param rowCount      数据行数
     * @return 匹配分数（0-100）
     */
    private int calculateMatchScore(SmartBiChartTemplate template,
                                     Set<String> mappedFields,
                                     boolean hasTimeSeries,
                                     int rowCount) {
        int score = 0;
        String templateCode = template.getTemplateCode();
        String chartType = template.getChartType();

        // ==================== 规则1: 预实对比 (budget_vs_actual) ====================
        // 检测到 budget_amount + actual_amount → 预实对比模板
        if (containsAll(mappedFields, "budget_amount", "actual_amount")
                || containsAll(mappedFields, "budget", "actual")) {
            if (SmartBiChartTemplate.TEMPLATE_BUDGET_VS_ACTUAL.equals(templateCode)
                    || templateCode.contains("budget")) {
                score += 50;
                log.debug("规则1匹配: 预实对比, +50 分");
            }
        }

        // ==================== 规则2: 利润趋势 (profit_trend) ====================
        // 检测到 revenue + cost + profit + 时间序列 → 利润趋势模板
        if (hasTimeSeries && (
                containsAll(mappedFields, "revenue", "cost", "profit")
                || containsAll(mappedFields, "revenue", "cost")
                || containsAny(mappedFields, "gross_profit", "net_profit", "operating_profit"))) {
            if (SmartBiChartTemplate.TEMPLATE_PROFIT_TREND.equals(templateCode)
                    || templateCode.contains("profit_trend")) {
                score += 50;
                log.debug("规则2匹配: 利润趋势, +50 分");
            }
        }

        // ==================== 规则3: 成本结构 (cost_structure) ====================
        // 检测到多个成本项 + 无时间序列 → 成本结构饼图
        Set<String> costFields = mappedFields.stream()
                .filter(f -> f.contains("cost") || f.contains("expense") || f.contains("fee"))
                .collect(Collectors.toSet());
        if (costFields.size() >= 2 && !hasTimeSeries) {
            if (SmartBiChartTemplate.TEMPLATE_COST_STRUCTURE_DETAIL.equals(templateCode)
                    || SmartBiChartTemplate.TEMPLATE_COST_STRUCTURE_PIE.equals(templateCode)
                    || templateCode.contains("cost_structure")) {
                score += 50;
                log.debug("规则3匹配: 成本结构 (成本字段数={}), +50 分", costFields.size());
            }
        }

        // ==================== 规则4: 同环比分析 (yoy_mom_comparison) ====================
        // 检测到 yoy_amount 或 mom_amount → 同环比分析模板
        if (containsAny(mappedFields, "yoy_amount", "mom_amount", "yoy", "mom",
                "year_on_year", "month_on_month", "yoy_rate", "mom_rate")) {
            if (SmartBiChartTemplate.TEMPLATE_YOY_MOM_COMPARISON.equals(templateCode)
                    || templateCode.contains("yoy") || templateCode.contains("comparison")) {
                score += 50;
                log.debug("规则4匹配: 同环比分析, +50 分");
            }
        }

        // ==================== 规则5: 销售趋势 (sales_trend) ====================
        // 检测到 quantity + amount + 时间序列 → 销售趋势模板
        if (hasTimeSeries && (
                containsAll(mappedFields, "quantity", "amount")
                || containsAll(mappedFields, "sales_quantity", "sales_amount")
                || containsAny(mappedFields, "order_amount", "total_sales"))) {
            if (templateCode.contains("sales_trend") || templateCode.contains("sales_line")) {
                score += 50;
                log.debug("规则5匹配: 销售趋势, +50 分");
            }
        }

        // ==================== 通用规则: 图表类型与数据特征匹配 ====================

        // 时间序列数据偏好折线图
        if (hasTimeSeries) {
            if (SmartBiChartTemplate.TYPE_LINE.equals(chartType)
                    || SmartBiChartTemplate.TYPE_AREA.equals(chartType)) {
                score += 20;
            }
        }

        // 小数据量偏好饼图/仪表盘
        if (rowCount > 0 && rowCount <= 10) {
            if (SmartBiChartTemplate.TYPE_PIE.equals(chartType)
                    || SmartBiChartTemplate.TYPE_GAUGE.equals(chartType)
                    || SmartBiChartTemplate.TYPE_DOUGHNUT.equals(chartType)) {
                score += 15;
            }
        }

        // 中等数据量偏好柱状图
        if (rowCount > 10 && rowCount <= 50) {
            if (SmartBiChartTemplate.TYPE_BAR.equals(chartType)
                    || SmartBiChartTemplate.TYPE_STACKED_BAR.equals(chartType)) {
                score += 15;
            }
        }

        // 大数据量偏好折线图
        if (rowCount > 50) {
            if (SmartBiChartTemplate.TYPE_LINE.equals(chartType)
                    || SmartBiChartTemplate.TYPE_AREA.equals(chartType)) {
                score += 15;
            }
        }

        // 包含比率字段偏好雷达图或仪表盘
        if (containsAny(mappedFields, "rate", "ratio", "percentage")) {
            if (SmartBiChartTemplate.TYPE_RADAR.equals(chartType)
                    || SmartBiChartTemplate.TYPE_GAUGE.equals(chartType)) {
                score += 10;
            }
        }

        // ==================== 字段覆盖度加分 ====================
        // 检查模板所需字段与已映射字段的匹配度
        if (template.getDataMapping() != null && !template.getDataMapping().isEmpty()) {
            try {
                Map<String, String> dataMapping = objectMapper.readValue(
                        template.getDataMapping(),
                        new TypeReference<Map<String, String>>() {});

                int mappedCount = 0;
                for (String requiredField : dataMapping.values()) {
                    if (mappedFields.contains(requiredField.toLowerCase())) {
                        mappedCount++;
                    }
                }

                if (!dataMapping.isEmpty()) {
                    // 计算覆盖率加分（最多20分）
                    int coverageScore = (int) ((double) mappedCount / dataMapping.size() * 20);
                    score += coverageScore;
                }
            } catch (Exception e) {
                log.trace("解析模板数据映射失败: {}", e.getMessage());
            }
        }

        // ==================== 排序权重 ====================
        // 考虑模板本身的排序权重
        if (template.getSortOrder() != null) {
            score += Math.max(0, 10 - template.getSortOrder());
        }

        return score;
    }

    /**
     * 检查是否有时间序列数据
     */
    private boolean hasTimeSeries(ExcelParseResponse parseResult) {
        if (parseResult == null || parseResult.getDataFeatures() == null) {
            return false;
        }

        return parseResult.getDataFeatures().stream()
                .anyMatch(f -> f != null &&
                        (DataFeatureResult.DataType.DATE.equals(f.getDataType())
                         || "DATE".equals(String.valueOf(f.getDataType()))));
    }

    /**
     * 检查字段集合是否包含所有指定字段
     */
    private boolean containsAll(Set<String> fields, String... required) {
        for (String r : required) {
            boolean found = false;
            for (String f : fields) {
                if (f.contains(r.toLowerCase()) || r.toLowerCase().contains(f)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }

    /**
     * 检查字段集合是否包含任意一个指定字段
     */
    private boolean containsAny(Set<String> fields, String... any) {
        for (String a : any) {
            for (String f : fields) {
                if (f.contains(a.toLowerCase()) || a.toLowerCase().contains(f)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 获取默认模板
     */
    private SmartBiChartTemplate getDefaultTemplate(String factoryId) {
        // 尝试获取通用柱状图模板
        SmartBiChartTemplate defaultTemplate = getTemplate("general_bar", factoryId);
        if (defaultTemplate != null) {
            return defaultTemplate;
        }

        // 获取第一个可用模板
        List<SmartBiChartTemplate> templates = getAllTemplates();
        if (!templates.isEmpty()) {
            return templates.get(0);
        }

        log.warn("没有找到默认模板");
        return null;
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
        if (template.getApplicableMetrics() == null || template.getApplicableMetrics().isEmpty()) {
            return;
        }

        try {
            // 假设 applicableMetrics 是逗号分隔的字符串或 JSON 数组
            String applicableMetricsStr = template.getApplicableMetrics();
            List<String> metricCodes;

            if (applicableMetricsStr.startsWith("[")) {
                // JSON 数组格式
                metricCodes = objectMapper.readValue(applicableMetricsStr, new TypeReference<List<String>>() {});
            } else {
                // 逗号分隔格式
                metricCodes = Arrays.asList(applicableMetricsStr.split(","));
            }

            for (String metricCode : metricCodes) {
                String trimmedCode = metricCode.trim();
                metricToTemplatesCache.computeIfAbsent(trimmedCode, k -> new ArrayList<>())
                        .add(template.getTemplateCode());
            }
        } catch (Exception e) {
            log.warn("解析模板指标映射失败: templateCode={}, applicableMetrics={}, error={}",
                    template.getTemplateCode(), template.getApplicableMetrics(), e.getMessage());
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
