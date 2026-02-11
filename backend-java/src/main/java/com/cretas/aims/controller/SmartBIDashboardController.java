package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.dto.smartbi.chart.AdaptiveChartRequest;
import com.cretas.aims.dto.smartbi.chart.AdaptiveChartResponse;
import com.cretas.aims.service.smartbi.*;
import com.cretas.aims.service.smartbi.chart.AdaptiveChartGenerator;
import com.cretas.aims.util.DateRangeUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * SmartBI Dashboard Controller
 *
 * Handles executive dashboard, unified dashboard, data date range,
 * and adaptive chart generation endpoints.
 * AUDIT-085: Extracted from SmartBIController to reduce file size.
 *
 * @author Cretas Team
 * @since 2026-02-11
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/smart-bi")
@Tag(name = "SmartBI Dashboard", description = "SmartBI Dashboard and chart generation API")
public class SmartBIDashboardController {

    private final SalesAnalysisService salesAnalysisService;
    private final DepartmentAnalysisService departmentAnalysisService;
    private final RegionAnalysisService regionAnalysisService;
    private final FinanceAnalysisService financeAnalysisService;
    private final ProductionAnalysisService productionAnalysisService;
    private final QualityAnalysisService qualityAnalysisService;
    private final InventoryHealthAnalysisService inventoryHealthAnalysisService;
    private final ProcurementAnalysisService procurementAnalysisService;
    private final RecommendationService recommendationService;
    private final SmartBIService smartBIService;
    private final AdaptiveChartGenerator adaptiveChartGenerator;
    private final DynamicAnalysisService dynamicAnalysisService;

    @Autowired
    public SmartBIDashboardController(
            SalesAnalysisService salesAnalysisService,
            DepartmentAnalysisService departmentAnalysisService,
            RegionAnalysisService regionAnalysisService,
            FinanceAnalysisService financeAnalysisService,
            ProductionAnalysisService productionAnalysisService,
            QualityAnalysisService qualityAnalysisService,
            InventoryHealthAnalysisService inventoryHealthAnalysisService,
            ProcurementAnalysisService procurementAnalysisService,
            RecommendationService recommendationService,
            @Autowired(required = false) SmartBIService smartBIService,
            @Autowired(required = false) AdaptiveChartGenerator adaptiveChartGenerator,
            @Autowired(required = false) DynamicAnalysisService dynamicAnalysisService) {
        this.salesAnalysisService = salesAnalysisService;
        this.departmentAnalysisService = departmentAnalysisService;
        this.regionAnalysisService = regionAnalysisService;
        this.financeAnalysisService = financeAnalysisService;
        this.productionAnalysisService = productionAnalysisService;
        this.qualityAnalysisService = qualityAnalysisService;
        this.inventoryHealthAnalysisService = inventoryHealthAnalysisService;
        this.procurementAnalysisService = procurementAnalysisService;
        this.recommendationService = recommendationService;
        this.smartBIService = smartBIService;
        this.adaptiveChartGenerator = adaptiveChartGenerator;
        this.dynamicAnalysisService = dynamicAnalysisService;
    }

    // ==================== Adaptive Chart Generation ====================

