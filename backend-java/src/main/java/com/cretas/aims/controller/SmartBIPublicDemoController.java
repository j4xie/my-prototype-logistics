package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.entity.smartbi.enums.SmartBIIntent;
import com.cretas.aims.service.smartbi.*;
import com.cretas.aims.util.DateRangeUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/public/smart-bi")
@RequiredArgsConstructor
@Tag(name = "SmartBI 公开演示", description = "无需登录的 SmartBI API")
@CrossOrigin(origins = "*")
public class SmartBIPublicDemoController {

    private final SalesAnalysisService salesAnalysisService;
    private final DepartmentAnalysisService departmentAnalysisService;
    private final RegionAnalysisService regionAnalysisService;
    private final FinanceAnalysisService financeAnalysisService;
    private final SmartBIIntentService intentService;
    private final RecommendationService recommendationService;
    private final ForecastService forecastService;

    private static final String DEMO_FACTORY_ID = "F001";

    @PostMapping("/query")
    @Operation(summary = "自然语言查询")
    public ResponseEntity<ApiResponse<NLQueryResponse>> query(@RequestBody NLQueryRequest request) {
        log.info("SmartBI 查询: {}", request.getEffectiveQuery());
        try {
            IntentResult intentResult = intentService.recognizeIntent(request.getEffectiveQuery(), request.getContext());
            DateRange dr = intentService.parseTimeRange(request.getEffectiveQuery());
            LocalDate start = dr != null ? dr.getStartDate() : LocalDate.now().minusDays(30);
            LocalDate end = dr != null ? dr.getEndDate() : LocalDate.now();

            NLQueryResponse response = NLQueryResponse.builder()
                    .intent(intentResult.getIntent() != null ? intentResult.getIntent().name() : "UNKNOWN")
                    .parameters(intentResult.getParameters())
                    .confidence(intentResult.getConfidence())
                    .needsClarification(intentService.needsLLMFallback(intentResult))
                    .build();
            response.setResponseText(executeQuery(intentResult, request));
            response.setFollowUpQuestions(getFollowUps(intentResult));

            // 如果是预测意图，附加 forecast 结构化数据
            if (intentResult.getIntent() == SmartBIIntent.FORECAST) {
                int forecastDays = 7;
                Object daysParam = intentResult.getParameters().get("forecastDays");
                if (daysParam instanceof Number) {
                    forecastDays = ((Number) daysParam).intValue();
                }
                ForecastResult forecast = forecastService.forecastSales(DEMO_FACTORY_ID, start, end, forecastDays);
                response.setForecast(forecast);
            }

            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            log.error("查询失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("查询失败: " + e.getMessage()));
        }
    }

    @PostMapping("/intent-test")
    @Operation(summary = "测试意图识别")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testIntent(@RequestBody Map<String, String> request) {
        String query = request.get("query");
        log.info("意图测试: {}", query);
        try {
            IntentResult result = intentService.recognizeIntent(query);
            Map<String, Object> resp = new HashMap<>();
            resp.put("query", query);
            resp.put("intent", result.getIntent() != null ? result.getIntent().name() : "UNKNOWN");
            resp.put("intentName", result.getIntent() != null ? result.getIntent().getName() : "未知");
            resp.put("category", result.getIntent() != null ? result.getIntent().getCategory() : "UNKNOWN");
            resp.put("confidence", result.getConfidence());
            resp.put("parameters", result.getParameters());
            resp.put("needsLlmFallback", intentService.needsLLMFallback(result));
            List<Map<String, String>> intents = new ArrayList<>();
            for (SmartBIIntent i : intentService.getSupportedIntents()) {
                Map<String, String> info = new HashMap<>();
                info.put("code", i.getCode());
                info.put("name", i.getName());
                info.put("category", i.getCategory());
                intents.add(info);
            }
            resp.put("supportedIntents", intents);
            return ResponseEntity.ok(ApiResponse.success(resp));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("测试失败: " + e.getMessage()));
        }
    }

