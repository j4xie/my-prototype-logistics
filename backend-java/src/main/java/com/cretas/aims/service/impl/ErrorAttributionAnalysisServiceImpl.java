package com.cretas.aims.service.impl;

import com.cretas.aims.entity.intent.ErrorAttributionStatistics;
import com.cretas.aims.entity.intent.IntentMatchRecord;
import com.cretas.aims.entity.intent.IntentMatchRecord.ErrorAttribution;
import com.cretas.aims.entity.intent.IntentMatchRecord.MatchMethod;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion.SuggestionStatus;
import com.cretas.aims.entity.intent.IntentOptimizationSuggestion.SuggestionType;
import com.cretas.aims.repository.ErrorAttributionStatisticsRepository;
import com.cretas.aims.repository.IntentMatchRecordRepository;
import com.cretas.aims.repository.IntentOptimizationSuggestionRepository;
import com.cretas.aims.service.ErrorAttributionAnalysisService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 错误归因分析服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ErrorAttributionAnalysisServiceImpl implements ErrorAttributionAnalysisService {

    private final IntentMatchRecordRepository matchRecordRepository;
    private final ErrorAttributionStatisticsRepository statisticsRepository;
    private final IntentOptimizationSuggestionRepository suggestionRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.intent.analysis.retention-days:90}")
    private int matchRecordRetentionDays;

    @Value("${cretas.ai.intent.statistics.retention-days:365}")
    private int statisticsRetentionDays;

    @Value("${cretas.ai.intent.suggestion.expiry-days:30}")
    private int suggestionExpiryDays;

    // ==================== 统计聚合 ====================

    @Override
    @Transactional
    public ErrorAttributionStatistics aggregateDailyStatistics(String factoryId, LocalDate date) {
        log.info("Aggregating daily statistics for factory={}, date={}", factoryId, date);

        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(LocalTime.MAX);

        // 查询当天的所有匹配记录
        List<IntentMatchRecord> records = matchRecordRepository
                .findByFactoryIdAndCreatedAtBetween(factoryId, startOfDay, endOfDay);

        if (records.isEmpty()) {
            log.info("No records found for factory={}, date={}", factoryId, date);
            return null;
        }

        // 获取或创建统计记录
        ErrorAttributionStatistics stats = statisticsRepository
                .findByFactoryIdAndStatDate(factoryId, date)
                .orElse(ErrorAttributionStatistics.builder()
                        .factoryId(factoryId)
                        .statDate(date)
                        .build());

        // 聚合基础统计
        stats.setTotalRequests(records.size());
        stats.setMatchedCount((int) records.stream()
                .filter(r -> r.getMatchedIntentCode() != null)
                .count());
        stats.setUnmatchedCount(stats.getTotalRequests() - stats.getMatchedCount());
        stats.setLlmFallbackCount((int) records.stream()
                .filter(IntentMatchRecord::getLlmCalled)
                .count());

        // 聚合信号分布
        stats.setStrongSignalCount((int) records.stream()
                .filter(IntentMatchRecord::isStrongSignal)
                .count());
        stats.setWeakSignalCount(stats.getTotalRequests() - stats.getStrongSignalCount());

        // 聚合确认统计
        stats.setConfirmationRequested((int) records.stream()
                .filter(IntentMatchRecord::isRequiresConfirmation)
                .count());
        stats.setUserConfirmedCount((int) records.stream()
                .filter(r -> Boolean.TRUE.equals(r.getUserConfirmed()))
                .count());
        stats.setUserRejectedCount((int) records.stream()
                .filter(r -> Boolean.FALSE.equals(r.getUserConfirmed()))
                .count());

        // 聚合执行统计
        stats.setExecutedCount((int) records.stream()
                .filter(r -> r.getExecutionStatus() == IntentMatchRecord.ExecutionStatus.EXECUTED)
                .count());
        stats.setFailedCount((int) records.stream()
                .filter(r -> r.getExecutionStatus() == IntentMatchRecord.ExecutionStatus.FAILED)
                .count());
        stats.setCancelledCount((int) records.stream()
                .filter(r -> r.getExecutionStatus() == IntentMatchRecord.ExecutionStatus.CANCELLED)
                .count());

        // 聚合错误归因
        Map<ErrorAttribution, Long> attributionCounts = records.stream()
                .filter(r -> r.getErrorAttribution() != null)
                .collect(Collectors.groupingBy(IntentMatchRecord::getErrorAttribution, Collectors.counting()));

        stats.setRuleMissCount(attributionCounts.getOrDefault(ErrorAttribution.RULE_MISS, 0L).intValue());
        stats.setAmbiguousCount(attributionCounts.getOrDefault(ErrorAttribution.AMBIGUOUS, 0L).intValue());
        stats.setFalsePositiveCount(attributionCounts.getOrDefault(ErrorAttribution.FALSE_POSITIVE, 0L).intValue());
        stats.setUserCancelCount(attributionCounts.getOrDefault(ErrorAttribution.USER_CANCEL, 0L).intValue());
        stats.setSystemErrorCount(attributionCounts.getOrDefault(ErrorAttribution.SYSTEM_ERROR, 0L).intValue());

        // 聚合分类统计 (JSON)
        Map<String, Map<String, Object>> categoryStats = records.stream()
                .filter(r -> r.getMatchedIntentCategory() != null)
                .collect(Collectors.groupingBy(
                        IntentMatchRecord::getMatchedIntentCategory,
                        Collectors.collectingAndThen(Collectors.toList(), list -> {
                            Map<String, Object> stat = new HashMap<>();
                            stat.put("count", list.size());
                            long successCount = list.stream()
                                    .filter(r -> r.getExecutionStatus() == IntentMatchRecord.ExecutionStatus.EXECUTED)
                                    .count();
                            stat.put("successRate", list.isEmpty() ? 0.0 : (double) successCount / list.size());
                            return stat;
                        })));
        try {
            stats.setIntentCategoryStats(objectMapper.writeValueAsString(categoryStats));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize category stats", e);
        }

        // 聚合匹配方法统计 (JSON)
        Map<String, Map<String, Object>> methodStats = records.stream()
                .filter(r -> r.getMatchMethod() != null)
                .collect(Collectors.groupingBy(
                        r -> r.getMatchMethod().name(),
                        Collectors.collectingAndThen(Collectors.toList(), list -> {
                            Map<String, Object> stat = new HashMap<>();
                            stat.put("count", list.size());
                            double avgConfidence = list.stream()
                                    .filter(r -> r.getConfidenceScore() != null)
                                    .mapToDouble(r -> r.getConfidenceScore().doubleValue())
                                    .average()
                                    .orElse(0.0);
                            stat.put("avgConfidence", avgConfidence);
                            return stat;
                        })));
        try {
            stats.setMatchMethodStats(objectMapper.writeValueAsString(methodStats));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize method stats", e);
        }

        // 计算平均置信度
        OptionalDouble avgConfidence = records.stream()
                .filter(r -> r.getConfidenceScore() != null)
                .mapToDouble(r -> r.getConfidenceScore().doubleValue())
                .average();
        if (avgConfidence.isPresent()) {
            stats.setAvgConfidence(BigDecimal.valueOf(avgConfidence.getAsDouble())
                    .setScale(4, RoundingMode.HALF_UP));
        }

        // 置信度分布
        Map<String, Integer> confidenceDistribution = new LinkedHashMap<>();
        confidenceDistribution.put("0.0-0.3", 0);
        confidenceDistribution.put("0.3-0.5", 0);
        confidenceDistribution.put("0.5-0.7", 0);
        confidenceDistribution.put("0.7-0.9", 0);
        confidenceDistribution.put("0.9-1.0", 0);

        for (IntentMatchRecord record : records) {
            if (record.getConfidenceScore() != null) {
                double conf = record.getConfidenceScore().doubleValue();
                if (conf < 0.3) confidenceDistribution.merge("0.0-0.3", 1, Integer::sum);
                else if (conf < 0.5) confidenceDistribution.merge("0.3-0.5", 1, Integer::sum);
                else if (conf < 0.7) confidenceDistribution.merge("0.5-0.7", 1, Integer::sum);
                else if (conf < 0.9) confidenceDistribution.merge("0.7-0.9", 1, Integer::sum);
                else confidenceDistribution.merge("0.9-1.0", 1, Integer::sum);
            }
        }
        try {
            stats.setConfidenceDistribution(objectMapper.writeValueAsString(confidenceDistribution));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize confidence distribution", e);
        }

        ErrorAttributionStatistics saved = statisticsRepository.save(stats);
        log.info("Saved daily statistics: id={}, totalRequests={}, matchedCount={}",
                saved.getId(), saved.getTotalRequests(), saved.getMatchedCount());

        return saved;
    }

    @Override
    @Transactional
    public int aggregateYesterdayStatisticsForAllFactories() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        log.info("Aggregating yesterday's statistics for all factories: {}", yesterday);

        // 获取所有有记录的工厂ID
        @SuppressWarnings("unchecked")
        List<String> factoryIds = entityManager.createQuery(
                "SELECT DISTINCT r.factoryId FROM IntentMatchRecord r " +
                "WHERE DATE(r.createdAt) = :date")
                .setParameter("date", yesterday)
                .getResultList();

        int count = 0;
        for (String factoryId : factoryIds) {
            try {
                aggregateDailyStatistics(factoryId, yesterday);
                count++;
            } catch (Exception e) {
                log.error("Failed to aggregate statistics for factory={}, date={}",
                        factoryId, yesterday, e);
            }
        }

        log.info("Aggregated statistics for {} factories", count);
        return count;
    }

    @Override
    @Transactional
    public List<ErrorAttributionStatistics> reaggregateDateRange(String factoryId,
                                                                   LocalDate startDate,
                                                                   LocalDate endDate) {
        log.info("Re-aggregating date range: factory={}, start={}, end={}",
                factoryId, startDate, endDate);

        List<ErrorAttributionStatistics> results = new ArrayList<>();
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            ErrorAttributionStatistics stats = aggregateDailyStatistics(factoryId, current);
            if (stats != null) {
                results.add(stats);
            }
            current = current.plusDays(1);
        }
        return results;
    }

    // ==================== 趋势分析 ====================

    @Override
    public Map<LocalDate, Double> analyzeMatchRateTrend(String factoryId, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        List<ErrorAttributionStatistics> stats = statisticsRepository
                .findRecentStatistics(factoryId, startDate);

        return stats.stream()
                .collect(Collectors.toMap(
                        ErrorAttributionStatistics::getStatDate,
                        ErrorAttributionStatistics::getMatchSuccessRate,
                        (a, b) -> b,
                        LinkedHashMap::new));
    }

    @Override
    public Map<LocalDate, Integer> analyzeLlmFallbackTrend(String factoryId, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        List<ErrorAttributionStatistics> stats = statisticsRepository
                .findRecentStatistics(factoryId, startDate);

        return stats.stream()
                .collect(Collectors.toMap(
                        ErrorAttributionStatistics::getStatDate,
                        ErrorAttributionStatistics::getLlmFallbackCount,
                        (a, b) -> b,
                        LinkedHashMap::new));
    }

    @Override
    public Map<LocalDate, Map<String, Integer>> analyzeErrorAttributionTrend(String factoryId, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        List<ErrorAttributionStatistics> stats = statisticsRepository
                .findRecentStatistics(factoryId, startDate);

        return stats.stream()
                .collect(Collectors.toMap(
                        ErrorAttributionStatistics::getStatDate,
                        s -> {
                            Map<String, Integer> attribution = new HashMap<>();
                            attribution.put("RULE_MISS", s.getRuleMissCount());
                            attribution.put("AMBIGUOUS", s.getAmbiguousCount());
                            attribution.put("FALSE_POSITIVE", s.getFalsePositiveCount());
                            attribution.put("USER_CANCEL", s.getUserCancelCount());
                            attribution.put("SYSTEM_ERROR", s.getSystemErrorCount());
                            return attribution;
                        },
                        (a, b) -> b,
                        LinkedHashMap::new));
    }

    // ==================== 错误模式识别 ====================

    @Override
    public List<Map<String, Object>> identifyFailurePatterns(String factoryId, int days, int minFrequency) {
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);

        // 查询失败的记录，按用户输入分组
        @SuppressWarnings("unchecked")
        List<Object[]> results = entityManager.createQuery(
                "SELECT r.userInput, COUNT(r), r.matchedIntentCode " +
                "FROM IntentMatchRecord r " +
                "WHERE r.factoryId = :factoryId " +
                "AND r.createdAt >= :startDate " +
                "AND (r.executionStatus = 'FAILED' OR r.userConfirmed = false) " +
                "GROUP BY r.userInput, r.matchedIntentCode " +
                "HAVING COUNT(r) >= :minFrequency " +
                "ORDER BY COUNT(r) DESC")
                .setParameter("factoryId", factoryId)
                .setParameter("startDate", startDate)
                .setParameter("minFrequency", (long) minFrequency)
                .setMaxResults(50)
                .getResultList();

        return results.stream()
                .map(row -> {
                    Map<String, Object> pattern = new HashMap<>();
                    pattern.put("userInput", row[0]);
                    pattern.put("count", row[1]);
                    pattern.put("matchedIntent", row[2]);
                    return pattern;
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> identifyAmbiguousIntents(String factoryId, int days) {
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);

        // 查询低置信度的意图
        @SuppressWarnings("unchecked")
        List<Object[]> results = entityManager.createQuery(
                "SELECT r.matchedIntentCode, AVG(r.confidenceScore), COUNT(r), r.topCandidates " +
                "FROM IntentMatchRecord r " +
                "WHERE r.factoryId = :factoryId " +
                "AND r.createdAt >= :startDate " +
                "AND r.confidenceScore < 0.7 " +
                "AND r.matchedIntentCode IS NOT NULL " +
                "GROUP BY r.matchedIntentCode, r.topCandidates " +
                "HAVING COUNT(r) >= 3 " +
                "ORDER BY AVG(r.confidenceScore) ASC")
                .setParameter("factoryId", factoryId)
                .setParameter("startDate", startDate)
                .setMaxResults(20)
                .getResultList();

        return results.stream()
                .map(row -> {
                    Map<String, Object> ambiguous = new HashMap<>();
                    ambiguous.put("intentCode", row[0]);
                    ambiguous.put("avgConfidence", row[1]);
                    ambiguous.put("count", row[2]);
                    ambiguous.put("conflictingIntents", row[3]);
                    return ambiguous;
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<Map<String, Object>> identifyMissingRulePatterns(String factoryId, int days, int minCount) {
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);

        // 查询未匹配的用户输入
        List<IntentMatchRecord> unmatchedRecords = matchRecordRepository
                .findUnmatchedRecords(factoryId, startDate);

        // 按相似输入分组（简单方案：取前20个字符作为模式）
        Map<String, List<IntentMatchRecord>> patternGroups = unmatchedRecords.stream()
                .collect(Collectors.groupingBy(
                        r -> r.getUserInput().length() > 20
                                ? r.getUserInput().substring(0, 20)
                                : r.getUserInput()));

        return patternGroups.entrySet().stream()
                .filter(e -> e.getValue().size() >= minCount)
                .map(e -> {
                    Map<String, Object> pattern = new HashMap<>();
                    pattern.put("inputPattern", e.getKey());
                    pattern.put("count", e.getValue().size());
                    pattern.put("samples", e.getValue().stream()
                            .map(IntentMatchRecord::getUserInput)
                            .distinct()
                            .limit(5)
                            .collect(Collectors.toList()));
                    // 提取建议关键词（简单方案：提取高频词）
                    pattern.put("suggestedKeywords", extractSuggestedKeywords(e.getValue()));
                    return pattern;
                })
                .sorted((a, b) -> ((Integer) b.get("count")).compareTo((Integer) a.get("count")))
                .limit(20)
                .collect(Collectors.toList());
    }

    private List<String> extractSuggestedKeywords(List<IntentMatchRecord> records) {
        // 简单的关键词提取：分词并统计高频词
        Map<String, Long> wordFreq = records.stream()
                .flatMap(r -> Arrays.stream(r.getUserInput().split("[\\s,，。；;：:]+"))
                        .filter(w -> w.length() >= 2))
                .collect(Collectors.groupingBy(w -> w, Collectors.counting()));

        return wordFreq.entrySet().stream()
                .filter(e -> e.getValue() >= 2)
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    // ==================== 优化建议生成 ====================

    @Override
    @Transactional
    public List<IntentOptimizationSuggestion> generateOptimizationSuggestions(String factoryId, int days) {
        log.info("Generating optimization suggestions for factory={}, days={}", factoryId, days);

        List<IntentOptimizationSuggestion> suggestions = new ArrayList<>();

        // 1. 基于规则缺失生成 ADD_KEYWORD 建议
        List<Map<String, Object>> missingPatterns = identifyMissingRulePatterns(factoryId, days, 3);
        for (Map<String, Object> pattern : missingPatterns) {
            @SuppressWarnings("unchecked")
            List<String> keywords = (List<String>) pattern.get("suggestedKeywords");
            if (keywords != null && !keywords.isEmpty()) {
                IntentOptimizationSuggestion suggestion = IntentOptimizationSuggestion.builder()
                        .factoryId(factoryId)
                        .intentCode("UNKNOWN")  // 需要人工确定目标意图
                        .suggestionType(SuggestionType.ADD_KEYWORD)
                        .suggestionDetail("建议添加关键词: " + String.join(", ", keywords) +
                                "\n基于未匹配模式: " + pattern.get("inputPattern"))
                        .frequency((Integer) pattern.get("count"))
                        .impactScore(BigDecimal.valueOf((Integer) pattern.get("count") * 0.1)
                                .setScale(2, RoundingMode.HALF_UP))
                        .status(SuggestionStatus.PENDING)
                        .expiredAt(LocalDateTime.now().plusDays(suggestionExpiryDays))
                        .build();
                suggestions.add(suggestionRepository.save(suggestion));
            }
        }

        // 2. 基于歧义意图生成 ADJUST_PRIORITY 建议
        List<Map<String, Object>> ambiguousIntents = identifyAmbiguousIntents(factoryId, days);
        for (Map<String, Object> ambiguous : ambiguousIntents) {
            String intentCode = (String) ambiguous.get("intentCode");
            if (intentCode != null) {
                // 检查是否已存在相同建议
                if (!suggestionRepository.existsByIntentCodeAndSuggestionTypeAndStatus(
                        intentCode, SuggestionType.ADJUST_PRIORITY, SuggestionStatus.PENDING)) {
                    IntentOptimizationSuggestion suggestion = IntentOptimizationSuggestion.builder()
                            .factoryId(factoryId)
                            .intentCode(intentCode)
                            .suggestionType(SuggestionType.ADJUST_PRIORITY)
                            .suggestionDetail(String.format(
                                    "意图 '%s' 存在歧义，平均置信度仅 %.2f，建议调整优先级或添加区分性关键词",
                                    intentCode, ambiguous.get("avgConfidence")))
                            .frequency(((Number) ambiguous.get("count")).intValue())
                            .impactScore(BigDecimal.valueOf(0.5)
                                    .setScale(2, RoundingMode.HALF_UP))
                            .status(SuggestionStatus.PENDING)
                            .expiredAt(LocalDateTime.now().plusDays(suggestionExpiryDays))
                            .build();
                    suggestions.add(suggestionRepository.save(suggestion));
                }
            }
        }

        // 3. 基于失败模式生成建议
        List<Map<String, Object>> failurePatterns = identifyFailurePatterns(factoryId, days, 3);
        for (Map<String, Object> pattern : failurePatterns) {
            String matchedIntent = (String) pattern.get("matchedIntent");
            if (matchedIntent != null) {
                // 检查是否已存在相同建议
                if (!suggestionRepository.existsByIntentCodeAndSuggestionTypeAndStatus(
                        matchedIntent, SuggestionType.ADD_KEYWORD, SuggestionStatus.PENDING)) {
                    IntentOptimizationSuggestion suggestion = IntentOptimizationSuggestion.builder()
                            .factoryId(factoryId)
                            .intentCode(matchedIntent)
                            .suggestionType(SuggestionType.ADD_KEYWORD)
                            .suggestionDetail(String.format(
                                    "意图 '%s' 多次匹配失败（%d次），用户输入示例: '%s'，建议检查匹配规则",
                                    matchedIntent, pattern.get("count"), pattern.get("userInput")))
                            .frequency(((Number) pattern.get("count")).intValue())
                            .impactScore(BigDecimal.valueOf(((Number) pattern.get("count")).intValue() * 0.15)
                                    .setScale(2, RoundingMode.HALF_UP))
                            .status(SuggestionStatus.PENDING)
                            .expiredAt(LocalDateTime.now().plusDays(suggestionExpiryDays))
                            .build();
                    suggestions.add(suggestionRepository.save(suggestion));
                }
            }
        }

        log.info("Generated {} optimization suggestions for factory={}", suggestions.size(), factoryId);
        return suggestions;
    }

    @Override
    public Map<String, Object> generateWeeklyReport(String factoryId) {
        log.info("Generating weekly report for factory={}", factoryId);

        LocalDate endDate = LocalDate.now().minusDays(1);
        LocalDate startDate = endDate.minusDays(6);

        Map<String, Object> report = new LinkedHashMap<>();

        // 1. 摘要
        Map<String, Object> summary = new HashMap<>();
        Long totalRequests = statisticsRepository.sumTotalRequests(factoryId, startDate, endDate);
        Double avgMatchRate = statisticsRepository.calculateAverageMatchRate(factoryId, startDate, endDate);
        Long llmFallbackCount = statisticsRepository.sumLlmFallbackCount(factoryId, startDate, endDate);
        Double avgStrongSignalRate = statisticsRepository.calculateAverageStrongSignalRate(factoryId, startDate, endDate);

        summary.put("totalRequests", totalRequests != null ? totalRequests : 0);
        summary.put("avgMatchRate", avgMatchRate != null ? String.format("%.1f%%", avgMatchRate * 100) : "N/A");
        summary.put("llmFallbackCount", llmFallbackCount != null ? llmFallbackCount : 0);
        summary.put("llmFallbackRate", totalRequests != null && totalRequests > 0
                ? String.format("%.1f%%", (llmFallbackCount != null ? llmFallbackCount : 0) * 100.0 / totalRequests)
                : "N/A");
        summary.put("avgStrongSignalRate", avgStrongSignalRate != null
                ? String.format("%.1f%%", avgStrongSignalRate * 100)
                : "N/A");
        report.put("summary", summary);

        // 2. 趋势数据
        Map<String, Object> trends = new HashMap<>();
        trends.put("matchRate", analyzeMatchRateTrend(factoryId, 7));
        trends.put("llmFallback", analyzeLlmFallbackTrend(factoryId, 7));
        trends.put("errorAttribution", analyzeErrorAttributionTrend(factoryId, 7));
        report.put("trends", trends);

        // 3. 错误归因汇总
        List<Object[]> attributionResults = statisticsRepository
                .sumErrorAttributions(factoryId, startDate, endDate);
        if (!attributionResults.isEmpty()) {
            Object[] row = attributionResults.get(0);
            Map<String, Object> errorSummary = new HashMap<>();
            errorSummary.put("ruleMiss", row[0] != null ? row[0] : 0);
            errorSummary.put("ambiguous", row[1] != null ? row[1] : 0);
            errorSummary.put("falsePositive", row[2] != null ? row[2] : 0);
            errorSummary.put("userCancel", row[3] != null ? row[3] : 0);
            errorSummary.put("systemError", row[4] != null ? row[4] : 0);
            report.put("errorSummary", errorSummary);
        }

        // 4. Top 问题
        report.put("topFailurePatterns", identifyFailurePatterns(factoryId, 7, 2));
        report.put("ambiguousIntents", identifyAmbiguousIntents(factoryId, 7));

        // 5. 待处理建议
        long pendingSuggestions = suggestionRepository.countByFactoryIdAndStatus(
                factoryId, SuggestionStatus.PENDING);
        report.put("pendingSuggestions", pendingSuggestions);

        // 6. 报告元数据
        report.put("reportPeriod", Map.of("start", startDate, "end", endDate));
        report.put("generatedAt", LocalDateTime.now());

        return report;
    }

    // ==================== 清理操作 ====================

    @Override
    @Transactional
    public int cleanupOldMatchRecords(int retentionDays) {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(retentionDays);
        int deleted = matchRecordRepository.deleteOldRecords(cutoffDate);
        log.info("Cleaned up {} old match records (retention={} days)", deleted, retentionDays);
        return deleted;
    }

    @Override
    @Transactional
    public int cleanupOldStatistics(int retentionDays) {
        LocalDate cutoffDate = LocalDate.now().minusDays(retentionDays);
        int deleted = statisticsRepository.deleteByStatDateBefore(cutoffDate);
        log.info("Cleaned up {} old statistics records (retention={} days)", deleted, retentionDays);
        return deleted;
    }

    @Override
    @Transactional
    public int markExpiredSuggestions() {
        int marked = suggestionRepository.markExpiredSuggestions(LocalDateTime.now());
        log.info("Marked {} suggestions as expired", marked);
        return marked;
    }
}
