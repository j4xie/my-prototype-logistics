package com.cretas.aims.service.governance;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Tool 健康度监控服务
 *
 * 每日凌晨 3 点自动审计：
 * 1. 30 天内无调用记录的 Tool（僵尸工具）
 * 2. 高失败率 Tool（>10%）
 * 3. 已废弃但仍有调用的 Tool
 * 4. 未标注 domainTag 的 Tool
 *
 * 输出 GovernanceReport 到日志。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ToolHealthMonitor {

    /**
     * 趋势分析和淘汰检测的最低门槛。
     * 全平台总调用量低于此值时，这些功能不启用——避免早期使用量低时产生大量噪音。
     */
    private static final long MIN_CALLS_FOR_TREND_ANALYSIS = 500;

    private final ToolRegistry toolRegistry;
    private final ToolCallRecordRepository toolCallRecordRepository;

    @Autowired
    @Lazy
    private ToolSimilarityService toolSimilarityService;

    @Scheduled(cron = "0 0 3 * * *")
    public void dailyAudit() {
        log.info("========== Tool Health Audit Start ==========");
        try {
            Map<String, Object> report = runAudit(30);
            logReport(report);
        } catch (Exception e) {
            log.error("Tool Health Audit failed", e);
        }
        log.info("========== Tool Health Audit End ==========");
    }

    /**
     * Run audit and return report (also used by governance tools for on-demand reports).
     */
    public Map<String, Object> runAudit(int lookbackDays) {
        Map<String, Object> report = new LinkedHashMap<>();
        LocalDateTime since = LocalDateTime.now().minusDays(lookbackDays);
        LocalDateTime now = LocalDateTime.now();

        // 1. Get all registered tool names
        Set<String> registeredTools = new HashSet<>(toolRegistry.getAllToolNames());
        report.put("totalRegistered", registeredTools.size());

        // 2. Get call records from the lookback period
        List<ToolCallRecord> records = toolCallRecordRepository.findByCreatedAtBetween(since, now);

        // Group by tool name
        Map<String, List<ToolCallRecord>> recordsByTool = records.stream()
                .collect(Collectors.groupingBy(ToolCallRecord::getToolName));

        // 3. Unused tools (registered but 0 calls in lookback period)
        Set<String> calledTools = recordsByTool.keySet();
        Set<String> unusedTools = new HashSet<>(registeredTools);
        unusedTools.removeAll(calledTools);
        report.put("unusedToolCount", unusedTools.size());
        report.put("unusedTools", unusedTools.stream().sorted().collect(Collectors.toList()));

        // 4. High failure rate tools (>10% failure)
        List<Map<String, Object>> highFailureTools = new ArrayList<>();
        for (Map.Entry<String, List<ToolCallRecord>> entry : recordsByTool.entrySet()) {
            List<ToolCallRecord> toolRecords = entry.getValue();
            long total = toolRecords.size();
            long failed = toolRecords.stream()
                    .filter(r -> "FAILED".equals(r.getExecutionStatus()))
                    .count();
            if (total >= 5 && (double) failed / total > 0.10) {
                Map<String, Object> info = new LinkedHashMap<>();
                info.put("toolName", entry.getKey());
                info.put("totalCalls", total);
                info.put("failedCalls", failed);
                info.put("failureRate", String.format("%.1f%%", (double) failed / total * 100));
                highFailureTools.add(info);
            }
        }
        highFailureTools.sort(Comparator.comparingLong(m -> -((Long) m.get("failedCalls"))));
        report.put("highFailureToolCount", highFailureTools.size());
        report.put("highFailureTools", highFailureTools);

        // 5. Deprecated tools still receiving calls
        List<String> deprecatedWithCalls = new ArrayList<>();
        for (ToolExecutor executor : toolRegistry.getAllExecutors()) {
            if (executor.getDeprecationNotice() != null
                    && recordsByTool.containsKey(executor.getToolName())) {
                deprecatedWithCalls.add(executor.getToolName());
            }
        }
        report.put("deprecatedWithCallsCount", deprecatedWithCalls.size());
        report.put("deprecatedWithCalls", deprecatedWithCalls);

        // 6. Governance metadata report from ToolRegistry
        report.put("governanceReport", toolRegistry.getGovernanceReport());

        // 7. Similar tool pairs
        try {
            List<ToolSimilarityService.SimilarToolPair> similarPairs =
                    toolSimilarityService.detectSimilarTools();
            report.put("similarToolPairCount", similarPairs.size());
            report.put("similarToolPairs", similarPairs.stream()
                    .limit(10)
                    .map(p -> Map.of(
                            "toolA", p.getToolA(),
                            "toolB", p.getToolB(),
                            "similarity", p.getCombinedSimilarity(),
                            "recommendation", p.getMergeRecommendation()))
                    .collect(Collectors.toList()));
        } catch (Exception e) {
            report.put("similarToolPairCount", -1);
            log.warn("Similarity detection skipped: {}", e.getMessage());
        }

        // 8-9. Usage trends + retirement candidates (require minimum data maturity)
        long totalCallsInPeriod = records.size();
        report.put("totalCallsInPeriod", totalCallsInPeriod);

        if (totalCallsInPeriod < MIN_CALLS_FOR_TREND_ANALYSIS) {
            report.put("trendAnalysisStatus", "INSUFFICIENT_DATA");
            report.put("trendAnalysisMessage",
                    String.format("总调用量 %d 次 < 门槛 %d 次，趋势分析和淘汰检测暂不启用",
                            totalCallsInPeriod, MIN_CALLS_FOR_TREND_ANALYSIS));
            log.info("⏸️  Trend/retirement analysis skipped: {} calls < {} threshold",
                    totalCallsInPeriod, MIN_CALLS_FOR_TREND_ANALYSIS);
        } else {
            report.put("trendAnalysisStatus", "ACTIVE");

            // 8. Usage trends
            try {
                List<ToolUsageTrend> trends = getUsageTrends(lookbackDays);
                List<ToolUsageTrend> declining = trends.stream()
                        .filter(t -> "DECLINING".equals(t.getTrend()))
                        .collect(Collectors.toList());
                List<ToolUsageTrend> surging = trends.stream()
                        .filter(t -> "SURGING".equals(t.getTrend()))
                        .collect(Collectors.toList());
                report.put("decliningToolCount", declining.size());
                report.put("decliningTools", declining.stream()
                        .map(ToolUsageTrend::getToolName).collect(Collectors.toList()));
                report.put("surgingToolCount", surging.size());
                report.put("surgingTools", surging.stream()
                        .map(ToolUsageTrend::getToolName).collect(Collectors.toList()));
            } catch (Exception e) {
                log.warn("Usage trend analysis skipped: {}", e.getMessage());
            }

            // 9. Candidate retirement: only tools that WERE called historically but stopped recently
            Set<String> retirementCandidates = getStaleTools(90);
            report.put("retirementCandidateCount", retirementCandidates.size());
            report.put("retirementCandidates", retirementCandidates.stream()
                    .sorted().limit(20).collect(Collectors.toList()));
        }

        return report;
    }

    private void logReport(Map<String, Object> report) {
        log.info("📊 Total registered tools: {}", report.get("totalRegistered"));
        log.info("💤 Unused tools (30d): {} — {}", report.get("unusedToolCount"),
                truncateList(report.get("unusedTools"), 20));
        log.info("🔴 High failure rate tools: {}", report.get("highFailureToolCount"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> failures = (List<Map<String, Object>>) report.get("highFailureTools");
        for (Map<String, Object> f : failures) {
            log.warn("   ⚠ {} — {} calls, {} failed ({})",
                    f.get("toolName"), f.get("totalCalls"), f.get("failedCalls"), f.get("failureRate"));
        }

        log.info("⚠️  Deprecated tools with active calls: {}", report.get("deprecatedWithCallsCount"));

        // Similarity pairs
        Object pairCount = report.get("similarToolPairCount");
        if (pairCount != null && !pairCount.equals(-1)) {
            log.info("🔍 Similar tool pairs: {}", pairCount);
        }

        // Trend analysis status
        String trendStatus = (String) report.get("trendAnalysisStatus");
        if ("INSUFFICIENT_DATA".equals(trendStatus)) {
            log.info("⏸️  {}", report.get("trendAnalysisMessage"));
        } else {
            // Usage trends
            Object declCount = report.get("decliningToolCount");
            Object surgCount = report.get("surgingToolCount");
            if (declCount != null) {
                log.info("📉 Declining tools: {} — {}", declCount,
                        truncateList(report.get("decliningTools"), 10));
            }
            if (surgCount != null) {
                log.info("📈 Surging tools: {} — {}", surgCount,
                        truncateList(report.get("surgingTools"), 10));
            }

            // Retirement candidates (stale tools only)
            Object retireCount = report.get("retirementCandidateCount");
            if (retireCount != null) {
                log.info("🗑️  Stale tools (had calls before, 0 in last 90d): {} — {}", retireCount,
                        truncateList(report.get("retirementCandidates"), 10));
            }
        }
    }

    @SuppressWarnings("unchecked")
    private String truncateList(Object list, int max) {
        if (list instanceof List) {
            List<String> items = (List<String>) list;
            if (items.size() <= max) return items.toString();
            return items.subList(0, max).toString() + " ... +" + (items.size() - max) + " more";
        }
        return String.valueOf(list);
    }

    // ==================== Usage Trends ====================

    /**
     * 统计每个 Tool 最近 N 天的调用趋势
     *
     * - DECLINING: 连续 7 天调用量下降 > 50%
     * - SURGING: 连续 3 天调用量上升 > 200%
     * - STABLE: 其他情况
     */
    public List<ToolUsageTrend> getUsageTrends(int lookbackDays) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusDays(lookbackDays);

        List<ToolCallRecord> records = toolCallRecordRepository.findByCreatedAtBetween(since, now);

        // Group by tool name, then by date
        Map<String, Map<LocalDate, Long>> toolDailyCounts = new HashMap<>();
        for (ToolCallRecord record : records) {
            String toolName = record.getToolName();
            LocalDate date = record.getCreatedAt().toLocalDate();
            toolDailyCounts
                    .computeIfAbsent(toolName, k -> new HashMap<>())
                    .merge(date, 1L, Long::sum);
        }

        List<ToolUsageTrend> trends = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (Map.Entry<String, Map<LocalDate, Long>> entry : toolDailyCounts.entrySet()) {
            String toolName = entry.getKey();
            Map<LocalDate, Long> dailyCounts = entry.getValue();

            // Build daily count array for the last N days
            long[] daily = new long[lookbackDays];
            for (int i = 0; i < lookbackDays; i++) {
                LocalDate d = today.minusDays(lookbackDays - 1 - i);
                daily[i] = dailyCounts.getOrDefault(d, 0L);
            }

            long totalCalls = Arrays.stream(daily).sum();
            String trend = detectTrend(daily);

            if (!"STABLE".equals(trend)) {
                trends.add(ToolUsageTrend.builder()
                        .toolName(toolName)
                        .totalCalls(totalCalls)
                        .trend(trend)
                        .lookbackDays(lookbackDays)
                        .build());
            }
        }

        trends.sort(Comparator.comparingLong(ToolUsageTrend::getTotalCalls).reversed());
        return trends;
    }

    private String detectTrend(long[] daily) {
        int len = daily.length;
        if (len < 7) return "STABLE";

        // Check SURGING: last 3 days each > 200% of the average of previous 7 days
        if (len >= 10) {
            long prevSum = 0;
            for (int i = len - 10; i < len - 3; i++) {
                prevSum += daily[i];
            }
            double prevAvg = prevSum / 7.0;
            if (prevAvg > 0) {
                boolean surging = true;
                for (int i = len - 3; i < len; i++) {
                    if (daily[i] < prevAvg * 3.0) {
                        surging = false;
                        break;
                    }
                }
                if (surging) return "SURGING";
            }
        }

        // Check DECLINING: last 7 days average < 50% of previous 7 days average
        if (len >= 14) {
            long recentSum = 0, prevSum = 0;
            for (int i = len - 7; i < len; i++) recentSum += daily[i];
            for (int i = len - 14; i < len - 7; i++) prevSum += daily[i];

            if (prevSum > 0 && (double) recentSum / prevSum < 0.5) {
                return "DECLINING";
            }
        }

        return "STABLE";
    }

    // ==================== Deprecated Tool Cleanup ====================

    /**
     * 找出标记 deprecated 但仍有调用的 Tool
     */
    public List<String> getDeprecatedToolsWithActiveCalls() {
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        List<ToolCallRecord> recentRecords = toolCallRecordRepository.findByCreatedAtBetween(
                since, LocalDateTime.now());
        Set<String> recentlyCalledTools = recentRecords.stream()
                .map(ToolCallRecord::getToolName)
                .collect(Collectors.toSet());

        List<String> result = new ArrayList<>();
        for (ToolExecutor executor : toolRegistry.getAllExecutors()) {
            if (executor.getDeprecationNotice() != null
                    && recentlyCalledTools.contains(executor.getToolName())) {
                result.add(executor.getToolName());
            }
        }
        return result;
    }

    /**
     * 找出"曾经活跃但最近 N 天停用"的 Tool（真正的僵尸工具）。
     *
     * 只返回在 N 天之前有历史调用记录、但最近 N 天内零调用的 Tool。
     * "从未被调用"的 Tool 不会被标记——它们可能只是还没被用到，不是僵尸。
     *
     * @param days 近期窗口天数（默认 90）
     * @return 曾经活跃但已停用的 Tool 名称集合
     */
    public Set<String> getStaleTools(int days) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime recentCutoff = now.minusDays(days);

        // Step 1: 最近 N 天内有调用的 Tool
        List<ToolCallRecord> recentRecords = toolCallRecordRepository.findByCreatedAtBetween(
                recentCutoff, now);
        Set<String> recentlyCalledTools = recentRecords.stream()
                .map(ToolCallRecord::getToolName)
                .collect(Collectors.toSet());

        // Step 2: N 天之前有过调用的 Tool（历史活跃）
        List<ToolCallRecord> historicalRecords = toolCallRecordRepository.findByCreatedAtBetween(
                now.minusYears(2), recentCutoff);
        Set<String> historicallyCalledTools = historicalRecords.stream()
                .map(ToolCallRecord::getToolName)
                .collect(Collectors.toSet());

        // Step 3: 曾经活跃 BUT 最近无调用 = 真正的僵尸
        historicallyCalledTools.removeAll(recentlyCalledTools);

        // Only include tools that are still registered (not already removed)
        Set<String> registeredTools = new HashSet<>(toolRegistry.getAllToolNames());
        historicallyCalledTools.retainAll(registeredTools);

        return historicallyCalledTools;
    }

    // ==================== DTOs ====================

    @Data
    @Builder
    public static class ToolUsageTrend {
        private String toolName;
        private long totalCalls;
        private String trend; // DECLINING, SURGING, STABLE
        private int lookbackDays;
    }
}
