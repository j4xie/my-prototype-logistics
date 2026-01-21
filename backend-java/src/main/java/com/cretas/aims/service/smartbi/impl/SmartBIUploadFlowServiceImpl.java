package com.cretas.aims.service.smartbi.impl;

import com.cretas.aims.dto.smartbi.ExcelParseRequest;
import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;
import com.cretas.aims.entity.smartbi.SmartBiFinanceData;
import com.cretas.aims.entity.smartbi.SmartBiSalesData;
import com.cretas.aims.repository.smartbi.SmartBiFinanceDataRepository;
import com.cretas.aims.repository.smartbi.SmartBiSalesDataRepository;
import com.cretas.aims.service.smartbi.ChartTemplateService;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService.DataType;
import com.cretas.aims.service.smartbi.ExcelDataPersistenceService.PersistenceResult;
import com.cretas.aims.service.smartbi.ExcelDynamicParserService;
import com.cretas.aims.service.smartbi.SmartBIUploadFlowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
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

    // 数据类型到模板分类的映射
    private static final Map<String, String> DATA_TYPE_TO_CATEGORY = Map.of(
            "SALES", SmartBiChartTemplate.CATEGORY_SALES,
            "FINANCE", SmartBiChartTemplate.CATEGORY_FINANCE,
            "DEPARTMENT", SmartBiChartTemplate.CATEGORY_HR
    );

    @Override
    @Transactional
    public UploadFlowResult executeUploadFlow(String factoryId, MultipartFile file, String dataType) {
        log.info("开始执行上传流程: factoryId={}, fileName={}, dataType={}",
                factoryId, file.getOriginalFilename(), dataType);

        // 1. 验证文件
        if (file == null || file.isEmpty()) {
            return UploadFlowResult.failure("文件不能为空");
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null || (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls"))) {
            return UploadFlowResult.failure("仅支持 .xlsx 或 .xls 格式的文件");
        }

        try {
            // 2. 解析 Excel 文件
            ExcelParseRequest parseRequest = ExcelParseRequest.builder()
                    .factoryId(factoryId)
                    .fileName(fileName)
                    .headerRow(0)
                    .sampleSize(100)
                    .skipEmptyRows(true)
                    .businessScene(dataType)
                    .build();

            ExcelParseResponse parseResult = excelParserService.parseExcel(
                    file.getInputStream(), parseRequest);

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

            // 4. 检查是否需要用户确认字段映射
            boolean needsConfirmation = checkNeedsConfirmation(parseResult);

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

        // 1. 检测数据类型
        DataType dataType = persistenceService.detectDataType(parseResponse);
        String category = DATA_TYPE_TO_CATEGORY.getOrDefault(dataType.name(), SmartBiChartTemplate.CATEGORY_GENERAL);

        // 2. 获取该分类下的模板
        List<SmartBiChartTemplate> categoryTemplates = chartTemplateService.getTemplatesByCategory(category);

        if (categoryTemplates.isEmpty()) {
            // 回退到通用模板
            categoryTemplates = chartTemplateService.getTemplatesByCategory(SmartBiChartTemplate.CATEGORY_GENERAL);
        }

        // 3. 根据数据特征排序
        return sortTemplatesByDataFeatures(categoryTemplates, parseResponse);
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
}
