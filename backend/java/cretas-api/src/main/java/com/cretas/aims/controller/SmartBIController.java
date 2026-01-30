package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.dto.smartbi.chart.AdaptiveChartRequest;
import com.cretas.aims.dto.smartbi.chart.AdaptiveChartResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.SmartBiFieldDefinition;
import com.cretas.aims.entity.smartbi.SmartBiSchemaHistory;
import com.cretas.aims.client.PythonSmartBIClient;
import com.cretas.aims.config.smartbi.PythonSmartBIConfig;
import com.cretas.aims.service.smartbi.*;
import com.cretas.aims.service.smartbi.chart.AdaptiveChartGenerator;
import com.cretas.aims.entity.smartbi.postgres.SmartBiDynamicData;
import com.cretas.aims.entity.smartbi.postgres.SmartBiPgExcelUpload;
import com.cretas.aims.repository.smartbi.postgres.SmartBiPgExcelUploadRepository;
import com.cretas.aims.util.DateRangeUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.validation.Valid;
import java.io.IOException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SmartBI 智能商业分析控制器
 *
 * 提供统一的 REST API 入口，整合以下功能：
 * - Excel 动态解析与数据上传
 * - 经营驾驶舱（Executive Dashboard）
 * - 销售分析、部门分析、区域分析、财务分析
 * - 自然语言问答（NL Query）
 * - 数据下钻（Drill-down）
 * - 预警与建议
 * - 激励方案生成
 *
 * Phase 4A 实现：统一控制器层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/smart-bi")
@Tag(name = "SmartBI 智能分析", description = "SmartBI 智能商业分析 API")
public class SmartBIController {

    private final SalesAnalysisService salesAnalysisService;
    private final DepartmentAnalysisService departmentAnalysisService;
    private final RegionAnalysisService regionAnalysisService;
    private final FinanceAnalysisService financeAnalysisService;
    private final SmartBIIntentService intentService;
    private final RecommendationService recommendationService;
    private final ExcelDynamicParserService excelParserService;
    private final SmartBiSchemaService schemaService;
    private final ProductionAnalysisService productionAnalysisService;
    private final QualityAnalysisService qualityAnalysisService;
    private final InventoryHealthAnalysisService inventoryHealthAnalysisService;
    private final ProcurementAnalysisService procurementAnalysisService;

    // Optional service - may not be available yet
    private final SmartBIUploadFlowService uploadFlowService;

    // SmartBI 门面服务（包含缓存、配额、使用记录）- 可选注入
    private final SmartBIService smartBIService;

    // Adaptive chart generation service
    private final AdaptiveChartGenerator adaptiveChartGenerator;

    // Python SmartBI client for direct Python service calls
    private final PythonSmartBIClient pythonClient;
    private final PythonSmartBIConfig pythonConfig;

    private final ObjectMapper objectMapper;

    // PostgreSQL-based services for dynamic data analysis (optional - requires smartbi.postgres.enabled=true)
    private final DynamicAnalysisService dynamicAnalysisService;
    private final SmartBiPgExcelUploadRepository pgUploadRepository;

    @Autowired
    public SmartBIController(
            SalesAnalysisService salesAnalysisService,
            DepartmentAnalysisService departmentAnalysisService,
            RegionAnalysisService regionAnalysisService,
            FinanceAnalysisService financeAnalysisService,
            SmartBIIntentService intentService,
            RecommendationService recommendationService,
            ExcelDynamicParserService excelParserService,
            SmartBiSchemaService schemaService,
            ProductionAnalysisService productionAnalysisService,
            QualityAnalysisService qualityAnalysisService,
            InventoryHealthAnalysisService inventoryHealthAnalysisService,
            ProcurementAnalysisService procurementAnalysisService,
            @Autowired(required = false) SmartBIUploadFlowService uploadFlowService,
            @Autowired(required = false) AdaptiveChartGenerator adaptiveChartGenerator,
            @Autowired(required = false) SmartBIService smartBIService,
            PythonSmartBIClient pythonClient,
            PythonSmartBIConfig pythonConfig,
            ObjectMapper objectMapper,
            @Autowired(required = false) DynamicAnalysisService dynamicAnalysisService,
            @Autowired(required = false) SmartBiPgExcelUploadRepository pgUploadRepository) {
        this.salesAnalysisService = salesAnalysisService;
        this.departmentAnalysisService = departmentAnalysisService;
        this.regionAnalysisService = regionAnalysisService;
        this.financeAnalysisService = financeAnalysisService;
        this.intentService = intentService;
        this.recommendationService = recommendationService;
        this.excelParserService = excelParserService;
        this.schemaService = schemaService;
        this.productionAnalysisService = productionAnalysisService;
        this.qualityAnalysisService = qualityAnalysisService;
        this.inventoryHealthAnalysisService = inventoryHealthAnalysisService;
        this.procurementAnalysisService = procurementAnalysisService;
        this.uploadFlowService = uploadFlowService;
        this.adaptiveChartGenerator = adaptiveChartGenerator;
        this.smartBIService = smartBIService;
        this.pythonClient = pythonClient;
        this.pythonConfig = pythonConfig;
        this.objectMapper = objectMapper;
        this.dynamicAnalysisService = dynamicAnalysisService;
        this.pgUploadRepository = pgUploadRepository;
    }

