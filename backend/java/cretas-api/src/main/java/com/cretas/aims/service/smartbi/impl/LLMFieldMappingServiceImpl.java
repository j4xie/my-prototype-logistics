package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.smartbi.FieldMappingDictionary;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole.ChartAxisRole;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole.FieldRole;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.repository.smartbi.SmartBiDictionaryRepository;
import com.cretas.aims.service.smartbi.LLMFieldMappingService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * LLM 字段映射服务实现
 *
 * 使用 DashScope (阿里云 LLM) 理解未知字段并自动映射到标准字段，
 * 同时分析字段在图表中的角色（X_AXIS/SERIES/Y_AXIS）
 *
 * 核心流程：
 * 1. 首先尝试从字典缓存匹配（避免重复调用 LLM）
 * 2. 未命中缓存时调用 LLM 分析
 * 3. 高置信度结果自动保存到字典数据库
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
public class LLMFieldMappingServiceImpl implements LLMFieldMappingService {

    private static final String DICT_TYPE_FIELD_MAPPING = "llm_field_mapping";
    private static final double CONFIDENCE_THRESHOLD_SAVE = 0.75;
    private static final double CONFIDENCE_THRESHOLD_CONFIRM = 0.7;

    @Autowired
    private DashScopeClient dashScopeClient;

    @Autowired
    private FieldMappingDictionary fieldMappingDictionary;

    @Autowired(required = false)
    private SmartBiDictionaryRepository dictionaryRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ==================== 系统提示词 ====================

    private static final String SYSTEM_PROMPT = """
        你是一个数据分析专家，擅长理解业务数据字段的语义并进行标准化映射。

        你的任务是分析给定的字段信息，并输出以下结果：

        1. standardField: 标准字段名（snake_case 格式，如 order_date, sales_amount）
        2. alias: 中文别名（简洁明了）
        3. role: 字段角色
           - TIME: 时间/日期类型字段
           - DIMENSION: 维度字段（分类、分组依据）
           - METRIC: 度量字段（可聚合的数值）
           - IDENTIFIER: 标识符（ID类，通常不展示）
        4. chartAxis: 图表轴角色
           - X_AXIS: 适合作为 X 轴（时间、有序分类）
           - SERIES: 适合作为系列/图例（2-10个唯一值的分类）
           - Y_AXIS: 适合作为 Y 轴（数值）
           - NONE: 不适合展示在图表中
        5. aggregationType: 聚合方式
           - GROUP_BY: 用于分组（维度字段）
           - SUM: 求和（金额、数量等）
           - AVG: 平均值（价格、比率等）
           - COUNT: 计数
           - MAX/MIN: 最大/最小值
        6. axisPriority: 优先级（1-99，1为最高优先）
        7. confidence: 置信度（0.0-1.0）
        8. reasoning: 简短的推理说明

        判断规则：
        - 日期/时间类型 → TIME + X_AXIS + GROUP_BY
        - 唯一值 2-10 个的分类 → DIMENSION + SERIES + GROUP_BY
        - 唯一值 >10 的分类 → DIMENSION + X_AXIS + GROUP_BY
        - 唯一值 = 数据量的字段 → IDENTIFIER + NONE
        - 数值类型（金额、数量）→ METRIC + Y_AXIS + SUM/AVG
        - 百分比/比率 → METRIC + Y_AXIS + AVG

        输出格式：纯 JSON，不要包含 markdown 代码块标记
        """;

    private static final String BATCH_SYSTEM_PROMPT = """
        你是一个数据分析专家，擅长理解业务数据字段的语义并进行标准化映射。

        你的任务是分析多个字段的信息，综合考虑它们之间的关系，为每个字段输出映射结果。

        输出格式要求：
        - 返回一个 JSON 数组
        - 每个元素包含: originalField, standardField, alias, role, chartAxis, aggregationType, axisPriority, confidence, reasoning

        字段角色 (role):
        - TIME: 时间/日期类型
        - DIMENSION: 维度（分类、分组依据）
        - METRIC: 度量（可聚合的数值）
        - IDENTIFIER: 标识符（ID类）

        图表轴角色 (chartAxis):
        - X_AXIS: 适合作为 X 轴
        - SERIES: 适合作为系列（2-10个唯一值）
        - Y_AXIS: 适合作为 Y 轴（数值）
        - NONE: 不适合展示

        聚合方式 (aggregationType):
        - GROUP_BY: 分组
        - SUM: 求和
        - AVG: 平均值
        - COUNT: 计数

        规则：
        - 只能有一个 X_AXIS（优先时间字段）
        - 只能有一个 SERIES（优先唯一值 2-10 的分类）
        - 可以有多个 Y_AXIS
        - ID类字段设为 NONE

        输出：纯 JSON 数组，不要 markdown 代码块
        """;

