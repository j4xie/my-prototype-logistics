package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.annotation.RequirePermission;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.entity.smartbi.SmartBiDatasource;
import com.cretas.aims.entity.smartbi.SmartBiFieldDefinition;
import com.cretas.aims.entity.smartbi.SmartBiQueryTemplate;
import com.cretas.aims.entity.smartbi.SmartBiSchemaHistory;
import com.cretas.aims.repository.smartbi.SmartBiQueryTemplateRepository;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import com.cretas.aims.util.ErrorSanitizer;

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
    private final SmartBiQueryTemplateRepository queryTemplateRepository;

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
            @Autowired(required = false) SmartBIService smartBIService,
            SmartBiQueryTemplateRepository queryTemplateRepository) {
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
        this.queryTemplateRepository = queryTemplateRepository;
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
        log.info("[SMARTBI_MIGRATED] /analysis/sales factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/sales (since 2026-05-09)")
        );
    }

    // ==================== Department Analysis ====================

    @GetMapping("/analysis/department")
    @Operation(summary = "Get department analysis", description = "Get department performance analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDepartmentAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Department name") @RequestParam(required = false) String department) {
        log.info("[SMARTBI_MIGRATED] /analysis/department factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/department (since 2026-05-09)")
        );
    }

    // ==================== Region Analysis ====================

    @GetMapping("/analysis/region")
    @Operation(summary = "Get region analysis", description = "Get regional sales analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRegionAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Region name") @RequestParam(required = false) String region) {
        log.info("[SMARTBI_MIGRATED] /analysis/region factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/region (since 2026-05-09)")
        );
    }

    // ==================== Finance Analysis ====================

    @GetMapping("/analysis/finance")
    @Operation(summary = "Get finance analysis", description = "Get finance analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFinanceAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: profit/cost/receivable/payable/budget") @RequestParam(required = false) String analysisType) {
        log.info("[SMARTBI_MIGRATED] /analysis/finance factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/finance (since 2026-05-09)")
        );
    }

    @GetMapping("/analysis/finance/budget-achievement")
    @Operation(summary = "Budget achievement analysis", description = "Budget vs actual chart per month")
    public ResponseEntity<ApiResponse<ChartConfig>> getBudgetAchievementChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Year") @RequestParam int year,
            @Parameter(description = "Metric: revenue/cost/profit/expense") @RequestParam(defaultValue = "revenue") String metric) {
        log.info("[SMARTBI_MIGRATED] /analysis/finance/budget-achievement factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/finance/budget-achievement (since 2026-05-09)")
        );
    }

    @GetMapping("/analysis/finance/yoy-mom")
    @Operation(summary = "YoY/MoM comparison", description = "Year-over-year and month-over-month comparison chart")
    public ResponseEntity<ApiResponse<ChartConfig>> getYoYMoMComparisonChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Period type") @RequestParam String periodType,
            @Parameter(description = "Start period") @RequestParam String startPeriod,
            @Parameter(description = "End period") @RequestParam(required = false) String endPeriod,
            @Parameter(description = "Metric: revenue/cost/profit/gross_margin") @RequestParam(defaultValue = "revenue") String metric) {
        log.info("[SMARTBI_MIGRATED] /analysis/finance/yoy-mom factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/finance/yoy-mom (since 2026-05-09)")
        );
    }

    @GetMapping("/analysis/finance/category-comparison")
    @Operation(summary = "Category structure comparison", description = "Compare category sales structure between two years")
    public ResponseEntity<ApiResponse<ChartConfig>> getCategoryStructureComparisonChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Current year") @RequestParam int year,
            @Parameter(description = "Compare year") @RequestParam int compareYear) {
        log.info("[SMARTBI_MIGRATED] /analysis/finance/category-comparison factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/finance/category-comparison (since 2026-05-09)")
        );
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
            return ResponseEntity.ok(ApiResponse.error("Get production analysis failed: " + ErrorSanitizer.sanitize(e)));
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
            return ResponseEntity.ok(ApiResponse.error("Get quality analysis failed: " + ErrorSanitizer.sanitize(e)));
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
        log.info("[SMARTBI_MIGRATED] /analysis/inventory factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/inventory (since 2026-05-09)")
        );
    }

    // ==================== Procurement Analysis ====================

    @GetMapping("/analysis/procurement")
    @Operation(summary = "Get procurement analysis", description = "Get procurement analysis data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProcurementAnalysis(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @Parameter(description = "Analysis type: supplier/cost/trend") @RequestParam(required = false) String analysisType) {
        log.info("[SMARTBI_MIGRATED] /analysis/procurement factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/analysis/procurement (since 2026-05-09)")
        );
    }

    // ==================== Natural Language Query ====================

    @RequirePermission({"analytics:read_write"})
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
            return ResponseEntity.ok(ApiResponse.error("Query failed: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== Drill-Down ====================

    @RequirePermission({"analytics:read_write"})
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
            return ResponseEntity.ok(ApiResponse.error("Drill-down failed: " + ErrorSanitizer.sanitize(e)));
        }
    }

    // ==================== Alerts ====================

    @GetMapping("/alerts")
    @Operation(summary = "Get alerts", description = "Get current alert list")
    public ResponseEntity<ApiResponse<List<Alert>>> getAlerts(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Category: sales/finance/department") @RequestParam(required = false) String category) {
        log.info("[SMARTBI_MIGRATED] /alerts factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/alerts (since 2026-05-09)")
        );
    }

    // ==================== Recommendations ====================

    @GetMapping("/recommendations")
    @Operation(summary = "Get recommendations", description = "Get smart recommendation list")
    public ResponseEntity<ApiResponse<List<Recommendation>>> getRecommendations(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Analysis type: sales/finance/department/all") @RequestParam(required = false) String analysisType) {
        log.info("[SMARTBI_MIGRATED] /recommendations factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/recommendations (since 2026-05-09)")
        );
    }

    // ==================== Incentive Plans ====================

    @GetMapping("/incentive-plan/{targetType}/{targetId}")
    @Operation(summary = "Get incentive plan", description = "Get incentive plan for specified target")
    public ResponseEntity<ApiResponse<IncentivePlan>> getIncentivePlan(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Target type: salesperson/department/region") @PathVariable String targetType,
            @Parameter(description = "Target ID") @PathVariable String targetId) {
        log.info("[SMARTBI_MIGRATED] /incentive-plan/{}/{} factoryId={} returning 410 Gone", targetType, targetId, factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/incentive-plan/{targetType}/{targetId} (since 2026-05-09)")
        );
    }

    // ==================== Schema Management ====================

    @RequirePermission({"analytics:read_write"})
    @PostMapping(value = "/datasource/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload and detect schema", description = "Parse Excel structure, compare with existing schema")
    public ResponseEntity<ApiResponse<SchemaChangePreview>> uploadAndDetectSchema(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Excel file") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Datasource name") @RequestParam("datasourceName") String datasourceName) {
        log.info("[SMARTBI_MIGRATED] /datasource/upload factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/datasource/upload (since 2026-05-09)")
        );
    }

    @GetMapping("/datasource/{datasourceId}/preview")
    @Operation(summary = "Preview schema changes", description = "Get pending schema change preview for datasource")
    public ResponseEntity<ApiResponse<SchemaChangePreview>> previewSchemaChanges(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Datasource ID") @PathVariable Long datasourceId) {
        log.info("[SMARTBI_MIGRATED] /datasource/{}/preview factoryId={} returning 410 Gone", datasourceId, factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/datasource/{id}/preview (since 2026-05-09)")
        );
    }

    @RequirePermission({"analytics:read_write"})
    @PostMapping("/datasource/apply")
    @Operation(summary = "Apply schema changes", description = "Validate confirmed mappings, execute DDL, update field definitions")
    public ResponseEntity<ApiResponse<Void>> applySchemaChanges(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @RequestBody @Valid SchemaApplyRequest request) {
        log.info("[SMARTBI_MIGRATED] /datasource/apply factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/datasource/apply (since 2026-05-09)")
        );
    }

    @GetMapping("/datasource/list")
    @Operation(summary = "List datasources", description = "Get all datasources for the factory")
    public ResponseEntity<ApiResponse<List<SmartBiDatasource>>> listDatasources(
            @Parameter(description = "Factory ID") @PathVariable String factoryId) {
        log.info("[SMARTBI_MIGRATED] /datasource/list factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/datasource/list (since 2026-05-09)")
        );
    }

    @GetMapping("/datasource/{datasourceId}/fields")
    @Operation(summary = "Get field definitions", description = "Get all field definitions for the datasource")
    public ResponseEntity<ApiResponse<List<SmartBiFieldDefinition>>> getDatasourceFields(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Datasource ID") @PathVariable Long datasourceId) {
        log.info("[SMARTBI_MIGRATED] /datasource/{}/fields factoryId={} returning 410 Gone", datasourceId, factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/datasource/{id}/fields (since 2026-05-09)")
        );
    }

    @GetMapping("/datasource/{datasourceId}/history")
    @Operation(summary = "Get schema history", description = "Get schema change history for the datasource")
    public ResponseEntity<ApiResponse<Page<SmartBiSchemaHistory>>> getSchemaHistory(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Datasource ID") @PathVariable Long datasourceId,
            @PageableDefault(size = 20) Pageable pageable) {
        log.info("[SMARTBI_MIGRATED] /datasource/{}/history factoryId={} returning 410 Gone", datasourceId, factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/datasource/{id}/history (since 2026-05-09)")
        );
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

    // ==================== Query Templates ====================

    @GetMapping("/query-templates")
    @Operation(summary = "List query templates", description = "Get all query templates for a factory")
    public ResponseEntity<ApiResponse<List<SmartBiQueryTemplate>>> getQueryTemplates(
            @PathVariable String factoryId) {
        log.info("[SMARTBI_MIGRATED] GET /query-templates factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/query-templates (since 2026-05-09)")
        );
    }

    @RequirePermission({"analytics:read_write"})
    @PostMapping("/query-templates")
    @Operation(summary = "Create query template")
    public ResponseEntity<ApiResponse<SmartBiQueryTemplate>> createQueryTemplate(
            @PathVariable String factoryId,
            @RequestBody SmartBiQueryTemplate template) {
        log.info("[SMARTBI_MIGRATED] POST /query-templates factoryId={} returning 410 Gone", factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/query-templates (since 2026-05-09)")
        );
    }

    @RequirePermission({"analytics:read_write"})
    @PutMapping("/query-templates/{templateId}")
    @Operation(summary = "Update query template")
    public ResponseEntity<ApiResponse<SmartBiQueryTemplate>> updateQueryTemplate(
            @PathVariable String factoryId,
            @PathVariable Long templateId,
            @RequestBody SmartBiQueryTemplate template) {
        log.info("[SMARTBI_MIGRATED] PUT /query-templates/{} factoryId={} returning 410 Gone", templateId, factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/query-templates/{id} (since 2026-05-09)")
        );
    }

    @RequirePermission({"analytics:read_write"})
    @DeleteMapping("/query-templates/{templateId}")
    @Operation(summary = "Delete query template")
    public ResponseEntity<ApiResponse<Void>> deleteQueryTemplate(
            @PathVariable String factoryId,
            @PathVariable Long templateId) {
        log.info("[SMARTBI_MIGRATED] DELETE /query-templates/{} factoryId={} returning 410 Gone", templateId, factoryId);
        return ResponseEntity.status(HttpStatus.GONE).body(
                ApiResponse.error(410, "SMARTBI_MIGRATED: endpoint moved to Python /api/smartbi/query-templates/{id} (since 2026-05-09)")
        );
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
