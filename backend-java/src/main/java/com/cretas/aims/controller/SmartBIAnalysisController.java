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

import javax.validation.Valid;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SmartBI Analysis Controller
 *
 * Handles all domain-specific analysis endpoints (sales, department, region, finance,
 * production, quality, inventory, procurement), NL query, drill-down, alerts,
 * recommendations, incentive plans, and schema management.
 * AUDIT-085: Extracted from SmartBIController to reduce file size.
 *
 * @author Cretas Team
 * @since 2026-02-11
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/smart-bi")
@Tag(name = "SmartBI Analysis", description = "SmartBI Analysis, Query, Alerts and Schema API")
public class SmartBIAnalysisController {

    private final SalesAnalysisService salesAnalysisService;
    private final DepartmentAnalysisService departmentAnalysisService;
    private final RegionAnalysisService regionAnalysisService;
    private final FinanceAnalysisService financeAnalysisService;
    private final SmartBIIntentService intentService;
    private final RecommendationService recommendationService;
    private final SmartBiSchemaService schemaService;
    private final ProductionAnalysisService productionAnalysisService;
    private final QualityAnalysisService qualityAnalysisService;
    private final InventoryHealthAnalysisService inventoryHealthAnalysisService;
    private final ProcurementAnalysisService procurementAnalysisService;
    private final SmartBIService smartBIService;

    @Autowired
    public SmartBIAnalysisController(
            SalesAnalysisService salesAnalysisService,
            DepartmentAnalysisService departmentAnalysisService,
            RegionAnalysisService regionAnalysisService,
            FinanceAnalysisService financeAnalysisService,
            SmartBIIntentService intentService,
            RecommendationService recommendationService,
            SmartBiSchemaService schemaService,
            ProductionAnalysisService productionAnalysisService,
            QualityAnalysisService qualityAnalysisService,
            InventoryHealthAnalysisService inventoryHealthAnalysisService,
            ProcurementAnalysisService procurementAnalysisService,
            @Autowired(required = false) SmartBIService smartBIService) {
        this.salesAnalysisService = salesAnalysisService;
        this.departmentAnalysisService = departmentAnalysisService;
        this.regionAnalysisService = regionAnalysisService;
        this.financeAnalysisService = financeAnalysisService;
        this.intentService = intentService;
        this.recommendationService = recommendationService;
        this.schemaService = schemaService;
        this.productionAnalysisService = productionAnalysisService;
        this.qualityAnalysisService = qualityAnalysisService;
        this.inventoryHealthAnalysisService = inventoryHealthAnalysisService;
        this.procurementAnalysisService = procurementAnalysisService;
        this.smartBIService = smartBIService;
    }

    // ==================== Sales Analysis ====================

