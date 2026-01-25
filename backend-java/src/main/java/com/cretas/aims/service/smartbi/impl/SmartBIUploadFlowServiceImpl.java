package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.dto.smartbi.BatchUploadResult;
import com.cretas.aims.dto.smartbi.DynamicChartConfig;
import com.cretas.aims.dto.smartbi.ExcelParseRequest;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.dto.smartbi.FieldMappingWithChartRole;
import com.cretas.aims.dto.smartbi.SheetConfig;
import com.cretas.aims.dto.smartbi.SheetInfo;
import com.cretas.aims.dto.smartbi.SheetUploadResult;
import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.ChartTemplateService;
import com.cretas.aims.service.smartbi.DynamicChartConfigBuilderService;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService.DataType;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService.PersistenceResult;
import com.cretas.aims.service.smartbi.ExcelDynamicParserService;
import com.cretas.aims.service.smartbi.LLMFieldMappingService;
import com.cretas.aims.service.smartbi.SmartBIUploadFlowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.cretas.aims.dto.smartbi.UploadProgressEvent;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * SmartBI 上传流程服务实现
 *
 * 编排完整的上传到图表生成流程：
 * 1. 使用 ExcelDynamicParserService 解析 Excel 文件
 * 2. 使用 ExcelDataPersistenceService 检测数据类型并持久化
 * 3. 使用 ChartTemplateService 推荐图表类型和生成配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmartBIUploadFlowServiceImpl implements SmartBIUploadFlowService {

    private final ExcelDynamicParserService excelParserService;
    private final ExcelDataPersistenceService persistenceService;
    private final ChartTemplateService chartTemplateService;
    private final SmartBiSalesDataRepository salesDataRepository;
    private final SmartBiFinanceDataRepository financeDataRepository;

    @Autowired
    private PythonSmartBIClient pythonClient;

    @Autowired
    private PythonSmartBIConfig pythonConfig;

    /**
     * Sheet 并行处理线程池
     * 5 个线程，避免 DashScope API 限流
     */
    private static final ExecutorService SHEET_EXECUTOR = Executors.newFixedThreadPool(5, r -> {
        Thread t = new Thread(r, "sheet-processor");
        t.setDaemon(true);
        return t;
    });

    /**
     * 单个 Sheet 处理超时时间（秒）
     */
    private static final int SHEET_TIMEOUT_SECONDS = 180;
    private final LLMFieldMappingService llmFieldMappingService;
    private final DynamicChartConfigBuilderService dynamicChartConfigBuilder;

    // 数据类型到模板分类的映射
    private static final Map<String, String> DATA_TYPE_TO_CATEGORY = Map.of(
            "SALES", SmartBiChartTemplate.CATEGORY_SALES,
            "FINANCE", SmartBiChartTemplate.CATEGORY_FINANCE,
            "DEPARTMENT", SmartBiChartTemplate.CATEGORY_HR
    );

    @Override
    @Transactional
    public UploadFlowResult executeUploadFlow(String factoryId, MultipartFile file, String dataType) {
        // 默认使用 Sheet 0, headerRow 0, 不自动确认
        return executeUploadFlow(factoryId, file, dataType, 0, 0, false);
    }

    @Override
    @Transactional
    public UploadFlowResult executeUploadFlow(String factoryId, MultipartFile file, String dataType,
                                               Integer sheetIndex, Integer headerRow, boolean autoConfirm) {
        log.info("开始执行上传流程: factoryId={}, fileName={}, dataType={}, sheetIndex={}, headerRow={}, autoConfirm={}",
                factoryId, file.getOriginalFilename(), dataType, sheetIndex, headerRow, autoConfirm);

        // 1. 验证文件
        if (file == null || file.isEmpty()) {
            return UploadFlowResult.failure("文件不能为空");
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null || (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls"))) {
            return UploadFlowResult.failure("仅支持 .xlsx 或 .xls 格式的文件");
        }

        try {
            // 2. 解析 Excel 文件（使用 Python 服务或 Java 降级）
            ExcelParseRequest parseRequest = ExcelParseRequest.builder()
                    .factoryId(factoryId)
                    .fileName(fileName)
                    .sheetIndex(sheetIndex != null ? sheetIndex : 0)
                    .headerRow(headerRow != null ? headerRow : 0)
                    .sampleSize(100)
                    .skipEmptyRows(true)
                    .businessScene(dataType)
                    .build();

            ExcelParseResponse parseResult = parseExcelWithFallback(file, factoryId, dataType, parseRequest);

            if (!parseResult.isSuccess()) {
                log.warn("Excel 解析失败: {}", parseResult.getErrorMessage());
                return UploadFlowResult.failure("解析失败: " + parseResult.getErrorMessage());
            }

            log.info("Excel 解析成功: headers={}, rows={}",
                    parseResult.getHeaders().size(), parseResult.getRowCount());

            // 3. 检测数据类型
            DataType detectedType = detectDataType(parseResult, dataType);
            String detectedTypeStr = detectedType.name();
            log.info("检测到数据类型: {}", detectedTypeStr);

            // 4. 检查是否需要用户确认字段映射（autoConfirm=true 时跳过）
            boolean needsConfirmation = !autoConfirm && checkNeedsConfirmation(parseResult);

            if (needsConfirmation) {
                log.info("字段映射需要用户确认");
                return UploadFlowResult.builder()
                        .success(true)
                        .message("字段映射需要用户确认")
                        .parseResult(parseResult)
                        .requiresConfirmation(true)
                        .detectedDataType(detectedTypeStr)
                        .recommendedTemplates(getDefaultTemplates(detectedTypeStr, factoryId))
                        .build();
            }

            if (autoConfirm) {
                log.info("autoConfirm=true，跳过用户确认，直接持久化数据");
            }

            // 5. 自动持久化数据
            PersistenceResult persistResult = persistenceService.persistData(
                    factoryId, parseResult, detectedType);

            if (!persistResult.isSuccess()) {
                log.warn("数据持久化失败: {}", persistResult.getMessage());
                return UploadFlowResult.failure("持久化失败: " + persistResult.getMessage());
            }

            log.info("数据持久化成功: uploadId={}, savedRows={}",
                    persistResult.getUploadId(), persistResult.getSavedRows());

            // 6. 推荐图表类型
            String recommendedChartType = recommendChartType(parseResult, detectedTypeStr);
            List<SmartBiChartTemplate> recommendedTemplates = recommendTemplates(factoryId, parseResult);

            // 7. 生成默认图表配置
            Map<String, Object> chartConfig = null;
            String aiAnalysis = null;

            if (!recommendedTemplates.isEmpty()) {
                SmartBiChartTemplate primaryTemplate = recommendedTemplates.get(0);
                Map<String, Object> chartData = buildChartData(
                        factoryId, persistResult.getUploadId(), detectedType);

                Map<String, Object> chartWithAnalysis = chartTemplateService.buildChartWithAnalysis(
                        primaryTemplate.getTemplateCode(), chartData, factoryId);

                chartConfig = chartWithAnalysis;
                aiAnalysis = (String) chartWithAnalysis.get("aiAnalysis");
            }

            // 8. 构建完整结果
            return UploadFlowResult.builder()
                    .success(true)
                    .message(String.format("成功上传并处理 %d 条%s数据",
                            persistResult.getSavedRows(), detectedType.getDisplayName()))
                    .parseResult(parseResult)
                    .persistResult(persistResult)
                    .detectedDataType(detectedTypeStr)
                    .recommendedChartType(recommendedChartType)
                    .recommendedTemplates(recommendedTemplates)
                    .chartConfig(chartConfig)
                    .aiAnalysis(aiAnalysis)
                    .requiresConfirmation(false)
                    .uploadId(persistResult.getUploadId())
                    .build();

        } catch (IOException e) {
            log.error("读取文件失败: {}", e.getMessage(), e);
            return UploadFlowResult.failure("读取文件失败: " + e.getMessage());
        } catch (Exception e) {
            log.error("上传流程执行失败: {}", e.getMessage(), e);
            return UploadFlowResult.failure("处理失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public UploadFlowResult confirmAndPersist(String factoryId,
                                               ExcelParseResponse parseResponse,
                                               List<FieldMappingResult> confirmedMappings,
                                               String dataType) {
        log.info("确认字段映射并持久化: factoryId={}, dataType={}", factoryId, dataType);

        if (parseResponse == null) {
            return UploadFlowResult.failure("解析结果不能为空");
        }

        if (confirmedMappings == null || confirmedMappings.isEmpty()) {
            return UploadFlowResult.failure("字段映射不能为空");
        }

        try {
            // 1. 解析数据类型
            DataType detectedType = parseDataType(dataType);
            if (detectedType == DataType.UNKNOWN) {
                return UploadFlowResult.failure("无效的数据类型: " + dataType);
            }

            // 2. 使用确认的字段映射持久化数据
            PersistenceResult persistResult = persistenceService.persistData(
                    factoryId, parseResponse, confirmedMappings, detectedType);

            if (!persistResult.isSuccess()) {
                return UploadFlowResult.failure("持久化失败: " + persistResult.getMessage());
            }

            log.info("确认后数据持久化成功: uploadId={}, savedRows={}",
                    persistResult.getUploadId(), persistResult.getSavedRows());

            // 2.1 自动学习：将用户手动确认的映射保存到字典数据库
            saveManualMappingsToDatabase(factoryId, confirmedMappings);

            // 3. 推荐图表
            String recommendedChartType = recommendChartType(parseResponse, dataType);
            List<SmartBiChartTemplate> recommendedTemplates = recommendTemplates(factoryId, parseResponse);

            // 4. 生成图表配置
            Map<String, Object> chartConfig = null;
            String aiAnalysis = null;

            if (!recommendedTemplates.isEmpty()) {
                SmartBiChartTemplate primaryTemplate = recommendedTemplates.get(0);
                Map<String, Object> chartData = buildChartData(
                        factoryId, persistResult.getUploadId(), detectedType);

                Map<String, Object> chartWithAnalysis = chartTemplateService.buildChartWithAnalysis(
                        primaryTemplate.getTemplateCode(), chartData, factoryId);

                chartConfig = chartWithAnalysis;
                aiAnalysis = (String) chartWithAnalysis.get("aiAnalysis");
            }

            return UploadFlowResult.builder()
                    .success(true)
                    .message(String.format("成功处理 %d 条%s数据",
                            persistResult.getSavedRows(), detectedType.getDisplayName()))
                    .parseResult(parseResponse)
                    .persistResult(persistResult)
                    .detectedDataType(dataType)
                    .recommendedChartType(recommendedChartType)
                    .recommendedTemplates(recommendedTemplates)
                    .chartConfig(chartConfig)
                    .aiAnalysis(aiAnalysis)
                    .requiresConfirmation(false)
                    .uploadId(persistResult.getUploadId())
                    .build();

        } catch (Exception e) {
            log.error("确认持久化失败: {}", e.getMessage(), e);
            return UploadFlowResult.failure("处理失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> generateChart(String factoryId, Long uploadId, String templateCode) {
        log.info("生成图表: factoryId={}, uploadId={}, templateCode={}",
                factoryId, uploadId, templateCode);

        if (uploadId == null) {
            return Map.of("error", "上传ID不能为空");
        }

        if (templateCode == null || templateCode.isEmpty()) {
            return Map.of("error", "模板代码不能为空");
        }

        try {
            // 1. 查询数据（先尝试销售数据，再尝试财务数据）
            List<SmartBiSalesData> salesData = salesDataRepository.findByUploadId(uploadId);
            DataType dataType;
            Map<String, Object> chartData;

            if (!salesData.isEmpty()) {
                dataType = DataType.SALES;
                chartData = aggregateSalesData(salesData);
            } else {
                List<SmartBiFinanceData> financeData = financeDataRepository.findByUploadId(uploadId);
                if (!financeData.isEmpty()) {
                    dataType = DataType.FINANCE;
                    chartData = aggregateFinanceData(financeData);
                } else {
                    return Map.of("error", "未找到上传ID对应的数据: " + uploadId);
                }
            }

            // 2. 使用模板生成图表配置
            return chartTemplateService.buildChartWithAnalysis(templateCode, chartData, factoryId);

        } catch (Exception e) {
            log.error("生成图表失败: {}", e.getMessage(), e);
            return Map.of("error", "生成图表失败: " + e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> recommendTemplates(String factoryId, ExcelParseResponse parseResponse) {
        if (parseResponse == null) {
            return Collections.emptyList();
        }

        // 1. 使用智能匹配获取最佳模板
        List<FieldMappingResult> fieldMappings = parseResponse.getFieldMappings();
        SmartBiChartTemplate bestTemplate = chartTemplateService.matchBestTemplate(
                fieldMappings, parseResponse, factoryId);

        // 2. 检测数据类型
        DataType dataType = persistenceService.detectDataType(parseResponse);
        String category = DATA_TYPE_TO_CATEGORY.getOrDefault(dataType.name(), SmartBiChartTemplate.CATEGORY_GENERAL);

        // 3. 获取该分类下的模板
        List<SmartBiChartTemplate> categoryTemplates = chartTemplateService.getTemplatesByCategory(category);

        if (categoryTemplates.isEmpty()) {
            // 回退到通用模板
            categoryTemplates = chartTemplateService.getTemplatesByCategory(SmartBiChartTemplate.CATEGORY_GENERAL);
        }

        // 4. 将最佳模板放在首位
        List<SmartBiChartTemplate> result = new ArrayList<>();
        if (bestTemplate != null) {
            result.add(bestTemplate);
            // 添加其他模板（排除已添加的最佳模板）
            for (SmartBiChartTemplate t : categoryTemplates) {
                if (!t.getTemplateCode().equals(bestTemplate.getTemplateCode())) {
                    result.add(t);
                }
            }
        } else {
            // 如果没有最佳匹配，使用原来的排序逻辑
            result = sortTemplatesByDataFeatures(categoryTemplates, parseResponse);
        }

        log.info("推荐模板: 最佳匹配={}, 总数={}",
                bestTemplate != null ? bestTemplate.getTemplateCode() : "无",
                result.size());

        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SmartBiChartTemplate> getDefaultTemplates(String dataType, String factoryId) {
        String category = DATA_TYPE_TO_CATEGORY.getOrDefault(dataType, SmartBiChartTemplate.CATEGORY_GENERAL);

        List<SmartBiChartTemplate> templates = chartTemplateService.getTemplatesByCategory(category);

        if (templates.isEmpty()) {
            templates = chartTemplateService.getTemplatesByCategory(SmartBiChartTemplate.CATEGORY_GENERAL);
        }

        // 限制返回数量
        return templates.stream().limit(5).collect(Collectors.toList());
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 使用 Python 服务解析 Excel，如果失败则降级到 Java 实现
     *
     * 优先使用 Python SmartBI 服务进行 Excel 解析，利用 Python 生态系统中
     * 更成熟的数据处理库（如 pandas, openpyxl）。如果 Python 服务不可用
     * 或处理失败，将自动降级到 Java 原生实现。
     *
     * @param file        Excel 文件
     * @param factoryId   工厂ID
     * @param dataType    数据类型提示
     * @param parseRequest 解析请求参数
     * @return Excel 解析结果
     * @throws IOException 如果 Java 解析也失败
     */
    private ExcelParseResponse parseExcelWithFallback(MultipartFile file, String factoryId,
                                                       String dataType, ExcelParseRequest parseRequest) throws IOException {
        // 检查 Python 服务是否启用
        if (!pythonConfig.isEnabled()) {
            log.debug("Python SmartBI 服务已禁用，使用 Java 解析器");
            return excelParserService.parseExcel(file.getInputStream(), parseRequest);
        }

        // 尝试使用 Python 服务
        try {
            if (pythonClient.isAvailable()) {
                log.info("使用 Python SmartBI 服务解析 Excel: fileName={}", file.getOriginalFilename());
                ExcelParseResponse pythonResult = pythonClient.parseExcel(file, factoryId, dataType);

                if (pythonResult != null && pythonResult.isSuccess()) {
                    log.info("Python SmartBI 解析成功: headers={}, rows={}",
                            pythonResult.getHeaders() != null ? pythonResult.getHeaders().size() : 0,
                            pythonResult.getRowCount());
                    return pythonResult;
                } else {
                    log.warn("Python SmartBI 解析返回失败结果，降级到 Java 解析器");
                }
            } else {
                log.debug("Python SmartBI 服务不可用，使用 Java 解析器");
            }
        } catch (Exception e) {
            log.warn("Python SmartBI 解析失败，降级到 Java 解析器: {}", e.getMessage());

            // 如果配置不允许降级，则抛出异常
            if (!pythonConfig.isFallbackOnError()) {
                throw new RuntimeException("Python SmartBI 服务不可用且不允许降级", e);
            }
        }

        // 降级到 Java 实现
        log.info("使用 Java 解析器处理 Excel: fileName={}", file.getOriginalFilename());
        return excelParserService.parseExcel(file.getInputStream(), parseRequest);
    }

    /**
     * 保存用户手动确认的字段映射到数据库（自动学习功能）
     *
     * 只有来源为 MANUAL 的映射才会被保存，用于下次 LLM 或字典直接匹配
     */
    private void saveManualMappingsToDatabase(String factoryId, List<FieldMappingResult> confirmedMappings) {
        if (confirmedMappings == null || confirmedMappings.isEmpty()) {
            return;
        }

        int savedCount = 0;
        for (FieldMappingResult mapping : confirmedMappings) {
            // 只保存用户手动确认的映射
            if (mapping.getMappingSource() == FieldMappingResult.MappingSource.MANUAL) {
                try {
                    llmFieldMappingService.saveUserMapping(
                            factoryId,
                            mapping.getStandardField(),
                            mapping.getOriginalColumn(),
                            "USER"
                    );
                    savedCount++;
                } catch (Exception e) {
                    log.warn("保存用户映射失败: {} -> {}, error={}",
                            mapping.getOriginalColumn(), mapping.getStandardField(), e.getMessage());
                }
            }
        }

        if (savedCount > 0) {
            log.info("自动学习完成: 已保存 {} 条用户手动确认的字段映射到字典 (factoryId={})",
                    savedCount, factoryId);
        }
    }

    /**
     * 检测数据类型
     */
    private DataType detectDataType(ExcelParseResponse parseResponse, String dataTypeHint) {
        // 如果有明确的类型提示
        if (dataTypeHint != null && !dataTypeHint.isEmpty()) {
            DataType hinted = parseDataType(dataTypeHint);
            if (hinted != DataType.UNKNOWN) {
                return hinted;
            }
        }

        // 使用持久化服务的自动检测
        return persistenceService.detectDataType(parseResponse);
    }

    /**
     * 解析数据类型字符串
     */
    private DataType parseDataType(String dataType) {
        if (dataType == null || dataType.isEmpty()) {
            return DataType.UNKNOWN;
        }

        try {
            return DataType.valueOf(dataType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return DataType.UNKNOWN;
        }
    }

    /**
     * 检查是否需要用户确认字段映射
     */
    private boolean checkNeedsConfirmation(ExcelParseResponse parseResponse) {
        if (parseResponse.getFieldMappings() == null) {
            return true;
        }

        // 检查是否有需要确认的字段
        for (FieldMappingResult mapping : parseResponse.getFieldMappings()) {
            if (Boolean.TRUE.equals(mapping.getRequiresConfirmation())) {
                return true;
            }
            // 置信度低于 70% 也需要确认
            if (mapping.getConfidence() != null && mapping.getConfidence() < 70.0) {
                return true;
            }
        }

        // 检查是否缺少必填字段
        if (parseResponse.getMissingRequiredFields() != null
                && !parseResponse.getMissingRequiredFields().isEmpty()) {
            return true;
        }

        return false;
    }

    /**
     * 推荐图表类型
     */
    private String recommendChartType(ExcelParseResponse parseResponse, String dataType) {
        // 分析数据特征
        boolean hasTimeDimension = hasTimeDimension(parseResponse);
        int dataPointCount = parseResponse.getRowCount() != null ? parseResponse.getRowCount() : 0;

        // 根据数据类型确定默认指标代码
        String metricCode;
        switch (dataType.toUpperCase()) {
            case "SALES":
                metricCode = "sales_amount";
                break;
            case "FINANCE":
                metricCode = "total_cost";
                break;
            default:
                metricCode = "general_metric";
        }

        return chartTemplateService.recommendChartType(metricCode, dataPointCount, hasTimeDimension);
    }

    /**
     * 检查数据是否有时间维度
     */
    private boolean hasTimeDimension(ExcelParseResponse parseResponse) {
        if (parseResponse.getDataFeatures() == null) {
            return false;
        }

        return parseResponse.getDataFeatures().stream()
                .anyMatch(f -> f != null && "DATE".equals(f.getDataType()));
    }

    /**
     * 根据数据特征对模板排序
     */
    private List<SmartBiChartTemplate> sortTemplatesByDataFeatures(
            List<SmartBiChartTemplate> templates, ExcelParseResponse parseResponse) {

        boolean hasTimeDimension = hasTimeDimension(parseResponse);
        int rowCount = parseResponse.getRowCount() != null ? parseResponse.getRowCount() : 0;

        return templates.stream()
                .sorted((a, b) -> {
                    int scoreA = calculateTemplateScore(a, hasTimeDimension, rowCount);
                    int scoreB = calculateTemplateScore(b, hasTimeDimension, rowCount);
                    return scoreB - scoreA; // 降序
                })
                .collect(Collectors.toList());
    }

    /**
     * 计算模板与数据特征的匹配分数
     */
    private int calculateTemplateScore(SmartBiChartTemplate template, boolean hasTimeDimension, int rowCount) {
        int score = 0;

        String chartType = template.getChartType();

        // 时间序列数据偏好折线图
        if (hasTimeDimension && "LINE".equals(chartType)) {
            score += 30;
        }

        // 小数据量偏好饼图/仪表盘
        if (rowCount <= 10) {
            if ("PIE".equals(chartType) || "GAUGE".equals(chartType)) {
                score += 20;
            }
        }

        // 大数据量偏好柱状图/折线图
        if (rowCount > 50) {
            if ("BAR".equals(chartType) || "LINE".equals(chartType)) {
                score += 15;
            }
        }

        // 考虑排序权重
        score += (100 - template.getSortOrder());

        return score;
    }

    /**
     * 构建图表数据
     */
    private Map<String, Object> buildChartData(String factoryId, Long uploadId, DataType dataType) {
        switch (dataType) {
            case SALES:
                List<SmartBiSalesData> salesData = salesDataRepository.findByUploadId(uploadId);
                return aggregateSalesData(salesData);
            case FINANCE:
                List<SmartBiFinanceData> financeData = financeDataRepository.findByUploadId(uploadId);
                return aggregateFinanceData(financeData);
            default:
                return Collections.emptyMap();
        }
    }

    /**
     * 使用 DynamicChartConfigBuilder 构建动态图表配置
     *
     * 根据字段的 chartAxis 角色自动聚合数据，而不是硬编码的 byDate/byCategory/byRegion
     *
     * @param factoryId        工厂ID
     * @param uploadId         上传ID
     * @param dataType         数据类型
     * @param fieldMappings    带图表角色的字段映射列表
     * @return 动态图表配置
     */
    public DynamicChartConfig buildDynamicChartConfig(String factoryId, Long uploadId,
                                                       DataType dataType,
                                                       List<FieldMappingWithChartRole> fieldMappings) {
        if (fieldMappings == null || fieldMappings.isEmpty()) {
            log.warn("字段映射为空，无法构建动态图表配置");
            return null;
        }

        // 1. 获取原始数据
        Map<String, Object> rawData = buildChartData(factoryId, uploadId, dataType);
        if (rawData.isEmpty()) {
            log.warn("原始数据为空，无法构建动态图表配置");
            return null;
        }

        // 2. 将原始数据转换为 DynamicChartConfigBuilder 可接受的格式
        Map<String, Object> aggregatedData = new LinkedHashMap<>();
        aggregatedData.put("data", convertToDataList(rawData, dataType));
        aggregatedData.put("totalRows", rawData.get("recordCount"));

        // 3. 使用 DynamicChartConfigBuilder 构建配置
        try {
            DynamicChartConfig config = dynamicChartConfigBuilder.buildConfig(fieldMappings, aggregatedData);
            log.info("成功构建动态图表配置: chartType={}, totalRows={}",
                    config.getChartType(), config.getTotalRows());
            return config;
        } catch (Exception e) {
            log.error("构建动态图表配置失败: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 使用指定的字段构建动态图表配置
     *
     * @param factoryId         工厂ID
     * @param uploadId          上传ID
     * @param dataType          数据类型
     * @param fieldMappings     字段映射列表
     * @param xAxisFieldName    指定的 X 轴字段名
     * @param seriesFieldName   指定的 Series 字段名（可为 null）
     * @param measureFieldNames 指定的度量字段名列表
     * @return 动态图表配置
     */
    public DynamicChartConfig buildDynamicChartConfigWithFields(String factoryId, Long uploadId,
                                                                  DataType dataType,
                                                                  List<FieldMappingWithChartRole> fieldMappings,
                                                                  String xAxisFieldName,
                                                                  String seriesFieldName,
                                                                  List<String> measureFieldNames) {
        if (fieldMappings == null || fieldMappings.isEmpty()) {
            log.warn("字段映射为空，无法构建动态图表配置");
            return null;
        }

        // 1. 获取原始数据
        Map<String, Object> rawData = buildChartData(factoryId, uploadId, dataType);
        if (rawData.isEmpty()) {
            log.warn("原始数据为空，无法构建动态图表配置");
            return null;
        }

        // 2. 转换数据格式
        Map<String, Object> aggregatedData = new LinkedHashMap<>();
        aggregatedData.put("data", convertToDataList(rawData, dataType));
        aggregatedData.put("totalRows", rawData.get("recordCount"));

        // 3. 使用指定字段构建配置
        try {
            DynamicChartConfig config = dynamicChartConfigBuilder.buildConfigWithFields(
                    fieldMappings, aggregatedData, xAxisFieldName, seriesFieldName, measureFieldNames);
            log.info("成功构建动态图表配置（指定字段）: chartType={}, xAxis={}, series={}",
                    config.getChartType(), xAxisFieldName, seriesFieldName);
            return config;
        } catch (Exception e) {
            log.error("构建动态图表配置失败: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 将聚合数据转换为数据列表格式
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> convertToDataList(Map<String, Object> rawData, DataType dataType) {
        List<Map<String, Object>> dataList = new ArrayList<>();

        // 根据数据类型选择适当的分组数据
        Map<String, BigDecimal> primaryGroup = null;
        String groupKey = null;
        String valueKey = null;

        switch (dataType) {
            case SALES:
                // 优先使用按日期分组，如果为空则尝试按分类
                primaryGroup = (Map<String, BigDecimal>) rawData.get("byDate");
                if (primaryGroup == null || primaryGroup.isEmpty()) {
                    primaryGroup = (Map<String, BigDecimal>) rawData.get("byCategory");
                    groupKey = "category";
                    valueKey = "amount";
                } else {
                    groupKey = "date";
                    valueKey = "amount";
                }
                break;
            case FINANCE:
                primaryGroup = (Map<String, BigDecimal>) rawData.get("byDate");
                if (primaryGroup == null || primaryGroup.isEmpty()) {
                    primaryGroup = (Map<String, BigDecimal>) rawData.get("byDepartment");
                    groupKey = "department";
                    valueKey = "cost";
                } else {
                    groupKey = "date";
                    valueKey = "cost";
                }
                break;
            default:
                return dataList;
        }

        if (primaryGroup != null && !primaryGroup.isEmpty()) {
            for (Map.Entry<String, BigDecimal> entry : primaryGroup.entrySet()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put(groupKey, entry.getKey());
                row.put(valueKey, entry.getValue());
                dataList.add(row);
            }
        }

        return dataList;
    }

    /**
     * 聚合销售数据
     */
    private Map<String, Object> aggregateSalesData(List<SmartBiSalesData> salesData) {
        Map<String, Object> result = new LinkedHashMap<>();

        if (salesData.isEmpty()) {
            return result;
        }

        // 总销售额
        BigDecimal totalAmount = salesData.stream()
                .map(SmartBiSalesData::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 总数量
        BigDecimal totalQuantity = salesData.stream()
                .map(SmartBiSalesData::getQuantity)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 按日期聚合
        Map<String, BigDecimal> byDate = salesData.stream()
                .filter(s -> s.getOrderDate() != null && s.getAmount() != null)
                .collect(Collectors.groupingBy(
                        s -> s.getOrderDate().toString(),
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        // 按产品分类聚合
        Map<String, BigDecimal> byCategory = salesData.stream()
                .filter(s -> s.getProductCategory() != null && s.getAmount() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getProductCategory,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        // 按区域聚合
        Map<String, BigDecimal> byRegion = salesData.stream()
                .filter(s -> s.getRegion() != null && s.getAmount() != null)
                .collect(Collectors.groupingBy(
                        SmartBiSalesData::getRegion,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiSalesData::getAmount, BigDecimal::add)
                ));

        result.put("totalAmount", totalAmount);
        result.put("totalQuantity", totalQuantity);
        result.put("recordCount", salesData.size());
        result.put("byDate", byDate);
        result.put("byCategory", byCategory);
        result.put("byRegion", byRegion);
        result.put("dataType", "SALES");

        return result;
    }

    /**
     * 聚合财务数据
     */
    private Map<String, Object> aggregateFinanceData(List<SmartBiFinanceData> financeData) {
        Map<String, Object> result = new LinkedHashMap<>();

        if (financeData.isEmpty()) {
            return result;
        }

        // 总成本
        BigDecimal totalCost = financeData.stream()
                .map(SmartBiFinanceData::getTotalCost)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 预算总额
        BigDecimal totalBudget = financeData.stream()
                .map(SmartBiFinanceData::getBudgetAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 实际总额
        BigDecimal totalActual = financeData.stream()
                .map(SmartBiFinanceData::getActualAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 按日期聚合
        Map<String, BigDecimal> byDate = financeData.stream()
                .filter(f -> f.getRecordDate() != null && f.getTotalCost() != null)
                .collect(Collectors.groupingBy(
                        f -> f.getRecordDate().toString(),
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiFinanceData::getTotalCost, BigDecimal::add)
                ));

        // 按部门聚合
        Map<String, BigDecimal> byDepartment = financeData.stream()
                .filter(f -> f.getDepartment() != null && f.getTotalCost() != null)
                .collect(Collectors.groupingBy(
                        SmartBiFinanceData::getDepartment,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiFinanceData::getTotalCost, BigDecimal::add)
                ));

        // 按类别聚合
        Map<String, BigDecimal> byCategory = financeData.stream()
                .filter(f -> f.getCategory() != null && f.getTotalCost() != null)
                .collect(Collectors.groupingBy(
                        SmartBiFinanceData::getCategory,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SmartBiFinanceData::getTotalCost, BigDecimal::add)
                ));

        result.put("totalCost", totalCost);
        result.put("totalBudget", totalBudget);
        result.put("totalActual", totalActual);
        result.put("recordCount", financeData.size());
        result.put("byDate", byDate);
        result.put("byDepartment", byDepartment);
        result.put("byCategory", byCategory);
        result.put("dataType", "FINANCE");

        // 计算预算差异
        if (totalBudget.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal variance = totalActual.subtract(totalBudget);
            BigDecimal varianceRate = variance.divide(totalBudget, 4, BigDecimal.ROUND_HALF_UP)
                    .multiply(BigDecimal.valueOf(100));
            result.put("budgetVariance", variance);
            result.put("budgetVarianceRate", varianceRate);
        }

        return result;
    }

    // ==================== 批量 Sheet 上传 ====================

    @Override
    public BatchUploadResult executeBatchUpload(String factoryId, InputStream inputStream,
                                                  String fileName, List<SheetConfig> sheetConfigs) {
        log.info("开始批量上传: factoryId={}, fileName={}, sheetCount={}",
                factoryId, fileName, sheetConfigs != null ? sheetConfigs.size() : 0);

        if (sheetConfigs == null || sheetConfigs.isEmpty()) {
            return BatchUploadResult.builder()
                    .totalSheets(0)
                    .message("没有指定要处理的 Sheet")
                    .results(Collections.emptyList())
                    .build();
        }

        // 将输入流读入内存，以便多次读取
        byte[] fileBytes;
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            fileBytes = baos.toByteArray();
            log.info("文件读入内存: {} bytes", fileBytes.length);
        } catch (IOException e) {
            log.error("读取文件失败: {}", e.getMessage(), e);
            return BatchUploadResult.builder()
                    .totalSheets(sheetConfigs.size())
                    .failedCount(sheetConfigs.size())
                    .message("读取文件失败: " + e.getMessage())
                    .results(Collections.emptyList())
                    .build();
        }

        // 获取 Sheet 信息列表
        List<SheetInfo> sheetInfoList;
        try {
            sheetInfoList = excelParserService.listSheets(new ByteArrayInputStream(fileBytes));
        } catch (Exception e) {
            log.error("获取 Sheet 列表失败: {}", e.getMessage(), e);
            return BatchUploadResult.builder()
                    .totalSheets(sheetConfigs.size())
                    .failedCount(sheetConfigs.size())
                    .message("获取 Sheet 列表失败: " + e.getMessage())
                    .results(Collections.emptyList())
                    .build();
        }

        // 并行处理每个 Sheet
        log.info("开始并行处理 {} 个 Sheet (线程池大小: 5)", sheetConfigs.size());
        long startTime = System.currentTimeMillis();

        // 创建并行任务
        List<CompletableFuture<SheetUploadResult>> futures = new ArrayList<>();
        final byte[] fileBytesRef = fileBytes;
        final List<SheetInfo> sheetInfoRef = sheetInfoList;

        for (SheetConfig config : sheetConfigs) {
            CompletableFuture<SheetUploadResult> future = CompletableFuture.supplyAsync(() ->
                processSingleSheet(factoryId, fileName, fileBytesRef, sheetInfoRef, config),
                SHEET_EXECUTOR
            ).orTimeout(SHEET_TIMEOUT_SECONDS, TimeUnit.SECONDS)
             .exceptionally(e -> {
                 int sheetIndex = config.getSheetIndex();
                 String sheetName = getSheetName(sheetInfoRef, sheetIndex);
                 String errorMsg = e instanceof TimeoutException
                     ? "处理超时 (>" + SHEET_TIMEOUT_SECONDS + "秒)"
                     : "处理异常: " + e.getMessage();
                 log.error("Sheet[{}] {} 失败: {}", sheetIndex, sheetName, errorMsg);
                 return SheetUploadResult.failed(sheetIndex, sheetName, errorMsg);
             });
            futures.add(future);
        }

        // 等待所有任务完成
        List<SheetUploadResult> results;
        try {
            CompletableFuture<Void> allFutures = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0])
            );
            allFutures.join();

            results = futures.stream()
                .map(CompletableFuture::join)
                .sorted(Comparator.comparingInt(SheetUploadResult::getSheetIndex))
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("并行处理异常: {}", e.getMessage(), e);
            results = Collections.emptyList();
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("并行处理完成: {} 个 Sheet, 耗时 {} 秒", results.size(), elapsed / 1000.0);

        BatchUploadResult batchResult = BatchUploadResult.fromResults(results);
        log.info("批量上传完成: {}", batchResult.getMessage());

        return batchResult;
    }

    @Override
    public BatchUploadResult executeBatchUploadWithProgress(String factoryId, InputStream inputStream,
                                                             String fileName, List<SheetConfig> sheetConfigs,
                                                             Consumer<UploadProgressEvent> progressCallback) {
        log.info("开始带进度的批量上传: factoryId={}, fileName={}, sheetCount={}",
                factoryId, fileName, sheetConfigs != null ? sheetConfigs.size() : 0);

        // 安全的进度回调
        Consumer<UploadProgressEvent> safeCallback = event -> {
            try {
                if (progressCallback != null) {
                    progressCallback.accept(event);
                }
            } catch (Exception e) {
                log.warn("进度回调失败: {}", e.getMessage());
            }
        };

        if (sheetConfigs == null || sheetConfigs.isEmpty()) {
            safeCallback.accept(UploadProgressEvent.error("没有指定要处理的 Sheet"));
            return BatchUploadResult.builder()
                    .totalSheets(0)
                    .message("没有指定要处理的 Sheet")
                    .results(Collections.emptyList())
                    .build();
        }

        int totalSheets = sheetConfigs.size();
        safeCallback.accept(UploadProgressEvent.start(totalSheets));

        // 将输入流读入内存
        byte[] fileBytes;
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            fileBytes = baos.toByteArray();
            log.info("文件读入内存: {} bytes", fileBytes.length);
        } catch (IOException e) {
            log.error("读取文件失败: {}", e.getMessage(), e);
            safeCallback.accept(UploadProgressEvent.error("读取文件失败: " + e.getMessage()));
            return BatchUploadResult.builder()
                    .totalSheets(totalSheets)
                    .failedCount(totalSheets)
                    .message("读取文件失败: " + e.getMessage())
                    .results(Collections.emptyList())
                    .build();
        }

        // 获取 Sheet 信息列表
        List<SheetInfo> sheetInfoList;
        try {
            sheetInfoList = excelParserService.listSheets(new ByteArrayInputStream(fileBytes));
        } catch (Exception e) {
            log.error("获取 Sheet 列表失败: {}", e.getMessage(), e);
            safeCallback.accept(UploadProgressEvent.error("获取 Sheet 列表失败: " + e.getMessage()));
            return BatchUploadResult.builder()
                    .totalSheets(totalSheets)
                    .failedCount(totalSheets)
                    .message("获取 Sheet 列表失败: " + e.getMessage())
                    .results(Collections.emptyList())
                    .build();
        }

        // 并行处理每个 Sheet（带进度回调）
        log.info("开始并行处理 {} 个 Sheet (线程池大小: 5)", sheetConfigs.size());
        long startTime = System.currentTimeMillis();

        AtomicInteger completedCount = new AtomicInteger(0);
        List<CompletableFuture<SheetUploadResult>> futures = new ArrayList<>();
        final byte[] fileBytesRef = fileBytes;
        final List<SheetInfo> sheetInfoRef = sheetInfoList;

        for (SheetConfig config : sheetConfigs) {
            CompletableFuture<SheetUploadResult> future = CompletableFuture.supplyAsync(() ->
                processSingleSheetWithProgress(factoryId, fileName, fileBytesRef, sheetInfoRef, config,
                        totalSheets, completedCount, safeCallback),
                SHEET_EXECUTOR
            ).orTimeout(SHEET_TIMEOUT_SECONDS, TimeUnit.SECONDS)
             .exceptionally(e -> {
                 int sheetIndex = config.getSheetIndex();
                 String sheetName = getSheetName(sheetInfoRef, sheetIndex);
                 String errorMsg = e instanceof TimeoutException
                     ? "处理超时 (>" + SHEET_TIMEOUT_SECONDS + "秒)"
                     : "处理异常: " + e.getMessage();
                 log.error("Sheet[{}] {} 失败: {}", sheetIndex, sheetName, errorMsg);

                 int completed = completedCount.incrementAndGet();
                 safeCallback.accept(UploadProgressEvent.sheetFailed(sheetIndex, sheetName, errorMsg, completed, totalSheets));

                 return SheetUploadResult.failed(sheetIndex, sheetName, errorMsg);
             });
            futures.add(future);
        }

        // 等待所有任务完成
        List<SheetUploadResult> results;
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            results = futures.stream()
                .map(CompletableFuture::join)
                .sorted(Comparator.comparingInt(SheetUploadResult::getSheetIndex))
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("并行处理异常: {}", e.getMessage(), e);
            results = Collections.emptyList();
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("并行处理完成: {} 个 Sheet, 耗时 {} 秒", results.size(), elapsed / 1000.0);

        BatchUploadResult batchResult = BatchUploadResult.fromResults(results);
        safeCallback.accept(UploadProgressEvent.complete(batchResult));
        log.info("批量上传完成: {}", batchResult.getMessage());

        return batchResult;
    }

    /**
     * 处理单个 Sheet（带进度回调）
     */
    private SheetUploadResult processSingleSheetWithProgress(String factoryId, String fileName,
                                                               byte[] fileBytes, List<SheetInfo> sheetInfoList,
                                                               SheetConfig config, int totalSheets,
                                                               AtomicInteger completedCount,
                                                               Consumer<UploadProgressEvent> progressCallback) {
        int sheetIndex = config.getSheetIndex();
        String sheetName = getSheetName(sheetInfoList, sheetIndex);

        log.info("[Thread-{}] 开始处理 Sheet[{}] {}", Thread.currentThread().getName(), sheetIndex, sheetName);

        // 发送 Sheet 开始事件
        progressCallback.accept(UploadProgressEvent.sheetStart(sheetIndex, sheetName, totalSheets));

        // 验证 Sheet 索引
        if (sheetIndex < 0 || sheetIndex >= sheetInfoList.size()) {
            int completed = completedCount.incrementAndGet();
            String error = "无效的 Sheet 索引: " + sheetIndex;
            progressCallback.accept(UploadProgressEvent.sheetFailed(sheetIndex, sheetName, error, completed, totalSheets));
            return SheetUploadResult.failed(sheetIndex, sheetName, error);
        }

        // 检查是否为空 Sheet
        SheetInfo sheetInfo = sheetInfoList.get(sheetIndex);
        if (Boolean.TRUE.equals(sheetInfo.getEmpty())) {
            int completed = completedCount.incrementAndGet();
            String error = "Sheet 为空";
            progressCallback.accept(UploadProgressEvent.sheetFailed(sheetIndex, sheetName, error, completed, totalSheets));
            return SheetUploadResult.failed(sheetIndex, sheetName, error);
        }

        try {
            // 发送解析中事件
            progressCallback.accept(UploadProgressEvent.parsing(sheetIndex, sheetName));

            // 解析 Excel
            ExcelParseRequest parseRequest = ExcelParseRequest.builder()
                    .factoryId(factoryId)
                    .fileName(fileName)
                    .sheetIndex(sheetIndex)
                    .headerRow(config.getHeaderRow() != null ? config.getHeaderRow() : 0)
                    .sampleSize(config.getSampleSize() != null ? config.getSampleSize() : 100)
                    .skipEmptyRows(config.getSkipEmptyRows() != null ? config.getSkipEmptyRows() : true)
                    .businessScene(config.getDataType())
                    .build();

            ExcelParseResponse parseResult = excelParserService.parseExcel(
                    new ByteArrayInputStream(fileBytes), parseRequest);

            if (!parseResult.isSuccess()) {
                int completed = completedCount.incrementAndGet();
                String error = "解析失败: " + parseResult.getErrorMessage();
                progressCallback.accept(UploadProgressEvent.sheetFailed(sheetIndex, sheetName, error, completed, totalSheets));
                return SheetUploadResult.failed(sheetIndex, sheetName, error);
            }

            // 发送字段映射事件
            int dictionaryHits = 0;
            int llmFields = 0;
            if (parseResult.getFieldMappings() != null) {
                for (FieldMappingResult mapping : parseResult.getFieldMappings()) {
                    FieldMappingResult.MappingSource source = mapping.getMappingSource();
                    // EXACT_MATCH 和 SYNONYM_MATCH 视为字典命中
                    if (source == FieldMappingResult.MappingSource.EXACT_MATCH
                            || source == FieldMappingResult.MappingSource.SYNONYM_MATCH) {
                        dictionaryHits++;
                    } else if (source == FieldMappingResult.MappingSource.AI_SEMANTIC) {
                        // AI_SEMANTIC 视为 LLM 分析
                        llmFields++;
                    }
                }
            }
            progressCallback.accept(UploadProgressEvent.fieldMapping(sheetIndex, sheetName, dictionaryHits, llmFields));

            // 检测数据类型
            DataType detectedType = detectDataType(parseResult, config.getDataType());
            String detectedTypeStr = detectedType.name();

            // 检查是否需要用户确认
            boolean autoConfirm = Boolean.TRUE.equals(config.getAutoConfirm());
            boolean needsConfirmation = !autoConfirm && checkNeedsConfirmation(parseResult);

            if (needsConfirmation) {
                int completed = completedCount.incrementAndGet();
                UploadFlowResult flowResult = UploadFlowResult.builder()
                        .success(true)
                        .message("字段映射需要用户确认")
                        .parseResult(parseResult)
                        .requiresConfirmation(true)
                        .detectedDataType(detectedTypeStr)
                        .build();
                progressCallback.accept(UploadProgressEvent.sheetComplete(sheetIndex, sheetName, completed, totalSheets, 0));
                return SheetUploadResult.success(sheetIndex, sheetName, flowResult);
            }

            // 发送持久化事件
            int rowCount = parseResult.getRowCount() != null ? parseResult.getRowCount() : 0;
            progressCallback.accept(UploadProgressEvent.persisting(sheetIndex, sheetName, rowCount));

            // 持久化数据
            PersistenceResult persistResult;
            synchronized (this) {
                persistResult = persistenceService.persistData(factoryId, parseResult, detectedType);
            }

            if (!persistResult.isSuccess()) {
                int completed = completedCount.incrementAndGet();
                String error = "持久化失败: " + persistResult.getMessage();
                progressCallback.accept(UploadProgressEvent.sheetFailed(sheetIndex, sheetName, error, completed, totalSheets));
                return SheetUploadResult.failed(sheetIndex, sheetName, error);
            }

            // 推荐图表模板
            String recommendedChartType = recommendChartType(parseResult, detectedTypeStr);
            List<SmartBiChartTemplate> recommendedTemplates = recommendTemplates(factoryId, parseResult);

            // 生成图表配置和 AI 分析
            Map<String, Object> chartConfig = null;
            String aiAnalysis = null;

            if (!recommendedTemplates.isEmpty()) {
                try {
                    progressCallback.accept(UploadProgressEvent.builder()
                            .type(UploadProgressEvent.EventType.CHART_GENERATING)
                            .sheetIndex(sheetIndex)
                            .sheetName(sheetName)
                            .stage("生成图表")
                            .message("正在生成图表配置和 AI 分析...")
                            .build());

                    SmartBiChartTemplate primaryTemplate = recommendedTemplates.get(0);
                    Map<String, Object> chartData = buildChartData(factoryId, persistResult.getUploadId(), detectedType);
                    Map<String, Object> chartWithAnalysis = chartTemplateService.buildChartWithAnalysis(
                            primaryTemplate.getTemplateCode(), chartData, factoryId);
                    chartConfig = chartWithAnalysis;
                    aiAnalysis = (String) chartWithAnalysis.get("aiAnalysis");
                    log.info("Sheet[{}] {} 图表生成成功", sheetIndex, sheetName);
                } catch (Exception e) {
                    log.warn("Sheet[{}] {} 图表生成失败: {}", sheetIndex, sheetName, e.getMessage());
                }
            }

            // 成功完成
            int completed = completedCount.incrementAndGet();
            UploadFlowResult flowResult = UploadFlowResult.builder()
                    .success(true)
                    .message(String.format("成功处理 %d 条%s数据", persistResult.getSavedRows(), detectedType.getDisplayName()))
                    .parseResult(parseResult)
                    .persistResult(persistResult)
                    .detectedDataType(detectedTypeStr)
                    .recommendedChartType(recommendedChartType)
                    .recommendedTemplates(recommendedTemplates)
                    .chartConfig(chartConfig)
                    .aiAnalysis(aiAnalysis)
                    .requiresConfirmation(false)
                    .uploadId(persistResult.getUploadId())
                    .build();

            progressCallback.accept(UploadProgressEvent.sheetComplete(sheetIndex, sheetName, completed, totalSheets, persistResult.getSavedRows()));
            log.info("Sheet[{}] {} 处理成功: savedRows={}", sheetIndex, sheetName, persistResult.getSavedRows());

            return SheetUploadResult.success(sheetIndex, sheetName, flowResult);

        } catch (Exception e) {
            log.error("处理 Sheet[{}] {} 失败: {}", sheetIndex, sheetName, e.getMessage(), e);
            int completed = completedCount.incrementAndGet();
            String error = "处理异常: " + e.getMessage();
            progressCallback.accept(UploadProgressEvent.sheetFailed(sheetIndex, sheetName, error, completed, totalSheets));
            return SheetUploadResult.failed(sheetIndex, sheetName, error);
        }
    }

    /**
     * 根据索引获取 Sheet 名称
     */
    private String getSheetName(List<SheetInfo> sheetInfoList, int sheetIndex) {
        if (sheetIndex >= 0 && sheetIndex < sheetInfoList.size()) {
            return sheetInfoList.get(sheetIndex).getName();
        }
        return "Sheet" + sheetIndex;
    }

    /**
     * 处理单个 Sheet（供并行调用）
     */
    private SheetUploadResult processSingleSheet(String factoryId, String fileName,
                                                  byte[] fileBytes, List<SheetInfo> sheetInfoList,
                                                  SheetConfig config) {
        int sheetIndex = config.getSheetIndex();
        String sheetName = getSheetName(sheetInfoList, sheetIndex);

        log.info("[Thread-{}] 开始处理 Sheet[{}] {}: headerRow={}, dataType={}",
                Thread.currentThread().getName(), sheetIndex, sheetName,
                config.getHeaderRow(), config.getDataType());

        // 验证 Sheet 索引
        if (sheetIndex < 0 || sheetIndex >= sheetInfoList.size()) {
            return SheetUploadResult.failed(sheetIndex, sheetName,
                    "无效的 Sheet 索引: " + sheetIndex);
        }

        // 检查是否为空 Sheet
        SheetInfo sheetInfo = sheetInfoList.get(sheetIndex);
        if (Boolean.TRUE.equals(sheetInfo.getEmpty())) {
            return SheetUploadResult.failed(sheetIndex, sheetName, "Sheet 为空");
        }

        try {
            // 解析 Excel
            ExcelParseRequest parseRequest = ExcelParseRequest.builder()
                    .factoryId(factoryId)
                    .fileName(fileName)
                    .sheetIndex(sheetIndex)
                    .headerRow(config.getHeaderRow() != null ? config.getHeaderRow() : 0)
                    .sampleSize(config.getSampleSize() != null ? config.getSampleSize() : 100)
                    .skipEmptyRows(config.getSkipEmptyRows() != null ? config.getSkipEmptyRows() : true)
                    .businessScene(config.getDataType())
                    .build();

            ExcelParseResponse parseResult = excelParserService.parseExcel(
                    new ByteArrayInputStream(fileBytes), parseRequest);

            if (!parseResult.isSuccess()) {
                return SheetUploadResult.failed(sheetIndex, sheetName,
                        "解析失败: " + parseResult.getErrorMessage());
            }

            // 检测数据类型
            DataType detectedType = detectDataType(parseResult, config.getDataType());
            String detectedTypeStr = detectedType.name();

            // 检查是否需要用户确认（如果 autoConfirm=true，则跳过确认）
            boolean autoConfirm = Boolean.TRUE.equals(config.getAutoConfirm());
            boolean needsConfirmation = !autoConfirm && checkNeedsConfirmation(parseResult);

            if (needsConfirmation) {
                UploadFlowResult flowResult = UploadFlowResult.builder()
                        .success(true)
                        .message("字段映射需要用户确认")
                        .parseResult(parseResult)
                        .requiresConfirmation(true)
                        .detectedDataType(detectedTypeStr)
                        .build();
                return SheetUploadResult.success(sheetIndex, sheetName, flowResult);
            }

            if (autoConfirm) {
                log.debug("Sheet[{}] {} autoConfirm=true，跳过用户确认", sheetIndex, sheetName);
            }

            // 持久化数据（同步执行，避免事务问题）
            PersistenceResult persistResult;
            synchronized (this) {
                persistResult = persistenceService.persistData(factoryId, parseResult, detectedType);
            }

            if (!persistResult.isSuccess()) {
                return SheetUploadResult.failed(sheetIndex, sheetName,
                        "持久化失败: " + persistResult.getMessage());
            }

            // 推荐图表模板
            String recommendedChartType = recommendChartType(parseResult, detectedTypeStr);
            List<SmartBiChartTemplate> recommendedTemplates = recommendTemplates(factoryId, parseResult);

            // 生成图表配置和 AI 分析
            Map<String, Object> chartConfig = null;
            String aiAnalysis = null;

            if (!recommendedTemplates.isEmpty()) {
                try {
                    SmartBiChartTemplate primaryTemplate = recommendedTemplates.get(0);
                    Map<String, Object> chartData = buildChartData(
                            factoryId, persistResult.getUploadId(), detectedType);

                    Map<String, Object> chartWithAnalysis = chartTemplateService.buildChartWithAnalysis(
                            primaryTemplate.getTemplateCode(), chartData, factoryId);

                    chartConfig = chartWithAnalysis;
                    aiAnalysis = (String) chartWithAnalysis.get("aiAnalysis");
                    log.info("Sheet[{}] {} 图表生成成功: template={}",
                            sheetIndex, sheetName, primaryTemplate.getTemplateCode());
                } catch (Exception e) {
                    log.warn("Sheet[{}] {} 图表生成失败: {}", sheetIndex, sheetName, e.getMessage());
                }
            }

            // 成功
            UploadFlowResult flowResult = UploadFlowResult.builder()
                    .success(true)
                    .message(String.format("成功处理 %d 条%s数据",
                            persistResult.getSavedRows(), detectedType.getDisplayName()))
                    .parseResult(parseResult)
                    .persistResult(persistResult)
                    .detectedDataType(detectedTypeStr)
                    .recommendedChartType(recommendedChartType)
                    .recommendedTemplates(recommendedTemplates)
                    .chartConfig(chartConfig)
                    .aiAnalysis(aiAnalysis)
                    .requiresConfirmation(false)
                    .uploadId(persistResult.getUploadId())
                    .build();

            log.info("[Thread-{}] Sheet[{}] {} 处理成功: savedRows={}, uploadId={}",
                    Thread.currentThread().getName(), sheetIndex, sheetName,
                    persistResult.getSavedRows(), persistResult.getUploadId());

            return SheetUploadResult.success(sheetIndex, sheetName, flowResult);

        } catch (Exception e) {
            log.error("处理 Sheet[{}] {} 失败: {}", sheetIndex, sheetName, e.getMessage(), e);
            return SheetUploadResult.failed(sheetIndex, sheetName, "处理异常: " + e.getMessage());
        }
    }
}
