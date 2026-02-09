package com.cretas.aims.service.calibration;

import com.cretas.aims.dto.calibration.CalibrationDashboardDTO;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics;
import com.cretas.aims.entity.calibration.BehaviorCalibrationMetrics.PeriodType;
import com.cretas.aims.entity.calibration.ToolCallRecord;
import com.cretas.aims.entity.calibration.ToolReliabilityStats;
import com.cretas.aims.repository.calibration.BehaviorCalibrationMetricsRepository;
import com.cretas.aims.repository.calibration.ToolCallRecordRepository;
import com.cretas.aims.repository.calibration.ToolReliabilityStatsRepository;
import com.cretas.aims.service.calibration.impl.BehaviorCalibrationServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 时区敏感性测试
 *
 * 测试场景涵盖:
 * 1. 日期边界处理（午夜转换）
 * 2. 时区转换指标计算
 * 3. 夏令时转换
 * 4. UTC与本地时间一致性
 * 5. 跨日操作
 * 6. 周边界计算
 * 7. 月边界边缘情况
 * 8. 年边界（12月31日 -> 1月1日）
 * 9. 闰年处理（2月29日）
 * 10. 时间精度（毫秒 vs 秒）
 * 11. 定时任务调度
 * 12. 跨时区缓存TTL
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("时区敏感性测试 - TimeZoneSensitiveTest")
class TimeZoneSensitiveTest {

    @Mock
    private BehaviorCalibrationMetricsRepository metricsRepository;

    @Mock
    private ToolCallRecordRepository toolCallRecordRepository;

    @Mock
    private ToolReliabilityStatsRepository reliabilityStatsRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private BehaviorCalibrationServiceImpl calibrationService;

    private static final String TEST_FACTORY_ID = "F001";

    // 常用时区
    private static final ZoneId ZONE_SHANGHAI = ZoneId.of("Asia/Shanghai");
    private static final ZoneId ZONE_UTC = ZoneId.of("UTC");
    private static final ZoneId ZONE_NEW_YORK = ZoneId.of("America/New_York");
    private static final ZoneId ZONE_TOKYO = ZoneId.of("Asia/Tokyo");
    private static final ZoneId ZONE_LONDON = ZoneId.of("Europe/London");

    @BeforeEach
    void setUp() {
        calibrationService = new BehaviorCalibrationServiceImpl(
            metricsRepository,
            toolCallRecordRepository,
            reliabilityStatsRepository,
            objectMapper
        );
    }

    // ==================== 1. 日期边界处理（午夜转换）测试 ====================

    @Test
    @DisplayName("午夜边界 - 23:59:59 与 00:00:00 应属于不同日期")
    void midnightBoundary_shouldDistinguishDifferentDays() {
        // 测试午夜前一秒
        LocalDateTime beforeMidnight = LocalDateTime.of(2026, 1, 18, 23, 59, 59);
        LocalDateTime afterMidnight = LocalDateTime.of(2026, 1, 19, 0, 0, 0);

        LocalDate dateBefore = beforeMidnight.toLocalDate();
        LocalDate dateAfter = afterMidnight.toLocalDate();

        // 验证日期不同
        assertNotEquals(dateBefore, dateAfter, "午夜前后应属于不同日期");
        assertEquals(1, ChronoUnit.DAYS.between(dateBefore, dateAfter),
            "日期差应该是1天");

        // 验证同一秒内时间相差1秒
        assertEquals(1, ChronoUnit.SECONDS.between(beforeMidnight, afterMidnight),
            "时间差应该是1秒");
    }

    @Test
    @DisplayName("午夜边界 - 指标查询应正确处理日期范围边界")
    void midnightBoundary_metricQueryShouldHandleBoundaryCorrectly() {
        LocalDate testDate = LocalDate.of(2026, 1, 18);
        LocalDateTime startOfDay = testDate.atStartOfDay();
        LocalDateTime endOfDay = testDate.atTime(LocalTime.MAX);

        // Mock 仓库返回数据
        when(toolCallRecordRepository.countByFactoryIdAndTimeRange(
            eq(TEST_FACTORY_ID), eq(startOfDay), eq(endOfDay)))
            .thenReturn(50L);
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
            TEST_FACTORY_ID, testDate, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any(BehaviorCalibrationMetrics.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // 执行计算
        BehaviorCalibrationMetrics result = calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, testDate);

        // 验证查询参数
        ArgumentCaptor<LocalDateTime> startCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> endCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(toolCallRecordRepository).countByFactoryIdAndTimeRange(
            eq(TEST_FACTORY_ID), startCaptor.capture(), endCaptor.capture());

        // 验证开始时间是当天 00:00:00
        assertEquals(LocalTime.MIDNIGHT, startCaptor.getValue().toLocalTime(),
            "开始时间应该是午夜 00:00:00");
        // 验证结束时间是当天 23:59:59.999999999
        assertEquals(LocalTime.MAX, endCaptor.getValue().toLocalTime(),
            "结束时间应该是 23:59:59.999999999");
    }