    // ==================== 核心方法实现 ====================

    @Override
    public FieldMappingWithChartRole analyzeField(String columnName, String dataType,
                                                   List<Object> sampleValues, int uniqueValueCount) {
        log.info("[LLM Field Mapping] 分析字段: columnName={}, dataType={}, uniqueValueCount={}",
                columnName, dataType, uniqueValueCount);

        // 1. 先尝试从字典缓存获取
        Optional<FieldMappingWithChartRole> cached = getFromCache(columnName);
        if (cached.isPresent()) {
            log.info("[LLM Field Mapping] 命中缓存: {} -> {}", columnName, cached.get().getStandardField());
            // 更新实时数据
            FieldMappingWithChartRole result = cached.get();
            result.setUniqueValueCount(uniqueValueCount);
            return result;
        }

        // 2. 尝试从 FieldMappingDictionary 精确匹配
        Optional<String> dictMatch = fieldMappingDictionary.findStandardField(columnName);
        if (dictMatch.isPresent()) {
            String standardField = dictMatch.get();
            String dictDataType = fieldMappingDictionary.getDataType(standardField);
            int confidence = fieldMappingDictionary.getMatchConfidence(columnName, standardField);

            log.info("[LLM Field Mapping] 字典匹配: {} -> {} (confidence={})", columnName, standardField, confidence);

            return buildMappingFromDictionary(columnName, standardField, dictDataType,
                    uniqueValueCount, confidence / 100.0);
        }

        // 3. 调用 LLM 分析
        return analyzeFieldWithLLM(columnName, dataType, sampleValues, uniqueValueCount);
    }

    @Override
    public List<FieldMappingWithChartRole> analyzeFields(List<FieldInfo> fieldInfoList) {
        if (fieldInfoList == null || fieldInfoList.isEmpty()) {
            return Collections.emptyList();
        }

        log.info("[LLM Field Mapping] 批量分析 {} 个字段", fieldInfoList.size());

        // 1. 先尝试从缓存和字典获取
        List<FieldMappingWithChartRole> results = new ArrayList<>();
        List<FieldInfo> needLLMAnalysis = new ArrayList<>();

        for (FieldInfo fieldInfo : fieldInfoList) {
            Optional<FieldMappingWithChartRole> cached = getFromCache(fieldInfo.getColumnName());
            if (cached.isPresent()) {
                FieldMappingWithChartRole result = cached.get();
                result.setUniqueValueCount(fieldInfo.getUniqueValueCount());
                results.add(result);
                continue;
            }

            Optional<String> dictMatch = fieldMappingDictionary.findStandardField(fieldInfo.getColumnName());
            if (dictMatch.isPresent()) {
                String standardField = dictMatch.get();
                String dictDataType = fieldMappingDictionary.getDataType(standardField);
                int confidence = fieldMappingDictionary.getMatchConfidence(fieldInfo.getColumnName(), standardField);

                results.add(buildMappingFromDictionary(fieldInfo.getColumnName(), standardField,
                        dictDataType, fieldInfo.getUniqueValueCount(), confidence / 100.0));
                continue;
            }

            needLLMAnalysis.add(fieldInfo);
        }

        // 2. 批量调用 LLM 分析未匹配的字段
        if (!needLLMAnalysis.isEmpty()) {
            log.info("[LLM Field Mapping] {} 个字段需要 LLM 分析", needLLMAnalysis.size());
            List<FieldMappingWithChartRole> llmResults = analyzeFieldsWithLLM(needLLMAnalysis);
            results.addAll(llmResults);
        }

        // 3. 后处理：确保只有一个 X_AXIS 和一个 SERIES
        return postProcessMappings(results);
    }

    @Override
    public FieldMappingWithChartRole analyzeAndSave(String columnName, String dataType,
                                                     List<Object> sampleValues, int uniqueValueCount,
                                                     String factoryId) {
        FieldMappingWithChartRole result = analyzeField(columnName, dataType, sampleValues, uniqueValueCount);

        // 高置信度时自动保存
        if (result.getConfidence() != null && result.getConfidence() >= CONFIDENCE_THRESHOLD_SAVE) {
            saveToDatabase(result, factoryId);
        }

        return result;
    }

    @Override
    public List<FieldMappingWithChartRole> analyzeAndSaveAll(List<FieldInfo> fieldInfoList, String factoryId) {
        List<FieldMappingWithChartRole> results = analyzeFields(fieldInfoList);

        // 批量保存高置信度结果
        for (FieldMappingWithChartRole result : results) {
            if (result.getConfidence() != null && result.getConfidence() >= CONFIDENCE_THRESHOLD_SAVE) {
                saveToDatabase(result, factoryId);
            }
        }

        return results;
    }

