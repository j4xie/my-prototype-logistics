package com.cretas.aims.service.smartbi.chart.impl;

import com.cretas.aims.dto.smartbi.chart.DataFeatures;
import com.cretas.aims.service.smartbi.chart.DataFeatureExtractor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Data feature extraction service implementation.
 * Analyzes data patterns for adaptive chart generation.
 *
 * Detects:
 * - Column types (numeric, categorical, time)
 * - Data patterns (time series, proportion, comparison, hierarchy)
 * - Budget vs Actual patterns
 * - YoY/MoM comparison patterns
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
@Service
public class DataFeatureExtractorImpl implements DataFeatureExtractor {

    // ==================== Keywords for Detection (Chinese + English) ====================

    private static final Set<String> TIME_KEYWORDS = Set.of(
            "date", "time", "month", "year", "quarter", "week", "day", "period",
            "日期", "时间", "月", "年", "季度", "周", "天", "期间", "月份", "年份"
    );

    private static final Set<String> BUDGET_KEYWORDS = Set.of(
            "budget", "预算", "plan", "计划", "target", "目标", "quota", "定额",
            "budgeted", "planned", "forecasted", "预测"
    );

    private static final Set<String> ACTUAL_KEYWORDS = Set.of(
            "actual", "实际", "execute", "执行", "spent", "支出", "real", "真实",
            "realized", "完成", "current", "当期"
    );

    private static final Set<String> YOY_KEYWORDS = Set.of(
            "yoy", "同比", "year-over-year", "lastyear", "去年", "上年",
            "year_over_year", "yearly", "annual"
    );

    private static final Set<String> MOM_KEYWORDS = Set.of(
            "mom", "环比", "month-over-month", "lastmonth", "上月", "上期",
            "month_over_month", "monthly", "sequential"
    );

    private static final Set<String> PROPORTION_KEYWORDS = Set.of(
            "rate", "ratio", "percent", "percentage", "share", "proportion",
            "比例", "占比", "比率", "百分比", "份额", "%"
    );

    private static final Set<String> HIERARCHY_KEYWORDS = Set.of(
            "parent", "child", "level", "category", "subcategory", "group",
            "父", "子", "层级", "分类", "子分类", "组", "一级", "二级", "三级"
    );

    private static final Set<String> CATEGORY_KEYWORDS = Set.of(
            "name", "type", "category", "product", "region", "department", "customer",
            "名称", "类型", "分类", "产品", "区域", "部门", "客户", "项目"
    );

    // ==================== Date Patterns ====================

    private static final Pattern DATE_PATTERN = Pattern.compile(
            "\\d{4}[-/年]\\d{1,2}([-/月]\\d{1,2}日?)?|" +
            "\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}|" +
            "\\d{4}年\\d{1,2}月|" +
            "\\d{4}Q[1-4]|" +
            "Q[1-4]\\s*\\d{4}|" +
            "\\d{4}[-/]Q[1-4]"
    );

