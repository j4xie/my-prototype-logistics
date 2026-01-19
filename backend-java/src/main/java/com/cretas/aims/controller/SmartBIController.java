package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.SmartBiFieldDefinition;
import com.cretas.aims.entity.smartbi.SmartBiSchemaHistory;
import com.cretas.aims.service.smartbi.*;
import com.cretas.aims.util.DateRangeUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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
@RequiredArgsConstructor
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

    // ==================== Excel 上传 ====================

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "上传 Excel 文件", description = "上传并解析 Excel 文件，返回解析结果和字段映射")
    public ResponseEntity<ApiResponse<ExcelParseResponse>> uploadExcel(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "Excel 文件") @RequestParam("file") MultipartFile file,
            @Parameter(description = "数据类型: sales/finance/inventory") @RequestParam(required = false) String dataType) {

        log.info("上传 Excel 文件: factoryId={}, fileName={}, dataType={}",
                factoryId, file.getOriginalFilename(), dataType);

        try {
            ExcelParseRequest request = ExcelParseRequest.builder()
                    .factoryId(factoryId)
                    .businessScene(dataType)
                    .build();

            ExcelParseResponse response = excelParserService.parseExcel(file.getInputStream(), request);

            if (!response.isSuccess()) {
                return ResponseEntity.ok(ApiResponse.error(response.getErrorMessage()));
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

    // ==================== 经营驾驶舱 ====================

    @GetMapping("/dashboard/executive")
    @Operation(summary = "获取经营驾驶舱", description = "获取综合经营分析仪表盘数据")
    public ResponseEntity<ApiResponse<DashboardResponse>> getExecutiveDashboard(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @Parameter(description = "时间周期: today/week/month/quarter/year")
            @RequestParam(defaultValue = "month") String period) {

        log.info("获取经营驾驶舱: factoryId={}, period={}", factoryId, period);

        try {
            LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
            LocalDate startDate = dateRange[0];
            LocalDate endDate = dateRange[1];

            // 使用销售分析服务获取概览数据
            DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
            return ResponseEntity.ok(ApiResponse.success(dashboard));
        } catch (Exception e) {
            log.error("获取经营驾驶舱失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取数据失败: " + e.getMessage()));
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
                request.getQueryText() != null && request.getQueryText().length() > 50
                        ? request.getQueryText().substring(0, 50) + "..."
                        : request.getQueryText());

        try {
            // 设置工厂ID
            request.setFactoryId(factoryId);

            // 识别意图
            IntentResult intentResult = intentService.recognizeIntent(
                    request.getQueryText(), request.getContext());

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
    @Operation(summary = "数据下钻", description = "根据当前分析结果进行数据下钻")
    public ResponseEntity<ApiResponse<Map<String, Object>>> drillDown(
            @Parameter(description = "工厂ID") @PathVariable String factoryId,
            @RequestBody DrillDownRequest request) {

        log.info("数据下钻: factoryId={}, dimension={}, value={}",
                factoryId, request.getDimension(), request.getValue());

        try {
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
            log.error("数据下钻失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("下钻失败: " + e.getMessage()));
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
            com.cretas.aims.dto.smartbi.DateRange dateRange = intentService.parseTimeRange(request.getQueryText());
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

    // ==================== DTO Classes ====================

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
}