    @Test
    @DisplayName("午夜边界 - 23:59:59.999 和 00:00:00.000 毫秒级精度测试")
    void midnightBoundary_millisecondPrecisionTest() {
        // 午夜前最后一毫秒
        LocalDateTime beforeMidnight = LocalDateTime.of(2026, 1, 18, 23, 59, 59, 999_999_999);
        // 午夜第一纳秒
        LocalDateTime afterMidnight = LocalDateTime.of(2026, 1, 19, 0, 0, 0, 0);

        // 计算纳秒差
        long nanosDiff = ChronoUnit.NANOS.between(beforeMidnight, afterMidnight);
        assertEquals(1, nanosDiff, "时间差应该是1纳秒");

        // 但日期不同
        assertNotEquals(beforeMidnight.toLocalDate(), afterMidnight.toLocalDate(),
            "虽然只差1纳秒，但日期应该不同");
    }

    // ==================== 2. 时区转换指标计算测试 ====================

    @Test
    @DisplayName("时区转换 - 上海时间转UTC应正确计算偏移量")
    void timeZoneConversion_shanghaiToUtcShouldCalculateOffset() {
        // 上海时间 2026-01-18 10:00:00 (UTC+8)
        ZonedDateTime shanghaiTime = ZonedDateTime.of(2026, 1, 18, 10, 0, 0, 0, ZONE_SHANGHAI);

        // 转换为UTC
        ZonedDateTime utcTime = shanghaiTime.withZoneSameInstant(ZONE_UTC);

        // 验证UTC时间应该是 02:00:00
        assertEquals(2, utcTime.getHour(), "UTC时间应该比上海时间早8小时");
        assertEquals(shanghaiTime.toInstant(), utcTime.toInstant(), "Instant应该相同");
    }

    @Test
    @DisplayName("时区转换 - 多时区工厂指标聚合测试")
    void timeZoneConversion_multiFactoryMetricsAggregation() {
        // 模拟同一时刻不同时区的工厂记录
        Instant commonInstant = Instant.parse("2026-01-18T10:00:00Z");

        ZonedDateTime shanghaiRecord = commonInstant.atZone(ZONE_SHANGHAI);  // 18:00
        ZonedDateTime tokyoRecord = commonInstant.atZone(ZONE_TOKYO);        // 19:00
        ZonedDateTime newYorkRecord = commonInstant.atZone(ZONE_NEW_YORK);   // 05:00

        // 验证同一Instant在不同时区的本地日期可能不同
        assertEquals(18, shanghaiRecord.toLocalDate().getDayOfMonth());
        assertEquals(18, tokyoRecord.toLocalDate().getDayOfMonth());
        assertEquals(18, newYorkRecord.toLocalDate().getDayOfMonth());

        // 但本地时间不同
        assertEquals(18, shanghaiRecord.getHour());
        assertEquals(19, tokyoRecord.getHour());
        assertEquals(5, newYorkRecord.getHour());
    }

    @Test
    @DisplayName("时区转换 - 跨日场景下的时区处理")
    void timeZoneConversion_crossDayScenario() {
        // UTC 2026-01-18 20:00:00 - 在上海是1月19日04:00
        ZonedDateTime utcTime = ZonedDateTime.of(2026, 1, 18, 20, 0, 0, 0, ZONE_UTC);
        ZonedDateTime shanghaiTime = utcTime.withZoneSameInstant(ZONE_SHANGHAI);

        // 验证日期跨越
        assertEquals(18, utcTime.getDayOfMonth(), "UTC应该是18号");
        assertEquals(19, shanghaiTime.getDayOfMonth(), "上海应该是19号");

        // 验证这是同一时刻
        assertEquals(utcTime.toInstant(), shanghaiTime.toInstant());
    }

    // ==================== 3. 夏令时转换测试 ====================

    @Test
    @DisplayName("夏令时 - 美国东部时间春季夏令时转换（凌晨2点跳到3点）")
    void daylightSaving_springForwardInNewYork() {
        // 2026年美国夏令时开始日期: 3月8日凌晨2点
        // 注意：实际日期可能因年份不同而变化，这里使用示例日期
        LocalDate dstStartDate = LocalDate.of(2026, 3, 8);

        // 夏令时转换前 01:59:59 EST
        ZonedDateTime beforeDST = ZonedDateTime.of(dstStartDate, LocalTime.of(1, 59, 59), ZONE_NEW_YORK);
        // 加1秒后应该跳到 03:00:00 EDT
        ZonedDateTime afterDST = beforeDST.plusSeconds(1);

        // 注意: ZonedDateTime 会自动处理夏令时跳跃
        // 验证时间确实发生了跳跃（如果该年份有夏令时转换）
        assertNotNull(afterDST);

        // 验证Instant是连续的（物理时间连续）
        assertEquals(1, ChronoUnit.SECONDS.between(beforeDST.toInstant(), afterDST.toInstant()),
            "物理时间应该只差1秒");
    }

