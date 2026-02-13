package com.cretas.aims.service.impl;

import com.cretas.aims.dto.analytics.*;
import com.cretas.aims.repository.ProductionReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductionAnalyticsServiceImpl {

    private final ProductionReportRepository reportRepo;

    // ==================== 生产分析 ====================

    public ProductionDashboardResponse getProductionDashboard(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<Map<String, Object>> dailyTrend = reportRepo.getDailyProductionTrend(factoryId, startDate, endDate);
        List<Map<String, Object>> byProduct = reportRepo.getProductBreakdown(factoryId, startDate, endDate);
        List<Map<String, Object>> byProcess = reportRepo.getProcessBreakdown(factoryId, startDate, endDate);
        Map<String, Object> summary = reportRepo.getProgressSummary(factoryId, startDate, endDate);

        // 计算环比
        long days = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        LocalDate prevEnd = startDate.minusDays(1);
        LocalDate prevStart = prevEnd.minusDays(days - 1);
        Map<String, Object> prevSummary = reportRepo.getProgressSummary(factoryId, prevStart, prevEnd);

        List<KPIItem> kpis = buildProductionKPIs(summary, prevSummary);

        return ProductionDashboardResponse.builder()
                .kpis(kpis)
                .dailyTrend(dailyTrend)
                .byProduct(byProduct)
                .byProcess(byProcess)
                .build();
    }

    public List<Map<String, Object>> getDailyTrend(String factoryId, LocalDate startDate, LocalDate endDate) {
        return reportRepo.getDailyProductionTrend(factoryId, startDate, endDate);
    }

    public List<Map<String, Object>> getByProduct(String factoryId, LocalDate startDate, LocalDate endDate) {
        return reportRepo.getProductBreakdown(factoryId, startDate, endDate);
    }

    public List<Map<String, Object>> getByProcess(String factoryId, LocalDate startDate, LocalDate endDate) {
        return reportRepo.getProcessBreakdown(factoryId, startDate, endDate);
    }

    // ==================== 人效分析 ====================

    public EfficiencyDashboardResponse getEfficiencyDashboard(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<Map<String, Object>> workerRanking = reportRepo.getWorkerEfficiencyRanking(factoryId, startDate, endDate);
        List<Map<String, Object>> dailyTrend = reportRepo.getDailyEfficiencyTrend(factoryId, startDate, endDate);
        List<Map<String, Object>> hoursByProduct = reportRepo.getHoursBreakdownByProduct(factoryId, startDate, endDate);
        List<Map<String, Object>> workerProcessCross = reportRepo.getWorkerProcessCross(factoryId, startDate, endDate);

        Map<String, Object> summary = reportRepo.getProgressSummary(factoryId, startDate, endDate);
        Map<String, Object> hoursSummary = reportRepo.getHoursSummary(factoryId, startDate, endDate);

        // 计算环比
        long days = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        LocalDate prevEnd = startDate.minusDays(1);
        LocalDate prevStart = prevEnd.minusDays(days - 1);
        Map<String, Object> prevSummary = reportRepo.getProgressSummary(factoryId, prevStart, prevEnd);
        Map<String, Object> prevHoursSummary = reportRepo.getHoursSummary(factoryId, prevStart, prevEnd);

        List<KPIItem> kpis = buildEfficiencyKPIs(summary, hoursSummary, prevSummary, prevHoursSummary, workerRanking);

        // 为排名数据添加人效字段
        enrichWorkerRanking(workerRanking);

        return EfficiencyDashboardResponse.builder()
                .kpis(kpis)
                .workerRanking(workerRanking)
                .dailyTrend(enrichDailyEfficiencyTrend(dailyTrend))
                .hoursByProduct(hoursByProduct)
                .workerProcessCross(workerProcessCross)
                .build();
    }

    public List<Map<String, Object>> getWorkerRanking(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<Map<String, Object>> ranking = reportRepo.getWorkerEfficiencyRanking(factoryId, startDate, endDate);
        enrichWorkerRanking(ranking);
        return ranking;
    }

    public List<Map<String, Object>> getEfficiencyTrend(String factoryId, LocalDate startDate, LocalDate endDate) {
        return enrichDailyEfficiencyTrend(reportRepo.getDailyEfficiencyTrend(factoryId, startDate, endDate));
    }

    public List<Map<String, Object>> getHoursByProduct(String factoryId, LocalDate startDate, LocalDate endDate) {
        return reportRepo.getHoursBreakdownByProduct(factoryId, startDate, endDate);
    }

    public List<Map<String, Object>> getWorkerProcessCross(String factoryId, LocalDate startDate, LocalDate endDate) {
        return reportRepo.getWorkerProcessCross(factoryId, startDate, endDate);
    }

    // ==================== 内部方法 ====================

    private List<KPIItem> buildProductionKPIs(Map<String, Object> current, Map<String, Object> previous) {
        double totalOutput = toDouble(current.get("total_output"));
        double totalGood = toDouble(current.get("total_good"));
        double totalDefect = toDouble(current.get("total_defect"));
        long reportCount = toLong(current.get("report_count"));

        double yieldRate = totalOutput > 0 ? (totalGood / totalOutput) * 100 : 0;
        double defectRate = totalOutput > 0 ? (totalDefect / totalOutput) * 100 : 0;

        double prevOutput = toDouble(previous.get("total_output"));
        double prevGood = toDouble(previous.get("total_good"));
        double prevDefect = toDouble(previous.get("total_defect"));
        long prevCount = toLong(previous.get("report_count"));

        double prevYield = prevOutput > 0 ? (prevGood / prevOutput) * 100 : 0;
        double prevDefectRate = prevOutput > 0 ? (prevDefect / prevOutput) * 100 : 0;

        return List.of(
                buildKPI("total_output", "总产出量", totalOutput, "", prevOutput, "purple"),
                buildKPI("yield_rate", "综合良率", round(yieldRate, 1), "%", prevYield, "pink"),
                buildKPI("defect_rate", "综合不良率", round(defectRate, 1), "%", prevDefectRate, "blue"),
                buildKPI("report_count", "报工总数", (double) reportCount, "", (double) prevCount, "green")
        );
    }

    private List<KPIItem> buildEfficiencyKPIs(
            Map<String, Object> progress, Map<String, Object> hours,
            Map<String, Object> prevProgress, Map<String, Object> prevHours,
            List<Map<String, Object>> workerRanking) {

        double totalOutput = toDouble(progress.get("total_output"));
        double totalMinutes = toDouble(hours.get("total_minutes"));
        double totalHours = totalMinutes / 60.0;
        double avgEfficiency = totalHours > 0 ? totalOutput / totalHours : 0;

        // 参与人数 (distinct workers from ranking)
        int workerCount = workerRanking != null ? workerRanking.size() : 0;

        // 平均不良率
        double totalGood = toDouble(progress.get("total_good"));
        double defectRate = totalOutput > 0 ? ((totalOutput - totalGood) / totalOutput) * 100 : 0;

        // 环比
        double prevOutput = toDouble(prevProgress.get("total_output"));
        double prevMinutes = toDouble(prevHours.get("total_minutes"));
        double prevHoursVal = prevMinutes / 60.0;
        double prevEfficiency = prevHoursVal > 0 ? prevOutput / prevHoursVal : 0;
        double prevGood = toDouble(prevProgress.get("total_good"));
        double prevDefectRate = prevOutput > 0 ? ((prevOutput - prevGood) / prevOutput) * 100 : 0;

        return List.of(
                buildKPI("avg_efficiency", "平均人效(产出/时)", round(avgEfficiency, 1), "产出/时", prevEfficiency, "purple"),
                buildKPI("total_hours", "总工时", round(totalHours, 1), "小时", prevHoursVal, "pink"),
                buildKPI("worker_count", "参与人数", (double) workerCount, "人", 0.0, "blue"),
                buildKPI("defect_rate", "平均不良率", round(defectRate, 1), "%", prevDefectRate, "green")
        );
    }

    private KPIItem buildKPI(String key, String label, double value, String unit, double prevValue, String gradient) {
        double change = 0;
        String changeType = "flat";
        if (prevValue > 0) {
            change = round(((value - prevValue) / prevValue) * 100, 1);
            changeType = change > 0 ? "up" : (change < 0 ? "down" : "flat");
        } else if (value > 0) {
            change = 100.0;
            changeType = "up";
        }
        return KPIItem.builder()
                .key(key)
                .label(label)
                .value(value)
                .unit(unit)
                .change(change)
                .changeType(changeType)
                .gradient(gradient)
                .build();
    }

    private void enrichWorkerRanking(List<Map<String, Object>> ranking) {
        if (ranking == null) return;
        for (Map<String, Object> row : ranking) {
            double output = toDouble(row.get("total_output"));
            double minutes = toDouble(row.get("total_minutes"));
            double hours = minutes / 60.0;
            double efficiency = hours > 0 ? round(output / hours, 1) : 0;
            double good = toDouble(row.get("total_good"));
            double yieldRate = output > 0 ? round((good / output) * 100, 1) : 0;
            // Make mutable copy if needed
            row.put("efficiency", efficiency);
            row.put("total_hours", round(hours, 1));
            row.put("yield_rate", yieldRate);
        }
    }

    private List<Map<String, Object>> enrichDailyEfficiencyTrend(List<Map<String, Object>> trend) {
        if (trend == null) return Collections.emptyList();
        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Map<String, Object> row : trend) {
            Map<String, Object> copy = new HashMap<>(row);
            double output = toDouble(row.get("total_output"));
            double minutes = toDouble(row.get("total_minutes"));
            double hours = minutes / 60.0;
            double efficiency = hours > 0 ? round(output / hours, 1) : 0;
            copy.put("efficiency", efficiency);
            copy.put("total_hours", round(hours, 1));
            enriched.add(copy);
        }
        return enriched;
    }

    private double toDouble(Object value) {
        if (value == null) return 0;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private long toLong(Object value) {
        if (value == null) return 0;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private double round(double value, int places) {
        return BigDecimal.valueOf(value).setScale(places, RoundingMode.HALF_UP).doubleValue();
    }
}