    @PostMapping("/generate-adaptive-charts")
    @Operation(summary = "Generate adaptive charts", description = "Auto-evaluate data and generate optimal chart configs")
    public ResponseEntity<ApiResponse<AdaptiveChartResponse>> generateAdaptiveCharts(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @RequestBody @Valid AdaptiveChartRequest request) {

        log.info("Generate adaptive charts: factoryId={}, uploadId={}", factoryId, request.getUploadId());

        if (adaptiveChartGenerator == null) {
            return ResponseEntity.ok(ApiResponse.error("Adaptive chart service not configured"));
        }

        try {
            AdaptiveChartResponse response = adaptiveChartGenerator.generateAdaptive(request.getUploadId(), request);
            String message = response.getCharts() != null && !response.getCharts().isEmpty()
                    ? String.format("Generated %d charts", response.getCharts().size())
                    : "Chart generation complete";
            return ResponseEntity.ok(ApiResponse.success(message, response));
        } catch (Exception e) {
            log.error("Generate adaptive charts failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Chart generation failed: " + e.getMessage()));
        }
    }

    @PostMapping("/generate-chart")
    @Operation(summary = "Quick generate single chart", description = "Generate single chart by specified type")
    public ResponseEntity<ApiResponse<AdaptiveChartResponse.GeneratedChart>> generateSingleChart(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload ID") @RequestParam Long uploadId,
            @Parameter(description = "Chart type: bar/line/pie/radar/treemap/waterfall/combo") @RequestParam String chartType,
            @Parameter(description = "Chart purpose description") @RequestParam(required = false) String purpose) {

        log.info("Quick generate chart: factoryId={}, uploadId={}, chartType={}", factoryId, uploadId, chartType);

        if (adaptiveChartGenerator == null) {
            return ResponseEntity.ok(ApiResponse.error("Adaptive chart service not configured"));
        }

        try {
            AdaptiveChartRequest request = AdaptiveChartRequest.builder()
                    .uploadId(uploadId)
                    .evaluateFirst(false)
                    .maxCharts(1)
                    .fusionEnabled(false)
                    .preferredChartType(chartType)
                    .build();

            AdaptiveChartResponse response = adaptiveChartGenerator.generateAdaptive(uploadId, request);

            if (response.getCharts() != null && !response.getCharts().isEmpty()) {
                return ResponseEntity.ok(ApiResponse.success("Chart generated", response.getCharts().get(0)));
            } else {
                return ResponseEntity.ok(ApiResponse.error("Failed to generate chart"));
            }
        } catch (Exception e) {
            log.error("Quick generate chart failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Chart generation failed: " + e.getMessage()));
        }
    }

    // ==================== Executive Dashboard ====================

    @GetMapping("/dashboard/executive")
    @Operation(summary = "Get executive dashboard", description = "Get comprehensive business analysis dashboard data")
    public ResponseEntity<ApiResponse<DashboardResponse>> getExecutiveDashboard(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Period: today/week/month/quarter/year")
            @RequestParam(defaultValue = "month") String period) {

        log.info("Get executive dashboard: factoryId={}, period={}", factoryId, period);

        try {
            if (smartBIService != null) {
                DashboardResponse dashboard = smartBIService.getExecutiveDashboard(factoryId, period);
                return ResponseEntity.ok(ApiResponse.success(dashboard));
            }

            LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
            DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, dateRange[0], dateRange[1]);
            return ResponseEntity.ok(ApiResponse.success(dashboard));
        } catch (Exception e) {
            log.error("Get executive dashboard failed: {}", e.getMessage(), e);
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
    @Operation(summary = "Get custom date range dashboard", description = "Executive dashboard with specified date range")
    public ResponseEntity<ApiResponse<DashboardResponse>> getExecutiveDashboardCustomRange(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Start date (yyyy-MM-dd)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date (yyyy-MM-dd)")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        log.info("Get custom range dashboard: factoryId={}, startDate={}, endDate={}", factoryId, startDate, endDate);

        try {
            DashboardResponse dashboard = salesAnalysisService.getSalesOverview(factoryId, startDate, endDate);
            return ResponseEntity.ok(ApiResponse.success(dashboard));
        } catch (Exception e) {
            log.error("Get custom range dashboard failed: {}", e.getMessage(), e);
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
    @Operation(summary = "Get data date range", description = "Auto-detect sales data time span in database")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDataDateRange(
            @Parameter(description = "Factory ID") @PathVariable String factoryId) {

        log.info("Get data date range: factoryId={}", factoryId);

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
                    return ResponseEntity.ok(ApiResponse.success("Data date range detected", result));
                }
            }

            result.put("hasData", false);
            result.put("message", "No sales data detected");
            return ResponseEntity.ok(ApiResponse.success("No sales data detected", result));
        } catch (Exception e) {
            log.error("Get data date range failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get data date range failed: " + e.getMessage()));
        }
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Get unified dashboard", description = "Aggregate all analysis dimensions into one-stop overview")
    public ResponseEntity<ApiResponse<UnifiedDashboardResponse>> getUnifiedDashboard(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Period: today/week/month/quarter/year")
            @RequestParam(defaultValue = "month") String period) {

        log.info("Get unified dashboard: factoryId={}, period={}", factoryId, period);
        long startTime = System.currentTimeMillis();

        try {
            if (smartBIService != null) {
                DashboardResponse dashboard = smartBIService.getExecutiveDashboard(factoryId, period);

                LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
                LocalDate startDate = dateRange[0];
                LocalDate endDate = dateRange[1];

                UnifiedDashboardResponse response = UnifiedDashboardResponse.builder()
                        .period(period)
                        .startDate(startDate)
                        .endDate(endDate)
                        .sales(dashboard)
                        .generatedAt(java.time.LocalDateTime.now())
                        .dataVersion(String.valueOf(System.currentTimeMillis()))
                        .build();

                enrichUnifiedDashboard(response, factoryId, startDate, endDate, period);

                long elapsed = System.currentTimeMillis() - startTime;
                log.info("Unified dashboard generated (via SmartBIService): factoryId={}, period={}, elapsed={}ms", factoryId, period, elapsed);
                return ResponseEntity.ok(ApiResponse.success(response));
            }

            // Fallback
            log.info("SmartBIService not available, using fallback aggregation");
            LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
            LocalDate startDate = dateRange[0];
            LocalDate endDate = dateRange[1];

            UnifiedDashboardResponse response = UnifiedDashboardResponse.builder()
                    .period(period)
                    .startDate(startDate)
                    .endDate(endDate)
                    .build();

            try { response.setSales(salesAnalysisService.getSalesOverview(factoryId, startDate, endDate)); }
            catch (Exception e) { log.warn("Get sales data failed: {}", e.getMessage()); }

            enrichUnifiedDashboard(response, factoryId, startDate, endDate, period);

            response.setGeneratedAt(java.time.LocalDateTime.now());
            response.setDataVersion(String.valueOf(System.currentTimeMillis()));

            long elapsed = System.currentTimeMillis() - startTime;
            log.info("Unified dashboard generated (fallback): factoryId={}, period={}, elapsed={}ms", factoryId, period, elapsed);
            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("Get unified dashboard failed: {}", e.getMessage(), e);
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

    // ==================== Lightweight KPI Endpoint ====================

    /**
     * AUDIT-052: Lightweight KPI-only query.
     * Returns only KPI cards without charts or AI insights.
     * Ideal for dashboard loading where only headline numbers are needed.
     */
    @GetMapping("/analysis/dynamic/kpis")
    @Operation(summary = "Get KPIs only", description = "Lightweight endpoint returning only KPI cards, no charts or AI insights")
    public ResponseEntity<ApiResponse<java.util.List<java.util.Map<String, Object>>>> getKPIsOnly(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload ID") @RequestParam Long uploadId) {

        log.info("Get KPIs only: factoryId={}, uploadId={}", factoryId, uploadId);

        if (dynamicAnalysisService == null) {
            return ResponseEntity.ok(ApiResponse.error("Dynamic analysis service not enabled"));
        }

        try {
            java.util.List<java.util.Map<String, Object>> kpis =
                    dynamicAnalysisService.getKPIsOnly(factoryId, uploadId);
            return ResponseEntity.ok(ApiResponse.success(kpis));
        } catch (Exception e) {
            log.error("Get KPIs failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Get KPIs failed: " + e.getMessage()));
        }
    }

    // ==================== Dynamic Data Analysis ====================

    @GetMapping("/analysis/dynamic")
    @Operation(summary = "Dynamic data analysis", description = "Analyze uploaded Excel data, returns KPI cards, charts, and AI insights")
    public ResponseEntity<ApiResponse<DynamicAnalysisService.DashboardResponse>> analyzeDynamicData(
            @Parameter(description = "Factory ID") @PathVariable String factoryId,
            @Parameter(description = "Upload ID") @RequestParam Long uploadId,
            @Parameter(description = "Analysis type: auto/finance/sales/inventory") @RequestParam(defaultValue = "auto") String analysisType) {

        log.info("Dynamic data analysis: factoryId={}, uploadId={}, type={}", factoryId, uploadId, analysisType);

        if (dynamicAnalysisService == null) {
            return ResponseEntity.ok(ApiResponse.error("Dynamic analysis service not enabled, set smartbi.postgres.enabled=true"));
        }

        try {
            DynamicAnalysisService.DashboardResponse result =
                    dynamicAnalysisService.analyzeDynamic(factoryId, uploadId, analysisType);
            if (result == null) {
                return ResponseEntity.ok(ApiResponse.error("Analysis result empty, please verify data was uploaded"));
            }
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Dynamic data analysis failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("Analysis failed: " + e.getMessage()));
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Enrich unified dashboard with additional dimension data
     */
    private void enrichUnifiedDashboard(UnifiedDashboardResponse response, String factoryId,
                                         LocalDate startDate, LocalDate endDate, String period) {
        try { response.setFinance(financeAnalysisService.getFinanceOverview(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get finance data failed: {}", e.getMessage()); }

        try { response.setInventory(inventoryHealthAnalysisService.getInventoryHealth(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get inventory data failed: {}", e.getMessage()); }

        try { response.setProduction(productionAnalysisService.getOEEOverview(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get production data failed: {}", e.getMessage()); }

        try { response.setQuality(qualityAnalysisService.getQualitySummary(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get quality data failed: {}", e.getMessage()); }

        try { response.setProcurement(procurementAnalysisService.getProcurementOverview(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get procurement data failed: {}", e.getMessage()); }

        try { response.setDepartmentRanking(departmentAnalysisService.getDepartmentRanking(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get department ranking failed: {}", e.getMessage()); }

        try { response.setRegionRanking(regionAnalysisService.getRegionRanking(factoryId, startDate, endDate)); }
        catch (Exception e) { log.warn("Get region ranking failed: {}", e.getMessage()); }

        try {
            DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod(period);
            response.setAlerts(recommendationService.generateAllAlerts(factoryId, range));
        } catch (Exception e) { log.warn("Get alerts failed: {}", e.getMessage()); }

        try { response.setRecommendations(recommendationService.generateRecommendations(factoryId, "all")); }
        catch (Exception e) { log.warn("Get recommendations failed: {}", e.getMessage()); }
    }
}