    @Override
    public Map<String, Object> recommendChartConfig(List<FieldMappingWithChartRole> mappings) {
        Map<String, Object> config = new LinkedHashMap<>();

        if (mappings == null || mappings.isEmpty()) {
            return config;
        }

        // 按轴角色分组
        FieldMappingWithChartRole xAxisField = null;
        FieldMappingWithChartRole seriesField = null;
        List<FieldMappingWithChartRole> yAxisFields = new ArrayList<>();

        for (FieldMappingWithChartRole mapping : mappings) {
            if (mapping.getChartAxis() == ChartAxisRole.X_AXIS) {
                if (xAxisField == null ||
                    (mapping.getAxisPriority() != null && xAxisField.getAxisPriority() != null &&
                     mapping.getAxisPriority() < xAxisField.getAxisPriority())) {
                    xAxisField = mapping;
                }
            } else if (mapping.getChartAxis() == ChartAxisRole.SERIES) {
                if (seriesField == null ||
                    (mapping.getAxisPriority() != null && seriesField.getAxisPriority() != null &&
                     mapping.getAxisPriority() < seriesField.getAxisPriority())) {
                    seriesField = mapping;
                }
            } else if (mapping.getChartAxis() == ChartAxisRole.Y_AXIS) {
                yAxisFields.add(mapping);
            }
        }

        // 如果没有 X 轴，尝试从时间字段中选择
        if (xAxisField == null) {
            xAxisField = mappings.stream()
                    .filter(m -> m.getRole() == FieldRole.TIME)
                    .findFirst()
                    .orElse(null);
        }

        // 构建配置
        if (xAxisField != null) {
            config.put("xAxisField", xAxisField.getStandardField());
            config.put("xAxisAlias", xAxisField.getAlias());
        }

        if (seriesField != null) {
            config.put("seriesField", seriesField.getStandardField());
            config.put("seriesAlias", seriesField.getAlias());
        }

        List<Map<String, String>> yAxisConfig = yAxisFields.stream()
                .sorted(Comparator.comparingInt(m -> m.getAxisPriority() != null ? m.getAxisPriority() : 99))
                .map(m -> {
                    Map<String, String> fieldConfig = new LinkedHashMap<>();
                    fieldConfig.put("field", m.getStandardField());
                    fieldConfig.put("alias", m.getAlias());
                    fieldConfig.put("aggregation", m.getAggregationType());
                    return fieldConfig;
                })
                .collect(Collectors.toList());
        config.put("yAxisFields", yAxisConfig);

        // 推荐图表类型
        String chartType = recommendChartType(xAxisField, seriesField, yAxisFields);
        config.put("chartType", chartType);

        return config;
    }

    @Override
    public boolean isAvailable() {
        return dashScopeClient != null && dashScopeClient.isAvailable();
    }