    @GetMapping("/dashboard/executive")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(@RequestParam(defaultValue = "month") String period) {
        try {
            LocalDate[] range = DateRangeUtils.getDateRangeByPeriod(period);
            return ResponseEntity.ok(ApiResponse.success(salesAnalysisService.getSalesOverview(DEMO_FACTORY_ID, range[0], range[1])));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @GetMapping("/dashboard")
    @Operation(summary = "统一仪表盘", description = "聚合所有分析维度数据")
    public ResponseEntity<ApiResponse<UnifiedDashboardResponse>> getUnifiedDashboard(
            @RequestParam(defaultValue = "month") String period) {
        log.info("获取统一仪表盘: period={}", period);
        try {
            LocalDate[] dateRange = DateRangeUtils.getDateRangeByPeriod(period);
            LocalDate startDate = dateRange[0];
            LocalDate endDate = dateRange[1];

            UnifiedDashboardResponse response = UnifiedDashboardResponse.builder()
                    .period(period)
                    .startDate(startDate)
                    .endDate(endDate)
                    .build();

            // 聚合各维度数据
            try { response.setSales(salesAnalysisService.getSalesOverview(DEMO_FACTORY_ID, startDate, endDate)); } catch (Exception e) { log.warn("销售数据获取失败: {}", e.getMessage()); }
            try { response.setFinance(financeAnalysisService.getFinanceOverview(DEMO_FACTORY_ID, startDate, endDate)); } catch (Exception e) { log.warn("财务数据获取失败: {}", e.getMessage()); }
            try { response.setDepartmentRanking(departmentAnalysisService.getDepartmentRanking(DEMO_FACTORY_ID, startDate, endDate)); } catch (Exception e) { log.warn("部门排名获取失败: {}", e.getMessage()); }
            try { response.setRegionRanking(regionAnalysisService.getRegionRanking(DEMO_FACTORY_ID, startDate, endDate)); } catch (Exception e) { log.warn("区域排名获取失败: {}", e.getMessage()); }
            try {
                DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod(period);
                response.setAlerts(recommendationService.generateAllAlerts(DEMO_FACTORY_ID, range));
            } catch (Exception e) { log.warn("预警获取失败: {}", e.getMessage()); }
            try { response.setRecommendations(recommendationService.generateRecommendations(DEMO_FACTORY_ID, "all")); } catch (Exception e) { log.warn("建议获取失败: {}", e.getMessage()); }

            response.setGeneratedAt(java.time.LocalDateTime.now());
            return ResponseEntity.ok(ApiResponse.success(response));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @GetMapping("/analysis/sales")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSales(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "overview") String dimension) {
        try {
            if (startDate == null) startDate = LocalDate.now().minusDays(30);
            if (endDate == null) endDate = LocalDate.now();
            Map<String, Object> result = new HashMap<>();
            result.put("startDate", startDate);
            result.put("endDate", endDate);
            result.put("dimension", dimension);
            switch (dimension) {
                case "salesperson": result.put("ranking", salesAnalysisService.getSalespersonRanking(DEMO_FACTORY_ID, startDate, endDate)); result.put("chartType", "BAR"); break;
                case "product": result.put("ranking", salesAnalysisService.getProductRanking(DEMO_FACTORY_ID, startDate, endDate)); result.put("chartType", "PIE"); break;
                case "trend": result.put("chart", salesAnalysisService.getSalesTrendChart(DEMO_FACTORY_ID, startDate, endDate, "DAY")); result.put("chartType", "LINE"); break;
                default: result.put("overview", salesAnalysisService.getSalesOverview(DEMO_FACTORY_ID, startDate, endDate)); result.put("chartType", "DASHBOARD");
            }
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @GetMapping("/analysis/department")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDepartment(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            if (startDate == null) startDate = LocalDate.now().minusDays(30);
            if (endDate == null) endDate = LocalDate.now();
            Map<String, Object> result = new HashMap<>();
            result.put("ranking", departmentAnalysisService.getDepartmentRanking(DEMO_FACTORY_ID, startDate, endDate));
            result.put("chartType", "BAR");
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @GetMapping("/analysis/region")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRegion(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            if (startDate == null) startDate = LocalDate.now().minusDays(30);
            if (endDate == null) endDate = LocalDate.now();
            Map<String, Object> result = new HashMap<>();
            result.put("ranking", regionAnalysisService.getRegionRanking(DEMO_FACTORY_ID, startDate, endDate));
            result.put("heatmap", regionAnalysisService.getGeographicHeatmapData(DEMO_FACTORY_ID, startDate, endDate));
            result.put("chartType", "MAP");
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<List<Recommendation>>> getRecommendations(@RequestParam(defaultValue = "all") String type) {
        try {
            return ResponseEntity.ok(ApiResponse.success(recommendationService.generateRecommendations(DEMO_FACTORY_ID, type)));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @GetMapping("/incentive-plan/{targetType}/{targetId}")
    @Operation(summary = "获取激励方案")
    public ResponseEntity<ApiResponse<IncentivePlan>> getIncentivePlan(
            @PathVariable String targetType,
            @PathVariable String targetId) {
        log.info("获取激励方案: targetType={}, targetId={}", targetType, targetId);
        try {
            DateRangeUtils.DateRange range = DateRangeUtils.rangeByPeriod("month");
            IncentivePlan plan;
            switch (targetType.toLowerCase()) {
                case "salesperson":
                    plan = recommendationService.generateSalespersonIncentivePlan(
                        DEMO_FACTORY_ID, targetId, range);
                    break;
                case "department":
                    plan = recommendationService.generateDepartmentIncentivePlan(
                        DEMO_FACTORY_ID, targetId, range);
                    break;
                default:
                    plan = recommendationService.generateIncentivePlan(DEMO_FACTORY_ID, targetType);
            }
            return ResponseEntity.ok(ApiResponse.success(plan));
        } catch (Exception e) {
            log.error("获取激励方案失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(ApiResponse.error("获取失败: " + e.getMessage()));
        }
    }

    @PostMapping("/drill-down")
    public ResponseEntity<ApiResponse<Map<String, Object>>> drillDown(@RequestBody DrillDownRequest req) {
        try {
            LocalDate start = req.getStartDate() != null ? req.getStartDate() : LocalDate.now().minusDays(30);
            LocalDate end = req.getEndDate() != null ? req.getEndDate() : LocalDate.now();
            Map<String, Object> result = new HashMap<>();
            result.put("dimension", req.getDimension());
            result.put("value", req.getValue());
            switch (req.getDimension()) {
                case "region": result.put("data", regionAnalysisService.getProvinceRanking(DEMO_FACTORY_ID, req.getValue(), start, end)); break;
                case "department": result.put("data", departmentAnalysisService.getDepartmentDetail(DEMO_FACTORY_ID, req.getValue(), start, end)); break;
            }
            result.put("hints", Arrays.asList("查看更多详情", "返回上一级"));
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.error("下钻失败: " + e.getMessage()));
        }
    }

    private String executeQuery(IntentResult ir, NLQueryRequest req) {
        if (ir.getIntent() == null) return "无法理解您的问题。请尝试：本月销售额是多少？";
        DateRange dr = intentService.parseTimeRange(req.getEffectiveQuery());
        LocalDate start = dr != null ? dr.getStartDate() : LocalDate.now().minusDays(30);
        LocalDate end = dr != null ? dr.getEndDate() : LocalDate.now();
        switch (ir.getIntent()) {
            case QUERY_SALES_OVERVIEW: return genSalesResp(start, end);
            case QUERY_SALES_RANKING: return genRankingResp(start, end);
            case QUERY_DEPARTMENT_PERFORMANCE: return genDeptResp(start, end);
            case QUERY_REGION_ANALYSIS: return genRegionResp(start, end);
            case FORECAST: return genForecastResp(start, end, ir);
            default: return "查询完成。";
        }
    }

    private String genForecastResp(LocalDate start, LocalDate end, IntentResult ir) {
        int forecastDays = 7;
        Object daysParam = ir.getParameters().get("forecastDays");
        if (daysParam instanceof Number) {
            forecastDays = ((Number) daysParam).intValue();
        }
        ForecastResult result = forecastService.forecastSales(DEMO_FACTORY_ID, start, end, forecastDays);
        if (result != null && result.getForecastPoints() != null && !result.getForecastPoints().isEmpty()) {
            StringBuilder sb = new StringBuilder("销售预测：\n");
            sb.append("- 算法: ").append(result.getAlgorithm() != null ? result.getAlgorithm().getDisplayName() : "自动选择").append("\n");
            sb.append("- 置信度: ").append(result.getConfidence()).append("%\n");
            sb.append("- 趋势: ").append(result.getTrend() != null ? result.getTrend() : "稳定").append("\n");
            // 返回预测点（非历史数据）
            int count = 0;
            for (ForecastPoint p : result.getForecastPoints()) {
                if (!Boolean.TRUE.equals(p.getIsHistorical()) && count < 5) {
                    sb.append("- ").append(p.getDate()).append(": ").append(String.format("%,.2f", p.getValue())).append("元\n");
                    count++;
                }
            }
            return sb.toString();
        }
        return "预测数据生成中...";
    }

    private String genSalesResp(LocalDate s, LocalDate e) {
        DashboardResponse d = salesAnalysisService.getSalesOverview(DEMO_FACTORY_ID, s, e);
        if (d != null && d.getKpiCards() != null) {
            StringBuilder sb = new StringBuilder("销售情况：\n");
            for (KPICard k : d.getKpiCards()) {
                if (k.getRawValue() != null) sb.append("- ").append(k.getTitle()).append(": ").append(k.getRawValue()).append("\n");
            }
            return sb.toString();
        }
        return "已获取数据。";
    }

    private String genRankingResp(LocalDate s, LocalDate e) {
        List<RankingItem> r = salesAnalysisService.getSalespersonRanking(DEMO_FACTORY_ID, s, e);
        if (r != null && !r.isEmpty()) {
            StringBuilder sb = new StringBuilder("销售排名：\n");
            for (int i = 0; i < Math.min(5, r.size()); i++) {
                sb.append(i+1).append(". ").append(r.get(i).getName()).append(": ").append(r.get(i).getValue()).append("元\n");
            }
            return sb.toString();
        }
        return "暂无数据。";
    }

    private String genDeptResp(LocalDate s, LocalDate e) {
        List<RankingItem> r = departmentAnalysisService.getDepartmentRanking(DEMO_FACTORY_ID, s, e);
        if (r != null && !r.isEmpty()) {
            StringBuilder sb = new StringBuilder("部门业绩：\n");
            for (int i = 0; i < r.size(); i++) {
                sb.append(i+1).append(". ").append(r.get(i).getName()).append(": ").append(r.get(i).getValue()).append("元\n");
            }
            return sb.toString();
        }
        return "暂无数据。";
    }

    private String genRegionResp(LocalDate s, LocalDate e) {
        List<RankingItem> r = regionAnalysisService.getRegionRanking(DEMO_FACTORY_ID, s, e);
        if (r != null && !r.isEmpty()) {
            StringBuilder sb = new StringBuilder("区域销售：\n");
            for (int i = 0; i < r.size(); i++) {
                sb.append(i+1).append(". ").append(r.get(i).getName()).append(": ").append(r.get(i).getValue()).append("元\n");
            }
            return sb.toString();
        }
        return "暂无数据。";
    }

    private List<String> getFollowUps(IntentResult ir) {
        if (ir.getIntent() == null) return Arrays.asList("本月销售额是多少？", "哪个部门业绩最好？");
        String c = ir.getIntent().getCode();
        if (c.contains("sales")) return Arrays.asList("销售员排名", "销售趋势", "产品销量");
        if (c.contains("dept")) return Arrays.asList("部门完成率", "人均产出");
        if (c.contains("region")) return Arrays.asList("省份详情", "区域增长");
        return Arrays.asList("查看更多", "导出报表");
    }

    @Data
    public static class DrillDownRequest {
        private String dimension;
        private String value;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate startDate;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate endDate;
    }
}
