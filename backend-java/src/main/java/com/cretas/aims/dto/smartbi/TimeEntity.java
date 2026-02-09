package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Time Entity DTO
 *
 * Represents a time entity recognized from natural language queries.
 * Supports various time expressions including:
 * - Relative time: today, yesterday, this week, last month, etc.
 * - Dynamic patterns: last N days/weeks/months
 * - Absolute dates: 2024-01-15, 2024年1月15日
 * - Quarters: Q1, Q2, first quarter
 *
 * Usage examples:
 * - Query "今天的销售额" -> TimeEntity(text="今天", timeType=TODAY, granularity=DAY)
 * - Query "本月数据" -> TimeEntity(text="本月", timeType=THIS_MONTH, granularity=MONTH)
 * - Query "最近7天趋势" -> TimeEntity(text="最近7天", timeType=LAST_N_DAYS, extractedNumber=7)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeEntity {

    /**
     * Time type enumeration
     */
    public enum TimeType {
        // Relative time types
        TODAY,
        YESTERDAY,
        THIS_WEEK,
        LAST_WEEK,
        THIS_MONTH,
        LAST_MONTH,
        THIS_QUARTER,
        LAST_QUARTER,
        THIS_YEAR,
        LAST_YEAR,

        // Dynamic patterns
        LAST_N_DAYS,
        LAST_N_WEEKS,
        LAST_N_MONTHS,

        // Absolute time types
        ABSOLUTE_DATE,
        ABSOLUTE_MONTH,
        ABSOLUTE_YEAR,
        ABSOLUTE_QUARTER,
        ISO_DATE
    }

    /**
     * Time granularity enumeration
     */
    public enum TimeGranularity {
        DAY,
        WEEK,
        MONTH,
        QUARTER,
        YEAR
    }

    /**
     * Matched text from the original query
     * e.g., "今天", "本月", "最近7天", "2024年1月"
     */
    private String text;

    /**
     * Time type
     */
    private TimeType timeType;

    /**
     * Start date of the resolved time range (inclusive)
     */
    private LocalDate startDate;

    /**
     * End date of the resolved time range (inclusive)
     */
    private LocalDate endDate;

    /**
     * Time granularity
     */
    private TimeGranularity granularity;

    /**
     * Start index in the original query text (inclusive)
     */
    private int startIndex;

    /**
     * End index in the original query text (exclusive)
     */
    private int endIndex;

    /**
     * Whether this is a relative time expression
     * true: today, this week, last month
     * false: 2024-01-15, 2024年1月
     */
    @Builder.Default
    private boolean relative = true;

    /**
     * Extracted number for dynamic patterns
     * Used for "last N days/weeks/months" type expressions
     * e.g., "最近7天" -> extractedNumber = 7
     */
    private Integer extractedNumber;

    /**
     * Match confidence (0.0 - 1.0)
     * Exact pattern match: 1.0
     * Dynamic regex match: 0.95
     */
    @Builder.Default
    private double confidence = 1.0;

    /**
     * Year for absolute time (if applicable)
     */
    private Integer year;

    /**
     * Month for absolute time (if applicable)
     */
    private Integer month;

    /**
     * Day for absolute time (if applicable)
     */
    private Integer day;

    /**
     * Quarter number (1-4) for quarter expressions
     */
    private Integer quarter;

    // ==================== Convenience Constructors ====================

    /**
     * Create a relative time entity (for simple patterns like "today", "this week")
     */
    public static TimeEntity relative(String text, TimeType timeType, TimeGranularity granularity,
                                       LocalDate startDate, LocalDate endDate,
                                       int startIndex, int endIndex) {
        return TimeEntity.builder()
                .text(text)
                .timeType(timeType)
                .granularity(granularity)
                .startDate(startDate)
                .endDate(endDate)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .relative(true)
                .confidence(1.0)
                .build();
    }

    /**
     * Create a dynamic time entity (for patterns like "last N days")
     */
    public static TimeEntity dynamic(String text, TimeType timeType, TimeGranularity granularity,
                                      LocalDate startDate, LocalDate endDate,
                                      int extractedNumber, int startIndex, int endIndex) {
        return TimeEntity.builder()
                .text(text)
                .timeType(timeType)
                .granularity(granularity)
                .startDate(startDate)
                .endDate(endDate)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .relative(true)
                .extractedNumber(extractedNumber)
                .confidence(0.95)
                .build();
    }

    /**
     * Create an absolute date entity
     */
    public static TimeEntity absoluteDate(String text, LocalDate date,
                                           int startIndex, int endIndex) {
        return TimeEntity.builder()
                .text(text)
                .timeType(TimeType.ABSOLUTE_DATE)
                .granularity(TimeGranularity.DAY)
                .startDate(date)
                .endDate(date)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .relative(false)
                .year(date.getYear())
                .month(date.getMonthValue())
                .day(date.getDayOfMonth())
                .confidence(1.0)
                .build();
    }

    /**
     * Create an absolute month entity
     */
    public static TimeEntity absoluteMonth(String text, int year, int month,
                                            LocalDate startDate, LocalDate endDate,
                                            int startIndex, int endIndex) {
        return TimeEntity.builder()
                .text(text)
                .timeType(TimeType.ABSOLUTE_MONTH)
                .granularity(TimeGranularity.MONTH)
                .startDate(startDate)
                .endDate(endDate)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .relative(false)
                .year(year)
                .month(month)
                .confidence(1.0)
                .build();
    }

    /**
     * Create an absolute year entity
     */
    public static TimeEntity absoluteYear(String text, int year,
                                           LocalDate startDate, LocalDate endDate,
                                           int startIndex, int endIndex) {
        return TimeEntity.builder()
                .text(text)
                .timeType(TimeType.ABSOLUTE_YEAR)
                .granularity(TimeGranularity.YEAR)
                .startDate(startDate)
                .endDate(endDate)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .relative(false)
                .year(year)
                .confidence(1.0)
                .build();
    }

    /**
     * Create a quarter entity
     */
    public static TimeEntity quarter(String text, TimeType timeType, int year, int quarterNum,
                                      LocalDate startDate, LocalDate endDate,
                                      boolean isRelative, int startIndex, int endIndex) {
        return TimeEntity.builder()
                .text(text)
                .timeType(timeType)
                .granularity(TimeGranularity.QUARTER)
                .startDate(startDate)
                .endDate(endDate)
                .startIndex(startIndex)
                .endIndex(endIndex)
                .relative(isRelative)
                .year(year)
                .quarter(quarterNum)
                .confidence(1.0)
                .build();
    }

    // ==================== Utility Methods ====================

    /**
     * Get text length
     */
    public int getTextLength() {
        return text != null ? text.length() : 0;
    }

    /**
     * Check if the entity represents a day-level time
     */
    public boolean isDay() {
        return granularity == TimeGranularity.DAY;
    }

    /**
     * Check if the entity represents a week-level time
     */
    public boolean isWeek() {
        return granularity == TimeGranularity.WEEK;
    }

    /**
     * Check if the entity represents a month-level time
     */
    public boolean isMonth() {
        return granularity == TimeGranularity.MONTH;
    }

    /**
     * Check if the entity represents a quarter-level time
     */
    public boolean isQuarter() {
        return granularity == TimeGranularity.QUARTER;
    }

    /**
     * Check if the entity represents a year-level time
     */
    public boolean isYear() {
        return granularity == TimeGranularity.YEAR;
    }

    /**
     * Check if the entity is a dynamic pattern (last N days/weeks/months)
     */
    public boolean isDynamic() {
        return timeType == TimeType.LAST_N_DAYS
                || timeType == TimeType.LAST_N_WEEKS
                || timeType == TimeType.LAST_N_MONTHS;
    }

    /**
     * Check if the entity is valid
     */
    public boolean isValid() {
        return text != null && !text.isEmpty()
                && timeType != null
                && startDate != null
                && endDate != null
                && !startDate.isAfter(endDate)
                && startIndex >= 0
                && endIndex > startIndex;
    }

    /**
     * Convert to DateRange DTO
     */
    public DateRange toDateRange() {
        return DateRange.builder()
                .startDate(startDate)
                .endDate(endDate)
                .granularity(granularity != null ? granularity.name() : "DAY")
                .originalExpression(text)
                .relative(relative)
                .build();
    }

    /**
     * Get the number of days in the time range
     */
    public long getDays() {
        if (startDate == null || endDate == null) {
            return 0;
        }
        return java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }
}