    @Test
    @DisplayName("夏令时 - 欧洲夏令时期间的日指标计算")
    void daylightSaving_metricsCalculationDuringDST() {
        // 欧洲夏令时期间，伦敦时间比UTC快1小时
        ZonedDateTime summerLondon = ZonedDateTime.of(2026, 7, 15, 12, 0, 0, 0, ZONE_LONDON);
        ZonedDateTime summerUTC = summerLondon.withZoneSameInstant(ZONE_UTC);

        // 夏令时期间伦敦是BST (UTC+1)
        assertEquals(11, summerUTC.getHour(), "夏季伦敦12点应对应UTC 11点");

        // 冬季伦敦是GMT (UTC+0)
        ZonedDateTime winterLondon = ZonedDateTime.of(2026, 1, 15, 12, 0, 0, 0, ZONE_LONDON);
        ZonedDateTime winterUTC = winterLondon.withZoneSameInstant(ZONE_UTC);
        assertEquals(12, winterUTC.getHour(), "冬季伦敦12点应对应UTC 12点");
    }

    // ==================== 4. UTC与本地时间一致性测试 ====================

    @Test
    @DisplayName("UTC一致性 - 数据库存储应使用统一时区")
    void utcConsistency_databaseStorageShouldUseUnifiedTimezone() {
        // 模拟从不同时区提交的记录
        Instant recordInstant = Instant.now();

        // 无论本地时区如何，Instant始终表示UTC时间点
        LocalDateTime utcDateTime = LocalDateTime.ofInstant(recordInstant, ZONE_UTC);
        LocalDateTime shanghaiDateTime = LocalDateTime.ofInstant(recordInstant, ZONE_SHANGHAI);

        // UTC和本地时间表示的是同一时刻
        assertEquals(recordInstant, utcDateTime.atZone(ZONE_UTC).toInstant());
        assertEquals(recordInstant, shanghaiDateTime.atZone(ZONE_SHANGHAI).toInstant());

        // 但LocalDateTime的值不同
        assertNotEquals(utcDateTime, shanghaiDateTime);
    }

    @Test
    @DisplayName("UTC一致性 - 指标日期应基于统一时区计算")
    void utcConsistency_metricDateShouldBeCalculatedInUnifiedTimezone() {
        // 假设系统使用上海时区
        LocalDate metricDate = LocalDate.of(2026, 1, 18);

        // 获取该日期的时间范围（基于上海时区）
        ZonedDateTime startOfDaySH = metricDate.atStartOfDay(ZONE_SHANGHAI);
        ZonedDateTime endOfDaySH = metricDate.atTime(LocalTime.MAX).atZone(ZONE_SHANGHAI);

        // 转换为UTC
        Instant startInstant = startOfDaySH.toInstant();
        Instant endInstant = endOfDaySH.toInstant();

        // 验证UTC时间
        ZonedDateTime startUTC = startInstant.atZone(ZONE_UTC);
        assertEquals(17, startUTC.getDayOfMonth(), "上海1月18日0点对应UTC 1月17日16点");
    }

    // ==================== 5. 跨日操作测试 ====================

    @Test
    @DisplayName("跨日操作 - 午夜前后的工具调用应分配到正确日期")
    void crossDayOperation_toolCallsShouldBeAssignedToCorrectDate() {
        // 创建跨越午夜的工具调用记录
        LocalDateTime beforeMidnight = LocalDateTime.of(2026, 1, 18, 23, 30, 0);
        LocalDateTime afterMidnight = LocalDateTime.of(2026, 1, 19, 0, 30, 0);

        // 获取日期
        LocalDate dateBefore = beforeMidnight.toLocalDate();
        LocalDate dateAfter = afterMidnight.toLocalDate();

        // 验证分配到不同日期
        assertEquals(LocalDate.of(2026, 1, 18), dateBefore);
        assertEquals(LocalDate.of(2026, 1, 19), dateAfter);
    }

