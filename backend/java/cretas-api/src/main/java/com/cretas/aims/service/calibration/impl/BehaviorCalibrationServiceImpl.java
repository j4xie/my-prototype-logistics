package com.cretas.aims.service.calibration.impl;

import com.cretas.aims.dto.calibration.CalibrationDashboardDTO;
import com.cretas.aims.dto.calibration.CalibrationDashboardDTO.*;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;
import com.cretas.aims.repository.calibration.BehaviorCalibrationMetricsRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.calibration.ToolReliabilityStatsRepository;
import com.cretas.aims.service.calibration.BehaviorCalibrationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 行为校准服务实现类
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 *
 * 核心指标计算：
 * - 简洁性 = (总调用 - 冗余调用) / 总调用 * 100
 * - 成功率 = 成功调用 / 总调用 * 100
 * - 推理效率 = 基于token消耗（基准1000 tokens/call）
 * - 综合得分 = 简洁性*0.3 + 成功率*0.5 + 效率*0.2
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BehaviorCalibrationServiceImpl implements BehaviorCalibrationService {

    private final BehaviorCalibrationMetricsRepository metricsRepository;
    private final ToolCallRecordRepository toolCallRecordRepository;
    private final ToolReliabilityStatsRepository toolReliabilityStatsRepository;
    private final ObjectMapper objectMapper;

    /**
     * Token消耗基准值（每次调用）
     */
    private static final int BASELINE_TOKENS_PER_CALL = 1000;

    /**
     * 趋势数据默认天数
     */
    private static final int DEFAULT_TREND_DAYS = 30;

    /**
     * 最近调用记录数量
     */
    private static final int RECENT_CALLS_LIMIT = 20;

    /**
     * 工具排名数量限制
     */
    private static final int TOOL_RANKING_LIMIT = 10;

    @Override
    @Transactional
    public BehaviorCalibrationMetrics calculateDailyMetrics(String factoryId, LocalDate date) {
        log.info("开始计算日指标: factoryId={}, date={}", factoryId, date);

        LocalDateTime startTime = date.atStartOfDay();
        LocalDateTime endTime = date.atTime(LocalTime.MAX);

        // 查询统计数据
        Long totalCalls = toolCallRecordRepository.countByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Long successfulCalls = toolCallRecordRepository.countSuccessfulByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Long failedCalls = toolCallRecordRepository.countFailedByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Long redundantCalls = toolCallRecordRepository.countRedundantByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Long recoveredCalls = toolCallRecordRepository.countRecoveredByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Long totalInputTokens = toolCallRecordRepository.sumInputTokensByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Long totalOutputTokens = toolCallRecordRepository.sumOutputTokensByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        Double avgExecutionTime = toolCallRecordRepository.avgExecutionTimeByFactoryIdAndTimeRange(factoryId, startTime, endTime);

        // 获取工具分布统计
        List<Object[]> toolDistribution = toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(
                factoryId, startTime, endTime);
        String toolDistributionJson = convertToJson(toolDistribution);

        // 获取错误分布统计
        List<Object[]> errorDistribution = toolCallRecordRepository.countByStatusAndFactoryIdAndTimeRange(
                factoryId, startTime, endTime);
        String errorDistributionJson = convertToJson(errorDistribution);

        // 查找或创建指标记录
        BehaviorCalibrationMetrics metrics = metricsRepository
                .findByFactoryIdAndMetricDateAndPeriodType(factoryId, date, PeriodType.DAILY)
                .orElseGet(() -> BehaviorCalibrationMetrics.builder()
                        .factoryId(factoryId)
                        .metricDate(date)
                        .periodType(PeriodType.DAILY)
                        .build());

        // 设置统计数据
        metrics.setTotalCalls(totalCalls != null ? totalCalls.intValue() : 0);
        metrics.setSuccessfulCalls(successfulCalls != null ? successfulCalls.intValue() : 0);
        metrics.setFailedCalls(failedCalls != null ? failedCalls.intValue() : 0);
        metrics.setRedundantCalls(redundantCalls != null ? redundantCalls.intValue() : 0);
        metrics.setRecoveredCalls(recoveredCalls != null ? recoveredCalls.intValue() : 0);
        metrics.setTotalInputTokens(totalInputTokens != null ? totalInputTokens : 0L);
        metrics.setTotalOutputTokens(totalOutputTokens != null ? totalOutputTokens : 0L);
        metrics.setAvgExecutionTimeMs(avgExecutionTime != null ? avgExecutionTime.intValue() : null);
        metrics.setToolDistribution(toolDistributionJson);
        metrics.setErrorDistribution(errorDistributionJson);

        // 计算得分
        metrics.calculateScores();

        // 保存指标
        metrics = metricsRepository.save(metrics);

        log.info("日指标计算完成: factoryId={}, date={}, compositeScore={}",
                factoryId, date, metrics.getCompositeScore());

        return metrics;
    }

    @Override
    @Transactional
    public void aggregateMetrics(String factoryId, LocalDate date, PeriodType periodType) {
        if (periodType == PeriodType.DAILY) {
            log.warn("日指标无需聚合，请使用calculateDailyMetrics");
            return;
        }

        log.info("开始聚合指标: factoryId={}, date={}, periodType={}", factoryId, date, periodType);

        LocalDate startDate;
        LocalDate endDate = date;

        if (periodType == PeriodType.WEEKLY) {
            // 获取本周的周一
            startDate = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        } else {
            // 获取本月第一天
            startDate = date.with(TemporalAdjusters.firstDayOfMonth());
        }

        // 获取该周期内的所有日指标
        List<BehaviorCalibrationMetrics> dailyMetrics = metricsRepository
                .findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                        factoryId, startDate, endDate, PeriodType.DAILY);

        if (dailyMetrics.isEmpty()) {
            log.warn("没有找到日指标数据进行聚合: factoryId={}, startDate={}, endDate={}",
                    factoryId, startDate, endDate);
            return;
        }

        // 聚合计算
        int totalCalls = dailyMetrics.stream().mapToInt(m -> m.getTotalCalls() != null ? m.getTotalCalls() : 0).sum();
        int successfulCalls = dailyMetrics.stream().mapToInt(m -> m.getSuccessfulCalls() != null ? m.getSuccessfulCalls() : 0).sum();
        int failedCalls = dailyMetrics.stream().mapToInt(m -> m.getFailedCalls() != null ? m.getFailedCalls() : 0).sum();
        int redundantCalls = dailyMetrics.stream().mapToInt(m -> m.getRedundantCalls() != null ? m.getRedundantCalls() : 0).sum();
        int recoveredCalls = dailyMetrics.stream().mapToInt(m -> m.getRecoveredCalls() != null ? m.getRecoveredCalls() : 0).sum();
        long totalInputTokens = dailyMetrics.stream().mapToLong(m -> m.getTotalInputTokens() != null ? m.getTotalInputTokens() : 0L).sum();
        long totalOutputTokens = dailyMetrics.stream().mapToLong(m -> m.getTotalOutputTokens() != null ? m.getTotalOutputTokens() : 0L).sum();

        // 计算平均执行时间
        OptionalDouble avgExecTime = dailyMetrics.stream()
                .filter(m -> m.getAvgExecutionTimeMs() != null)
                .mapToInt(BehaviorCalibrationMetrics::getAvgExecutionTimeMs)
                .average();

        // 查找或创建聚合指标记录
        BehaviorCalibrationMetrics aggregatedMetrics = metricsRepository
                .findByFactoryIdAndMetricDateAndPeriodType(factoryId, date, periodType)
                .orElseGet(() -> BehaviorCalibrationMetrics.builder()
                        .factoryId(factoryId)
                        .metricDate(date)
                        .periodType(periodType)
                        .build());

        aggregatedMetrics.setTotalCalls(totalCalls);
        aggregatedMetrics.setSuccessfulCalls(successfulCalls);
        aggregatedMetrics.setFailedCalls(failedCalls);
        aggregatedMetrics.setRedundantCalls(redundantCalls);
        aggregatedMetrics.setRecoveredCalls(recoveredCalls);
        aggregatedMetrics.setTotalInputTokens(totalInputTokens);
        aggregatedMetrics.setTotalOutputTokens(totalOutputTokens);
        aggregatedMetrics.setAvgExecutionTimeMs(avgExecTime.isPresent() ? (int) avgExecTime.getAsDouble() : null);

        // 计算得分
        aggregatedMetrics.calculateScores();

        metricsRepository.save(aggregatedMetrics);

        log.info("指标聚合完成: factoryId={}, date={}, periodType={}, compositeScore={}",
                factoryId, date, periodType, aggregatedMetrics.getCompositeScore());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BehaviorCalibrationMetrics> getMetricsTrend(String factoryId, LocalDate startDate,
                                                            LocalDate endDate, PeriodType periodType) {
        log.debug("获取指标趋势: factoryId={}, startDate={}, endDate={}, periodType={}",
                factoryId, startDate, endDate, periodType);

        if (factoryId == null) {
            return metricsRepository.findByFactoryIdIsNullAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                    startDate, endDate, periodType);
        }

        return metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
                factoryId, startDate, endDate, periodType);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ToolReliabilityStats> getToolReliabilityRanking(String factoryId, LocalDate date) {
        log.debug("获取工具可靠性排名: factoryId={}, date={}", factoryId, date);

        if (factoryId == null) {
            return toolReliabilityStatsRepository.findByFactoryIdIsNullAndStatDateOrderBySuccessRateDesc(date);
        }

        return toolReliabilityStatsRepository.findByFactoryIdAndStatDateOrderBySuccessRateDesc(factoryId, date);
    }

    @Override
    @Transactional(readOnly = true)
    public CalibrationDashboardDTO getDashboardData(String factoryId) {
        log.info("获取仪表盘数据: factoryId={}", factoryId);

        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        LocalDate trendStartDate = today.minusDays(DEFAULT_TREND_DAYS);

        // 1. 获取当前指标（今天或最近的一天）
        BehaviorCalibrationMetrics todayMetrics = metricsRepository
                .findByFactoryIdAndMetricDateAndPeriodType(factoryId, today, PeriodType.DAILY)
                .orElseGet(() -> metricsRepository
                        .findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(factoryId, PeriodType.DAILY)
                        .orElse(null));

        // 2. 获取昨天指标（用于对比）
        BehaviorCalibrationMetrics yesterdayMetrics = metricsRepository
                .findByFactoryIdAndMetricDateAndPeriodType(factoryId, yesterday, PeriodType.DAILY)
                .orElse(null);

        // 3. 构建当前指标卡片
        CurrentMetrics currentMetrics = buildCurrentMetrics(todayMetrics, yesterdayMetrics);

        // 4. 获取趋势数据
        List<BehaviorCalibrationMetrics> trendMetrics = getMetricsTrend(
                factoryId, trendStartDate, today, PeriodType.DAILY);
        List<MetricsTrendItem> trendData = convertToTrendItems(trendMetrics);

        // 5. 获取工具可靠性排名
        LocalDate statsDate = todayMetrics != null ? todayMetrics.getMetricDate() : today;
        List<ToolReliabilityStats> reliabilityStats = getToolReliabilityRanking(factoryId, statsDate);
        List<ToolReliabilityItem> toolReliabilityRanking = convertToReliabilityItems(reliabilityStats);

        // 6. 获取最近工具调用
        List<ToolCallRecord> recentCalls = toolCallRecordRepository.findTop20ByFactoryIdOrderByCreatedAtDesc(factoryId);
        List<RecentToolCallItem> recentToolCalls = convertToRecentCallItems(recentCalls);

        // 7. 构建日期范围
        DateRange dateRange = DateRange.builder()
                .startDate(trendStartDate)
                .endDate(today)
                .periodType(PeriodType.DAILY.name())
                .build();

        return CalibrationDashboardDTO.builder()
                .currentMetrics(currentMetrics)
                .trendData(trendData)
                .toolReliabilityRanking(toolReliabilityRanking)
                .recentToolCalls(recentToolCalls)
                .dateRange(dateRange)
                .build();
    }

    @Override
    @Transactional
    public void calculateToolReliabilityStats(String factoryId, LocalDate date) {
        log.info("计算工具可靠性统计: factoryId={}, date={}", factoryId, date);

        LocalDateTime startTime = date.atStartOfDay();
        LocalDateTime endTime = date.atTime(LocalTime.MAX);

        // 获取按工具名分组的统计
        List<Object[]> toolStats = toolCallRecordRepository.countByToolNameAndFactoryIdAndTimeRange(
                factoryId, startTime, endTime);

        for (Object[] stat : toolStats) {
            String toolName = (String) stat[0];
            Long totalCalls = (Long) stat[1];

            // 查询该工具的详细统计
            List<ToolCallRecord> toolRecords = toolCallRecordRepository
                    .findByFactoryIdAndCreatedAtBetween(factoryId, startTime, endTime)
                    .stream()
                    .filter(r -> toolName.equals(r.getToolName()))
                    .collect(Collectors.toList());

            long successfulCalls = toolRecords.stream()
                    .filter(r -> r.getExecutionStatus() == ToolCallRecord.ExecutionStatus.SUCCESS)
                    .count();

            long failedCalls = toolRecords.stream()
                    .filter(r -> r.getExecutionStatus() == ToolCallRecord.ExecutionStatus.FAILED)
                    .count();

            OptionalDouble avgExecTime = toolRecords.stream()
                    .filter(r -> r.getExecutionTimeMs() != null)
                    .mapToInt(ToolCallRecord::getExecutionTimeMs)
                    .average();

            // 统计常见错误
            Map<String, Long> errorCounts = toolRecords.stream()
                    .filter(r -> r.getErrorType() != null)
                    .collect(Collectors.groupingBy(ToolCallRecord::getErrorType, Collectors.counting()));

            String commonErrorsJson = convertToJson(errorCounts);

            // 查找或创建统计记录
            ToolReliabilityStats stats = toolReliabilityStatsRepository
                    .findByFactoryIdAndToolNameAndStatDate(factoryId, toolName, date)
                    .orElseGet(() -> ToolReliabilityStats.builder()
                            .factoryId(factoryId)
                            .toolName(toolName)
                            .statDate(date)
                            .build());

            stats.setTotalCalls(totalCalls.intValue());
            stats.setSuccessfulCalls((int) successfulCalls);
            stats.setFailedCalls((int) failedCalls);
            stats.setAvgExecutionTimeMs(avgExecTime.isPresent() ? (int) avgExecTime.getAsDouble() : null);
            stats.setCommonErrors(commonErrorsJson);
            stats.calculateSuccessRate();

            toolReliabilityStatsRepository.save(stats);
        }

        log.info("工具可靠性统计计算完成: factoryId={}, date={}, toolCount={}",
                factoryId, date, toolStats.size());
    }

    @Override
    @Transactional(readOnly = true)
    public BehaviorCalibrationMetrics getLatestDailyMetrics(String factoryId) {
        return metricsRepository.findFirstByFactoryIdAndPeriodTypeOrderByMetricDateDesc(
                factoryId, PeriodType.DAILY).orElse(null);
    }

    @Override
    @Transactional
    public void calculateAllFactoriesDailyMetrics(LocalDate date) {
        log.info("开始计算所有工厂的日指标: date={}", date);

        // 获取所有有调用记录的工厂ID
        LocalDateTime startTime = date.atStartOfDay();
        LocalDateTime endTime = date.atTime(LocalTime.MAX);

        List<ToolCallRecord> records = toolCallRecordRepository
                .findByFactoryIdAndCreatedAtBetween(null, startTime, endTime);

        Set<String> factoryIds = records.stream()
                .map(ToolCallRecord::getFactoryId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // 计算每个工厂的指标
        for (String factoryId : factoryIds) {
            try {
                calculateDailyMetrics(factoryId, date);
                calculateToolReliabilityStats(factoryId, date);
            } catch (Exception e) {
                log.error("计算工厂日指标失败: factoryId={}, date={}", factoryId, date, e);
            }
        }

        // 计算全平台指标
        try {
            calculateDailyMetrics(null, date);
            calculateToolReliabilityStats(null, date);
        } catch (Exception e) {
            log.error("计算全平台日指标失败: date={}", date, e);
        }

        log.info("所有工厂日指标计算完成: date={}, factoryCount={}", date, factoryIds.size());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ToolReliabilityStats> getLowReliabilityTools(String factoryId, LocalDate date,
                                                              BigDecimal threshold) {
        return toolReliabilityStatsRepository.findLowReliabilityTools(factoryId, date, threshold);
    }

    @Override
    @Transactional(readOnly = true)
    public Double getAverageCompositeScore(String factoryId, LocalDate startDate, LocalDate endDate) {
        return metricsRepository.avgCompositeScoreByFactoryIdAndDateRange(
                factoryId, startDate, endDate, PeriodType.DAILY);
    }

    @Override
    @Transactional(readOnly = true)
    public CalibrationDashboardDTO.CurrentMetrics getRealtimeMetrics(String factoryId) {
        log.info("计算实时指标: factoryId={}", factoryId);

        // 获取今日的所有工具调用记录
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 直接从 tool_call_records 表查询今日数据
        List<ToolCallRecord> todayRecords;
        if (factoryId != null) {
            todayRecords = toolCallRecordRepository.findByFactoryIdAndCreatedAtBetween(
                    factoryId, startOfDay, endOfDay);
        } else {
            todayRecords = toolCallRecordRepository.findByCreatedAtBetween(startOfDay, endOfDay);
        }

        // 计算指标
        int totalCalls = todayRecords.size();
        int successfulCalls = (int) todayRecords.stream()
                .filter(r -> ToolCallRecord.ExecutionStatus.SUCCESS.equals(r.getExecutionStatus()))
                .count();
        int failedCalls = (int) todayRecords.stream()
                .filter(r -> ToolCallRecord.ExecutionStatus.FAILED.equals(r.getExecutionStatus()))
                .count();
        int redundantCalls = (int) todayRecords.stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsRedundant()))
                .count();
        int recoveredCalls = (int) todayRecords.stream()
                .filter(r -> r.getRetryCount() != null && r.getRetryCount() > 0 &&
                        ToolCallRecord.ExecutionStatus.SUCCESS.equals(r.getExecutionStatus()))
                .count();

        // 计算比率
        BigDecimal successRate = totalCalls > 0 ?
                BigDecimal.valueOf(successfulCalls * 100.0 / totalCalls).setScale(1, RoundingMode.HALF_UP) :
                BigDecimal.ZERO;
        BigDecimal concisenessScore = totalCalls > 0 ?
                BigDecimal.valueOf((totalCalls - redundantCalls) * 100.0 / totalCalls).setScale(1, RoundingMode.HALF_UP) :
                BigDecimal.valueOf(100);

        // 计算推理效率 (基于平均执行时间)
        double avgExecutionTime = todayRecords.stream()
                .filter(r -> r.getExecutionTimeMs() != null)
                .mapToLong(ToolCallRecord::getExecutionTimeMs)
                .average()
                .orElse(1000);
        BigDecimal reasoningEfficiency = BigDecimal.valueOf(
                Math.min(100, 1000.0 / Math.max(avgExecutionTime, 1) * 100)
        ).setScale(1, RoundingMode.HALF_UP);

        // 计算综合得分: 简洁性*0.3 + 成功率*0.5 + 效率*0.2
        BigDecimal compositeScore = concisenessScore.multiply(BigDecimal.valueOf(0.3))
                .add(successRate.multiply(BigDecimal.valueOf(0.5)))
                .add(reasoningEfficiency.multiply(BigDecimal.valueOf(0.2)))
                .setScale(1, RoundingMode.HALF_UP);

        log.info("实时指标计算完成: total={}, success={}, failed={}, redundant={}, recovered={}, score={}",
                totalCalls, successfulCalls, failedCalls, redundantCalls, recoveredCalls, compositeScore);

        return CalibrationDashboardDTO.CurrentMetrics.builder()
                .concisenessScore(concisenessScore)
                .successRate(successRate)
                .reasoningEfficiency(reasoningEfficiency)
                .compositeScore(compositeScore)
                .totalCalls(totalCalls)
                .successfulCalls(successfulCalls)
                .failedCalls(failedCalls)
                .redundantCalls(redundantCalls)
                .recoveredCalls(recoveredCalls)
                .metricDate(today)
                .build();
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 构建当前指标卡片数据
     */
    private CurrentMetrics buildCurrentMetrics(BehaviorCalibrationMetrics todayMetrics,
                                                BehaviorCalibrationMetrics yesterdayMetrics) {
        if (todayMetrics == null) {
            return CurrentMetrics.builder()
                    .concisenessScore(BigDecimal.ZERO)
                    .successRate(BigDecimal.ZERO)
                    .reasoningEfficiency(BigDecimal.ZERO)
                    .compositeScore(BigDecimal.ZERO)
                    .totalCalls(0)
                    .successfulCalls(0)
                    .failedCalls(0)
                    .redundantCalls(0)
                    .recoveredCalls(0)
                    .metricDate(LocalDate.now())
                    .build();
        }

        MetricsChange change = null;
        if (yesterdayMetrics != null) {
            change = MetricsChange.builder()
                    .concisenessChange(calculateChange(todayMetrics.getConcisenessScore(),
                            yesterdayMetrics.getConcisenessScore()))
                    .successRateChange(calculateChange(todayMetrics.getSuccessRate(),
                            yesterdayMetrics.getSuccessRate()))
                    .efficiencyChange(calculateChange(todayMetrics.getReasoningEfficiency(),
                            yesterdayMetrics.getReasoningEfficiency()))
                    .compositeScoreChange(calculateChange(todayMetrics.getCompositeScore(),
                            yesterdayMetrics.getCompositeScore()))
                    .build();
        }

        return CurrentMetrics.builder()
                .concisenessScore(todayMetrics.getConcisenessScore())
                .successRate(todayMetrics.getSuccessRate())
                .reasoningEfficiency(todayMetrics.getReasoningEfficiency())
                .compositeScore(todayMetrics.getCompositeScore())
                .totalCalls(todayMetrics.getTotalCalls())
                .successfulCalls(todayMetrics.getSuccessfulCalls())
                .failedCalls(todayMetrics.getFailedCalls())
                .redundantCalls(todayMetrics.getRedundantCalls())
                .recoveredCalls(todayMetrics.getRecoveredCalls())
                .changeFromYesterday(change)
                .metricDate(todayMetrics.getMetricDate())
                .build();
    }

    /**
     * 计算指标变化（百分点）
     */
    private BigDecimal calculateChange(BigDecimal current, BigDecimal previous) {
        if (current == null || previous == null) {
            return BigDecimal.ZERO;
        }
        return current.subtract(previous).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 转换为趋势数据项
     */
    private List<MetricsTrendItem> convertToTrendItems(List<BehaviorCalibrationMetrics> metrics) {
        return metrics.stream()
                .map(m -> MetricsTrendItem.builder()
                        .date(m.getMetricDate())
                        .concisenessScore(m.getConcisenessScore())
                        .successRate(m.getSuccessRate())
                        .reasoningEfficiency(m.getReasoningEfficiency())
                        .compositeScore(m.getCompositeScore())
                        .totalCalls(m.getTotalCalls())
                        .successfulCalls(m.getSuccessfulCalls())
                        .redundantCalls(m.getRedundantCalls())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * 转换为工具可靠性项
     */
    private List<ToolReliabilityItem> convertToReliabilityItems(List<ToolReliabilityStats> stats) {
        List<ToolReliabilityItem> items = new ArrayList<>();
        int rank = 1;

        for (ToolReliabilityStats stat : stats) {
            if (rank > TOOL_RANKING_LIMIT) {
                break;
            }

            List<String> commonErrors = parseCommonErrors(stat.getCommonErrors());

            items.add(ToolReliabilityItem.builder()
                    .rank(rank++)
                    .toolName(stat.getToolName())
                    .totalCalls(stat.getTotalCalls())
                    .successfulCalls(stat.getSuccessfulCalls())
                    .failedCalls(stat.getFailedCalls())
                    .successRate(stat.getSuccessRate())
                    .avgExecutionTimeMs(stat.getAvgExecutionTimeMs())
                    .commonErrors(commonErrors)
                    .build());
        }

        return items;
    }

    /**
     * 转换为最近调用项
     */
    private List<RecentToolCallItem> convertToRecentCallItems(List<ToolCallRecord> records) {
        return records.stream()
                .limit(RECENT_CALLS_LIMIT)
                .map(r -> RecentToolCallItem.builder()
                        .id(r.getId())
                        .toolName(r.getToolName())
                        .intentCode(r.getIntentCode())
                        .executionStatus(r.getExecutionStatus().name())
                        .isRedundant(r.getIsRedundant())
                        .redundantReason(r.getRedundantReason())
                        .executionTimeMs(r.getExecutionTimeMs())
                        .inputTokens(r.getInputTokens())
                        .outputTokens(r.getOutputTokens())
                        .recovered(r.getRecovered())
                        .recoveryStrategy(r.getRecoveryStrategy())
                        .callTime(r.getCreatedAt())
                        .sessionId(r.getSessionId())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * 解析常见错误JSON
     */
    private List<String> parseCommonErrors(String json) {
        if (json == null || json.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            Map<String, Long> errorMap = objectMapper.readValue(json,
                    new TypeReference<Map<String, Long>>() {});
            return new ArrayList<>(errorMap.keySet());
        } catch (JsonProcessingException e) {
            log.warn("解析常见错误JSON失败: {}", json, e);
            return Collections.emptyList();
        }
    }

    /**
     * 转换对象为JSON字符串
     */
    private String convertToJson(Object obj) {
        if (obj == null) {
            return null;
        }

        try {
            if (obj instanceof List) {
                List<?> list = (List<?>) obj;
                if (list.isEmpty()) {
                    return "{}";
                }

                // 如果是Object[]列表，转换为Map
                if (list.get(0) instanceof Object[]) {
                    Map<String, Object> map = new LinkedHashMap<>();
                    for (Object item : list) {
                        Object[] arr = (Object[]) item;
                        if (arr.length >= 2) {
                            map.put(String.valueOf(arr[0]), arr[1]);
                        }
                    }
                    return objectMapper.writeValueAsString(map);
                }
            }

            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("对象转JSON失败", e);
            return "{}";
        }
    }
}
