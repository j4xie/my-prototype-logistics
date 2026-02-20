package com.cretas.aims.util;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.function.Consumer;

/**
 * 日期范围工具类
 *
 * 提供日期范围计算、LocalDateTime 转换等通用方法，
 * 减少 ReportServiceImpl 中的重复代码。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
public final class DateRangeUtils {

    private DateRangeUtils() {
        // 工具类禁止实例化
    }

    // ==================== LocalDateTime 转换 ====================

    /**
     * 获取日期的开始时间 (00:00:00)
     *
     * @param date 日期
     * @return 该日期的开始时间
     */
    public static LocalDateTime startOfDay(LocalDate date) {
        return date != null ? date.atStartOfDay() : null;
    }

    /**
     * 获取日期的结束时间 (23:59:59)
     *
     * @param date 日期
     * @return 该日期的结束时间
     */
    public static LocalDateTime endOfDay(LocalDate date) {
        return date != null ? date.atTime(23, 59, 59) : null;
    }

    /**
     * 获取日期的结束时间（精确到下一天开始，适用于 < 比较）
     *
     * @param date 日期
     * @return 下一天的开始时间
     */
    public static LocalDateTime endOfDayExclusive(LocalDate date) {
        return date != null ? date.plusDays(1).atStartOfDay() : null;
    }

    /**
     * 转换日期范围为 LocalDateTime 对
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return [startDateTime, endDateTime]
     */
    public static LocalDateTime[] toDateTimeRange(LocalDate startDate, LocalDate endDate) {
        return new LocalDateTime[]{
            startOfDay(startDate),
            endOfDay(endDate)
        };
    }

    /**
     * 转换日期范围为 LocalDateTime 对（结束时间为排他性）
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return [startDateTime, endDateTimeExclusive]
     */
    public static LocalDateTime[] toDateTimeRangeExclusive(LocalDate startDate, LocalDate endDate) {
        return new LocalDateTime[]{
            startOfDay(startDate),
            endOfDayExclusive(endDate)
        };
    }

    // ==================== 日期范围计算 ====================

    /**
     * 获取本周的开始日期（周一）
     *
     * @param date 参考日期
     * @return 本周一
     */
    public static LocalDate getWeekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * 获取本周的结束日期（周日）
     *
     * @param date 参考日期
     * @return 本周日
     */
    public static LocalDate getWeekEnd(LocalDate date) {
        return date.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
    }

    /**
     * 获取本月的开始日期
     *
     * @param date 参考日期
     * @return 本月第一天
     */
    public static LocalDate getMonthStart(LocalDate date) {
        return date.withDayOfMonth(1);
    }

    /**
     * 获取本月的结束日期
     *
     * @param date 参考日期
     * @return 本月最后一天
     */
    public static LocalDate getMonthEnd(LocalDate date) {
        return date.with(TemporalAdjusters.lastDayOfMonth());
    }

    /**
     * 获取本季度的开始日期
     *
     * @param date 参考日期
     * @return 本季度第一天
     */
    public static LocalDate getQuarterStart(LocalDate date) {
        int quarterStartMonth = ((date.getMonthValue() - 1) / 3) * 3 + 1;
        return date.withMonth(quarterStartMonth).withDayOfMonth(1);
    }

    /**
     * 获取本季度的结束日期
     *
     * @param date 参考日期
     * @return 本季度最后一天
     */
    public static LocalDate getQuarterEnd(LocalDate date) {
        int quarterEndMonth = ((date.getMonthValue() - 1) / 3 + 1) * 3;
        return date.withMonth(quarterEndMonth).with(TemporalAdjusters.lastDayOfMonth());
    }

    /**
     * 获取本年的开始日期
     *
     * @param date 参考日期
     * @return 本年第一天
     */
    public static LocalDate getYearStart(LocalDate date) {
        return date.withDayOfYear(1);
    }

    /**
     * 获取本年的结束日期
     *
     * @param date 参考日期
     * @return 本年最后一天
     */
    public static LocalDate getYearEnd(LocalDate date) {
        return date.with(TemporalAdjusters.lastDayOfYear());
    }

    // ==================== 周期日期范围 ====================

    /**
     * 根据周期名称获取日期范围
     *
     * @param period 周期名称：today, week, month, quarter, year
     * @param referenceDate 参考日期
     * @return [startDate, endDate]
     */
    public static LocalDate[] getDateRangeByPeriod(String period, LocalDate referenceDate) {
        LocalDate ref = referenceDate != null ? referenceDate : LocalDate.now();

        switch (period != null ? period.toLowerCase() : "month") {
            case "today":
                return new LocalDate[]{ref, ref};
            case "week":
                return new LocalDate[]{getWeekStart(ref), getWeekEnd(ref)};
            case "month":
                return new LocalDate[]{getMonthStart(ref), getMonthEnd(ref)};
            case "quarter":
                return new LocalDate[]{getQuarterStart(ref), getQuarterEnd(ref)};
            case "year":
                return new LocalDate[]{getYearStart(ref), getYearEnd(ref)};
            default:
                // 默认最近30天
                return new LocalDate[]{ref.minusDays(30), ref};
        }
    }

    /**
     * 根据周期名称获取日期范围（使用当前日期作为参考）
     *
     * @param period 周期名称
     * @return [startDate, endDate]
     */
    public static LocalDate[] getDateRangeByPeriod(String period) {
        return getDateRangeByPeriod(period, LocalDate.now());
    }

    // ==================== 默认日期处理 ====================

    /**
     * 获取开始日期，如果为 null 则返回默认值（30天前）
     *
     * @param startDate 原始开始日期
     * @return 有效的开始日期
     */
    public static LocalDate getStartDateOrDefault(LocalDate startDate) {
        return startDate != null ? startDate : LocalDate.now().minusDays(30);
    }

    /**
     * 获取开始日期，如果为 null 则返回指定天数前
     *
     * @param startDate   原始开始日期
     * @param defaultDays 默认天数
     * @return 有效的开始日期
     */
    public static LocalDate getStartDateOrDefault(LocalDate startDate, int defaultDays) {
        return startDate != null ? startDate : LocalDate.now().minusDays(defaultDays);
    }

    /**
     * 获取结束日期，如果为 null 则返回今天
     *
     * @param endDate 原始结束日期
     * @return 有效的结束日期
     */
    public static LocalDate getEndDateOrDefault(LocalDate endDate) {
        return endDate != null ? endDate : LocalDate.now();
    }

    // ==================== 日期迭代 ====================

    /**
     * 迭代日期范围内的每一天
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param consumer  每天执行的操作
     */
    public static void iterateDateRange(LocalDate startDate, LocalDate endDate, Consumer<LocalDate> consumer) {
        LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            consumer.accept(current);
            current = current.plusDays(1);
        }
    }

    /**
     * 计算两个日期之间的天数
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 天数
     */
    public static long daysBetween(LocalDate startDate, LocalDate endDate) {
        return java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate);
    }

    // ==================== 比较对象 ====================

    /**
     * 日期范围对象，便于方法返回
     */
    public static class DateRange {
        private final LocalDate startDate;
        private final LocalDate endDate;

        public DateRange(LocalDate startDate, LocalDate endDate) {
            this.startDate = startDate;
            this.endDate = endDate;
        }

        public LocalDate getStartDate() {
            return startDate;
        }

        public LocalDate getEndDate() {
            return endDate;
        }

        public LocalDateTime getStartDateTime() {
            return startOfDay(startDate);
        }

        public LocalDateTime getEndDateTime() {
            return endOfDay(endDate);
        }

        public LocalDateTime getEndDateTimeExclusive() {
            return endOfDayExclusive(endDate);
        }

        public long getDays() {
            return daysBetween(startDate, endDate) + 1;
        }
    }

    /**
     * 创建日期范围对象
     *
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return DateRange 对象
     */
    public static DateRange range(LocalDate startDate, LocalDate endDate) {
        return new DateRange(startDate, endDate);
    }

    /**
     * 根据周期创建日期范围对象
     *
     * @param period 周期名称
     * @return DateRange 对象
     */
    public static DateRange rangeByPeriod(String period) {
        LocalDate[] dates = getDateRangeByPeriod(period);
        return new DateRange(dates[0], dates[1]);
    }
}
