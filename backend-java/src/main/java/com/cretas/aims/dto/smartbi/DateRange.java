package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 时间范围 DTO
 *
 * 用于表示查询的时间范围，支持多种时间粒度：
 * - 日、周、月、季度、年
 * - 自定义时间段
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DateRange {

    /**
     * 开始日期
     */
    private LocalDate startDate;

    /**
     * 结束日期
     */
    private LocalDate endDate;

    /**
     * 时间粒度
     * DAY, WEEK, MONTH, QUARTER, YEAR
     */
    private String granularity;

    /**
     * 原始时间表达式
     * 如：今天、本周、本月、Q1、2024年
     */
    private String originalExpression;

    /**
     * 是否为相对时间
     * true: 今天、本月等相对表达
     * false: 2024-01-01 等绝对时间
     */
    private boolean relative;

    // ==================== 便捷构造方法 ====================

    /**
     * 创建今天的时间范围
     */
    public static DateRange today() {
        LocalDate today = LocalDate.now();
        return DateRange.builder()
                .startDate(today)
                .endDate(today)
                .granularity("DAY")
                .originalExpression("今天")
                .relative(true)
                .build();
    }

    /**
     * 创建昨天的时间范围
     */
    public static DateRange yesterday() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        return DateRange.builder()
                .startDate(yesterday)
                .endDate(yesterday)
                .granularity("DAY")
                .originalExpression("昨天")
                .relative(true)
                .build();
    }

    /**
     * 创建本周的时间范围
     */
    public static DateRange thisWeek() {
        LocalDate today = LocalDate.now();
        LocalDate startOfWeek = today.minusDays(today.getDayOfWeek().getValue() - 1);
        LocalDate endOfWeek = startOfWeek.plusDays(6);
        return DateRange.builder()
                .startDate(startOfWeek)
                .endDate(endOfWeek)
                .granularity("WEEK")
                .originalExpression("本周")
                .relative(true)
                .build();
    }

    /**
     * 创建上周的时间范围
     */
    public static DateRange lastWeek() {
        LocalDate today = LocalDate.now();
        LocalDate startOfThisWeek = today.minusDays(today.getDayOfWeek().getValue() - 1);
        LocalDate startOfLastWeek = startOfThisWeek.minusWeeks(1);
        LocalDate endOfLastWeek = startOfLastWeek.plusDays(6);
        return DateRange.builder()
                .startDate(startOfLastWeek)
                .endDate(endOfLastWeek)
                .granularity("WEEK")
                .originalExpression("上周")
                .relative(true)
                .build();
    }

    /**
     * 创建本月的时间范围
     */
    public static DateRange thisMonth() {
        LocalDate today = LocalDate.now();
        LocalDate startOfMonth = today.withDayOfMonth(1);
        LocalDate endOfMonth = today.withDayOfMonth(today.lengthOfMonth());
        return DateRange.builder()
                .startDate(startOfMonth)
                .endDate(endOfMonth)
                .granularity("MONTH")
                .originalExpression("本月")
                .relative(true)
                .build();
    }

    /**
     * 创建上月的时间范围
     */
    public static DateRange lastMonth() {
        LocalDate today = LocalDate.now();
        LocalDate lastMonth = today.minusMonths(1);
        LocalDate startOfMonth = lastMonth.withDayOfMonth(1);
        LocalDate endOfMonth = lastMonth.withDayOfMonth(lastMonth.lengthOfMonth());
        return DateRange.builder()
                .startDate(startOfMonth)
                .endDate(endOfMonth)
                .granularity("MONTH")
                .originalExpression("上月")
                .relative(true)
                .build();
    }

    /**
     * 创建本季度的时间范围
     */
    public static DateRange thisQuarter() {
        LocalDate today = LocalDate.now();
        int quarter = (today.getMonthValue() - 1) / 3;
        LocalDate startOfQuarter = LocalDate.of(today.getYear(), quarter * 3 + 1, 1);
        LocalDate endOfQuarter = startOfQuarter.plusMonths(2).withDayOfMonth(
                startOfQuarter.plusMonths(2).lengthOfMonth());
        return DateRange.builder()
                .startDate(startOfQuarter)
                .endDate(endOfQuarter)
                .granularity("QUARTER")
                .originalExpression("本季度")
                .relative(true)
                .build();
    }

    /**
     * 创建指定季度的时间范围
     *
     * @param year 年份
     * @param quarter 季度 (1-4)
     */
    public static DateRange quarter(int year, int quarter) {
        if (quarter < 1 || quarter > 4) {
            throw new IllegalArgumentException("Quarter must be between 1 and 4");
        }
        LocalDate startOfQuarter = LocalDate.of(year, (quarter - 1) * 3 + 1, 1);
        LocalDate endOfQuarter = startOfQuarter.plusMonths(2).withDayOfMonth(
                startOfQuarter.plusMonths(2).lengthOfMonth());
        return DateRange.builder()
                .startDate(startOfQuarter)
                .endDate(endOfQuarter)
                .granularity("QUARTER")
                .originalExpression("Q" + quarter)
                .relative(false)
                .build();
    }

    /**
     * 创建本年的时间范围
     */
    public static DateRange thisYear() {
        LocalDate today = LocalDate.now();
        LocalDate startOfYear = LocalDate.of(today.getYear(), 1, 1);
        LocalDate endOfYear = LocalDate.of(today.getYear(), 12, 31);
        return DateRange.builder()
                .startDate(startOfYear)
                .endDate(endOfYear)
                .granularity("YEAR")
                .originalExpression("今年")
                .relative(true)
                .build();
    }

    /**
     * 创建去年的时间范围
     */
    public static DateRange lastYear() {
        LocalDate today = LocalDate.now();
        int lastYear = today.getYear() - 1;
        LocalDate startOfYear = LocalDate.of(lastYear, 1, 1);
        LocalDate endOfYear = LocalDate.of(lastYear, 12, 31);
        return DateRange.builder()
                .startDate(startOfYear)
                .endDate(endOfYear)
                .granularity("YEAR")
                .originalExpression("去年")
                .relative(true)
                .build();
    }

    /**
     * 创建指定年份的时间范围
     *
     * @param year 年份
     */
    public static DateRange year(int year) {
        LocalDate startOfYear = LocalDate.of(year, 1, 1);
        LocalDate endOfYear = LocalDate.of(year, 12, 31);
        return DateRange.builder()
                .startDate(startOfYear)
                .endDate(endOfYear)
                .granularity("YEAR")
                .originalExpression(year + "年")
                .relative(false)
                .build();
    }

    /**
     * 创建最近N天的时间范围
     *
     * @param days 天数
     */
    public static DateRange lastDays(int days) {
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(days - 1);
        return DateRange.builder()
                .startDate(startDate)
                .endDate(today)
                .granularity("DAY")
                .originalExpression("最近" + days + "天")
                .relative(true)
                .build();
    }

    /**
     * 创建自定义时间范围
     *
     * @param startDate 开始日期
     * @param endDate 结束日期
     */
    public static DateRange custom(LocalDate startDate, LocalDate endDate) {
        return DateRange.builder()
                .startDate(startDate)
                .endDate(endDate)
                .granularity(inferGranularity(startDate, endDate))
                .originalExpression(startDate + " 至 " + endDate)
                .relative(false)
                .build();
    }

    // ==================== 工具方法 ====================

    /**
     * 获取时间范围的天数
     */
    public long getDays() {
        if (startDate == null || endDate == null) {
            return 0;
        }
        return ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }

    /**
     * 判断时间范围是否有效
     */
    public boolean isValid() {
        return startDate != null && endDate != null && !startDate.isAfter(endDate);
    }

    /**
     * 判断指定日期是否在范围内
     */
    public boolean contains(LocalDate date) {
        if (!isValid() || date == null) {
            return false;
        }
        return !date.isBefore(startDate) && !date.isAfter(endDate);
    }

    /**
     * 根据时间跨度推断粒度
     */
    private static String inferGranularity(LocalDate startDate, LocalDate endDate) {
        long days = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        if (days <= 1) {
            return "DAY";
        } else if (days <= 7) {
            return "WEEK";
        } else if (days <= 31) {
            return "MONTH";
        } else if (days <= 93) {
            return "QUARTER";
        } else {
            return "YEAR";
        }
    }
}