    private static final List<DateTimeFormatter> DATE_FORMATTERS = Arrays.asList(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyy-M-d"),
            DateTimeFormatter.ofPattern("yyyy/M/d"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("MM-dd-yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    );

    // ==================== Main Extract Method ====================

    @Override
    public DataFeatures extract(List<Map<String, Object>> data, List<String> headers) {
        if (data == null || data.isEmpty()) {
            log.debug("Empty data provided for feature extraction");
            return DataFeatures.builder()
                    .rowCount(0)
                    .columnCount(headers != null ? headers.size() : 0)
                    .columns(headers != null ? headers : Collections.emptyList())
                    .numericColumns(Collections.emptyList())
                    .categoricalColumns(Collections.emptyList())
                    .timeColumns(Collections.emptyList())
                    .hasTimeSeries(false)
                    .hasProportion(false)
                    .hasComparison(false)
                    .hasHierarchy(false)
                    .hasBudgetActual(false)
                    .hasYoYMoM(false)
                    .valueRanges(Collections.emptyMap())
                    .sampleValues(Collections.emptyMap())
                    .build();
        }

        List<String> effectiveHeaders = headers != null && !headers.isEmpty()
                ? headers
                : extractHeadersFromData(data);

        List<String> numericColumns = new ArrayList<>();
        List<String> categoricalColumns = new ArrayList<>();
        List<String> timeColumns = new ArrayList<>();
        Map<String, DataFeatures.ValueRange> valueRanges = new HashMap<>();
        Map<String, List<Object>> sampleValues = new HashMap<>();

        for (String header : effectiveHeaders) {
            String headerLower = header.toLowerCase();
            List<Object> values = extractColumnValues(data, header);

            // Store sample values (up to 5)
            sampleValues.put(header, values.stream()
                    .filter(Objects::nonNull)
                    .limit(5)
                    .collect(Collectors.toList()));

            // Detect column type
            if (isTimeColumn(headerLower, values)) {
                timeColumns.add(header);
                log.debug("Detected time column: {}", header);
            } else if (isNumericColumn(values)) {
                numericColumns.add(header);
                valueRanges.put(header, calculateValueRange(values));
                log.debug("Detected numeric column: {} with range {}", header, valueRanges.get(header));
            } else {
                categoricalColumns.add(header);
                log.debug("Detected categorical column: {}", header);
            }
        }

        // Detect data patterns
        boolean hasTimeSeries = detectTimeSeries(data, effectiveHeaders);
        boolean hasProportion = detectProportion(data);
        boolean hasComparison = detectComparison(data, effectiveHeaders);
        boolean hasHierarchy = detectHierarchy(data, effectiveHeaders);
        boolean hasBudgetActual = detectBudgetActual(effectiveHeaders);
        boolean hasYoYMoM = detectYoYMoM(effectiveHeaders);

        log.info("Feature extraction complete: {} rows, {} columns, " +
                "numeric={}, categorical={}, time={}, " +
                "timeSeries={}, proportion={}, comparison={}, hierarchy={}, budgetActual={}, yoyMom={}",
                data.size(), effectiveHeaders.size(),
                numericColumns.size(), categoricalColumns.size(), timeColumns.size(),
                hasTimeSeries, hasProportion, hasComparison, hasHierarchy, hasBudgetActual, hasYoYMoM);

        return DataFeatures.builder()
                .rowCount(data.size())
                .columnCount(effectiveHeaders.size())
                .columns(effectiveHeaders)
                .numericColumns(numericColumns)
                .categoricalColumns(categoricalColumns)
                .timeColumns(timeColumns)
                .hasTimeSeries(hasTimeSeries)
                .hasProportion(hasProportion)
                .hasComparison(hasComparison)
                .hasHierarchy(hasHierarchy)
                .hasBudgetActual(hasBudgetActual)
                .hasYoYMoM(hasYoYMoM)
                .valueRanges(valueRanges)
                .sampleValues(sampleValues)
                .build();
    }

    // ==================== Interface Methods ====================

    @Override
    public boolean detectTimeSeries(List<Map<String, Object>> data, List<String> headers) {
        if (data == null || data.isEmpty() || headers == null) {
            return false;
        }

        // Check if any column is a time column
        for (String header : headers) {
            String headerLower = header.toLowerCase();
            List<Object> values = extractColumnValues(data, header);

            if (isTimeColumn(headerLower, values)) {
                // Verify it has sequential or ordered time values
                if (hasSequentialTimeValues(values)) {
                    log.debug("Time series pattern detected in column: {}", header);
                    return true;
                }
            }
        }

        // Also check if data has sufficient rows for trend analysis (at least 3)
        return false;
    }

    @Override
    public boolean detectProportion(List<Map<String, Object>> data) {
        if (data == null || data.isEmpty()) {
            return false;
        }

        // Get all headers from first row
        Set<String> headers = data.get(0).keySet();

        // Check for proportion keywords in headers
        for (String header : headers) {
            String headerLower = header.toLowerCase();
            if (containsAnyKeyword(headerLower, PROPORTION_KEYWORDS)) {
                log.debug("Proportion pattern detected via header keyword: {}", header);
                return true;
            }
        }

        // Check for numeric columns that sum to approximately 100 or 1
        for (String header : headers) {
            List<Object> values = extractColumnValues(data, header);
            if (isNumericColumn(values)) {
                double sum = values.stream()
                        .map(this::parseNumericValue)
                        .filter(Objects::nonNull)
                        .mapToDouble(BigDecimal::doubleValue)
                        .sum();

                // Check if values sum to ~100 (percentage) or ~1 (ratio)
                if ((sum >= 98 && sum <= 102) || (sum >= 0.98 && sum <= 1.02)) {
                    log.debug("Proportion pattern detected: column {} sums to {}", header, sum);
                    return true;
                }
            }
        }

        // Check if any numeric values are between 0-100 and look like percentages
        for (String header : headers) {
            List<Object> values = extractColumnValues(data, header);
            if (isNumericColumn(values)) {
                long inRangeCount = values.stream()
                        .map(this::parseNumericValue)
                        .filter(Objects::nonNull)
                        .filter(v -> v.doubleValue() >= 0 && v.doubleValue() <= 100)
                        .count();

                // If most values are in 0-100 range, might be percentages
                if (inRangeCount == values.size() && values.size() > 1) {
                    String firstValue = values.get(0) != null ? values.get(0).toString() : "";
                    if (firstValue.contains("%") || firstValue.contains("percent")) {
                        log.debug("Proportion pattern detected via percentage values in: {}", header);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    @Override
    public boolean detectComparison(List<Map<String, Object>> data, List<String> headers) {
        if (headers == null || headers.isEmpty()) {
            return false;
        }

        // Check for Budget vs Actual pattern
        if (detectBudgetActual(headers)) {
            log.debug("Comparison pattern detected: Budget vs Actual");
            return true;
        }

        // Check for YoY/MoM pattern
        if (detectYoYMoM(headers)) {
            log.debug("Comparison pattern detected: YoY/MoM");
            return true;
        }

        // Check for paired comparison columns (e.g., "2024销售额" vs "2023销售额")
        List<String> headersLower = headers.stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());

        // Look for year patterns suggesting comparison
        Pattern yearPattern = Pattern.compile("(\\d{4})");
        Set<String> years = new HashSet<>();
        for (String header : headers) {
            Matcher m = yearPattern.matcher(header);
            while (m.find()) {
                years.add(m.group(1));
            }
        }
        if (years.size() >= 2) {
            log.debug("Comparison pattern detected: multiple years found ({})", years);
            return true;
        }

        // Look for "本期/上期", "当前/历史" patterns
        boolean hasCurrentPeriod = headersLower.stream()
                .anyMatch(h -> h.contains("本期") || h.contains("当前") || h.contains("current"));
        boolean hasPreviousPeriod = headersLower.stream()
                .anyMatch(h -> h.contains("上期") || h.contains("历史") || h.contains("previous") || h.contains("last"));

        if (hasCurrentPeriod && hasPreviousPeriod) {
            log.debug("Comparison pattern detected: current vs previous period");
            return true;
        }

        return false;
    }

    @Override
    public boolean detectHierarchy(List<Map<String, Object>> data, List<String> headers) {
        if (data == null || data.isEmpty() || headers == null) {
            return false;
        }

        // Check headers for hierarchy keywords
        for (String header : headers) {
            String headerLower = header.toLowerCase();
            if (containsAnyKeyword(headerLower, HIERARCHY_KEYWORDS)) {
                log.debug("Hierarchy pattern detected via keyword in header: {}", header);
                return true;
            }
        }

        // Check for indentation or level markers in data
        for (Map<String, Object> row : data) {
            for (Object value : row.values()) {
                if (value instanceof String) {
                    String strValue = (String) value;
                    // Check for indentation patterns
                    if (strValue.startsWith("  ") || strValue.startsWith("\t") ||
                        strValue.startsWith("- ") || strValue.startsWith("--")) {
                        log.debug("Hierarchy pattern detected via indentation");
                        return true;
                    }
                }
            }
        }

        // Check for numbered hierarchy (1., 1.1., 1.1.1.)
        Pattern hierarchyNumberPattern = Pattern.compile("^\\d+(\\.\\d+)+\\.?\\s");
        for (Map<String, Object> row : data) {
            for (Object value : row.values()) {
                if (value instanceof String) {
                    if (hierarchyNumberPattern.matcher((String) value).find()) {
                        log.debug("Hierarchy pattern detected via numbered hierarchy");
                        return true;
                    }
                }
            }
        }

        // Check if there are multiple categorical columns (potential drill-down)
        long categoricalCount = headers.stream()
                .filter(h -> {
                    List<Object> values = extractColumnValues(data, h);
                    return !isNumericColumn(values) && !isTimeColumn(h.toLowerCase(), values);
                })
                .count();

        if (categoricalCount >= 2) {
            // Check if one column has fewer unique values (parent) than another (child)
            List<String> categoricalHeaders = headers.stream()
                    .filter(h -> {
                        List<Object> values = extractColumnValues(data, h);
                        return !isNumericColumn(values) && !isTimeColumn(h.toLowerCase(), values);
                    })
                    .collect(Collectors.toList());

            if (categoricalHeaders.size() >= 2) {
                long uniqueCount1 = extractColumnValues(data, categoricalHeaders.get(0)).stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .count();
                long uniqueCount2 = extractColumnValues(data, categoricalHeaders.get(1)).stream()
                        .filter(Objects::nonNull)
                        .distinct()
                        .count();

                // Significant difference in cardinality suggests hierarchy
                if (uniqueCount1 > 0 && uniqueCount2 > 0) {
                    double ratio = Math.max(uniqueCount1, uniqueCount2) / (double) Math.min(uniqueCount1, uniqueCount2);
                    if (ratio >= 2.0) {
                        log.debug("Hierarchy pattern detected via cardinality difference: {} vs {}",
                                uniqueCount1, uniqueCount2);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // ==================== Helper Methods ====================

    /**
     * Detect Budget vs Actual pattern in headers
     */
    private boolean detectBudgetActual(List<String> headers) {
        if (headers == null) {
            return false;
        }

        boolean hasBudget = false;
        boolean hasActual = false;

        for (String header : headers) {
            String headerLower = header.toLowerCase();
            if (containsAnyKeyword(headerLower, BUDGET_KEYWORDS)) {
                hasBudget = true;
            }
            if (containsAnyKeyword(headerLower, ACTUAL_KEYWORDS)) {
                hasActual = true;
            }
        }

        return hasBudget && hasActual;
    }

    /**
     * Detect YoY/MoM comparison pattern in headers
     */
    private boolean detectYoYMoM(List<String> headers) {
        if (headers == null) {
            return false;
        }

        for (String header : headers) {
            String headerLower = header.toLowerCase();
            if (containsAnyKeyword(headerLower, YOY_KEYWORDS) ||
                containsAnyKeyword(headerLower, MOM_KEYWORDS)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a column is a time column based on header keywords and values
     */
    private boolean isTimeColumn(String headerLower, List<Object> values) {
        // Check header keywords
        if (containsAnyKeyword(headerLower, TIME_KEYWORDS)) {
            return true;
        }

        // Check if values match date patterns
        if (values == null || values.isEmpty()) {
            return false;
        }

        long dateMatchCount = values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .filter(this::looksLikeDate)
                .count();

        // If more than 50% of values look like dates, consider it a time column
        return dateMatchCount > values.size() * 0.5;
    }

    /**
     * Check if a string value looks like a date
     */
    private boolean looksLikeDate(String value) {
        if (value == null || value.trim().isEmpty()) {
            return false;
        }

        String trimmed = value.trim();

        // Check against date pattern regex
        if (DATE_PATTERN.matcher(trimmed).matches()) {
            return true;
        }

        // Try parsing with common date formatters
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                LocalDate.parse(trimmed, formatter);
                return true;
            } catch (DateTimeParseException e) {
                // Continue trying other formats
            }
        }

        // Check for year-month patterns like "2024年1月" or "Jan 2024"
        if (trimmed.matches("\\d{4}年\\d{1,2}月") ||
            trimmed.matches("[A-Za-z]{3,9}\\s*\\d{4}") ||
            trimmed.matches("\\d{4}\\s*[A-Za-z]{3,9}")) {
            return true;
        }

        return false;
    }

    /**
     * Check if a column contains numeric values
     */
    private boolean isNumericColumn(List<Object> values) {
        if (values == null || values.isEmpty()) {
            return false;
        }

        // Filter out null values and count numeric ones
        long numericCount = values.stream()
                .filter(Objects::nonNull)
                .filter(v -> parseNumericValue(v) != null)
                .count();

        // Count non-null values
        long nonNullCount = values.stream()
                .filter(Objects::nonNull)
                .count();

        // If more than 70% of non-null values are numeric, consider it a numeric column
        return nonNullCount > 0 && numericCount >= nonNullCount * 0.7;
    }

    /**
     * Parse a value to BigDecimal, handling currency symbols and commas
     */
    private BigDecimal parseNumericValue(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof BigDecimal) {
            return (BigDecimal) value;
        }

        if (value instanceof Number) {
            return new BigDecimal(value.toString());
        }

        String strValue = value.toString().trim();
        if (strValue.isEmpty() || "-".equals(strValue) || "N/A".equalsIgnoreCase(strValue)) {
            return null;
        }

        try {
            // Remove currency symbols, commas, and percentage signs
            String cleaned = strValue
                    .replaceAll("[,，]", "")
                    .replaceAll("[￥$€£¥]", "")
                    .replaceAll("%$", "")
                    .replaceAll("\\s+", "")
                    .trim();

            if (cleaned.isEmpty()) {
                return null;
            }

            // Handle parentheses for negative numbers: (100) -> -100
            if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
                cleaned = "-" + cleaned.substring(1, cleaned.length() - 1);
            }

            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Calculate value range statistics for a numeric column
     */
    private DataFeatures.ValueRange calculateValueRange(List<Object> values) {
        List<BigDecimal> numericValues = values.stream()
                .map(this::parseNumericValue)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        if (numericValues.isEmpty()) {
            return DataFeatures.ValueRange.builder()
                    .min(null)
                    .max(null)
                    .avg(null)
                    .sum(null)
                    .build();
        }

        BigDecimal min = numericValues.stream().min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = numericValues.stream().max(BigDecimal::compareTo).orElse(null);
        BigDecimal sum = numericValues.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = sum.divide(new BigDecimal(numericValues.size()), 4, RoundingMode.HALF_UP);

        return DataFeatures.ValueRange.builder()
                .min(min != null ? min.doubleValue() : null)
                .max(max != null ? max.doubleValue() : null)
                .avg(avg.doubleValue())
                .sum(sum.doubleValue())
                .build();
    }

    /**
     * Extract all values for a specific column from the data
     */
    private List<Object> extractColumnValues(List<Map<String, Object>> data, String header) {
        if (data == null || header == null) {
            return Collections.emptyList();
        }

        return data.stream()
                .map(row -> row.get(header))
                .collect(Collectors.toList());
    }

    /**
     * Extract headers from data if not provided
     */
    private List<String> extractHeadersFromData(List<Map<String, Object>> data) {
        if (data == null || data.isEmpty()) {
            return Collections.emptyList();
        }

        // Get headers from first row's keys
        return new ArrayList<>(data.get(0).keySet());
    }

    /**
     * Check if time values appear to be sequential/ordered
     */
    private boolean hasSequentialTimeValues(List<Object> values) {
        if (values == null || values.size() < 3) {
            return false;
        }

        // Filter out null values
        List<String> nonNullValues = values.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .collect(Collectors.toList());

        if (nonNullValues.size() < 3) {
            return false;
        }

        // Check if values are unique (time series usually has unique timestamps)
        Set<String> uniqueValues = new HashSet<>(nonNullValues);

        // If at least 70% of values are unique, likely sequential
        return uniqueValues.size() >= nonNullValues.size() * 0.7;
    }

    /**
     * Check if a string contains any of the given keywords
     */
    private boolean containsAnyKeyword(String text, Set<String> keywords) {
        if (text == null || keywords == null) {
            return false;
        }

        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