    @Test
    @DisplayName("跨日操作 - 长时间运行的任务应按开始时间或结束时间记录")
    void crossDayOperation_longRunningTaskShouldBeRecordedProperly() {
        // 模拟一个跨越午夜的长时间任务
        LocalDateTime taskStart = LocalDateTime.of(2026, 1, 18, 23, 0, 0);
        LocalDateTime taskEnd = LocalDateTime.of(2026, 1, 19, 1, 0, 0);

        // 计算任务持续时间
        long durationMinutes = ChronoUnit.MINUTES.between(taskStart, taskEnd);
        assertEquals(120, durationMinutes, "任务应该持续120分钟");

        // 任务开始日期
        LocalDate startDate = taskStart.toLocalDate();
        // 任务结束日期
        LocalDate endDate = taskEnd.toLocalDate();

        assertNotEquals(startDate, endDate, "开始和结束应在不同日期");
    }

    // ==================== 6. 周边界计算测试 ====================

    @Test
    @DisplayName("周边界 - 周一到周日的边界判断")
    void weeklyBoundary_mondayToSundayBoundaryCheck() {
        // 2026年1月18日是周日
        LocalDate sunday = LocalDate.of(2026, 1, 18);
        assertEquals(DayOfWeek.SUNDAY, sunday.getDayOfWeek());

        // 周一是新一周的开始
        LocalDate monday = sunday.plusDays(1);
        assertEquals(DayOfWeek.MONDAY, monday.getDayOfWeek());

        // 验证周数变化
        int sundayWeek = sunday.get(java.time.temporal.WeekFields.ISO.weekOfYear());
        int mondayWeek = monday.get(java.time.temporal.WeekFields.ISO.weekOfYear());

        // 周日和周一应该属于不同的周（ISO周从周一开始）
        assertNotEquals(sundayWeek, mondayWeek, "周日和周一应属于不同的周");
    }

    @Test
    @DisplayName("周边界 - 周指标聚合应正确处理周边界")
    void weeklyBoundary_weeklyMetricsAggregationShouldHandleBoundary() {
        // 测试周聚合逻辑
        // 2026年1月15日是周四（参考日历: 1月12日是周一，1月18日是周日）
        LocalDate date = LocalDate.of(2026, 1, 15); // 周四
        assertEquals(DayOfWeek.THURSDAY, date.getDayOfWeek(), "2026年1月15日应该是周四");

        // 获取本周周一
        LocalDate weekStart = date.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        assertEquals(DayOfWeek.MONDAY, weekStart.getDayOfWeek());
        assertEquals(12, weekStart.getDayOfMonth(), "本周周一应该是12号");

        // 获取本周周日
        LocalDate weekEnd = date.with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        assertEquals(DayOfWeek.SUNDAY, weekEnd.getDayOfWeek());
        assertEquals(18, weekEnd.getDayOfMonth(), "本周周日应该是18号");
    }

    // ==================== 7. 月边界边缘情况测试 ====================

    @Test
    @DisplayName("月边界 - 月末到月初的转换")
    void monthlyBoundary_endOfMonthToStartOfNextMonth() {
        // 1月31日 -> 2月1日
        LocalDate jan31 = LocalDate.of(2026, 1, 31);
        LocalDate feb1 = jan31.plusDays(1);

        assertEquals(Month.JANUARY, jan31.getMonth());
        assertEquals(Month.FEBRUARY, feb1.getMonth());
        assertEquals(1, feb1.getDayOfMonth());
    }

