package com.cretas.aims.dto.intent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Time Range DTO for Slot Extraction
 *
 * Represents a parsed time range with start and end dates,
 * along with metadata about the original expression.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeRange {

    /**
     * Start date of the range (inclusive)
     */
    private LocalDate startDate;

    /**
     * End date of the range (inclusive)
     */
    private LocalDate endDate;

    /**
     * Original time expression from user input
     * Examples: "最近7天", "本月", "上周"
     */
    private String originalExpression;

    /**
     * Type of time range
     */
    private TimeRangeType rangeType;

    /**
     * Unit of the time range (for relative expressions)
     */
    private ChronoUnit unit;

    /**
     * Amount of units (for relative expressions)
     * Example: "3" in "过去3个月"
     */
    private Integer amount;

    /**
     * Whether this is a future time range
     */
    @Builder.Default
    private boolean isFuture = false;

    /**
     * Time Range Type Enum
     */
    public enum TimeRangeType {
        /**
         * Relative to current date
         * Examples: 最近7天, 过去3个月
         */
        RELATIVE("相对时间"),

        /**
         * Calendar period
         * Examples: 本周, 本月, 本年
         */
        CALENDAR_PERIOD("日历周期"),

        /**
         * Specific dates
         * Examples: 2026-01-01 到 2026-01-31
         */
        SPECIFIC("具体日期"),

        /**
         * Single point in time
         * Examples: 今天, 昨天
         */
        POINT("时间点"),

        /**
         * Comparison period
         * Examples: 同比(去年同期), 环比(上月)
         */
        COMPARISON("对比周期");

        private final String displayName;

        TimeRangeType(String displayName) {
            this.displayName = displayName;
        }

        public String getDisplayName() {
            return displayName;
        }
    }

    // ==================== Factory Methods ====================

    /**
     * Create a time range for "today"
     */
    public static TimeRange today() {
        LocalDate today = LocalDate.now();
        return TimeRange.builder()
                .startDate(today)
                .endDate(today)
                .originalExpression("今天")
                .rangeType(TimeRangeType.POINT)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "yesterday"
     */
    public static TimeRange yesterday() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        return TimeRange.builder()
                .startDate(yesterday)
                .endDate(yesterday)
                .originalExpression("昨天")
                .rangeType(TimeRangeType.POINT)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "last N days"
     */
    public static TimeRange lastDays(int days, String originalExpression) {
        LocalDate today = LocalDate.now();
        return TimeRange.builder()
                .startDate(today.minusDays(days - 1))
                .endDate(today)
                .originalExpression(originalExpression)
                .rangeType(TimeRangeType.RELATIVE)
                .unit(ChronoUnit.DAYS)
                .amount(days)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "last N weeks"
     */
    public static TimeRange lastWeeks(int weeks, String originalExpression) {
        LocalDate today = LocalDate.now();
        return TimeRange.builder()
                .startDate(today.minusWeeks(weeks))
                .endDate(today)
                .originalExpression(originalExpression)
                .rangeType(TimeRangeType.RELATIVE)
                .unit(ChronoUnit.WEEKS)
                .amount(weeks)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "last N months"
     */
    public static TimeRange lastMonths(int months, String originalExpression) {
        LocalDate today = LocalDate.now();
        return TimeRange.builder()
                .startDate(today.minusMonths(months))
                .endDate(today)
                .originalExpression(originalExpression)
                .rangeType(TimeRangeType.RELATIVE)
                .unit(ChronoUnit.MONTHS)
                .amount(months)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "this week"
     */
    public static TimeRange thisWeek() {
        LocalDate today = LocalDate.now();
        LocalDate startOfWeek = today.minusDays(today.getDayOfWeek().getValue() - 1);
        LocalDate endOfWeek = startOfWeek.plusDays(6);
        return TimeRange.builder()
                .startDate(startOfWeek)
                .endDate(endOfWeek)
                .originalExpression("本周")
                .rangeType(TimeRangeType.CALENDAR_PERIOD)
                .unit(ChronoUnit.WEEKS)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "this month"
     */
    public static TimeRange thisMonth() {
        LocalDate today = LocalDate.now();
        LocalDate startOfMonth = today.withDayOfMonth(1);
        LocalDate endOfMonth = today.withDayOfMonth(today.lengthOfMonth());
        return TimeRange.builder()
                .startDate(startOfMonth)
                .endDate(endOfMonth)
                .originalExpression("本月")
                .rangeType(TimeRangeType.CALENDAR_PERIOD)
                .unit(ChronoUnit.MONTHS)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "last week"
     */
    public static TimeRange lastWeek() {
        LocalDate today = LocalDate.now();
        LocalDate startOfLastWeek = today.minusWeeks(1).minusDays(today.getDayOfWeek().getValue() - 1);
        LocalDate endOfLastWeek = startOfLastWeek.plusDays(6);
        return TimeRange.builder()
                .startDate(startOfLastWeek)
                .endDate(endOfLastWeek)
                .originalExpression("上周")
                .rangeType(TimeRangeType.CALENDAR_PERIOD)
                .unit(ChronoUnit.WEEKS)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "last month"
     */
    public static TimeRange lastMonth() {
        LocalDate today = LocalDate.now();
        LocalDate startOfLastMonth = today.minusMonths(1).withDayOfMonth(1);
        LocalDate endOfLastMonth = startOfLastMonth.withDayOfMonth(startOfLastMonth.lengthOfMonth());
        return TimeRange.builder()
                .startDate(startOfLastMonth)
                .endDate(endOfLastMonth)
                .originalExpression("上月")
                .rangeType(TimeRangeType.CALENDAR_PERIOD)
                .unit(ChronoUnit.MONTHS)
                .isFuture(false)
                .build();
    }

    /**
     * Create a time range for "next N days" (future)
     */
    public static TimeRange nextDays(int days, String originalExpression) {
        LocalDate today = LocalDate.now();
        return TimeRange.builder()
                .startDate(today)
                .endDate(today.plusDays(days))
                .originalExpression(originalExpression)
                .rangeType(TimeRangeType.RELATIVE)
                .unit(ChronoUnit.DAYS)
                .amount(days)
                .isFuture(true)
                .build();
    }

    /**
     * Create a YoY (Year-over-Year) comparison time range
     */
    public static TimeRange yoyPeriod(TimeRange currentPeriod) {
        return TimeRange.builder()
                .startDate(currentPeriod.getStartDate().minusYears(1))
                .endDate(currentPeriod.getEndDate().minusYears(1))
                .originalExpression("去年同期")
                .rangeType(TimeRangeType.COMPARISON)
                .unit(ChronoUnit.YEARS)
                .isFuture(false)
                .build();
    }

    /**
     * Create a MoM (Month-over-Month) comparison time range
     */
    public static TimeRange momPeriod(TimeRange currentPeriod) {
        return TimeRange.builder()
                .startDate(currentPeriod.getStartDate().minusMonths(1))
                .endDate(currentPeriod.getEndDate().minusMonths(1))
                .originalExpression("上月同期")
                .rangeType(TimeRangeType.COMPARISON)
                .unit(ChronoUnit.MONTHS)
                .isFuture(false)
                .build();
    }

    // ==================== Utility Methods ====================

    /**
     * Get the duration in days
     */
    public long getDurationDays() {
        if (startDate == null || endDate == null) {
            return 0;
        }
        return ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }

    /**
     * Check if a date is within this range
     */
    public boolean contains(LocalDate date) {
        if (startDate == null || endDate == null || date == null) {
            return false;
        }
        return !date.isBefore(startDate) && !date.isAfter(endDate);
    }

    /**
     * Convert to start datetime (00:00:00)
     */
    public LocalDateTime getStartDateTime() {
        return startDate != null ? startDate.atStartOfDay() : null;
    }

    /**
     * Convert to end datetime (23:59:59)
     */
    public LocalDateTime getEndDateTime() {
        return endDate != null ? endDate.atTime(23, 59, 59) : null;
    }
}