    @Override
    public void saveUserMapping(String factoryId, String standardField, String originalColumn, String source) {
        if (dictionaryRepository == null) {
            log.debug("[LLM Field Mapping] 数据库不可用，跳过保存用户映射");
            return;
        }

        if (standardField == null || standardField.isEmpty() || originalColumn == null || originalColumn.isEmpty()) {
            log.warn("[LLM Field Mapping] 无效的映射参数: standardField={}, originalColumn={}",
                    standardField, originalColumn);
            return;
        }

        try {
            // 构建元数据
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("source", source != null ? source : "USER");
            metadata.put("confidence", 1.0); // 用户确认的映射置信度为 100%

            // 构建别名列表
            List<String> aliases = new ArrayList<>();
            aliases.add(originalColumn);

            // 查找或创建条目
            Optional<SmartBiDictionary> existing = factoryId != null ?
                    dictionaryRepository.findByDictTypeAndNameAndFactoryId(DICT_TYPE_FIELD_MAPPING, standardField, factoryId) :
                    dictionaryRepository.findGlobalByDictTypeAndName(DICT_TYPE_FIELD_MAPPING, standardField);

            SmartBiDictionary entry;
            if (existing.isPresent()) {
                entry = existing.get();
                // 合并别名
                List<String> existingAliases = parseAliases(entry.getAliases());
                for (String alias : aliases) {
                    if (!existingAliases.contains(alias)) {
                        existingAliases.add(alias);
                    }
                }
                entry.setAliases(objectMapper.writeValueAsString(existingAliases));
                // 更新来源
                entry.setSource(source != null ? source : "USER");
            } else {
                entry = SmartBiDictionary.builder()
                        .dictType(DICT_TYPE_FIELD_MAPPING)
                        .name(standardField)
                        .factoryId(factoryId)
                        .aliases(objectMapper.writeValueAsString(aliases))
                        .source(source != null ? source : "USER")
                        .isActive(true)
                        .priority(100) // 用户确认的映射优先级最高
                        .build();
            }

            entry.setMetadata(objectMapper.writeValueAsString(metadata));
            dictionaryRepository.save(entry);

            log.info("[LLM Field Mapping] 已保存用户映射: {} -> {} (factoryId={}, source={})",
                    originalColumn, standardField, factoryId, source);

        } catch (Exception e) {
            log.error("[LLM Field Mapping] 保存用户映射失败: {}", e.getMessage(), e);
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 从缓存获取映射结果
     */
    private Optional<FieldMappingWithChartRole> getFromCache(String columnName) {
        if (dictionaryRepository == null) {
            return Optional.empty();
        }

        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByAliasContaining(DICT_TYPE_FIELD_MAPPING, null, columnName);

            if (entries.isEmpty()) {
                return Optional.empty();
            }

            SmartBiDictionary entry = entries.get(0);
            return parseFromDictionary(entry, columnName);

        } catch (Exception e) {
            log.warn("[LLM Field Mapping] 缓存查询失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 从字典条目解析映射结果
     */
    private Optional<FieldMappingWithChartRole> parseFromDictionary(SmartBiDictionary entry, String originalField) {
        try {
            String metadataJson = entry.getMetadata();
            if (metadataJson == null || metadataJson.isEmpty()) {
                return Optional.empty();
            }

            Map<String, Object> metadata = objectMapper.readValue(metadataJson,
                    new TypeReference<Map<String, Object>>() {});

            FieldMappingWithChartRole result = FieldMappingWithChartRole.builder()
                    .originalField(originalField)
                    .standardField(entry.getName())
                    .alias(getStringValue(metadata, "alias", entry.getName()))
                    .role(FieldRole.fromString(getStringValue(metadata, "role", "DIMENSION")))
                    .chartAxis(ChartAxisRole.fromString(getStringValue(metadata, "chartAxis", "NONE")))
                    .aggregationType(getStringValue(metadata, "aggregationType", "GROUP_BY"))
                    .axisPriority(getIntValue(metadata, "axisPriority", 99))
                    .dataType(getStringValue(metadata, "dataType", "STRING"))
                    .confidence(getDoubleValue(metadata, "confidence", 0.9))
                    .requiresConfirmation(false)
                    .build();

            return Optional.of(result);

        } catch (Exception e) {
            log.warn("[LLM Field Mapping] 解析字典条目失败: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * 从字典配置构建映射结果
     */
    private FieldMappingWithChartRole buildMappingFromDictionary(String columnName, String standardField,
                                                                  String dataType, int uniqueValueCount,
                                                                  double confidence) {
        // 根据数据类型和唯一值数量推断角色
        FieldRole role;
        ChartAxisRole chartAxis;
        String aggregationType;
        int axisPriority;

        if ("DATE".equalsIgnoreCase(dataType)) {
            role = FieldRole.TIME;
            chartAxis = ChartAxisRole.X_AXIS;
            aggregationType = "GROUP_BY";
            axisPriority = 1;
        } else if ("AMOUNT".equalsIgnoreCase(dataType) || "QUANTITY".equalsIgnoreCase(dataType) ||
                   "NUMBER".equalsIgnoreCase(dataType)) {
            role = FieldRole.METRIC;
            chartAxis = ChartAxisRole.Y_AXIS;
            aggregationType = "AMOUNT".equalsIgnoreCase(dataType) ? "SUM" : "AVG";
            axisPriority = 1;
        } else if ("PERCENTAGE".equalsIgnoreCase(dataType)) {
            role = FieldRole.METRIC;
            chartAxis = ChartAxisRole.Y_AXIS;
            aggregationType = "AVG";
            axisPriority = 2;
        } else if ("ID".equalsIgnoreCase(dataType)) {
            role = FieldRole.IDENTIFIER;
            chartAxis = ChartAxisRole.NONE;
            aggregationType = "COUNT_DISTINCT";
            axisPriority = 99;
        } else if ("CATEGORICAL".equalsIgnoreCase(dataType) || "STRING".equalsIgnoreCase(dataType)) {
            role = FieldRole.DIMENSION;
            if (uniqueValueCount >= 2 && uniqueValueCount <= 10) {
                chartAxis = ChartAxisRole.SERIES;
                axisPriority = 1;
            } else if (uniqueValueCount > 10 && uniqueValueCount <= 100) {
                chartAxis = ChartAxisRole.X_AXIS;
                axisPriority = 2;
            } else {
                chartAxis = ChartAxisRole.NONE;
                axisPriority = 99;
            }
            aggregationType = "GROUP_BY";
        } else {
            role = FieldRole.DIMENSION;
            chartAxis = ChartAxisRole.NONE;
            aggregationType = "GROUP_BY";
            axisPriority = 99;
        }

        // 获取同义词作为别名
        List<String> synonyms = fieldMappingDictionary.getAllSynonyms(standardField);
        String alias = synonyms.isEmpty() ? standardField : synonyms.get(0);

        return FieldMappingWithChartRole.builder()
                .originalField(columnName)
                .standardField(standardField)
                .alias(alias)
                .role(role)
                .chartAxis(chartAxis)
                .aggregationType(aggregationType)
                .axisPriority(axisPriority)
                .dataType(dataType)
                .uniqueValueCount(uniqueValueCount)
                .confidence(confidence)
                .requiresConfirmation(confidence < CONFIDENCE_THRESHOLD_CONFIRM)
                .reasoning("字典匹配")
                .build();
    }

    /**
     * 使用 LLM 分析单个字段
     */
    private FieldMappingWithChartRole analyzeFieldWithLLM(String columnName, String dataType,
                                                          List<Object> sampleValues, int uniqueValueCount) {
        if (!isAvailable()) {
            log.warn("[LLM Field Mapping] LLM 服务不可用，使用默认规则");
            return buildDefaultMapping(columnName, dataType, uniqueValueCount);
        }

        try {
            // 构建用户输入
            String userInput = buildSingleFieldPrompt(columnName, dataType, sampleValues, uniqueValueCount);

            // 调用 LLM（使用低温度确保输出稳定）
            String response = dashScopeClient.chatLowTemp(SYSTEM_PROMPT, userInput);

            // 解析响应
            return parseLLMResponse(response, columnName, uniqueValueCount);

        } catch (Exception e) {
            log.error("[LLM Field Mapping] LLM 分析失败: columnName={}, error={}",
                    columnName, e.getMessage(), e);
            return buildDefaultMapping(columnName, dataType, uniqueValueCount);
        }
    }

    /**
     * 使用 LLM 批量分析字段
     */
    private List<FieldMappingWithChartRole> analyzeFieldsWithLLM(List<FieldInfo> fieldInfoList) {
        if (!isAvailable()) {
            log.warn("[LLM Field Mapping] LLM 服务不可用，使用默认规则");
            return fieldInfoList.stream()
                    .map(f -> buildDefaultMapping(f.getColumnName(), f.getDataType(), f.getUniqueValueCount()))
                    .collect(Collectors.toList());
        }

        try {
            // 构建用户输入
            String userInput = buildBatchFieldPrompt(fieldInfoList);

            // 调用 LLM
            String response = dashScopeClient.chatLowTemp(BATCH_SYSTEM_PROMPT, userInput);

            // 解析响应
            return parseBatchLLMResponse(response, fieldInfoList);

        } catch (Exception e) {
            log.error("[LLM Field Mapping] LLM 批量分析失败: error={}", e.getMessage(), e);
            return fieldInfoList.stream()
                    .map(f -> buildDefaultMapping(f.getColumnName(), f.getDataType(), f.getUniqueValueCount()))
                    .collect(Collectors.toList());
        }
    }

    /**
     * 构建单字段分析提示词
     */
    private String buildSingleFieldPrompt(String columnName, String dataType,
                                          List<Object> sampleValues, int uniqueValueCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("请分析以下字段:\n\n");
        sb.append("列名: ").append(columnName).append("\n");
        sb.append("数据类型: ").append(dataType).append("\n");
        sb.append("唯一值数量: ").append(uniqueValueCount).append("\n");

        if (sampleValues != null && !sampleValues.isEmpty()) {
            sb.append("样本值: ");
            List<String> samples = sampleValues.stream()
                    .limit(5)
                    .map(v -> v == null ? "null" : v.toString())
                    .collect(Collectors.toList());
            sb.append(String.join(", ", samples)).append("\n");
        }

        return sb.toString();
    }

    /**
     * 构建批量字段分析提示词
     */
    private String buildBatchFieldPrompt(List<FieldInfo> fieldInfoList) {
        StringBuilder sb = new StringBuilder();
        sb.append("请分析以下 ").append(fieldInfoList.size()).append(" 个字段:\n\n");

        for (int i = 0; i < fieldInfoList.size(); i++) {
            FieldInfo info = fieldInfoList.get(i);
            sb.append("【字段 ").append(i + 1).append("】\n");
            sb.append("列名: ").append(info.getColumnName()).append("\n");
            sb.append("数据类型: ").append(info.getDataType()).append("\n");
            sb.append("唯一值数量: ").append(info.getUniqueValueCount()).append("\n");

            if (info.getSampleValues() != null && !info.getSampleValues().isEmpty()) {
                List<String> samples = info.getSampleValues().stream()
                        .limit(3)
                        .map(v -> v == null ? "null" : v.toString())
                        .collect(Collectors.toList());
                sb.append("样本值: ").append(String.join(", ", samples)).append("\n");
            }
            sb.append("\n");
        }

        return sb.toString();
    }

    /**
     * 解析 LLM 单字段响应
     */
    private FieldMappingWithChartRole parseLLMResponse(String response, String columnName, int uniqueValueCount) {
        try {
            // 清理响应（移除可能的 markdown 代码块标记）
            String cleanJson = cleanJsonResponse(response);
            JsonNode json = objectMapper.readTree(cleanJson);

            return FieldMappingWithChartRole.builder()
                    .originalField(columnName)
                    .standardField(getJsonString(json, "standardField", columnName.toLowerCase().replace(" ", "_")))
                    .alias(getJsonString(json, "alias", columnName))
                    .role(FieldRole.fromString(getJsonString(json, "role", "DIMENSION")))
                    .chartAxis(ChartAxisRole.fromString(getJsonString(json, "chartAxis", "NONE")))
                    .aggregationType(getJsonString(json, "aggregationType", "GROUP_BY"))
                    .axisPriority(getJsonInt(json, "axisPriority", 99))
                    .dataType(getJsonString(json, "dataType", "STRING"))
                    .uniqueValueCount(uniqueValueCount)
                    .confidence(getJsonDouble(json, "confidence", 0.8))
                    .reasoning(getJsonString(json, "reasoning", "LLM 推断"))
                    .requiresConfirmation(getJsonDouble(json, "confidence", 0.8) < CONFIDENCE_THRESHOLD_CONFIRM)
                    .build();

        } catch (Exception e) {
            log.warn("[LLM Field Mapping] 解析 LLM 响应失败: {}", e.getMessage());
            return buildDefaultMapping(columnName, "STRING", uniqueValueCount);
        }
    }

    /**
     * 解析 LLM 批量响应
     */
    private List<FieldMappingWithChartRole> parseBatchLLMResponse(String response, List<FieldInfo> fieldInfoList) {
        List<FieldMappingWithChartRole> results = new ArrayList<>();

        try {
            String cleanJson = cleanJsonResponse(response);
            JsonNode jsonArray = objectMapper.readTree(cleanJson);

            if (!jsonArray.isArray()) {
                log.warn("[LLM Field Mapping] LLM 响应不是数组格式");
                return fieldInfoList.stream()
                        .map(f -> buildDefaultMapping(f.getColumnName(), f.getDataType(), f.getUniqueValueCount()))
                        .collect(Collectors.toList());
            }

            // 创建列名到 FieldInfo 的映射
            Map<String, FieldInfo> fieldInfoMap = fieldInfoList.stream()
                    .collect(Collectors.toMap(FieldInfo::getColumnName, f -> f, (a, b) -> a));

            for (JsonNode node : jsonArray) {
                String originalField = getJsonString(node, "originalField", "");
                FieldInfo info = fieldInfoMap.get(originalField);
                int uniqueValueCount = info != null ? info.getUniqueValueCount() : 0;

                FieldMappingWithChartRole mapping = FieldMappingWithChartRole.builder()
                        .originalField(originalField)
                        .standardField(getJsonString(node, "standardField", originalField.toLowerCase().replace(" ", "_")))
                        .alias(getJsonString(node, "alias", originalField))
                        .role(FieldRole.fromString(getJsonString(node, "role", "DIMENSION")))
                        .chartAxis(ChartAxisRole.fromString(getJsonString(node, "chartAxis", "NONE")))
                        .aggregationType(getJsonString(node, "aggregationType", "GROUP_BY"))
                        .axisPriority(getJsonInt(node, "axisPriority", 99))
                        .dataType(info != null ? info.getDataType() : "STRING")
                        .uniqueValueCount(uniqueValueCount)
                        .confidence(getJsonDouble(node, "confidence", 0.8))
                        .reasoning(getJsonString(node, "reasoning", "LLM 推断"))
                        .requiresConfirmation(getJsonDouble(node, "confidence", 0.8) < CONFIDENCE_THRESHOLD_CONFIRM)
                        .build();

                results.add(mapping);
            }

            // 补充未在响应中的字段
            Set<String> processedFields = results.stream()
                    .map(FieldMappingWithChartRole::getOriginalField)
                    .collect(Collectors.toSet());

            for (FieldInfo info : fieldInfoList) {
                if (!processedFields.contains(info.getColumnName())) {
                    results.add(buildDefaultMapping(info.getColumnName(), info.getDataType(), info.getUniqueValueCount()));
                }
            }

        } catch (Exception e) {
            log.error("[LLM Field Mapping] 解析批量响应失败: {}", e.getMessage(), e);
            return fieldInfoList.stream()
                    .map(f -> buildDefaultMapping(f.getColumnName(), f.getDataType(), f.getUniqueValueCount()))
                    .collect(Collectors.toList());
        }

        return results;
    }

    /**
     * 清理 JSON 响应（移除 markdown 代码块等）
     */
    private String cleanJsonResponse(String response) {
        if (response == null) {
            return "{}";
        }

        String cleaned = response.trim();

        // 移除 markdown 代码块标记
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3);
        }

        return cleaned.trim();
    }

    /**
     * 构建默认映射（当 LLM 不可用或解析失败时）
     */
    private FieldMappingWithChartRole buildDefaultMapping(String columnName, String dataType, int uniqueValueCount) {
        FieldRole role;
        ChartAxisRole chartAxis;
        String aggregationType;
        int axisPriority;

        // 根据数据类型和列名启发式判断
        String lowerName = columnName.toLowerCase();

        if ("DATE".equalsIgnoreCase(dataType) ||
            lowerName.contains("date") || lowerName.contains("日期") || lowerName.contains("time") || lowerName.contains("时间")) {
            role = FieldRole.TIME;
            chartAxis = ChartAxisRole.X_AXIS;
            aggregationType = "GROUP_BY";
            axisPriority = 1;
        } else if ("NUMBER".equalsIgnoreCase(dataType) &&
                   (lowerName.contains("amount") || lowerName.contains("金额") ||
                    lowerName.contains("sales") || lowerName.contains("销售") ||
                    lowerName.contains("revenue") || lowerName.contains("收入") ||
                    lowerName.contains("cost") || lowerName.contains("成本"))) {
            role = FieldRole.METRIC;
            chartAxis = ChartAxisRole.Y_AXIS;
            aggregationType = "SUM";
            axisPriority = 1;
        } else if ("NUMBER".equalsIgnoreCase(dataType)) {
            role = FieldRole.METRIC;
            chartAxis = ChartAxisRole.Y_AXIS;
            aggregationType = "SUM";
            axisPriority = 2;
        } else if (lowerName.contains("id") || lowerName.contains("编号") || lowerName.contains("编码")) {
            role = FieldRole.IDENTIFIER;
            chartAxis = ChartAxisRole.NONE;
            aggregationType = "COUNT_DISTINCT";
            axisPriority = 99;
        } else if (uniqueValueCount >= 2 && uniqueValueCount <= 10) {
            role = FieldRole.DIMENSION;
            chartAxis = ChartAxisRole.SERIES;
            aggregationType = "GROUP_BY";
            axisPriority = 1;
        } else if (uniqueValueCount > 10 && uniqueValueCount <= 100) {
            role = FieldRole.DIMENSION;
            chartAxis = ChartAxisRole.X_AXIS;
            aggregationType = "GROUP_BY";
            axisPriority = 2;
        } else {
            role = FieldRole.DIMENSION;
            chartAxis = ChartAxisRole.NONE;
            aggregationType = "GROUP_BY";
            axisPriority = 99;
        }

        return FieldMappingWithChartRole.builder()
                .originalField(columnName)
                .standardField(columnName.toLowerCase().replace(" ", "_").replace("-", "_"))
                .alias(columnName)
                .role(role)
                .chartAxis(chartAxis)
                .aggregationType(aggregationType)
                .axisPriority(axisPriority)
                .dataType(dataType != null ? dataType : "STRING")
                .uniqueValueCount(uniqueValueCount)
                .confidence(0.5)
                .reasoning("默认规则推断")
                .requiresConfirmation(true)
                .build();
    }

    /**
     * 后处理映射结果（确保只有一个 X_AXIS 和一个 SERIES）
     */
    private List<FieldMappingWithChartRole> postProcessMappings(List<FieldMappingWithChartRole> mappings) {
        if (mappings == null || mappings.size() <= 1) {
            return mappings;
        }

        // 找出所有 X_AXIS 字段，只保留优先级最高的
        List<FieldMappingWithChartRole> xAxisFields = mappings.stream()
                .filter(m -> m.getChartAxis() == ChartAxisRole.X_AXIS)
                .sorted(Comparator.comparingInt(m -> m.getAxisPriority() != null ? m.getAxisPriority() : 99))
                .collect(Collectors.toList());

        if (xAxisFields.size() > 1) {
            // 保留第一个，其他的降级
            for (int i = 1; i < xAxisFields.size(); i++) {
                FieldMappingWithChartRole field = xAxisFields.get(i);
                if (field.isSuitableForSeries()) {
                    field.setChartAxis(ChartAxisRole.SERIES);
                    field.setAxisPriority(2);
                } else {
                    field.setChartAxis(ChartAxisRole.NONE);
                    field.setAxisPriority(99);
                }
            }
        }

        // 找出所有 SERIES 字段，只保留优先级最高的
        List<FieldMappingWithChartRole> seriesFields = mappings.stream()
                .filter(m -> m.getChartAxis() == ChartAxisRole.SERIES)
                .sorted(Comparator.comparingInt(m -> m.getAxisPriority() != null ? m.getAxisPriority() : 99))
                .collect(Collectors.toList());

        if (seriesFields.size() > 1) {
            // 保留第一个，其他的降级
            for (int i = 1; i < seriesFields.size(); i++) {
                FieldMappingWithChartRole field = seriesFields.get(i);
                field.setChartAxis(ChartAxisRole.NONE);
                field.setAxisPriority(99);
            }
        }

        return mappings;
    }

    /**
     * 推荐图表类型
     */
    private String recommendChartType(FieldMappingWithChartRole xAxis,
                                       FieldMappingWithChartRole series,
                                       List<FieldMappingWithChartRole> yAxis) {
        if (xAxis != null && xAxis.getRole() == FieldRole.TIME) {
            // 时间序列优先用折线图
            return series != null ? "line" : "line";
        }

        if (series != null && yAxis.size() == 1) {
            // 有系列的单指标用柱状图
            return "bar";
        }

        if (xAxis != null && yAxis.size() >= 1) {
            // 分类 + 指标用柱状图
            return "bar";
        }

        if (yAxis.size() >= 2) {
            // 多指标用组合图
            return "combo";
        }

        return "bar"; // 默认柱状图
    }

    /**
     * 保存映射结果到数据库
     */
    private void saveToDatabase(FieldMappingWithChartRole mapping, String factoryId) {
        if (dictionaryRepository == null) {
            log.debug("[LLM Field Mapping] 数据库不可用，跳过保存");
            return;
        }

        try {
            // 构建元数据
            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("alias", mapping.getAlias());
            metadata.put("role", mapping.getRole().getValue());
            metadata.put("chartAxis", mapping.getChartAxis().getValue());
            metadata.put("aggregationType", mapping.getAggregationType());
            metadata.put("axisPriority", mapping.getAxisPriority());
            metadata.put("dataType", mapping.getDataType());
            metadata.put("confidence", mapping.getConfidence());
            metadata.put("reasoning", mapping.getReasoning());

            // 构建别名列表
            List<String> aliases = new ArrayList<>();
            aliases.add(mapping.getOriginalField());
            if (!mapping.getOriginalField().equalsIgnoreCase(mapping.getAlias())) {
                aliases.add(mapping.getAlias());
            }

            // 查找或创建条目
            Optional<SmartBiDictionary> existing = factoryId != null ?
                    dictionaryRepository.findByDictTypeAndNameAndFactoryId(DICT_TYPE_FIELD_MAPPING, mapping.getStandardField(), factoryId) :
                    dictionaryRepository.findGlobalByDictTypeAndName(DICT_TYPE_FIELD_MAPPING, mapping.getStandardField());

            SmartBiDictionary entry;
            if (existing.isPresent()) {
                entry = existing.get();
                // 合并别名
                List<String> existingAliases = parseAliases(entry.getAliases());
                for (String alias : aliases) {
                    if (!existingAliases.contains(alias)) {
                        existingAliases.add(alias);
                    }
                }
                entry.setAliases(objectMapper.writeValueAsString(existingAliases));
            } else {
                entry = SmartBiDictionary.builder()
                        .dictType(DICT_TYPE_FIELD_MAPPING)
                        .name(mapping.getStandardField())
                        .factoryId(factoryId)
                        .aliases(objectMapper.writeValueAsString(aliases))
                        .source("AI")
                        .isActive(true)
                        .priority(50)
                        .build();
            }

            entry.setMetadata(objectMapper.writeValueAsString(metadata));
            dictionaryRepository.save(entry);

            log.info("[LLM Field Mapping] 已保存映射: {} -> {} (confidence={})",
                    mapping.getOriginalField(), mapping.getStandardField(), mapping.getConfidence());

        } catch (Exception e) {
            log.error("[LLM Field Mapping] 保存映射失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 解析别名 JSON
     */
    private List<String> parseAliases(String aliasesJson) {
        if (aliasesJson == null || aliasesJson.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(aliasesJson, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return new ArrayList<>();
        }
    }

    // ==================== JSON 工具方法 ====================

    private String getJsonString(JsonNode node, String field, String defaultValue) {
        JsonNode valueNode = node.get(field);
        return valueNode != null && !valueNode.isNull() ? valueNode.asText() : defaultValue;
    }

    private int getJsonInt(JsonNode node, String field, int defaultValue) {
        JsonNode valueNode = node.get(field);
        return valueNode != null && valueNode.isNumber() ? valueNode.asInt() : defaultValue;
    }

    private double getJsonDouble(JsonNode node, String field, double defaultValue) {
        JsonNode valueNode = node.get(field);
        return valueNode != null && valueNode.isNumber() ? valueNode.asDouble() : defaultValue;
    }

    private String getStringValue(Map<String, Object> map, String key, String defaultValue) {
        Object value = map.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    private int getIntValue(Map<String, Object> map, String key, int defaultValue) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        return defaultValue;
    }

    private double getDoubleValue(Map<String, Object> map, String key, double defaultValue) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return defaultValue;
    }
}