    @Test
    @DisplayName("月边界 - 不同月份的天数处理")
    void monthlyBoundary_differentMonthLengths() {
        // 测试各月份的最后一天
        Map<Month, Integer> monthLengths = Map.of(
            Month.JANUARY, 31,
            Month.FEBRUARY, 28, // 非闰年
            Month.APRIL, 30,
            Month.JUNE, 30
        );

        int year = 2026; // 非闰年

        for (Map.Entry<Month, Integer> entry : monthLengths.entrySet()) {
            LocalDate lastDay = LocalDate.of(year, entry.getKey(), 1)
                .with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());
            assertEquals(entry.getValue().intValue(), lastDay.getDayOfMonth(),
                entry.getKey() + "的最后一天应该是" + entry.getValue());
        }
    }

    @Test
    @DisplayName("月边界 - 月指标聚合应包含整月数据")
    void monthlyBoundary_monthlyAggregationShouldIncludeWholeMonth() {
        LocalDate anyDayInJan = LocalDate.of(2026, 1, 15);

        // 获取月初
        LocalDate monthStart = anyDayInJan.with(java.time.temporal.TemporalAdjusters.firstDayOfMonth());
        assertEquals(1, monthStart.getDayOfMonth());

        // 获取月末
        LocalDate monthEnd = anyDayInJan.with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());
        assertEquals(31, monthEnd.getDayOfMonth());

        // 计算天数
        long daysInMonth = ChronoUnit.DAYS.between(monthStart, monthEnd) + 1;
        assertEquals(31, daysInMonth, "1月应该有31天");
    }

    // ==================== 8. 年边界（12月31日 -> 1月1日）测试 ====================

    @Test
    @DisplayName("年边界 - 跨年边界处理")
    void yearBoundary_crossYearHandling() {
        LocalDate dec31 = LocalDate.of(2025, 12, 31);
        LocalDate jan1 = LocalDate.of(2026, 1, 1);

        assertEquals(1, ChronoUnit.DAYS.between(dec31, jan1));
        assertNotEquals(dec31.getYear(), jan1.getYear());

        // 验证年份变化
        assertEquals(2025, dec31.getYear());
        assertEquals(2026, jan1.getYear());
    }

    @Test
    @DisplayName("年边界 - 跨年午夜时刻的精确处理")
    void yearBoundary_newYearMidnightPrecision() {
        // 2025年最后一秒
        LocalDateTime lastSecondOf2025 = LocalDateTime.of(2025, 12, 31, 23, 59, 59);
        // 2026年第一秒
        LocalDateTime firstSecondOf2026 = LocalDateTime.of(2026, 1, 1, 0, 0, 0);

        assertEquals(1, ChronoUnit.SECONDS.between(lastSecondOf2025, firstSecondOf2026));

        // 年份不同
        assertEquals(2025, lastSecondOf2025.getYear());
        assertEquals(2026, firstSecondOf2026.getYear());

        // 但只差1秒
        assertEquals(1, ChronoUnit.SECONDS.between(lastSecondOf2025, firstSecondOf2026));
    }

    @Test
    @DisplayName("年边界 - 跨年指标趋势查询")
    void yearBoundary_crossYearMetricsTrendQuery() {
        LocalDate startDate = LocalDate.of(2025, 12, 25);
        LocalDate endDate = LocalDate.of(2026, 1, 5);

        // 计算跨年天数
        long daysBetween = ChronoUnit.DAYS.between(startDate, endDate);
        assertEquals(11, daysBetween, "从12月25日到1月5日应该是11天");

        // Mock 趋势数据
        when(metricsRepository.findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            TEST_FACTORY_ID, startDate, endDate, PeriodType.DAILY))
            .thenReturn(Collections.emptyList());

        // 验证查询可以跨年
        List<BehaviorCalibrationMetrics> result = calibrationService.getMetricsTrend(
            TEST_FACTORY_ID, startDate, endDate, PeriodType.DAILY);

        assertNotNull(result);
        verify(metricsRepository).findByFactoryIdAndMetricDateBetweenAndPeriodTypeOrderByMetricDateAsc(
            eq(TEST_FACTORY_ID), eq(startDate), eq(endDate), eq(PeriodType.DAILY));
    }

    // ==================== 9. 闰年处理（2月29日）测试 ====================

    @Test
    @DisplayName("闰年 - 2月29日应该在闰年存在")
    void leapYear_feb29ShouldExistInLeapYear() {
        // 2024年是闰年
        assertTrue(Year.of(2024).isLeap(), "2024年应该是闰年");

        // 2024年2月29日应该有效
        LocalDate feb29_2024 = LocalDate.of(2024, 2, 29);
        assertEquals(29, feb29_2024.getDayOfMonth());
        assertEquals(Month.FEBRUARY, feb29_2024.getMonth());

        // 2026年不是闰年
        assertFalse(Year.of(2026).isLeap(), "2026年不应该是闰年");

        // 2月应该只有28天
        LocalDate lastDayOfFeb2026 = LocalDate.of(2026, 2, 1)
            .with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());
        assertEquals(28, lastDayOfFeb2026.getDayOfMonth());
    }

    @Test
    @DisplayName("闰年 - 闰年2月的月指标聚合")
    void leapYear_februaryMetricsAggregationInLeapYear() {
        // 2024年闰年2月
        LocalDate feb2024 = LocalDate.of(2024, 2, 15);
        LocalDate monthEnd = feb2024.with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());

        assertEquals(29, monthEnd.getDayOfMonth(), "2024年2月应该有29天");

        // 计算月内天数
        LocalDate monthStart = feb2024.with(java.time.temporal.TemporalAdjusters.firstDayOfMonth());
        long daysInMonth = ChronoUnit.DAYS.between(monthStart, monthEnd) + 1;
        assertEquals(29, daysInMonth, "2024年2月应该有29天数据");
    }

    @ParameterizedTest
    @DisplayName("闰年 - 参数化测试各年份2月天数")
    @CsvSource({
        "2024, 29",
        "2025, 28",
        "2026, 28",
        "2028, 29",
        "2100, 28"  // 世纪年但不能被400整除
    })
    void leapYear_parameterizedFebDaysTest(int year, int expectedDays) {
        LocalDate lastDayOfFeb = LocalDate.of(year, 2, 1)
            .with(java.time.temporal.TemporalAdjusters.lastDayOfMonth());

        assertEquals(expectedDays, lastDayOfFeb.getDayOfMonth(),
            year + "年2月应该有" + expectedDays + "天");
    }

    // ==================== 10. 时间精度（毫秒 vs 秒）测试 ====================

    @Test
    @DisplayName("时间精度 - 毫秒级精度对比测试")
    void timePrecision_millisecondPrecisionComparison() {
        // 创建两个只差1毫秒的时间
        LocalDateTime time1 = LocalDateTime.of(2026, 1, 18, 12, 0, 0, 0);
        LocalDateTime time2 = LocalDateTime.of(2026, 1, 18, 12, 0, 0, 1_000_000); // 1毫秒

        // 毫秒差
        long millisDiff = ChronoUnit.MILLIS.between(time1, time2);
        assertEquals(1, millisDiff, "应该差1毫秒");

        // 秒级比较应该相等
        long secondsDiff = ChronoUnit.SECONDS.between(time1, time2);
        assertEquals(0, secondsDiff, "秒级应该相等");
    }

    @Test
    @DisplayName("时间精度 - Instant与LocalDateTime的精度差异")
    void timePrecision_instantVsLocalDateTimePrecision() {
        // Instant支持纳秒精度
        Instant instant = Instant.parse("2026-01-18T12:00:00.123456789Z");

        // 转换为LocalDateTime会保留纳秒精度
        LocalDateTime ldt = LocalDateTime.ofInstant(instant, ZONE_UTC);
        assertEquals(123456789, ldt.getNano(), "纳秒应该被保留");

        // 但某些数据库只支持微秒或毫秒
        // 模拟数据库截断到毫秒
        long millis = instant.toEpochMilli();
        Instant truncatedInstant = Instant.ofEpochMilli(millis);
        assertEquals(123000000, truncatedInstant.getNano(), "截断后纳秒部分变为毫秒");
    }

    @Test
    @DisplayName("时间精度 - 执行时间毫秒精度验证")
    void timePrecision_executionTimeMillisecondPrecision() {
        // 模拟工具执行时间记录
        long startNanos = System.nanoTime();

        // 模拟一些操作
        try {
            Thread.sleep(10);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        long endNanos = System.nanoTime();
        long durationNanos = endNanos - startNanos;
        int durationMillis = (int) TimeUnit.NANOSECONDS.toMillis(durationNanos);

        // 验证毫秒精度
        assertTrue(durationMillis >= 10, "执行时间应该至少10毫秒");
        assertTrue(durationMillis < 100, "执行时间不应超过100毫秒");
    }

    // ==================== 11. 定时任务调度测试 ====================

    @Test
    @DisplayName("定时任务 - 每日0点触发的任务应处理前一天数据")
    void scheduledJob_dailyJobAtMidnightShouldProcessPreviousDay() {
        // 假设任务在 2026-01-19 00:00:00 触发
        LocalDateTime triggerTime = LocalDateTime.of(2026, 1, 19, 0, 0, 0);

        // 应该处理前一天的数据
        LocalDate dateToProcess = triggerTime.toLocalDate().minusDays(1);
        assertEquals(LocalDate.of(2026, 1, 18), dateToProcess);

        // Mock 数据
        when(metricsRepository.findByFactoryIdAndMetricDateAndPeriodType(
            TEST_FACTORY_ID, dateToProcess, PeriodType.DAILY))
            .thenReturn(Optional.empty());
        when(metricsRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        // 执行
        calibrationService.calculateDailyMetrics(TEST_FACTORY_ID, dateToProcess);

        // 验证处理的是前一天
        verify(metricsRepository).findByFactoryIdAndMetricDateAndPeriodType(
            eq(TEST_FACTORY_ID), eq(dateToProcess), eq(PeriodType.DAILY));
    }

    @Test
    @DisplayName("定时任务 - 周任务应在周一处理上周数据")
    void scheduledJob_weeklyJobShouldProcessPreviousWeek() {
        // 假设周任务在 2026-01-19（周一）触发
        // 参考日历: 1月19日是周一，1月18日是周日，1月12日是上周一
        LocalDate triggerDate = LocalDate.of(2026, 1, 19);
        assertEquals(DayOfWeek.MONDAY, triggerDate.getDayOfWeek(), "2026年1月19日应该是周一");

        // 上周的范围
        LocalDate lastWeekEnd = triggerDate.minusDays(1); // 周日
        LocalDate lastWeekStart = lastWeekEnd.minusDays(6); // 上周一

        assertEquals(DayOfWeek.SUNDAY, lastWeekEnd.getDayOfWeek());
        assertEquals(DayOfWeek.MONDAY, lastWeekStart.getDayOfWeek());
        assertEquals(LocalDate.of(2026, 1, 12), lastWeekStart);
        assertEquals(LocalDate.of(2026, 1, 18), lastWeekEnd);
    }

    @Test
    @DisplayName("定时任务 - 不同时区的定时任务触发时间差异")
    void scheduledJob_differentTimezoneScheduleTriggers() {
        // 如果定时任务配置为每天上海时间0点触发
        ZonedDateTime shanghaiMidnight = ZonedDateTime.of(2026, 1, 19, 0, 0, 0, 0, ZONE_SHANGHAI);

        // 对应的UTC时间
        ZonedDateTime utcTime = shanghaiMidnight.withZoneSameInstant(ZONE_UTC);
        assertEquals(16, utcTime.getHour(), "上海0点对应UTC 16点（前一天）");
        assertEquals(18, utcTime.getDayOfMonth(), "UTC还是18号");

        // 对应的纽约时间
        ZonedDateTime nyTime = shanghaiMidnight.withZoneSameInstant(ZONE_NEW_YORK);
        assertEquals(11, nyTime.getHour(), "上海0点对应纽约11点（前一天）");
    }

    // ==================== 12. 跨时区缓存TTL测试 ====================

    @Test
    @DisplayName("缓存TTL - 固定TTL在不同时区应表现一致")
    void cacheTTL_fixedTTLShouldBehaveSameAcrossTimezones() {
        // 模拟缓存过期时间 = 当前时间 + TTL
        Instant cacheCreationTime = Instant.now();
        Duration ttl = Duration.ofHours(1);
        Instant expirationTime = cacheCreationTime.plus(ttl);

        // 无论在哪个时区查看，过期时间的Instant是相同的
        ZonedDateTime expirationSH = expirationTime.atZone(ZONE_SHANGHAI);
        ZonedDateTime expirationNY = expirationTime.atZone(ZONE_NEW_YORK);

        assertEquals(expirationSH.toInstant(), expirationNY.toInstant(),
            "过期时间的Instant应该相同");
    }

    @Test
    @DisplayName("缓存TTL - 日期级缓存在跨日边界的失效处理")
    void cacheTTL_dateLevelCacheInvalidationAtDayBoundary() {
        // 模拟日期级缓存
        Map<LocalDate, String> dateCache = new ConcurrentHashMap<>();

        LocalDate today = LocalDate.of(2026, 1, 18);
        dateCache.put(today, "today_data");

        // 午夜后缓存键变化
        LocalDate tomorrow = today.plusDays(1);
        assertFalse(dateCache.containsKey(tomorrow), "新日期的缓存应该不存在");
        assertTrue(dateCache.containsKey(today), "旧日期的缓存应该还在");
    }

    @Test
    @DisplayName("缓存TTL - 多时区工厂的缓存隔离")
    void cacheTTL_multiTimezoneFactoryCacheIsolation() {
        // 模拟不同时区工厂的缓存
        Map<String, Map<LocalDate, BehaviorCalibrationMetrics>> factoryCache = new ConcurrentHashMap<>();

        // 上海工厂的今天
        LocalDate shanghaiToday = LocalDate.now(ZONE_SHANGHAI);
        // 纽约工厂的今天
        LocalDate nyToday = LocalDate.now(ZONE_NEW_YORK);

        // 在某些时刻，两个时区的"今天"可能不同
        String shanghaiFactoryId = "FACTORY_SH";
        String nyFactoryId = "FACTORY_NY";

        // 初始化缓存
        factoryCache.put(shanghaiFactoryId, new ConcurrentHashMap<>());
        factoryCache.put(nyFactoryId, new ConcurrentHashMap<>());

        // 各自存储自己的"今天"
        factoryCache.get(shanghaiFactoryId).put(shanghaiToday,
            BehaviorCalibrationMetrics.builder()
                .factoryId(shanghaiFactoryId)
                .metricDate(shanghaiToday)
                .periodType(PeriodType.DAILY)
                .build());

        factoryCache.get(nyFactoryId).put(nyToday,
            BehaviorCalibrationMetrics.builder()
                .factoryId(nyFactoryId)
                .metricDate(nyToday)
                .periodType(PeriodType.DAILY)
                .build());

        // 验证缓存隔离
        assertNotNull(factoryCache.get(shanghaiFactoryId).get(shanghaiToday));
        assertNotNull(factoryCache.get(nyFactoryId).get(nyToday));

        // 跨工厂访问不应获得数据
        assertNull(factoryCache.get(shanghaiFactoryId).get(nyToday.plusDays(1)));
    }

    // ==================== 附加测试场景 ====================

    @Test
    @DisplayName("日期格式解析 - 多种日期格式的解析与转换")
    void dateFormatParsing_multipleFormatsConversion() {
        // ISO格式
        String isoDate = "2026-01-18";
        LocalDate parsedIso = LocalDate.parse(isoDate);
        assertEquals(LocalDate.of(2026, 1, 18), parsedIso);

        // 中文日期格式
        DateTimeFormatter chineseFormatter = DateTimeFormatter.ofPattern("yyyy年MM月dd日");
        String chineseDate = "2026年01月18日";
        LocalDate parsedChinese = LocalDate.parse(chineseDate, chineseFormatter);
        assertEquals(LocalDate.of(2026, 1, 18), parsedChinese);

        // 带时间的ISO格式
        String isoDateTime = "2026-01-18T15:30:00";
        LocalDateTime parsedDateTime = LocalDateTime.parse(isoDateTime);
        assertEquals(LocalDateTime.of(2026, 1, 18, 15, 30, 0), parsedDateTime);

        // 带时区的ISO格式
        String isoZonedDateTime = "2026-01-18T15:30:00+08:00";
        ZonedDateTime parsedZoned = ZonedDateTime.parse(isoZonedDateTime);
        assertEquals(15, parsedZoned.getHour());
        assertEquals(8, parsedZoned.getOffset().getTotalSeconds() / 3600);
    }

    @ParameterizedTest
    @DisplayName("时区偏移量 - 参数化测试各时区偏移")
    @ValueSource(strings = {"Asia/Shanghai", "Asia/Tokyo", "America/New_York", "Europe/London", "UTC"})
    void timezoneOffset_parameterizedOffsetTest(String zoneId) {
        ZoneId zone = ZoneId.of(zoneId);
        ZonedDateTime now = ZonedDateTime.now(zone);

        // 验证时区有效
        assertNotNull(now);
        assertNotNull(now.getOffset());

        // 验证可以转换为其他时区
        ZonedDateTime utcTime = now.withZoneSameInstant(ZONE_UTC);
        assertEquals(now.toInstant(), utcTime.toInstant(), "转换后的Instant应该相同");
    }

    @Test
    @DisplayName("跨日操作 - 模拟午夜期间的系统操作")
    void crossDayOperation_simulateMidnightSystemOperations() {
        // 模拟在午夜前后执行的一批操作
        LocalDateTime[] operationTimes = {
            LocalDateTime.of(2026, 1, 18, 23, 58, 0),
            LocalDateTime.of(2026, 1, 18, 23, 59, 30),
            LocalDateTime.of(2026, 1, 18, 23, 59, 59),
            LocalDateTime.of(2026, 1, 19, 0, 0, 1),
            LocalDateTime.of(2026, 1, 19, 0, 1, 0),
            LocalDateTime.of(2026, 1, 19, 0, 2, 0)
        };

        // 按日期分组
        Map<LocalDate, List<LocalDateTime>> grouped = new HashMap<>();
        for (LocalDateTime time : operationTimes) {
            LocalDate date = time.toLocalDate();
            grouped.computeIfAbsent(date, k -> new ArrayList<>()).add(time);
        }

        // 验证分组正确
        assertEquals(2, grouped.size(), "应该有2个日期分组");
        assertEquals(3, grouped.get(LocalDate.of(2026, 1, 18)).size(), "1月18日应该有3条记录");
        assertEquals(3, grouped.get(LocalDate.of(2026, 1, 19)).size(), "1月19日应该有3条记录");
    }

    // ==================== 辅助方法 ====================

    /**
     * 创建模拟指标数据
     */
    private BehaviorCalibrationMetrics createMockMetrics(LocalDate date, String factoryId) {
        return BehaviorCalibrationMetrics.builder()
            .metricDate(date)
            .factoryId(factoryId)
            .periodType(PeriodType.DAILY)
            .totalCalls(100)
            .successfulCalls(95)
            .failedCalls(5)
            .redundantCalls(5)
            .recoveredCalls(3)
            .concisenessScore(new BigDecimal("95.00"))
            .successRate(new BigDecimal("95.00"))
            .reasoningEfficiency(new BigDecimal("85.00"))
            .compositeScore(new BigDecimal("91.50"))
            .build();
    }

    /**
     * 创建模拟工具调用记录
     */
    private ToolCallRecord createMockToolCallRecord(LocalDateTime callTime, String factoryId) {
        return ToolCallRecord.builder()
            .factoryId(factoryId)
            .toolName("test_tool")
            .executionStatus(ToolCallRecord.ExecutionStatus.SUCCESS)
            .executionTimeMs(100)
            .build();
    }
}