    @GetMapping("/analysis/sales")
    @Operation(summary = "Get sales analysis", description = "Get sales analysis data with multi-dimension support")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSalesAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Department filter") @RequestParam(required = false) String department,
            @Parameter(description = "Dimension: salesperson/product/customer/trend") @RequestParam(required = false) String dimension) {

        log.info("Get sales analysis: factoryId={}, startDate={}, endDate={}, dimension={}", factoryId, startDate, endDate, dimension);

        try {
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(factoryId, startDate, endDate, "sales");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

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
                DashboardResponse overview = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get sales analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get sales analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Department Analysis ====================

    @GetMapping("/analysis/department")
    @Operation(summary = "Get department analysis", description = "Get department performance analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDepartmentAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Department name") @RequestParam(required = false) String department) {

        log.info("Get department analysis: factoryId={}, startDate={}, endDate={}, department={}", factoryId, startDate, endDate, department);

        try {
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(factoryId, startDate, endDate, "department");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if (department != null && !department.isEmpty()) {
                DashboardResponse detail = departmentAnalysisService.getDepartmentDetail(factoryId, department, startDate, endDate);
                result.put("detail", detail);
            } else {
                result.put("ranking", departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate));
                result.put("completionRates", departmentAnalysisService.getDepartmentCompletionRates(factoryId, startDate, endDate));
                result.put("efficiencyMatrix", departmentAnalysisService.getDepartmentEfficiencyMatrix(factoryId, startDate, endDate));
                result.put("trendComparison", departmentAnalysisService.getDepartmentTrendComparison(factoryId, startDate, endDate, "MONTH"));
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get department analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get department analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Region Analysis ====================

    @GetMapping("/analysis/region")
    @Operation(summary = "Get region analysis", description = "Get regional sales analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRegionAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Region name") @RequestParam(required = false) String region) {

        log.info("Get region analysis: factoryId={}, startDate={}, endDate={}, region={}", factoryId, startDate, endDate, region);

        try {
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(factoryId, startDate, endDate, "region");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);

            if (region != null && !region.isEmpty()) {
                DashboardResponse detail = regionAnalysisService.getRegionDetail(factoryId, region, startDate, endDate);
                result.put("detail", detail);
                result.put("provinceRanking", regionAnalysisService.getProvinceRanking(factoryId, region, startDate, endDate));
            } else {
                result.put("ranking", regionAnalysisService.getRegionRanking(factoryId, startDate, endDate));
                result.put("opportunityScores", regionAnalysisService.getRegionOpportunityScores(factoryId, startDate, endDate));
                result.put("heatmap", regionAnalysisService.getGeographicHeatmapData(factoryId, startDate, endDate));
                result.put("treemap", regionAnalysisService.getRegionProvinceTreemap(factoryId, startDate, endDate));
                result.put("allRegions", regionAnalysisService.getAllRegions(factoryId));
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get region analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get region analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Finance Analysis ====================

    @GetMapping("/analysis/finance")
    @Operation(summary = "Get finance analysis", description = "Get finance analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFinanceAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: profit/cost/receivable/payable/budget") @RequestParam(required = false) String analysisType) {

        log.info("Get finance analysis: factoryId={}, startDate={}, endDate={}, type={}", factoryId, startDate, endDate, analysisType);

        try {
            if (smartBIService != null) {
                Map<String, Object> result = smartBIService.getComprehensiveAnalysis(factoryId, startDate, endDate, "finance");
                return ResponseEntity.ok(ApiResponse.success(result));
            }

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
                DashboardResponse overview = financeAnalysisService.getFinanceOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get finance analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get finance analysis failed: " + e.getMessage()));
        }
    }

    @GetMapping("/analysis/finance/budget-achievement")
    @Operation(summary = "Budget achievement analysis", description = "Budget vs actual chart per month")
    public ResponseEntity<ApiResponse<ChartConfig>> getBudgetAchievementChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Year") @RequestParam int year,
            @Parameter(description = "Metric: revenue/cost/profit/expense") @RequestParam(defaultValue = "revenue") String metric) {

        log.info("Get budget achievement: factoryId={}, year={}, metric={}", factoryId, year, metric);

        try {
            ChartConfig result = financeAnalysisService.getBudgetAchievementChart(factoryId, year, metric);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get budget achievement failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get budget achievement failed: " + e.getMessage()));
        }
    }

    @GetMapping("/analysis/finance/yoy-mom")
    @Operation(summary = "YoY/MoM comparison", description = "Year-over-year and month-over-month comparison chart")
    public ResponseEntity<ApiResponse<ChartConfig>> getYoYMoMComparisonChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Period type") @RequestParam String periodType,
            @Parameter(description = "Start period") @RequestParam String startPeriod,
            @Parameter(description = "End period") @RequestParam(required = false) String endPeriod,
            @Parameter(description = "Metric: revenue/cost/profit/gross_margin") @RequestParam(defaultValue = "revenue") String metric) {

        log.info("Get YoY/MoM: factoryId={}, periodType={}, metric={}", factoryId, periodType, metric);

        try {
            ChartConfig result = financeAnalysisService.getYoYMoMComparisonChart(factoryId, periodType, startPeriod, endPeriod, metric);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get YoY/MoM failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get YoY/MoM failed: " + e.getMessage()));
        }
    }

    @GetMapping("/analysis/finance/category-comparison")
    @Operation(summary = "Category structure comparison", description = "Compare category sales structure between two years")
    public ResponseEntity<ApiResponse<ChartConfig>> getCategoryStructureComparisonChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Current year") @RequestParam int year,
            @Parameter(description = "Compare year") @RequestParam int compareYear) {

        log.info("Get category comparison: factoryId={}, year={}, compareYear={}", factoryId, year, compareYear);

        try {
            ChartConfig result = financeAnalysisService.getCategoryStructureComparisonChart(factoryId, year, compareYear);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get category comparison failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get category comparison failed: " + e.getMessage()));
        }
    }

    // ==================== Production Analysis ====================

    @GetMapping("/analysis/production")
    @Operation(summary = "Get production analysis", description = "Get production OEE analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProductionAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: oee/efficiency/equipment") @RequestParam(required = false) String analysisType) {

        log.info("Get production analysis: factoryId={}, type={}", factoryId, analysisType);

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
                DashboardResponse overview = productionAnalysisService.getOEEOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get production analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get production analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Quality Analysis ====================

    @GetMapping("/analysis/quality")
    @Operation(summary = "Get quality analysis", description = "Get quality management analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getQualityAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: fpy/defect/rework") @RequestParam(required = false) String analysisType) {

        log.info("Get quality analysis: factoryId={}, type={}", factoryId, analysisType);

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
                DashboardResponse overview = qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get quality analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get quality analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Inventory Health Analysis ====================

    @GetMapping("/analysis/inventory")
    @Operation(summary = "Get inventory health analysis", description = "Get inventory health indicator analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getInventoryAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: turnover/expiry/aging") @RequestParam(required = false) String analysisType) {

        log.info("Get inventory analysis: factoryId={}, type={}", factoryId, analysisType);

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
                DashboardResponse overview = inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get inventory analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get inventory analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Procurement Analysis ====================

    @GetMapping("/analysis/procurement")
    @Operation(summary = "Get procurement analysis", description = "Get procurement analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProcurementAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: supplier/cost/trend") @RequestParam(required = false) String analysisType) {

        log.info("Get procurement analysis: factoryId={}, type={}", factoryId, analysisType);

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
                DashboardResponse overview = procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate);
                result.put("overview", overview);
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Get procurement analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get procurement analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Natural Language Query ====================

    @PostMapping("/query")
    @Operation(summary = "Natural language query", description = "Query and analyze data through natural language")
    public ResponseEntity<ApiResponse<NLQueryResponse>> query(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @RequestBody NLQueryRequest request) {

        log.info("NL query: factoryId={}, query={}", factoryId,
                request.getEffectiveQuery() != null && request.getEffectiveQuery().length() > 50
                        ? request.getEffectiveQuery().substring(0, 50) + "..."
                        : request.getEffectiveQuery());

        try {
            request.setFactoryId(factoryId);

            if (smartBIService != null) {
                NLQueryResponse response = smartBIService.processQuery(factoryId, null, request);
                return ResponseEntity.ok(ApiResponse.success(response));
            }

            IntentResult intentResult = intentService.recognizeIntent(request.getEffectiveQuery(), request.getContext());

            NLQueryResponse response = NLQueryResponse.builder()
                    .intent(intentResult.getIntent() != null ? intentResult.getIntent().name() : "UNKNOWN")
                    .parameters(intentResult.getParameters())
                    .build();

            String responseText = executeQueryByIntent(factoryId, intentResult, request);
            response.setResponseText(responseText);
            response.setFollowUpQuestions(generateFollowUpQuestions(intentResult));

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("NL query failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Query failed: " + e.getMessage()));
        }
    }

    // ==================== Drill-Down ====================

    @PostMapping("/drill-down")
    @Operation(summary = "Data drill-down", description = "Multi-dimensional data drill-down analysis")
    public ResponseEntity<ApiResponse<Map<String, Object>>> drillDown(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @RequestBody DrillDownRequestDTO request) {

        log.info("Drill-down: factoryId={}, dimension={}, value={}", factoryId, request.getDimension(), request.getValue());

        try {
            if (smartBIService != null) {
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

            Map<String, Object> result = new HashMap<>();
            result.put("dimension", request.getDimension());
            result.put("value", request.getValue());
            result.put("parentDimension", request.getParentDimension());

            LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : DateRangeUtils.getStartDateOrDefault(null);
            LocalDate endDate = request.getEndDate() != null ? request.getEndDate() : DateRangeUtils.getEndDateOrDefault(null);

            switch (request.getDimension()) {
                case "region":
                    result.put("data", regionAnalysisService.getProvinceRanking(factoryId, request.getValue(), startDate, endDate));
                    result.put("nextDimension", "province");
                    break;
                case "province":
                    result.put("data", regionAnalysisService.getCityRanking(factoryId, request.getValue(), startDate, endDate));
                    result.put("nextDimension", "city");
                    break;
                case "department":
                    result.put("data", departmentAnalysisService.getDepartmentDetail(factoryId, request.getValue(), startDate, endDate));
                    result.put("nextDimension", "salesperson");
                    break;
                default:
                    result.put("message", "Unsupported drill-down dimension: " + request.getDimension());
            }

            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Drill-down failed", e);
            return ResponseEntity.ok(ApiResponse.error("Drill-down failed: " + e.getMessage()));
        }
    }

    // ==================== Alerts ====================

    @GetMapping("/alerts")
    @Operation(summary = "Get alerts", description = "Get current alert list")
    public ResponseEntity<ApiResponse<List<Alert>>> getAlerts(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Category: sales/finance/department") @RequestParam(required = false) String category) {

        log.info("Get alerts: factoryId={}, category={}", factoryId, category);

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
            log.error("Get alerts failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get alerts failed: " + e.getMessage()));
        }
    }

    // ==================== Recommendations ====================

    @GetMapping("/recommendations")
    @Operation(summary = "Get recommendations", description = "Get smart recommendation list")
    public ResponseEntity<ApiResponse<List<Recommendation>>> getRecommendations(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Analysis type: sales/finance/department/all") @RequestParam(required = false) String analysisType) {

        log.info("Get recommendations: factoryId={}, type={}", factoryId, analysisType);

        try {
            String type = analysisType != null ? analysisType : "all";
            List<Recommendation> recommendations = recommendationService.generateRecommendations(factoryId, type);
            return ResponseEntity.ok(ApiResponse.success(recommendations));
        } catch (Exception e) {
            log.error("Get recommendations failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get recommendations failed: " + e.getMessage()));
        }
    }

    // ==================== Incentive Plans ====================

    @GetMapping("/incentive-plan/{targetType}/{targetId}")
    @Operation(summary = "Get incentive plan", description = "Get incentive plan for specified target")
    public ResponseEntity<ApiResponse<IncentivePlan>> getIncentivePlan(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Target type: salesperson/department/region") @PathVariable String targetType,
            @Parameter(description = "Target ID") @PathVariable String targetId) {

        log.info("Get incentive plan: factoryId={}, targetType={}, targetId={}", factoryId, targetType, targetId);

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
                    return ResponseEntity.ok(ApiResponse.error("Unsupported target type: " + targetType));
            }

            return ResponseEntity.ok(ApiResponse.success(plan));
        } catch (Exception e) {
            log.error("Get incentive plan failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get incentive plan failed: " + e.getMessage()));
        }
    }

    // ==================== Schema Management ====================

    @PostMapping(value = "/datasource/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload and detect schema", description = "Parse Excel structure, compare with existing schema")
    public ResponseEntity<ApiResponse<SchemaChangePreview>> uploadAndDetectSchema(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Datasource name") @RequestParam("datasourceName") String datasourceName) {

        log.info("Upload and detect schema: factoryId={}, datasourceName={}", factoryId, datasourceName);

        try {
            SchemaChangePreview preview = schemaService.uploadAndDetectSchema(file, datasourceName, factoryId);
            return ResponseEntity.ok(ApiResponse.success("Schema detection complete", preview));
        } catch (Exception e) {
            log.error("Schema detection failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Schema detection failed: " + e.getMessage()));
        }
    }

    @GetMapping("/datasource/{datasourceId}/preview")
    @Operation(summary = "Preview schema changes", description = "Get pending schema change preview for datasource")
    public ResponseEntity<ApiResponse<SchemaChangePreview>> previewSchemaChanges(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Datasource ID") @PathVariable Long datasourceId) {

        log.info("Preview schema changes: factoryId={}, datasourceId={}", factoryId, datasourceId);

        try {
            SchemaChangePreview preview = schemaService.previewSchemaChanges(datasourceId);
            return ResponseEntity.ok(ApiResponse.success(preview));
        } catch (Exception e) {
            log.error("Get schema preview failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get preview failed: " + e.getMessage()));
        }
    }

    @PostMapping("/datasource/apply")
    @Operation(summary = "Apply schema changes", description = "Validate confirmed mappings, execute DDL, update field definitions")
    public ResponseEntity<ApiResponse<Void>> applySchemaChanges(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @RequestBody @Valid SchemaApplyRequest request) {

        log.info("Apply schema changes: factoryId={}, datasourceId={}", factoryId, request.getDatasourceId());

        try {
            schemaService.applySchemaChanges(request);
            return ResponseEntity.ok(ApiResponse.successMessage("Schema changes applied"));
        } catch (Exception e) {
            log.error("Apply schema changes failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Apply changes failed: " + e.getMessage()));
        }
    }

    @GetMapping("/datasource/list")
    @Operation(summary = "List datasources", description = "Get all datasources for the factory")
    public ResponseEntity<ApiResponse<List<SmartBiDatasource>>> listDatasources(
            @Parameter(description = "Factory ID") @PathVariable String factoryId) {

        log.info("List datasources: factoryId={}", factoryId);

        try {
            List<SmartBiDatasource> datasources = schemaService.listDatasources(factoryId);
            return ResponseEntity.ok(ApiResponse.success(datasources));
        } catch (Exception e) {
            log.error("List datasources failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("List failed: " + e.getMessage()));
        }
    }

    @GetMapping("/datasource/{datasourceId}/fields")
    @Operation(summary = "Get field definitions", description = "Get all field definitions for the datasource")
    public ResponseEntity<ApiResponse<List<SmartBiFieldDefinition>>> getDatasourceFields(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Datasource ID") @PathVariable Long datasourceId) {

        log.info("Get field definitions: factoryId={}, datasourceId={}", factoryId, datasourceId);

        try {
            List<SmartBiFieldDefinition> fields = schemaService.getDatasourceFields(datasourceId);
            return ResponseEntity.ok(ApiResponse.success(fields));
        } catch (Exception e) {
            log.error("Get field definitions failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get field definitions failed: " + e.getMessage()));
        }
    }

    @GetMapping("/datasource/{datasourceId}/history")
    @Operation(summary = "Get schema history", description = "Get schema change history for the datasource")
    public ResponseEntity<ApiResponse<Page<SmartBiSchemaHistory>>> getSchemaHistory(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Datasource ID") @PathVariable Long datasourceId,
            @PageableDefault(size = 20) Pageable pageable) {

        log.info("Get schema history: factoryId={}, datasourceId={}", factoryId, datasourceId);

        try {
            Page<SmartBiSchemaHistory> history = schemaService.getSchemaHistory(datasourceId, pageable);
            return ResponseEntity.ok(ApiResponse.success(history));
        } catch (Exception e) {
            log.error("Get schema history failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get history failed: " + e.getMessage()));
        }
    }

    // ==================== Internal DTOs ====================

    /**
     * Drill-down request DTO (controller-specific, maps to dto.smartbi.DrillDownRequest)
     */
    @Data
    public static class DrillDownRequestDTO {
        private String dimension;
        private String value;
        private String parentDimension;
        private String parentValue;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate startDate;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate endDate;
        private Map<String, Object> filters;
    }

    // ==================== Helper Methods ====================

    private String executeQueryByIntent(String factoryId, IntentResult intentResult, NLQueryRequest request) {
        if (intentResult.getIntent() == null) {
            return "Sorry, I cannot understand your question. Please try rephrasing.";
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
                    return "Query complete, please check the returned data.";
            }
        } catch (Exception e) {
            log.warn("Generate response text failed: {}", e.getMessage());
            return "Query complete, data returned.";
        }
    }

    private String generateSalesQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard salesKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "TOTAL_SALES".equals(k.getKey())).findFirst().orElse(null);
            if (salesKpi != null && salesKpi.getRawValue() != null) {
                return String.format("During %s to %s, total sales were %s yuan.",
                        startDate, endDate, salesKpi.getRawValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
            }
        }
        return "Sales data retrieved, please check details.";
    }

    private String generateDepartmentQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<RankingItem> ranking = departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate);
        if (ranking != null && !ranking.isEmpty()) {
            RankingItem top = ranking.get(0);
            String valueStr = top.getValue() != null
                    ? top.getValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "0.00";
            return String.format("During %s to %s, %s ranked first with sales of %s yuan.",
                    startDate, endDate, top.getName(), valueStr);
        }
        return "Department data retrieved, please check details.";
    }

    private String generateRegionQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<RankingItem> ranking = regionAnalysisService.getRegionRanking(factoryId, startDate, endDate);
        if (ranking != null && !ranking.isEmpty()) {
            RankingItem top = ranking.get(0);
            String valueStr = top.getValue() != null
                    ? top.getValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "0.00";
            return String.format("During %s to %s, %s region ranked first with sales of %s yuan.",
                    startDate, endDate, top.getName(), valueStr);
        }
        return "Region data retrieved, please check details.";
    }

    private String generateFinanceQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<MetricResult> metrics = financeAnalysisService.getProfitMetrics(factoryId, startDate, endDate);
        if (metrics != null && !metrics.isEmpty()) {
            MetricResult grossProfit = metrics.stream()
                    .filter(m -> "GROSS_PROFIT".equals(m.getMetricCode())).findFirst().orElse(null);
            if (grossProfit != null && grossProfit.getValue() != null) {
                return String.format("During %s to %s, gross profit was %s yuan.",
                        startDate, endDate, grossProfit.getValue().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
            }
        }
        return "Finance data retrieved, please check details.";
    }

    private String generateProductionQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = productionAnalysisService.getOEEOverview(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard oeeKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "OEE".equals(k.getKey())).findFirst().orElse(null);
            if (oeeKpi != null && oeeKpi.getRawValue() != null) {
                return String.format("During %s to %s, OEE was %.1f%%.",
                        startDate, endDate, oeeKpi.getRawValue().doubleValue());
            }
        }
        return "Production data retrieved, please check details.";
    }

    private String generateQualityQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard fpyKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "FPY".equals(k.getKey())).findFirst().orElse(null);
            if (fpyKpi != null && fpyKpi.getRawValue() != null) {
                return String.format("During %s to %s, FPY was %.2f%%.",
                        startDate, endDate, fpyKpi.getRawValue().doubleValue());
            }
        }
        return "Quality data retrieved, please check details.";
    }

    private String generateInventoryQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard valueKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "INVENTORY_VALUE".equals(k.getKey())).findFirst().orElse(null);
            if (valueKpi != null && valueKpi.getRawValue() != null) {
                return String.format("As of %s, inventory value is %.2f yuan.", endDate, valueKpi.getRawValue().doubleValue());
            }
        }
        return "Inventory data retrieved, please check details.";
    }

    private String generateProcurementQueryResponse(String factoryId, LocalDate startDate, LocalDate endDate) {
        DashboardResponse dashboard = procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate);
        if (dashboard != null && dashboard.getKpiCards() != null && !dashboard.getKpiCards().isEmpty()) {
            KPICard amountKpi = dashboard.getKpiCards().stream()
                    .filter(k -> "PROCUREMENT_AMOUNT".equals(k.getKey())).findFirst().orElse(null);
            if (amountKpi != null && amountKpi.getRawValue() != null) {
                return String.format("During %s to %s, total procurement was %.2f yuan.",
                        startDate, endDate, amountKpi.getRawValue().doubleValue());
            }
        }
        return "Procurement data retrieved, please check details.";
    }

    private List<String> generateFollowUpQuestions(IntentResult intentResult) {
        if (intentResult.getIntent() == null) {
            return List.of("What are this month's sales?", "Which department performs best?", "What's the regional sales ranking?");
        }

        if (intentResult.getIntent().isQueryIntent() && intentResult.getIntent().getCode().contains("sales")) {
            return List.of("Who is the top salesperson?", "What's the sales trend?", "Product sales ranking?");
        } else if (intentResult.getIntent().getCode().contains("dept") || intentResult.getIntent().getCode().contains("department")) {
            return List.of("Department completion rate?", "Per-capita output?", "Department sales trend?");
        } else if (intentResult.getIntent().getCode().contains("region")) {
            return List.of("Provincial sales?", "Region opportunity scores?", "Fastest growing region?");
        } else if (intentResult.getIntent().getCode().contains("finance") || intentResult.getIntent().getCode().contains("profit")
                || intentResult.getIntent().getCode().contains("cost") || intentResult.getIntent().getCode().contains("receivable")) {
            return List.of("Receivable aging distribution?", "Cost structure?", "Budget execution?");
        } else {
            return List.of("View more analysis", "Export report", "Set alerts");
        }
    }
}