    // ==================== Excel 上传 ====================

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传 Excel 文件", description = "上传并解析 Excel 文件，返回解析结果和字段映射（使用 Python SmartBI 服务）")
    public ResponseEntity<ApiResponse<ExcelParseResponse>> uploadExcel(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "数据类型: sales/finance/inventory") @RequestParam(required = false) String dataType,
            @Parameter(description = "Sheet 索引，从 0 开始") @RequestParam(required = false, defaultValue = "0") Integer sheetIndex,
            @Parameter(description = "表头行号，从 0 开始") @RequestParam(required = false, defaultValue = "0") Integer headerRow,
            @Parameter(description = "是否转置数据（将列方向数据转为行方向，用于利润表等）") @RequestParam(required = false, defaultValue = "false") Boolean transpose,
            @Parameter(description = "转置时的行标签列索引（默认0）") @RequestParam(required = false, defaultValue = "0") Integer rowLabelColumn,
            @Parameter(description = "转置时的表头行数（默认1）") @RequestParam(required = false, defaultValue = "1") Integer headerRowCount) {

        log.info("上传 Excel 文件: factoryId={}, fileName={}, dataType={}, sheetIndex={}, headerRow={}, transpose={}",
                factoryId, file.getOriginalFilename(), dataType, sheetIndex, headerRow, transpose);

        // 检查 Python SmartBI 服务是否可用
        if (!pythonConfig.isEnabled()) {
            return ResponseEntity.ok(ApiResponse.error("Python SmartBI 服务未启用"));
        }
        if (!pythonClient.isAvailable()) {
            return ResponseEntity.ok(ApiResponse.error("Python SmartBI 服务不可用，请检查服务是否在 " + pythonConfig.getUrl() + " 运行"));
        }

        try {
            // 使用 Python SmartBI 服务解析 Excel
            int headerRows = headerRow != null ? headerRow + 1 : 1;
            ExcelParseResponse response = pythonClient.parseExcel(file, factoryId, dataType, sheetIndex, headerRows);

            if (response == null || !response.isSuccess()) {
                String errorMsg = response != null ? response.getErrorMessage() : "Python 服务返回空结果";
                return ResponseEntity.ok(ApiResponse.error("Excel 解析失败: " + errorMsg));
            }

            return ResponseEntity.ok(ApiResponse.success("Excel 解析成功", response));
        } catch (IOException e) {
            log.error("Excel 文件读取失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("文件读取失败: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Excel 解析异常: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("解析失败: " + e.getMessage()));
        }
    }

    /**
     * 上传并分析 - 完整流程
     * 上传 Excel 文件，自动解析、保存数据并生成图表分析
     */
    @PostMapping(value = "/upload-and-analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传并分析", description = "上传 Excel 文件，自动解析、保存数据并生成图表分析")
    public ResponseEntity<ApiResponse<?>> uploadAndAnalyze(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "数据类型: sales/finance/inventory/production/quality/procurement")
            @RequestParam(required = false) String dataType,
            @Parameter(description = "Sheet 索引，从 0 开始") @RequestParam(required = false, defaultValue = "0") Integer sheetIndex,
            @Parameter(description = "表头行号，从 0 开始") @RequestParam(required = false, defaultValue = "0") Integer headerRow,
            @Parameter(description = "是否自动确认字段映射（跳过用户确认步骤）") @RequestParam(name = "auto_confirm", required = false, defaultValue = "false") Boolean autoConfirm,
            @Parameter(description = "是否转置数据（将列方向数据转为行方向，用于利润表等）") @RequestParam(required = false, defaultValue = "false") Boolean transpose,
            @Parameter(description = "转置时的行标签列索引（默认0）") @RequestParam(required = false, defaultValue = "0") Integer rowLabelColumn,
            @Parameter(description = "转置时的表头行数（默认1）") @RequestParam(required = false, defaultValue = "1") Integer headerRowCount) {

        log.info("上传并分析: factoryId={}, fileName={}, dataType={}, sheetIndex={}, headerRow={}, autoConfirm={}, transpose={}",
                factoryId, file.getOriginalFilename(), dataType, sheetIndex, headerRow, autoConfirm, transpose);

        // Check if uploadFlowService is available (required for full flow)
        if (uploadFlowService == null) {
            log.error("SmartBIUploadFlowService 未注入，无法执行完整流程");
            return ResponseEntity.ok(ApiResponse.error("SmartBI 上传流程服务未配置，请联系管理员"));
        }

        // Check Python SmartBI service availability
        if (!pythonConfig.isEnabled() || !pythonClient.isAvailable()) {
            log.error("Python SmartBI 服务不可用");
            return ResponseEntity.ok(ApiResponse.error("Python SmartBI 服务不可用，请检查服务是否在 " + pythonConfig.getUrl() + " 运行"));
        }

        try {
            // Call the full upload flow service with all parameters
            SmartBIUploadFlowService.UploadFlowResult result = uploadFlowService.executeUploadFlow(
                    factoryId, file, dataType, sheetIndex, headerRow, Boolean.TRUE.equals(autoConfirm));
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("上传并分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("上传并分析失败: " + e.getMessage()));
        }
    }

    /**
     * 确认字段映射并保存
     * 用户确认字段映射后保存数据并生成图表
     */
    @PostMapping("/upload/confirm")
    @Operation(summary = "确认字段映射并保存", description = "确认字段映射后保存数据并生成图表")
    public ResponseEntity<ApiResponse<?>> confirmMappingsAndSave(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody @Valid ConfirmMappingRequest request) {

        log.info("确认字段映射: factoryId={}, dataType={}, mappings={}",
                factoryId, request.getDataType(),
                request.getConfirmedMappings() != null ? request.getConfirmedMappings().size() : 0);

        // Check if uploadFlowService is available
        if (uploadFlowService == null) {
            log.warn("SmartBIUploadFlowService 尚未实现");
            return ResponseEntity.ok(ApiResponse.error("完整分析流程服务尚未实现，请稍后再试"));
        }

        try {
            // Convert Map to List<FieldMappingResult>
            List<FieldMappingResult> mappings = new java.util.ArrayList<>();
            if (request.getConfirmedMappings() != null) {
                request.getConfirmedMappings().forEach((original, standard) -> {
                    FieldMappingResult mapping = new FieldMappingResult();
                    mapping.setOriginalColumn(original);
                    mapping.setStandardField(standard);
                    mapping.setConfidence(100.0); // User confirmed
                    mappings.add(mapping);
                });
            }

            // Call the upload flow service to confirm and save
            SmartBIUploadFlowService.UploadFlowResult result = uploadFlowService.confirmAndPersist(
                    factoryId,
                    request.getParseResponse(),
                    mappings,
                    request.getDataType()
            );
            if (result.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.success(result.getMessage(), result));
            } else {
                return ResponseEntity.ok(ApiResponse.error(result.getMessage()));
            }
        } catch (Exception e) {
            log.error("确认映射并保存失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("保存失败: " + e.getMessage()));
        }
    }

    // ==================== 批量 Sheet 处理 ====================

    /**
     * 获取 Excel 文件中所有 Sheet 的信息
     * 用于批量处理前的预览，让用户选择需要处理的 Sheet
     */
    @PostMapping(value = "/sheets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "获取 Sheet 列表", description = "预览 Excel 文件中所有 Sheet 的基本信息")
    public ResponseEntity<ApiResponse<List<SheetInfo>>> listSheets(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file) {

        log.info("获取 Sheet 列表: factoryId={}, fileName={}", factoryId, file.getOriginalFilename());

        try {
            List<SheetInfo> sheets = excelParserService.listSheets(file.getInputStream());
            log.info("成功获取 {} 个 Sheet 的信息", sheets.size());
            return ResponseEntity.ok(ApiResponse.success("获取成功", sheets));
        } catch (IOException e) {
            log.error("读取文件失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("读取文件失败: " + e.getMessage()));
        } catch (Exception e) {
            log.error("获取 Sheet 列表失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    /**
     * 批量上传多个 Sheet
     * 根据配置处理多个 Sheet，每个 Sheet 独立解析和持久化
     */
    @PostMapping(value = "/upload-batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "批量上传 Sheet", description = "一次上传并处理 Excel 文件中的多个 Sheet")
    public ResponseEntity<ApiResponse<BatchUploadResult>> uploadBatch(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Sheet 配置 JSON 数组") @RequestParam("sheetConfigs") String sheetConfigsJson) {

        log.info("批量上传: factoryId={}, fileName={}, sheetConfigs={}",
                factoryId, file.getOriginalFilename(),
                sheetConfigsJson.length() > 100 ? sheetConfigsJson.substring(0, 100) + "..." : sheetConfigsJson);

        // 检查 uploadFlowService 是否可用
        if (uploadFlowService == null) {
            log.warn("SmartBIUploadFlowService 尚未实现");
            return ResponseEntity.ok(ApiResponse.error("批量上传服务尚未实现"));
        }

        try {
            // 解析 Sheet 配置
            List<SheetConfig> configs = objectMapper.readValue(sheetConfigsJson,
                    new TypeReference<List<SheetConfig>>() {});

            if (configs == null || configs.isEmpty()) {
                return ResponseEntity.ok(ApiResponse.error("sheetConfigs 不能为空"));
            }

            log.info("解析到 {} 个 Sheet 配置", configs.size());

            // 执行批量上传
            BatchUploadResult result = uploadFlowService.executeBatchUpload(
                    factoryId,
                    file.getInputStream(),
                    file.getOriginalFilename(),
                    configs);

            // 始终返回完整结果，通过 message 区分状态
            String statusPrefix;
            if (result.isAllSuccess()) {
                statusPrefix = "";
            } else if (result.getRequiresConfirmationCount() > 0) {
                statusPrefix = "待确认: ";
            } else if (result.isPartialSuccess()) {
                statusPrefix = "部分成功: ";
            } else {
                statusPrefix = "失败: ";
            }
            return ResponseEntity.ok(ApiResponse.success(statusPrefix + result.getMessage(), result));

        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.error("解析 sheetConfigs 失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("sheetConfigs 格式错误: " + e.getMessage()));
        } catch (IOException e) {
            log.error("读取文件失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("读取文件失败: " + e.getMessage()));
        } catch (Exception e) {
            log.error("批量上传失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("批量上传失败: " + e.getMessage()));
        }
    }

    /**
     * 批量上传多个 Sheet (流式进度)
     * 使用 SSE 实时推送处理进度
     */
    @PostMapping(value = "/upload-batch-stream", consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
                 produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "批量上传 Sheet (流式)", description = "使用 SSE 实时推送处理进度")
    public SseEmitter uploadBatchStream(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Sheet 配置 JSON 数组") @RequestParam("sheetConfigs") String sheetConfigsJson) {

        log.info("批量上传(流式): factoryId={}, fileName={}", factoryId, file.getOriginalFilename());

        // 创建 SSE 发射器，超时 10 分钟
        SseEmitter emitter = new SseEmitter(600000L);

        // 异步处理
        new Thread(() -> {
            try {
                // 检查服务
                if (uploadFlowService == null) {
                    sendEvent(emitter, UploadProgressEvent.error("批量上传服务尚未实现"));
                    emitter.complete();
                    return;
                }

                // 解析配置
                List<SheetConfig> configs = objectMapper.readValue(sheetConfigsJson,
                        new TypeReference<List<SheetConfig>>() {});

                if (configs == null || configs.isEmpty()) {
                    sendEvent(emitter, UploadProgressEvent.error("sheetConfigs 不能为空"));
                    emitter.complete();
                    return;
                }

                // 执行带进度回调的批量上传
                BatchUploadResult result = uploadFlowService.executeBatchUploadWithProgress(
                        factoryId,
                        file.getInputStream(),
                        file.getOriginalFilename(),
                        configs,
                        event -> sendEvent(emitter, event)
                );

                // 发送完成事件
                sendEvent(emitter, UploadProgressEvent.complete(result));
                emitter.complete();

            } catch (Exception e) {
                log.error("批量上传(流式)失败: {}", e.getMessage(), e);
                try {
                    sendEvent(emitter, UploadProgressEvent.error(e.getMessage()));
                    emitter.complete();
                } catch (Exception ex) {
                    emitter.completeWithError(ex);
                }
            }
        }, "upload-stream-" + System.currentTimeMillis()).start();

        // 错误处理
        emitter.onCompletion(() -> log.debug("SSE 连接完成"));
        emitter.onTimeout(() -> log.warn("SSE 连接超时"));
        emitter.onError(e -> log.error("SSE 连接错误: {}", e.getMessage()));

        return emitter;
    }

    /**
     * 发送 SSE 事件
     */
    private void sendEvent(SseEmitter emitter, UploadProgressEvent event) {
        try {
            emitter.send(SseEmitter.event()
                    .name(event.getType().name().toLowerCase())
                    .data(event, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            log.warn("发送 SSE 事件失败: {}", e.getMessage());
        }
    }

    // ==================== 自适应图表生成 ====================

    /**
     * 生成自适应图表
     * 根据上传的数据特征，使用 LLM 评估并生成最优图表配置
     */
    @PostMapping("/generate-adaptive-charts")
    @Operation(summary = "生成自适应图表", description = "根据数据特征自动评估并生成最优图表配置")
    public ResponseEntity<ApiResponse<AdaptiveChartResponse>> generateAdaptiveCharts(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody @Valid AdaptiveChartRequest request) {

        log.info("生成自适应图表: factoryId={}, uploadId={}, evaluateFirst={}, maxCharts={}, fusionEnabled={}",
                factoryId, request.getUploadId(), request.isEvaluateFirst(),
                request.getMaxCharts(), request.isFusionEnabled());

        // 检查服务是否可用
        if (adaptiveChartGenerator == null) {
            log.warn("AdaptiveChartGenerator 服务未配置");
            return ResponseEntity.ok(ApiResponse.error("自适应图表服务未配置"));
        }

        try {
            AdaptiveChartResponse response = adaptiveChartGenerator.generateAdaptive(
                    request.getUploadId(), request);

            String message = response.getCharts() != null && !response.getCharts().isEmpty()
                    ? String.format("成功生成 %d 个图表", response.getCharts().size())
                    : "图表生成完成";

            return ResponseEntity.ok(ApiResponse.success(message, response));
        } catch (Exception e) {
            log.error("生成自适应图表失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("生成图表失败: " + e.getMessage()));
        }
    }

    /**
     * 快速生成单个图表
     * 根据指定的图表类型和数据生成 ECharts 配置
     */
    @PostMapping("/generate-chart")
    @Operation(summary = "快速生成单个图表", description = "根据指定类型生成单个图表配置")
    public ResponseEntity<ApiResponse<AdaptiveChartResponse.GeneratedChart>> generateSingleChart(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "上传记录ID") @RequestParam Long uploadId,
            @Parameter(description = "图表类型: bar/line/pie/radar/treemap/waterfall/combo")
            @RequestParam String chartType,
            @Parameter(description = "图表用途描述") @RequestParam(required = false) String purpose) {

        log.info("快速生成图表: factoryId={}, uploadId={}, chartType={}, purpose={}",
                factoryId, uploadId, chartType, purpose);

        if (adaptiveChartGenerator == null) {
            return ResponseEntity.ok(ApiResponse.error("自适应图表服务未配置"));
        }

        try {
            // 构建简单请求
            AdaptiveChartRequest request = AdaptiveChartRequest.builder()
                    .uploadId(uploadId)
                    .evaluateFirst(false)
                    .maxCharts(1)
                    .fusionEnabled(false)
                    .preferredChartType(chartType)
                    .build();

            AdaptiveChartResponse response = adaptiveChartGenerator.generateAdaptive(uploadId, request);

            if (response.getCharts() != null && !response.getCharts().isEmpty()) {
                return ResponseEntity.ok(ApiResponse.success("图表生成成功", response.getCharts().get(0)));
            } else {
                return ResponseEntity.ok(ApiResponse.error("未能生成图表"));
            }
        } catch (Exception e) {
            log.error("快速生成图表失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("生成图表失败: " + e.getMessage()));
        }
    }

    // ==================== 经营驾驶舱 ====================

    @GetMapping("/dashboard/executive")
    @Operation(summary = "获取经营驾驶舱", description = "获取综合经营分析仪表盘数据")
    public ResponseEntity<ApiResponse<DashboardResponse>> getExecutiveDashboard(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时间周期: today/week/month/quarter/year")
            @RequestParam(defaultValue = "month") String period) {

        log.info("获取经营驾驶舱: factoryId={}, period={}", factoryId, period);

        try {
            // 优先使用 SmartBIService（包含缓存、配额、使用记录）
            if (smartBIService != null) {
                DashboardResponse dashboard = smartBIService.getExecutiveDashboard(factoryId, period);
                return ResponseEntity.ok(ApiResponse.success(dashboard));
            }

            // 降级到原有逻辑
            LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
            LocalDate startDate = dateRange[0];
            LocalDate endDate = dateRange[1];

            // 使用销售分析服务获取概览数据
            DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
            return ResponseEntity.ok(ApiResponse.success(dashboard));
        } catch (Exception e) {
            log.error("获取经营驾驶舱失败: {}", e.getMessage(), e);
            // 返回空 Dashboard 而不是错误，让前端可以正常显示
            DashboardResponse emptyDashboard = DashboardResponse.builder()
                    .kpiCards(java.util.Collections.emptyList())
                    .charts(java.util.Collections.emptyMap())
                    .rankings(java.util.Collections.emptyMap())
                    .aiInsights(java.util.Collections.emptyList())
                    .suggestions(java.util.Collections.emptyList())
                    .lastUpdated(java.time.LocalDateTime.now())
                    .build();
            return ResponseEntity.ok(ApiResponse.success(emptyDashboard));
        }
    }

    @GetMapping("/dashboard/executive/custom")
    @Operation(summary = "获取自定义日期范围的经营驾驶舱", description = "支持指定开始和结束日期，用于查询历史数据")
    public ResponseEntity<ApiResponse<DashboardResponse>> getExecutiveDashboardCustomRange(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期 (yyyy-MM-dd)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期 (yyyy-MM-dd)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("获取自定义日期范围驾驶舱: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        try {
            // 直接使用销售分析服务获取指定日期范围的数据
            DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
            return ResponseEntity.ok(ApiResponse.success(dashboard));
        } catch (Exception e) {
            log.error("获取自定义日期范围驾驶舱失败: {}", e.getMessage(), e);
            DashboardResponse emptyDashboard = DashboardResponse.builder()
                    .kpiCards(java.util.Collections.emptyList())
                    .charts(java.util.Collections.emptyMap())
                    .rankings(java.util.Collections.emptyMap())
                    .aiInsights(java.util.Collections.emptyList())
                    .suggestions(java.util.Collections.emptyList())
                    .lastUpdated(java.time.LocalDateTime.now())
                    .build();
            return ResponseEntity.ok(ApiResponse.success(emptyDashboard));
        }
    }

    @GetMapping("/data-date-range")
    @Operation(summary = "获取数据日期范围", description = "自动检测数据库中销售数据的时间跨度，用于前端显示可用数据范围")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDataDateRange(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取数据日期范围: factoryId={}", factoryId);

        try {
            Map<String, Object> result = new HashMap<>();

            if (smartBIService != null) {
                DateRange dataRange = smartBIService.getDataDateRange(factoryId);
                if (dataRange != null && dataRange.isValid()) {
                    result.put("hasData", true);
                    result.put("startDate", dataRange.getStartDate().toString());
                    result.put("endDate", dataRange.getEndDate().toString());
                    result.put("granularity", dataRange.getGranularity());
                    result.put("description", dataRange.getOriginalExpression());
                    return ResponseEntity.ok(ApiResponse.success("检测到数据日期范围", result));
                }
            }

            result.put("hasData", false);
            result.put("message", "未检测到销售数据");
            return ResponseEntity.ok(ApiResponse.success("未检测到销售数据", result));
        } catch (Exception e) {
            log.error("获取数据日期范围失败: {}", e.getMessage(), e);
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("hasData", false);
            errorResult.put("error", e.getMessage());
            return ResponseEntity.ok(ApiResponse.error("获取数据日期范围失败: " + e.getMessage()));
        }
    }

    @GetMapping("/dashboard")
    @Operation(summary = "获取统一仪表盘", description = "聚合所有分析维度的数据，提供一站式经营数据概览")
    public ResponseEntity<ApiResponse<UnifiedDashboardResponse>> getUnifiedDashboard(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时间周期: today/week/month/quarter/year")
            @RequestParam(defaultValue = "month") String period) {

        log.info("获取统一仪表盘: factoryId={}, period={}", factoryId, period);
        long startTime = System.currentTimeMillis();

        try {
            // 优先使用门面服务（包含缓存、配额、使用记录）
            if (smartBIService != null) {
                DashboardResponse dashboard = smartBIService.getExecutiveDashboard(factoryId, period);

                LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
                LocalDate startDate = dateRange[0];
                LocalDate endDate = dateRange[1];

                // 转换为 UnifiedDashboardResponse
                UnifiedDashboardResponse response = UnifiedDashboardResponse.builder()
                        .period(period)
                        .startDate(startDate)
                        .endDate(endDate)
                        .sales(dashboard)
                        .generatedAt(java.time.LocalDateTime.now())
                        .dataVersion(String.valueOf(System.currentTimeMillis()))
                        .build();

                // 补充其他维度数据（如果门面服务未包含）
                try {
                    response.setFinance(financeAnalysisService.getFinanceOverview(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取财务数据失败: {}", e.getMessage());
                }

                try {
                    response.setInventory(inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取库存数据失败: {}", e.getMessage());
                }

                try {
                    response.setProduction(productionAnalysisService.getOEEOverview(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取生产数据失败: {}", e.getMessage());
                }

                try {
                    response.setQuality(qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取质量数据失败: {}", e.getMessage());
                }

                try {
                    response.setProcurement(procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取采购数据失败: {}", e.getMessage());
                }

                // 聚合部门和区域排名
                try {
                    response.setDepartmentRanking(departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取部门排名失败: {}", e.getMessage());
                }

                try {
                    response.setRegionRanking(regionAnalysisService.getRegionRanking(factoryId, startDate, endDate));
                } catch (Exception e) {
                    log.warn("获取区域排名失败: {}", e.getMessage());
                }

                // 聚合预警和建议
                try {
                    DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod(period);
                    response.setAlerts(recommendationService.generateAllAlerts(factoryId, range));
                } catch (Exception e) {
                    log.warn("获取预警失败: {}", e.getMessage());
                }

                try {
                    response.setRecommendations(recommendationService.generateRecommendations(factoryId, "all"));
                } catch (Exception e) {
                    log.warn("获取建议失败: {}", e.getMessage());
                }

                long elapsed = System.currentTimeMillis() - startTime;
                log.info("统一仪表盘生成完成(via SmartBIService): factoryId={}, period={}, elapsed={}ms", factoryId, period, elapsed);

                return ResponseEntity.ok(ApiResponse.success(response));
            }

            // 降级到原有逻辑（SmartBIService 不可用时）
            log.info("SmartBIService 不可用，降级到原有聚合逻辑");

            LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
            LocalDate startDate = dateRange[0];
            LocalDate endDate = dateRange[1];

            // 构建统一仪表盘响应
            UnifiedDashboardResponse response = UnifiedDashboardResponse.builder()
                    .period(period)
                    .startDate(startDate)
                    .endDate(endDate)
                    .build();

            // 聚合各维度数据（并行调用可优化性能）
            try {
                response.setSales(salesAnalysisService.getSalesOverview(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取销售数据失败: {}", e.getMessage());
            }

            try {
                response.setFinance(financeAnalysisService.getFinanceOverview(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取财务数据失败: {}", e.getMessage());
            }

            try {
                response.setInventory(inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取库存数据失败: {}", e.getMessage());
            }

            try {
                response.setProduction(productionAnalysisService.getOEEOverview(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取生产数据失败: {}", e.getMessage());
            }

            try {
                response.setQuality(qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取质量数据失败: {}", e.getMessage());
            }

            try {
                response.setProcurement(procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取采购数据失败: {}", e.getMessage());
            }

            // 聚合部门和区域排名
            try {
                response.setDepartmentRanking(departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取部门排名失败: {}", e.getMessage());
            }

            try {
                response.setRegionRanking(regionAnalysisService.getRegionRanking(factoryId, startDate, endDate));
            } catch (Exception e) {
                log.warn("获取区域排名失败: {}", e.getMessage());
            }

            // 聚合预警和建议
            try {
                DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod(period);
                response.setAlerts(recommendationService.generateAllAlerts(factoryId, range));
            } catch (Exception e) {
                log.warn("获取预警失败: {}", e.getMessage());
            }

            try {
                response.setRecommendations(recommendationService.generateRecommendations(factoryId, "all"));
            } catch (Exception e) {
                log.warn("获取建议失败: {}", e.getMessage());
            }

            // 设置元数据
            response.setGeneratedAt(java.time.LocalDateTime.now());
            response.setDataVersion(String.valueOf(System.currentTimeMillis()));

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("统一仪表盘生成完成(fallback): factoryId={}, period={}, elapsed={}ms", factoryId, period, elapsed);

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("获取统一仪表盘失败: {}", e.getMessage(), e);
            // 返回空的 UnifiedDashboardResponse 而不是错误
            LocalDate[] fallbackRange = DateRangeUtils.getDateRangeByPeriod(period);
            UnifiedDashboardResponse emptyResponse = UnifiedDashboardResponse.builder()
                    .period(period)
                    .startDate(fallbackRange[0])
                    .endDate(fallbackRange[1])
                    .sales(DashboardResponse.builder()
                            .kpiCards(java.util.Collections.emptyList())
                            .charts(java.util.Collections.emptyMap())
                            .rankings(java.util.Collections.emptyMap())
                            .aiInsights(java.util.Collections.emptyList())
                            .suggestions(java.util.Collections.emptyList())
                            .lastUpdated(java.time.LocalDateTime.now())
                            .build())
                    .generatedAt(java.time.LocalDateTime.now())
                    .dataVersion(String.valueOf(System.currentTimeMillis()))
                    .build();
            return ResponseEntity.ok(ApiResponse.success(emptyResponse));
        }
    }

    // ==================== 销售分析 ====================

    @GetMapping("/analysis/sales")
    @Operation(summary = "获取销售分析", description = "获取销售分析数据，支持多维度分析")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSalesAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "部门筛选") @RequestParam(required = false) String department,
            @Parameter(description = "分析维度: salesperson/product/customer/trend")
            @RequestParam(required = false) String dimension) {

        log.info("获取销售分析: factoryId={}, startDate={}, endDate={}, department={}, dimension={}",
                factoryId, startDate, endDate, department, dimension);

        try {
            // 优先使用门面服务
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(
                        factoryId, startDate, endDate, "sales");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            // 降级到原有逻辑
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            // 根据维度返回不同的分析数据
            if ("salesperson".equals(dimension)) {
                result.put("ranking", salesAnalysisService.getSalespersonRanking(factoryId, startDate, endDate));
            } else if ("product".equals(dimension)) {
                result.put("ranking", salesAnalysisService.getProductRanking(factoryId, startDate, endDate));
                result.put("chart", salesAnalysisService.getProductDistributionChart(factoryId, startDate, endDate));
            } else if ("customer".equals(dimension)) {
                result.put("ranking", salesAnalysisService.getCustomerRanking(factoryId, startDate, endDate));
            } else if ("trend".equals(dimension)) {
                result.put("chart", salesAnalysisService.getSalesTrendChart(factoryId, startDate, endDate, "DAY"));
            } else {
                // 默认返回概览
                DashboardResponse overview = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取销售分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取销售分析失败: " + e.getMessage()));
        }
    }

    // ==================== 部门分析 ====================

    @GetMapping("/analysis/department")
    @Operation(summary = "获取部门分析", description = "获取部门业绩分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDepartmentAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "部门名称") @RequestParam(required = false) String department) {

        log.info("获取部门分析: factoryId={}, startDate={}, endDate={}, department={}",
                factoryId, startDate, endDate, department);

        try {
            // 优先使用门面服务
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(
                        factoryId, startDate, endDate, "department");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            // 降级到原有逻辑
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if (department != null && !department.isEmpty()) {
                // 返回指定部门详情
                DashboardResponse detail = departmentAnalysisService.getDepartmentDetail(
                        factoryId, department, startDate, endDate);
                result.put("detail", detail);
            } else {
                // 返回所有部门排名和效率矩阵
                result.put("ranking", departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate));
                result.put("completionRates", departmentAnalysisService.getDepartmentCompletionRates(factoryId, startDate, endDate));
                result.put("efficiencyMatrix", departmentAnalysisService.getDepartmentEfficiencyMatrix(factoryId, startDate, endDate));
                result.put("trendComparison", departmentAnalysisService.getDepartmentTrendComparison(factoryId, startDate, endDate, "MONTH"));
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取部门分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取部门分析失败: " + e.getMessage()));
        }
    }

    // ==================== 区域分析 ====================

    @GetMapping("/analysis/region")
    @Operation(summary = "获取区域分析", description = "获取区域销售分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRegionAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "区域名称") @RequestParam(required = false) String region) {

        log.info("获取区域分析: factoryId={}, startDate={}, endDate={}, region={}",
                factoryId, startDate, endDate, region);

        try {
            // 优先使用门面服务
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(
                        factoryId, startDate, endDate, "region");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            // 降级到原有逻辑
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if (region != null && !region.isEmpty()) {
                // 返回指定区域详情
                DashboardResponse detail = regionAnalysisService.getRegionDetail(
                        factoryId, region, startDate, endDate);
                result.put("detail", detail);
                // 包含该区域下的省份排名
                result.put("provinceRanking", regionAnalysisService.getProvinceRanking(
                        factoryId, region, startDate, endDate));
            } else {
                // 返回所有区域排名和热力图
                result.put("ranking", regionAnalysisService.getRegionRanking(factoryId, startDate, endDate));
                result.put("opportunityScores", regionAnalysisService.getRegionOpportunityScores(factoryId, startDate, endDate));
                result.put("heatmap", regionAnalysisService.getGeographicHeatmapData(factoryId, startDate, endDate));
                result.put("treemap", regionAnalysisService.getRegionProvinceTreemap(factoryId, startDate, endDate));
                result.put("allRegions", regionAnalysisService.getAllRegions(factoryId));
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取区域分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取区域分析失败: " + e.getMessage()));
        }
    }

    // ==================== 财务分析 ====================

    @GetMapping("/analysis/finance")
    @Operation(summary = "获取财务分析", description = "获取财务分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFinanceAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "分析类型: profit/cost/receivable/payable/budget")
            @RequestParam(required = false) String analysisType) {

        log.info("获取财务分析: factoryId={}, startDate={}, endDate={}, analysisType={}",
                factoryId, startDate, endDate, analysisType);

        try {
            // 优先使用门面服务
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(
                        factoryId, startDate, endDate, "finance");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            // 降级到原有逻辑
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if ("profit".equals(analysisType)) {
                result.put("metrics", financeAnalysisService.getProfitMetrics(factoryId, startDate, endDate));
                result.put("trendChart", financeAnalysisService.getProfitTrendChart(factoryId, startDate, endDate, "MONTH"));
            } else if ("cost".equals(analysisType)) {
                result.put("structureChart", financeAnalysisService.getCostStructureChart(factoryId, startDate, endDate));
                result.put("trendChart", financeAnalysisService.getCostTrendChart(factoryId, startDate, endDate, "MONTH"));
            } else if ("receivable".equals(analysisType)) {
                result.put("metrics", financeAnalysisService.getReceivableMetrics(factoryId, endDate));
                result.put("agingChart", financeAnalysisService.getReceivableAgingChart(factoryId, endDate));
                result.put("overdueRanking", financeAnalysisService.getOverdueCustomerRanking(factoryId, endDate));
                result.put("trendChart", financeAnalysisService.getReceivableTrendChart(factoryId, startDate, endDate));
            } else if ("payable".equals(analysisType)) {
                result.put("metrics", financeAnalysisService.getPayableMetrics(factoryId, endDate));
                result.put("agingChart", financeAnalysisService.getPayableAgingChart(factoryId, endDate));
            } else if ("budget".equals(analysisType)) {
                int year = endDate.getYear();
                int month = endDate.getMonthValue();
                result.put("metrics", financeAnalysisService.getBudgetMetrics(factoryId, year, month));
                result.put("waterfall", financeAnalysisService.getBudgetExecutionWaterfall(factoryId, year));
                result.put("comparison", financeAnalysisService.getBudgetVsActualChart(factoryId, startDate, endDate));
            } else {
                // 默认返回财务概览
                DashboardResponse overview = financeAnalysisService.getFinanceOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取财务分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取财务分析失败: " + e.getMessage()));
        }
    }

    // ==================== 预算达成分析 ====================

    @GetMapping("/analysis/finance/budget-achievement")
    @Operation(summary = "预算达成分析", description = "获取预算达成分析图表，展示各月预算金额、实际金额、达成率")
    public ResponseEntity<ApiResponse<ChartConfig>> getBudgetAchievementChart(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "年份") @RequestParam int year,
            @Parameter(description = "指标类型: revenue/cost/profit/expense")
            @RequestParam(defaultValue = "revenue") String metric) {

        log.info("获取预算达成分析: factoryId={}, year={}, metric={}", factoryId, year, metric);

        try {
            ChartConfig result = financeAnalysisService.getBudgetAchievementChart(factoryId, year, metric);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取预算达成分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取预算达成分析失败: " + e.getMessage()));
        }
    }

    // ==================== 同比环比分析 ====================

    @GetMapping("/analysis/finance/yoy-mom")
    @Operation(summary = "同比环比分析", description = "获取同比环比分析图表，展示指标的同比/环比变化")
    public ResponseEntity<ApiResponse<ChartConfig>> getYoYMoMComparisonChart(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "期间类型: MONTH/QUARTER/MONTH_RANGE/QUARTER_RANGE")
            @RequestParam String periodType,
            @Parameter(description = "开始期间（MONTH格式：2026-01，QUARTER格式：2026-Q1）")
            @RequestParam String startPeriod,
            @Parameter(description = "结束期间（范围类型必填）")
            @RequestParam(required = false) String endPeriod,
            @Parameter(description = "指标类型: revenue/cost/profit/gross_margin")
            @RequestParam(defaultValue = "revenue") String metric) {

        log.info("获取同比环比分析: factoryId={}, periodType={}, startPeriod={}, endPeriod={}, metric={}",
                factoryId, periodType, startPeriod, endPeriod, metric);

        try {
            ChartConfig result = financeAnalysisService.getYoYMoMComparisonChart(
                    factoryId, periodType, startPeriod, endPeriod, metric);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取同比环比分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取同比环比分析失败: " + e.getMessage()));
        }
    }

    // ==================== 品类结构对比 ====================

    @GetMapping("/analysis/finance/category-comparison")
    @Operation(summary = "品类结构对比", description = "获取两个年份的品类销售结构对比图表")
    public ResponseEntity<ApiResponse<ChartConfig>> getCategoryStructureComparisonChart(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "当前年份") @RequestParam int year,
            @Parameter(description = "对比年份") @RequestParam int compareYear) {

        log.info("获取品类结构对比: factoryId={}, year={}, compareYear={}", factoryId, year, compareYear);

        try {
            ChartConfig result = financeAnalysisService.getCategoryStructureComparisonChart(
                    factoryId, year, compareYear);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取品类结构对比失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取品类结构对比失败: " + e.getMessage()));
        }
    }

    // ==================== 生产分析 ====================

    @GetMapping("/analysis/production")
    @Operation(summary = "获取生产分析", description = "获取生产OEE分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProductionAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "分析类型: oee/efficiency/equipment")
            @RequestParam(required = false) String analysisType) {

        log.info("获取生产分析: factoryId={}, startDate={}, endDate={}, analysisType={}",
                factoryId, startDate, endDate, analysisType);

        try {
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if ("oee".equals(analysisType)) {
                result.put("metrics", productionAnalysisService.getOEEMetrics(factoryId, startDate, endDate));
                result.put("trendChart", productionAnalysisService.getOEETrendChart(factoryId, startDate, endDate, "DAY"));
            } else if ("efficiency".equals(analysisType)) {
                result.put("metrics", productionAnalysisService.getProductionEfficiency(factoryId, startDate, endDate));
                result.put("ranking", productionAnalysisService.getProductionLineRanking(factoryId, startDate, endDate));
            } else if ("equipment".equals(analysisType)) {
                result.put("metrics", productionAnalysisService.getEquipmentUtilization(factoryId, startDate, endDate));
                result.put("ranking", productionAnalysisService.getEquipmentRanking(factoryId, startDate, endDate));
                result.put("downtimeChart", productionAnalysisService.getDowntimeDistributionChart(factoryId, startDate, endDate));
            } else {
                // 默认返回 OEE 概览
                DashboardResponse overview = productionAnalysisService.getOEEOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取生产分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取生产分析失败: " + e.getMessage()));
        }
    }

    // ==================== 质量分析 ====================

    @GetMapping("/analysis/quality")
    @Operation(summary = "获取质量分析", description = "获取质量管理分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getQualityAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "分析类型: fpy/defect/rework")
            @RequestParam(required = false) String analysisType) {

        log.info("获取质量分析: factoryId={}, startDate={}, endDate={}, analysisType={}",
                factoryId, startDate, endDate, analysisType);

        try {
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if ("fpy".equals(analysisType)) {
                result.put("metrics", qualityAnalysisService.getDefectAnalysis(factoryId, startDate, endDate));
                result.put("trendChart", qualityAnalysisService.getQualityTrendChart(factoryId, startDate, endDate, "DAY"));
            } else if ("defect".equals(analysisType)) {
                result.put("ranking", qualityAnalysisService.getDefectTypeRanking(factoryId, startDate, endDate));
                result.put("paretoChart", qualityAnalysisService.getDefectParetoChart(factoryId, startDate, endDate));
            } else if ("rework".equals(analysisType)) {
                result.put("metrics", qualityAnalysisService.getReworkCost(factoryId, startDate, endDate));
                result.put("costChart", qualityAnalysisService.getQualityCostDistributionChart(factoryId, startDate, endDate));
            } else {
                // 默认返回质量概览
                DashboardResponse overview = qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取质量分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取质量分析失败: " + e.getMessage()));
        }
    }

    // ==================== 库存健康分析 ====================

    @GetMapping("/analysis/inventory")
    @Operation(summary = "获取库存健康分析", description = "获取库存健康指标分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getInventoryAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "分析类型: turnover/expiry/aging")
            @RequestParam(required = false) String analysisType) {

        log.info("获取库存健康分析: factoryId={}, startDate={}, endDate={}, analysisType={}",
                factoryId, startDate, endDate, analysisType);

        try {
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if ("turnover".equals(analysisType)) {
                result.put("metrics", inventoryHealthAnalysisService.getTurnoverAnalysis(factoryId, startDate, endDate));
                result.put("ranking", inventoryHealthAnalysisService.getTurnoverByCategory(factoryId, startDate, endDate));
                result.put("trendChart", inventoryHealthAnalysisService.getTurnoverTrendChart(factoryId, startDate, endDate, "MONTH"));
            } else if ("expiry".equals(analysisType)) {
                result.put("riskAnalysis", inventoryHealthAnalysisService.getExpiryRiskAnalysis(factoryId));
                result.put("expiringBatches", inventoryHealthAnalysisService.getExpiringBatchesRanking(factoryId, 30));
                result.put("riskChart", inventoryHealthAnalysisService.getExpiryRiskChart(factoryId));
            } else if ("aging".equals(analysisType)) {
                result.put("agingMetrics", inventoryHealthAnalysisService.getAgingMetrics(factoryId));
                result.put("agingChart", inventoryHealthAnalysisService.getInventoryAgingChart(factoryId));
                result.put("longAgingBatches", inventoryHealthAnalysisService.getLongAgingBatchesRanking(factoryId, 60));
            } else {
                // 默认返回库存健康概览
                DashboardResponse overview = inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取库存健康分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取库存健康分析失败: " + e.getMessage()));
        }
    }

    // ==================== 采购分析 ====================

    @GetMapping("/analysis/procurement")
    @Operation(summary = "获取采购分析", description = "获取采购分析数据")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProcurementAnalysis(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "开始日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "分析类型: supplier/cost/trend")
            @RequestParam(required = false) String analysisType) {

        log.info("获取采购分析: factoryId={}, startDate={}, endDate={}, analysisType={}",
                factoryId, startDate, endDate, analysisType);

        try {
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if ("supplier".equals(analysisType)) {
                result.put("ranking", procurementAnalysisService.getSupplierRanking(factoryId, startDate, endDate));
                result.put("evaluation", procurementAnalysisService.getSupplierEvaluation(factoryId, startDate, endDate));
            } else if ("cost".equals(analysisType)) {
                result.put("metrics", procurementAnalysisService.getCostMetrics(factoryId, startDate, endDate));
                result.put("costAnalysis", procurementAnalysisService.getPurchaseCostAnalysis(factoryId, startDate, endDate));
                result.put("categoryRanking", procurementAnalysisService.getMaterialCategoryRanking(factoryId, startDate, endDate));
            } else if ("trend".equals(analysisType)) {
                result.put("trendChart", procurementAnalysisService.getProcurementTrendChart(factoryId, startDate, endDate, "MONTH"));
            } else {
                // 默认返回采购概览
                DashboardResponse overview = procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("获取采购分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取采购分析失败: " + e.getMessage()));
        }
    }

    // ==================== 自然语言问答 ====================

    @PostMapping("/query")
    @Operation(summary = "自然语言查询", description = "通过自然语言进行数据查询和分析")
    public ResponseEntity<ApiResponse<NLQueryResponse>> query(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody NLQueryRequest request) {

        log.info("自然语言查询: factoryId={}, query={}", factoryId,
                request.getEffectiveQuery() != null && request.getEffectiveQuery().length() > 50
                        ? request.getEffectiveQuery().substring(0, 50) + "..."
                        : request.getEffectiveQuery());

        try {
            // 设置工厂ID
            request.setFactoryId(factoryId);

            // 优先使用 SmartBIService（包含缓存、配额、使用记录）
            if (smartBIService != null) {
                NLQueryResponse response = smartBIService.processQuery(factoryId, null, request);
                return ResponseEntity.ok(ApiResponse.success(response));
            }

            // 降级到原有逻辑
            // 识别意图
            IntentResult intentResult = intentService.recognizeIntent(
                    request.getEffectiveQuery(), request.getContext());

            // 构建响应
            NLQueryResponse response = NLQueryResponse.builder()
                    .intent(intentResult.getIntent() != null ? intentResult.getIntent().name() : "UNKNOWN")
                    .parameters(intentResult.getParameters())
                    .build();

            // 根据意图执行查询并生成响应文本
            String responseText = executeQueryByIntent(factoryId, intentResult, request);
            response.setResponseText(responseText);

            // 生成后续问题建议
            response.setFollowUpQuestions(generateFollowUpQuestions(intentResult));

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("自然语言查询失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("查询失败: " + e.getMessage()));
        }
    }

    // ==================== 数据下钻 ====================

    @PostMapping("/drill-down")
    @Operation(summary = "数据下钻", description = "支持多维度数据下钻分析")
    public ResponseEntity<ApiResponse<Map<String, Object>>> drillDown(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody DrillDownRequest request) {

        log.info("数据下钻: factoryId={}, dimension={}, value={}",
                factoryId, request.getDimension(), request.getValue());

        try {
            // 优先使用门面服务（包含使用记录）
            if (smartBIService != null) {
                // 转换为 DTO 类型
                com.cretas.aims.dto.smartbi.DrillDownRequest dtoRequest =
                        com.cretas.aims.dto.smartbi.DrillDownRequest.builder()
                                .dimension(request.getDimension())
                                .filterValue(request.getValue())
                                .parentDimension(request.getParentDimension())
                                .parentValue(request.getParentValue())
                                .startDate(request.getStartDate())
                                .endDate(request.getEndDate())
                                .additionalFilters(request.getFilters() != null ? request.getFilters() : new HashMap<>())
                                .build();

                Map<String, Object> result = smartBIService.processDrillDown(factoryId, dtoRequest);
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            // 降级到原有逻辑
            Map<String, Object> result = new HashMap<>();
            result.put("dimension", request.getDimension());
            result.put("value", request.getValue());
            result.put("parentDimension", request.getParentDimension());

            LocalDate startDate = request.getStartDate() != null
                    ? request.getStartDate()
                    : DateRangeUtils.getStartDateOrDefault(null);
            LocalDate endDate = request.getEndDate() != null
                    ? request.getEndDate()
                    : DateRangeUtils.getEndDateOrDefault(null);

            switch (request.getDimension()) {
                case "region":
                    // 下钻到省份
                    result.put("data", regionAnalysisService.getProvinceRanking(
                            factoryId, request.getValue(), startDate, endDate));
                    result.put("nextDimension", "province");
                    break;
                case "province":
                    // 下钻到城市
                    result.put("data", regionAnalysisService.getCityRanking(
                            factoryId, request.getValue(), startDate, endDate));
                    result.put("nextDimension", "city");
                    break;
                case "department":
                    // 下钻到部门详情
                    result.put("data", departmentAnalysisService.getDepartmentDetail(
                            factoryId, request.getValue(), startDate, endDate));
                    result.put("nextDimension", "salesperson");
                    break;
                default:
                    result.put("message", "不支持的下钻维度: " + request.getDimension());
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("数据下钻失败", e);
            return ResponseEntity.ok(ApiResponse.error("下钻查询失败: " + e.getMessage()));
        }
    }

    // ==================== 预警列表 ====================

    @GetMapping("/alerts")
    @Operation(summary = "获取预警列表", description = "获取当前预警信息列表")
    public ResponseEntity<ApiResponse<List<Alert>>> getAlerts(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "预警类别: sales/finance/department")
            @RequestParam(required = false) String category) {

        log.info("获取预警列表: factoryId={}, category={}", factoryId, category);

        try {
            DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod("month");
            List<Alert> alerts;

            if ("sales".equals(category)) {
                alerts = recommendationService.generateSalesAlerts(factoryId, range);
            } else if ("finance".equals(category)) {
                alerts = recommendationService.generateFinanceAlerts(factoryId, range);
            } else if ("department".equals(category)) {
                alerts = recommendationService.generateDepartmentAlerts(factoryId, range);
            } else {
                alerts = recommendationService.generateAllAlerts(factoryId, range);
            }

            return ResponseEntity.ok(ApiResponse.success(alerts));
        } catch (Exception e) {
            log.error("获取预警列表失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取预警失败: " + e.getMessage()));
        }
    }

    // ==================== 建议列表 ====================

    @GetMapping("/recommendations")
    @Operation(summary = "获取建议列表", description = "获取智能建议列表")
    public ResponseEntity<ApiResponse<List<Recommendation>>> getRecommendations(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "分析类型: sales/finance/department/all")
            @RequestParam(required = false) String analysisType) {

        log.info("获取建议列表: factoryId={}, analysisType={}", factoryId, analysisType);

        try {
            String type = analysisType != null ? analysisType : "all";
            List<Recommendation> recommendations = recommendationService.generateRecommendations(factoryId, type);
            return ResponseEntity.ok(ApiResponse.success(recommendations));
        } catch (Exception e) {
            log.error("获取建议列表失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取建议失败: " + e.getMessage()));
        }
    }

    // ==================== 激励方案 ====================

    @GetMapping("/incentive-plan/{targetType}/{targetId}")
    @Operation(summary = "获取激励方案", description = "获取指定目标的激励方案")
    public ResponseEntity<ApiResponse<IncentivePlan>> getIncentivePlan(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "目标类型: salesperson/department/region") @PathVariable String targetType,
            @Parameter(description = "目标ID") @PathVariable String targetId) {

        log.info("获取激励方案: factoryId={}, targetType={}, targetId={}", factoryId, targetType, targetId);

        try {
            DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod("month");
            IncentivePlan plan;

            switch (targetType) {
                case "salesperson":
                    plan = recommendationService.generateSalespersonIncentivePlan(factoryId, targetId, range);
                    break;
                case "department":
                    plan = recommendationService.generateDepartmentIncentivePlan(factoryId, targetId, range);
                    break;
                case "region":
                    plan = recommendationService.generateIncentivePlan(factoryId, targetType);
                    break;
                default:
                    return ResponseEntity.ok(ApiResponse.error("不支持的目标类型: " + targetType));
            }

            return ResponseEntity.ok(ApiResponse.success(plan));
        } catch (Exception e) {
            log.error("获取激励方案失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取激励方案失败: " + e.getMessage()));
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 根据意图执行查询并生成响应文本
     */
    private String executeQueryByIntent(String factoryId, IntentResult intentResult, NLQueryRequest request) {
        if (intentResult.getIntent() == null) {
            return "抱歉，我无法理解您的问题。请尝试换一种方式描述。";
        }

        try {
            com.cretas.aims.dto.smartbi.DateRange dateRange = intentService.parseTimeRange(request.getEffectiveQuery());
            LocalDate startDate = dateRange != null ? dateRange.getStartDate() : DateRangeUtils.getStartDateOrDefault(null);
            LocalDate endDate = dateRange != null ? dateRange.getEndDate() : DateRangeUtils.getEndDateOrDefault(null);

            switch (intentResult.getIntent()) {
                case QUERY_SALES_OVERVIEW:
                case QUERY_SALES_RANKING:
                case QUERY_SALES_TREND:
                    return generateSalesQueryResponse(factoryId, startDate, endDate);
                case QUERY_DEPARTMENT_PERFORMANCE:
                case COMPARE_DEPARTMENT:
                    return generateDepartmentQueryResponse(factoryId, startDate, endDate);
                case QUERY_REGION_ANALYSIS:
                case COMPARE_REGION:
                    return generateRegionQueryResponse(factoryId, startDate, endDate);
                case QUERY_FINANCE_OVERVIEW:
                case QUERY_PROFIT_ANALYSIS:
                case QUERY_COST_ANALYSIS:
                case QUERY_RECEIVABLE:
                    return generateFinanceQueryResponse(factoryId, startDate, endDate);
                case QUERY_OEE_OVERVIEW:
                case QUERY_PRODUCTION_EFFICIENCY:
                case QUERY_EQUIPMENT_UTILIZATION:
                    return generateProductionQueryResponse(factoryId, startDate, endDate);
                case QUERY_QUALITY_SUMMARY:
                case QUERY_DEFECT_ANALYSIS:
                case QUERY_REWORK_COST:
                    return generateQualityQueryResponse(factoryId, startDate, endDate);
                case QUERY_INVENTORY_HEALTH:
                case QUERY_EXPIRY_RISK:
                case QUERY_LOSS_ANALYSIS:
                    return generateInventoryQueryResponse(factoryId, startDate, endDate);
                case QUERY_PROCUREMENT_OVERVIEW:
                case QUERY_SUPPLIER_EVALUATION:
                case QUERY_PURCHASE_COST:
                    return generateProcurementQueryResponse(factoryId, startDate, endDate);
                default:
                    return "查询完成，请查看返回的数据。";
            }
        } catch (Exception e) {
            log.warn("生成响应文本失败: {}", e.getMessage());
            return "查询完成，数据已返回。";
        }
    }

    private String generateSalesQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard salesKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "TOTAL_SALES".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            if (salesKpi != null && salesKpi.getRawValue() != null) {
                return String.format("在 %s 至 %s 期间，总销售额为 %s 元。",
                        startDate, endDate, salesKpi.getRawValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
            }
        }
        return "已获取销售数据，请查看详细信息。";
    }

    private String generateDepartmentQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<RankingItem> ranking = departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate);
        if (ranking != null && !ranking.isEmpty()) {
            RankingItem top = ranking.get(0);
            String valueStr = top.getValue() != null
                    ? top.getValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString()
                    : "0.00";
            return String.format("在 %s 至 %s 期间，%s 排名第一，销售额 %s 元。",
                    startDate, endDate, top.getName(), valueStr);
        }
        return "已获取部门数据，请查看详细信息。";
    }

    private String generateRegionQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<RankingItem> ranking = regionAnalysisService.getRegionRanking(factoryId, startDate, endDate);
        if (ranking != null && !ranking.isEmpty()) {
            RankingItem top = ranking.get(0);
            String valueStr = top.getValue() != null
                    ? top.getValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString()
                    : "0.00";
            return String.format("在 %s 至 %s 期间，%s 区域排名第一，销售额 %s 元。",
                    startDate, endDate, top.getName(), valueStr);
        }
        return "已获取区域数据，请查看详细信息。";
    }

    private String generateFinanceQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<MetricResult> metrics = financeAnalysisService.getProfitMetrics(factoryId, startDate, endDate);
        if (metrics != null && !metrics.isEmpty()) {
            MetricResult grossProfit = metrics.stream()
                    .filter(m -> "GROSS_PROFIT".equals(m.getMetricCode()))
                    .findFirst()
                    .orElse(null);
            if (grossProfit != null && grossProfit.getValue() != null) {
                return String.format("在 %s 至 %s 期间，毛利额为 %s 元。",
                        startDate, endDate, grossProfit.getValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
            }
        }
        return "已获取财务数据，请查看详细信息。";
    }

    private String generateProductionQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = productionAnalysisService.getOEEOverview(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard oeeKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "OEE".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            if (oeeKpi != null && oeeKpi.getRawValue() != null) {
                KPICard availKpi = dashboard.getKpiCards().stream().filter(k -> "AVAILABILITY".equals(k.getKey())).findFirst().orElse(null);
                KPICard perfKpi = dashboard.getKpiCards().stream().filter(k -> "PERFORMANCE".equals(k.getKey())).findFirst().orElse(null);
                KPICard qualKpi = dashboard.getKpiCards().stream().filter(k -> "QUALITY_RATE".equals(k.getKey())).findFirst().orElse(null);
                StringBuilder sb = new StringBuilder();
                sb.append(String.format("在 %s 至 %s 期间，综合设备效率 (OEE) 为 %.1f%%。",
                        startDate, endDate, oeeKpi.getRawValue().doubleValue()));
                if (availKpi != null) sb.append(String.format(" 可用性: %.1f%%，", availKpi.getRawValue().doubleValue()));
                if (perfKpi != null) sb.append(String.format("性能: %.1f%%，", perfKpi.getRawValue().doubleValue()));
                if (qualKpi != null) sb.append(String.format("质量: %.1f%%。", qualKpi.getRawValue().doubleValue()));
                return sb.toString();
            }
        }
        return "已获取生产数据，请查看详细信息。";
    }

    private String generateQualityQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard fpyKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "FPY".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            KPICard defectKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "DEFECT_RATE".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            if (fpyKpi != null && fpyKpi.getRawValue() != null) {
                StringBuilder sb = new StringBuilder();
                sb.append(String.format("在 %s 至 %s 期间，首次通过率 (FPY) 为 %.2f%%",
                        startDate, endDate, fpyKpi.getRawValue().doubleValue()));
                if (defectKpi != null && defectKpi.getRawValue() != null) {
                    sb.append(String.format("，不良率为 %.2f%%", defectKpi.getRawValue().doubleValue()));
                }
                sb.append("。");
                return sb.toString();
            }
        }
        return "已获取质量数据，请查看详细信息。";
    }

    private String generateInventoryQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard valueKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "INVENTORY_VALUE".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            KPICard turnoverKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "TURNOVER_RATE".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("截至 %s，", endDate));
            if (valueKpi != null && valueKpi.getRawValue() != null) {
                sb.append(String.format("库存总值为 %.2f 元", valueKpi.getRawValue().doubleValue()));
            }
            if (turnoverKpi != null && turnoverKpi.getRawValue() != null) {
                sb.append(String.format("，周转率为 %.1f 次/年", turnoverKpi.getRawValue().doubleValue()));
            }
            sb.append("。");
            return sb.toString();
        }
        return "已获取库存数据，请查看详细信息。";
    }

    private String generateProcurementQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard amountKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "PROCUREMENT_AMOUNT".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            KPICard batchKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "BATCH_COUNT".equals(k.getKey()))
                    .findFirst()
                    .orElse(null);
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("在 %s 至 %s 期间，", startDate, endDate));
            if (amountKpi != null && amountKpi.getRawValue() != null) {
                sb.append(String.format("采购总额为 %.2f 元", amountKpi.getRawValue().doubleValue()));
            }
            if (batchKpi != null && batchKpi.getRawValue() != null) {
                sb.append(String.format("，共 %.0f 批次", batchKpi.getRawValue().doubleValue()));
            }
            sb.append("。");
            return sb.toString();
        }
        return "已获取采购数据，请查看详细信息。";
    }

    /**
     * 生成后续问题建议
     */
    private List<String> generateFollowUpQuestions(IntentResult intentResult) {
        if (intentResult.getIntent() == null) {
            return List.of(
                    "本月销售额是多少？",
                    "哪个部门业绩最好？",
                    "区域销售排名是怎样的？"
            );
        }

        // 根据意图分类生成后续问题
        if (intentResult.getIntent().isQueryIntent() && intentResult.getIntent().getCode().contains("sales")) {
            return List.of(
                    "哪个销售员业绩最好？",
                    "销售趋势如何？",
                    "产品销量排名是怎样的？"
            );
        } else if (intentResult.getIntent().getCode().contains("dept") ||
                   intentResult.getIntent().getCode().contains("department")) {
            return List.of(
                    "部门完成率是多少？",
                    "人均产出是多少？",
                    "部门销售趋势如何？"
            );
        } else if (intentResult.getIntent().getCode().contains("region")) {
            return List.of(
                    "各省份销售情况如何？",
                    "区域机会评分是多少？",
                    "哪个区域增长最快？"
            );
        } else if (intentResult.getIntent().getCode().contains("finance") ||
                   intentResult.getIntent().getCode().contains("profit") ||
                   intentResult.getIntent().getCode().contains("cost") ||
                   intentResult.getIntent().getCode().contains("receivable")) {
            return List.of(
                    "应收账款账龄分布？",
                    "成本结构是怎样的？",
                    "预算执行情况如何？"
            );
        } else {
            return List.of(
                    "查看更多分析",
                    "导出报表",
                    "设置预警"
            );
        }
    }

    // ==================== Schema 管理端点 ====================

    /**
     * 上传 Excel 并检测 Schema 变化
     */
    @PostMapping(value = "/datasource/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传 Excel 并检测 Schema", description = "解析 Excel 文件结构，与现有 Schema 比较，使用 LLM 推断新字段含义")
    public ResponseEntity<ApiResponse<SchemaChangePreview>> uploadAndDetectSchema(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "数据源名称") @RequestParam("datasourceName") String datasourceName) {

        log.info("上传并检测 Schema: factoryId={}, datasourceName={}, fileName={}",
                factoryId, datasourceName, file.getOriginalFilename());

        try {
            SchemaChangePreview preview = schemaService.uploadAndDetectSchema(file, datasourceName, factoryId);
            return ResponseEntity.ok(ApiResponse.success("Schema 检测完成", preview));
        } catch (Exception e) {
            log.error("Schema 检测失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Schema 检测失败: " + e.getMessage()));
        }
    }

    /**
     * 预览 Schema 变更详情
     */
    @GetMapping("/datasource/{datasourceId}/preview")
    @Operation(summary = "预览 Schema 变更", description = "获取指定数据源的待审批 Schema 变更预览")
    public ResponseEntity<ApiResponse<SchemaChangePreview>> previewSchemaChanges(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "数据源ID") @PathVariable Long datasourceId) {

        log.info("预览 Schema 变更: factoryId={}, datasourceId={}", factoryId, datasourceId);

        try {
            SchemaChangePreview preview = schemaService.previewSchemaChanges(datasourceId);
            return ResponseEntity.ok(ApiResponse.success(preview));
        } catch (Exception e) {
            log.error("获取 Schema 预览失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取预览失败: " + e.getMessage()));
        }
    }

    /**
     * 应用 Schema 变更
     */
    @PostMapping("/datasource/apply")
    @Operation(summary = "应用 Schema 变更", description = "验证用户确认的映射，执行 DDL（如需要），更新字段定义，创建历史记录")
    public ResponseEntity<ApiResponse<Void>> applySchemaChanges(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody @Valid SchemaApplyRequest request) {

        log.info("应用 Schema 变更: factoryId={}, datasourceId={}", factoryId, request.getDatasourceId());

        try {
            schemaService.applySchemaChanges(request);
            return ResponseEntity.ok(ApiResponse.successMessage("Schema 变更已应用"));
        } catch (Exception e) {
            log.error("应用 Schema 变更失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("应用变更失败: " + e.getMessage()));
        }
    }

    /**
     * 获取数据源列表
     */
    @GetMapping("/datasource/list")
    @Operation(summary = "获取数据源列表", description = "获取工厂下所有数据源")
    public ResponseEntity<ApiResponse<List<SmartBiDatasource>>> listDatasources(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("获取数据源列表: factoryId={}", factoryId);

        try {
            List<SmartBiDatasource> datasources = schemaService.listDatasources(factoryId);
            return ResponseEntity.ok(ApiResponse.success(datasources));
        } catch (Exception e) {
            log.error("获取数据源列表失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取列表失败: " + e.getMessage()));
        }
    }

    /**
     * 获取数据源字段定义
     */
    @GetMapping("/datasource/{datasourceId}/fields")
    @Operation(summary = "获取字段定义", description = "获取数据源的所有字段定义")
    public ResponseEntity<ApiResponse<List<SmartBiFieldDefinition>>> getDatasourceFields(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "数据源ID") @PathVariable Long datasourceId) {

        log.info("获取字段定义: factoryId={}, datasourceId={}", factoryId, datasourceId);

        try {
            List<SmartBiFieldDefinition> fields = schemaService.getDatasourceFields(datasourceId);
            return ResponseEntity.ok(ApiResponse.success(fields));
        } catch (Exception e) {
            log.error("获取字段定义失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取字段定义失败: " + e.getMessage()));
        }
    }

    /**
     * 获取 Schema 变更历史
     */
    @GetMapping("/datasource/{datasourceId}/history")
    @Operation(summary = "获取变更历史", description = "获取数据源的 Schema 变更历史记录")
    public ResponseEntity<ApiResponse<Page<SmartBiSchemaHistory>>> getSchemaHistory(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "数据源ID") @PathVariable Long datasourceId,
            @PageableDefault(size = 20) Pageable pageable) {

        log.info("获取 Schema 历史: factoryId={}, datasourceId={}", factoryId, datasourceId);

        try {
            Page<SmartBiSchemaHistory> history = schemaService.getSchemaHistory(datasourceId, pageable);
            return ResponseEntity.ok(ApiResponse.success(history));
        } catch (Exception e) {
            log.error("获取 Schema 历史失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取历史失败: " + e.getMessage()));
        }
    }

    // ==================== 动态数据分析 (PostgreSQL) ====================

    /**
     * 获取上传历史列表
     * 返回已上传的 Excel 文件列表，用于前端数据源选择器
     */
    @GetMapping("/uploads")
    @Operation(summary = "获取上传历史", description = "获取工厂下所有已上传的 Excel 文件列表")
    public ResponseEntity<ApiResponse<List<UploadHistoryDTO>>> getUploadHistory(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "状态筛选") @RequestParam(required = false) String status) {

        log.info("获取上传历史: factoryId={}, status={}", factoryId, status);

        if (pgUploadRepository == null) {
            log.warn("PostgreSQL 上传功能未启用 (smartbi.postgres.enabled=false)");
            return ResponseEntity.ok(ApiResponse.success(java.util.Collections.emptyList()));
        }

        try {
            List<SmartBiPgExcelUpload> uploads = pgUploadRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);
            List<UploadHistoryDTO> dtos = uploads.stream()
                    .map(UploadHistoryDTO::fromEntity)
                    .collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(ApiResponse.success(dtos));
        } catch (Exception e) {
            log.error("获取上传历史失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取上传历史失败: " + e.getMessage()));
        }
    }

    /**
     * 动态数据分析
     * 对已上传的 Excel 数据进行分析，返回 KPI、图表和洞察
     */
    @GetMapping("/analysis/dynamic")
    @Operation(summary = "动态数据分析", description = "分析已上传的 Excel 数据，返回 KPI 卡片、图表配置和 AI 洞察")
    public ResponseEntity<ApiResponse<DynamicAnalysisService.DashboardResponse>> analyzeDynamicData(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "上传ID") @RequestParam Long uploadId,
            @Parameter(description = "分析类型: auto/finance/sales/inventory") @RequestParam(defaultValue = "auto") String analysisType) {

        log.info("动态数据分析: factoryId={}, uploadId={}, type={}", factoryId, uploadId, analysisType);

        if (dynamicAnalysisService == null) {
            log.warn("动态分析服务未启用 (smartbi.postgres.enabled=false)");
            return ResponseEntity.ok(ApiResponse.error("动态分析服务未启用，请在配置中开启 smartbi.postgres.enabled=true"));
        }

        try {
            DynamicAnalysisService.DashboardResponse result =
                    dynamicAnalysisService.analyzeDynamic(factoryId, uploadId, analysisType);

            if (result == null) {
                return ResponseEntity.ok(ApiResponse.error("分析结果为空，请确认数据已上传"));
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("动态数据分析失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("分析失败: " + e.getMessage()));
        }
    }

    /**
     * 获取上传数据的字段定义
     * 用于前端了解数据结构和可用的分析维度
     */
    @GetMapping("/uploads/{uploadId}/fields")
    @Operation(summary = "获取上传数据字段", description = "获取已上传数据的字段定义，包含语义类型和图表角色")
    public ResponseEntity<ApiResponse<List<DynamicAnalysisService.FieldDefinitionDTO>>> getUploadFields(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "上传ID") @PathVariable Long uploadId) {

        log.info("获取上传字段: factoryId={}, uploadId={}", factoryId, uploadId);

        if (dynamicAnalysisService == null) {
            log.warn("动态分析服务未启用");
            return ResponseEntity.ok(ApiResponse.error("动态分析服务未启用"));
        }

        try {
            List<DynamicAnalysisService.FieldDefinitionDTO> fields =
                    dynamicAnalysisService.getFieldDefinitions(uploadId);
            return ResponseEntity.ok(ApiResponse.success(fields));
        } catch (Exception e) {
            log.error("获取上传字段失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取字段失败: " + e.getMessage()));
        }
    }

    // ==================== Phase 5: Data Preview ====================

    /**
     * 获取上传数据的表格预览（分页）
     * 用于查看已持久化的原始 Excel 数据
     */
    @GetMapping("/uploads/{uploadId}/data")
    @Operation(summary = "获取上传数据", description = "分页获取已持久化的 Excel 数据行")
    public ResponseEntity<ApiResponse<TableDataResponse>> getUploadData(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "上传ID") @PathVariable Long uploadId,
            @Parameter(description = "页码 (从0开始)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "50") int size) {

        log.info("获取上传数据: factoryId={}, uploadId={}, page={}, size={}", factoryId, uploadId, page, size);

        if (dynamicAnalysisService == null) {
            log.warn("动态分析服务未启用");
            return ResponseEntity.ok(ApiResponse.error("动态分析服务未启用，无法查看原始数据"));
        }

        try {
            // 1. 获取字段定义作为表头
            List<DynamicAnalysisService.FieldDefinitionDTO> fields =
                    dynamicAnalysisService.getFieldDefinitions(uploadId);
            List<String> headers = fields.stream()
                    .map(DynamicAnalysisService.FieldDefinitionDTO::getOriginalName)
                    .collect(java.util.stream.Collectors.toList());

            // 2. 获取数据行（分页）
            org.springframework.data.domain.Page<SmartBiDynamicData> dataPage =
                    dynamicAnalysisService.getDataPage(factoryId, uploadId, page, size);

            List<Map<String, Object>> rows = dataPage.getContent().stream()
                    .map(SmartBiDynamicData::getRowData)
                    .collect(java.util.stream.Collectors.toList());

            // 3. 构建响应
            TableDataResponse response = TableDataResponse.builder()
                    .headers(headers)
                    .data(rows)
                    .total(dataPage.getTotalElements())
                    .page(page)
                    .size(size)
                    .totalPages(dataPage.getTotalPages())
                    .build();

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("获取上传数据失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取数据失败: " + e.getMessage()));
        }
    }

    // ==================== Phase 5: Field Definition Backfill ====================

    /**
     * 获取缺少字段定义的上传记录数量
     * 用于诊断历史数据问题
     */
    @GetMapping("/uploads-missing-fields")
    @Operation(summary = "诊断缺少字段定义的上传", description = "返回缺少字段定义的上传记录数量")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUploadsMissingFields(
            @Parameter(description = "工厂ID") @PathVariable String factoryId) {

        log.info("诊断缺少字段定义的上传: factoryId={}", factoryId);

        if (pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.error("PostgreSQL 功能未启用"));
        }

        try {
            List<SmartBiPgExcelUpload> allUploads = pgUploadRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId);
            int totalCount = allUploads.size();
            int missingCount = 0;

            for (SmartBiPgExcelUpload upload : allUploads) {
                if (dynamicAnalysisService != null) {
                    long fieldCount = dynamicAnalysisService.getFieldCount(upload.getId());
                    if (fieldCount == 0) {
                        missingCount++;
                    }
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("totalUploads", totalCount);
            result.put("missingFieldsCount", missingCount);
            result.put("hasIssues", missingCount > 0);

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("诊断失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("诊断失败: " + e.getMessage()));
        }
    }

    /**
     * 回填单个上传的字段定义
     * 从 field_mappings JSON 重建字段定义
     */
    @PostMapping("/backfill/fields/{uploadId}")
    @Operation(summary = "回填字段定义", description = "从 field_mappings 重建缺失的字段定义")
    public ResponseEntity<ApiResponse<BackfillResult>> backfillFieldDefinitions(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "上传ID") @PathVariable Long uploadId) {

        log.info("回填字段定义: factoryId={}, uploadId={}", factoryId, uploadId);

        if (dynamicAnalysisService == null || pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.error("动态分析服务未启用"));
        }

        try {
            BackfillResult result = dynamicAnalysisService.backfillFieldDefinitions(factoryId, uploadId);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("回填失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("回填失败: " + e.getMessage()));
        }
    }

    /**
     * 批量回填字段定义
     */
    @PostMapping("/backfill/batch")
    @Operation(summary = "批量回填字段定义", description = "为所有缺少字段定义的上传执行回填")
    public ResponseEntity<ApiResponse<BatchBackfillResult>> batchBackfill(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "最大处理数量") @RequestParam(defaultValue = "100") int limit) {

        log.info("批量回填字段定义: factoryId={}, limit={}", factoryId, limit);

        if (dynamicAnalysisService == null || pgUploadRepository == null) {
            return ResponseEntity.ok(ApiResponse.error("动态分析服务未启用"));
        }

        try {
            BatchBackfillResult result = dynamicAnalysisService.batchBackfillFieldDefinitions(factoryId, limit);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("批量回填失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("批量回填失败: " + e.getMessage()));
        }
    }

    // ==================== DTO Classes ====================

    /**
     * 表格数据响应 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TableDataResponse {
        private List<String> headers;
        private List<Map<String, Object>> data;
        private long total;
        private int page;
        private int size;
        private int totalPages;
    }

    /**
     * 回填结果 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BackfillResult {
        private Long uploadId;
        private String status;  // "success", "skipped", "failed"
        private int fieldsCreated;
        private String message;

        public static BackfillResult success(Long uploadId, int fieldsCreated) {
            return BackfillResult.builder()
                    .uploadId(uploadId)
                    .status("success")
                    .fieldsCreated(fieldsCreated)
                    .message("成功创建 " + fieldsCreated + " 个字段定义")
                    .build();
        }

        public static BackfillResult skipped(Long uploadId, String reason) {
            return BackfillResult.builder()
                    .uploadId(uploadId)
                    .status("skipped")
                    .fieldsCreated(0)
                    .message(reason)
                    .build();
        }

        public static BackfillResult failed(Long uploadId, String error) {
            return BackfillResult.builder()
                    .uploadId(uploadId)
                    .status("failed")
                    .fieldsCreated(0)
                    .message(error)
                    .build();
        }
    }

    /**
     * 批量回填结果 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BatchBackfillResult {
        private int totalProcessed;
        private int successCount;
        private int skippedCount;
        private int failedCount;
        private List<BackfillResult> details;
    }

    /**
     * 上传历史 DTO
     */
    @Data
    public static class UploadHistoryDTO {
        private Long id;
        private String fileName;
        private String sheetName;
        private String tableType;
        private Integer rowCount;
        private Integer columnCount;
        private String status;
        private String createdAt;

        public static UploadHistoryDTO fromEntity(SmartBiPgExcelUpload upload) {
            UploadHistoryDTO dto = new UploadHistoryDTO();
            dto.setId(upload.getId());
            dto.setFileName(upload.getFileName());
            dto.setSheetName(upload.getSheetName());
            dto.setTableType(upload.getDetectedTableType());
            dto.setRowCount(upload.getRowCount());
            dto.setColumnCount(upload.getColumnCount());
            dto.setStatus(upload.getUploadStatus() != null ? upload.getUploadStatus().name() : "UNKNOWN");
            dto.setCreatedAt(upload.getCreatedAt() != null ? upload.getCreatedAt().toString() : null);
            return dto;
        }
    }

    /**
     * 下钻请求 DTO
     */
    @Data
    public static class DrillDownRequest {
        /** 当前维度: region/province/city/department/salesperson */
        private String dimension;
        /** 当前维度的值 */
        private String value;
        /** 父级维度 */
        private String parentDimension;
        /** 父级维度的值 */
        private String parentValue;
        /** 开始日期 */
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate startDate;
        /** 结束日期 */
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate endDate;
        /** 额外筛选条件 */
        private Map<String, Object> filters;
    }

    /**
     * 确认字段映射请求 DTO
     * 用于 /upload/confirm 端点
     */
    @Data
    public static class ConfirmMappingRequest {
        /** 原始解析响应 (来自 /upload 或 /upload-and-analyze 返回的 parseResult) */
        private ExcelParseResponse parseResponse;

        /** 用户确认的字段映射
         * Key: Excel 列名
         * Value: 目标字段名 (标准字段名，如 "salesAmount", "productName" 等)
         */
        private Map<String, String> confirmedMappings;

        /** 数据类型: sales/finance/inventory/production/quality/procurement */
        private String dataType;

        /** 是否保存原始数据 (默认 true) */
        private Boolean saveRawData;

        /** 是否生成图表 (默认 true) */
        private Boolean generateChart;

        /** 图表模板ID (可选，不指定则自动推荐) */
        private Long chartTemplateId;

        /** 附加选项 */
        private Map<String, Object> options;
    }
}
