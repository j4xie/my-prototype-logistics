package com.cretas.aims.service;

import com.cretas.aims.dto.intent.ExtractedSlots;
import com.cretas.aims.dto.intent.ExtractedSlots.ComparisonDetails;
import com.cretas.aims.dto.intent.ExtractedSlots.NumericDetails;
import com.cretas.aims.dto.intent.ExtractedSlots.SlotMatch;
import com.cretas.aims.dto.intent.SlotType;
import com.cretas.aims.dto.intent.TimeRange;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Slot Extractor Service
 *
 * Extracts structured parameters (slots) from user input using regex patterns.
 * This enables parameterized queries like "设备EQ001的状态" to extract "EQ001"
 * as the DEVICE_ID slot.
 *
 * <p>Key Features:</p>
 * <ul>
 *   <li>Entity ID extraction (device, employee, customer, batch, order, etc.)</li>
 *   <li>Time range parsing (relative: last 7 days; calendar: this month)</li>
 *   <li>Comparison type detection (ranking, YoY, MoM)</li>
 *   <li>Numeric constraint extraction (TOP N, greater than X)</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
public class SlotExtractor {

    // ==================== ID Extraction Patterns ====================

    /**
     * Device/Equipment ID patterns
     * Examples: EQ001, WH002, DEV003, M001, 设备001
     */
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile(
            "(?:设备|机器|机台|仪器)?\\s*([A-Z]{1,3}\\d{3,6})|" +
            "(?:设备|机器|机台|仪器)(\\d{3,6})"
    );

    /**
     * Employee ID patterns
     * Examples: 员工1001, E001, EMP001, 工号001
     */
    private static final Pattern EMPLOYEE_ID_PATTERN = Pattern.compile(
            "(?:员工|工号|工人)\\s*([A-Z]?\\d{3,6})|" +
            "(E\\d{3,6}|EMP\\d{3,6})"
    );

    /**
     * Customer ID patterns
     * Examples: C001, CUS001, CUST001, 客户001
     */
    private static final Pattern CUSTOMER_ID_PATTERN = Pattern.compile(
            "(?:客户|顾客)\\s*([A-Z]?\\d{3,6})|" +
            "(C\\d{3,6}|CUS\\d{3,6}|CUST\\d{3,6})"
    );

    /**
     * Batch ID patterns
     * Examples: B2026012401, BATCH001, MB-F001-001, 批次号B001
     */
    private static final Pattern BATCH_ID_PATTERN = Pattern.compile(
            "(?:批次|批号)\\s*([A-Z]?\\d{6,12}|[A-Z]{1,2}-[A-Z]\\d{3}-\\d{3})|" +
            "(B\\d{8,12}|BATCH\\d{3,6}|MB-[A-Z]\\d{3}-\\d{3})"
    );

    /**
     * Order ID patterns
     * Examples: O20260124001, ORD001, ORDER-2026, 订单号001
     */
    private static final Pattern ORDER_ID_PATTERN = Pattern.compile(
            "(?:订单|订单号)\\s*([A-Z]?\\d{6,12})|" +
            "(O\\d{8,12}|ORD\\d{3,6}|ORDER-\\d{4,12})"
    );

    /**
     * Product ID patterns
     * Examples: P001, PROD001, SKU001, 产品001
     */
    private static final Pattern PRODUCT_ID_PATTERN = Pattern.compile(
            "(?:产品|商品)\\s*([A-Z]?\\d{3,6})|" +
            "(P\\d{3,6}|PROD\\d{3,6}|SKU\\d{3,6})"
    );

    /**
     * Supplier ID patterns
     * Examples: SUP001, S001, 供应商001
     */
    private static final Pattern SUPPLIER_ID_PATTERN = Pattern.compile(
            "(?:供应商|供货商)\\s*([A-Z]?\\d{3,6})|" +
            "(SUP\\d{3,6}|S\\d{3,6})"
    );

    /**
     * Material ID patterns
     * Examples: M001, MAT001, 原料001
     */
    private static final Pattern MATERIAL_ID_PATTERN = Pattern.compile(
            "(?:原料|物料|材料)\\s*([A-Z]?\\d{3,6})|" +
            "(MAT\\d{3,6})"
    );

    // ==================== Time Extraction Patterns ====================

    /**
     * Relative time pattern: 最近/过去 N 天/周/月/年
     */
    private static final Pattern RELATIVE_TIME_PATTERN = Pattern.compile(
            "(最近|过去|近)(\\d+)个?(天|周|月|年)"
    );

    /**
     * Calendar period pattern: 本/这个/上个 周/月/季度/年
     */
    private static final Pattern CALENDAR_PERIOD_PATTERN = Pattern.compile(
            "(本|这个?|上个?|下个?)(周|月|季度|年)"
    );

    /**
     * Single day pattern: 今天/昨天/前天/明天/后天
     */
    private static final Pattern SINGLE_DAY_PATTERN = Pattern.compile(
            "(今天|昨天|前天|明天|后天)"
    );

    /**
     * Future time pattern: N 天/周/月后
     */
    private static final Pattern FUTURE_TIME_PATTERN = Pattern.compile(
            "(\\d+)个?(天|周|月|年)(后|内)"
    );

    // ==================== Numeric Extraction Patterns ====================

    /**
     * TOP N / 前N pattern
     */
    private static final Pattern TOP_N_PATTERN = Pattern.compile(
            "(前|TOP|top)(\\d+)|" +
            "(\\d+)(名|个|条|位)"
    );

    /**
     * Bottom N / 倒数N pattern
     */
    private static final Pattern BOTTOM_N_PATTERN = Pattern.compile(
            "(倒数|末)(\\d+)|" +
            "(后|末尾)(\\d+)(名|个|条|位)"
    );

    /**
     * Comparison operator pattern: 超过/大于/低于/小于 N
     */
    private static final Pattern COMPARISON_OP_PATTERN = Pattern.compile(
            "(超过|大于|高于|多于|低于|小于|少于|不足)(\\d+)(%?)"
    );

    /**
     * Percentage pattern
     */
    private static final Pattern PERCENTAGE_PATTERN = Pattern.compile(
            "(\\d+(?:\\.\\d+)?)\\s*(%|百分)"
    );

    // ==================== Comparison Type Patterns ====================

    /**
     * Ranking/extreme pattern: 最高/最低/最大/最小/第一/倒数
     */
    private static final Pattern RANKING_PATTERN = Pattern.compile(
            "(最高|最低|最大|最小|最好|最差|第一|倒数|最多|最少)"
    );

    /**
     * YoY (Year-over-Year) pattern: 同比
     */
    private static final Pattern YOY_PATTERN = Pattern.compile(
            "(同比|比去年|年同期|YoY|yoy|去年同期|与去年|跟去年|较去年|上年同期)"
    );

    /**
     * MoM (Month-over-Month) pattern: 环比
     */
    private static final Pattern MOM_PATTERN = Pattern.compile(
            "(环比|比上月|比上周|上期对比|MoM|mom|与上月|跟上月|和上月|较上月|上月同期)"
    );

    /**
     * QoQ (Quarter-over-Quarter) pattern: 季环比
     */
    private static final Pattern QOQ_PATTERN = Pattern.compile(
            "(季环比|比上季|上季度|QoQ|qoq|季度对比)"
    );

    /**
     * Trend pattern: 趋势/走势/变化
     */
    private static final Pattern TREND_PATTERN = Pattern.compile(
            "(趋势|走势|变化|增长|下降|波动)"
    );

    // ==================== Metric Patterns ====================

    /**
     * Business metric pattern
     */
    private static final Pattern METRIC_PATTERN = Pattern.compile(
            "(销量|销售额|产量|产能|库存|效率|合格率|良品率|不良率|" +
            "出勤率|迟到率|产值|成本|利润|订单量|发货量|到货量|" +
            "加工量|检测量|报废量|返工率|完成率|达标率)"
    );

    // ==================== Person Name Patterns ====================

    /**
     * Common Chinese surname + name pattern (2-4 characters)
     */
    private static final List<String> COMMON_SURNAMES = List.of(
            "张", "李", "王", "刘", "陈", "杨", "黄", "赵", "周", "吴",
            "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗"
    );

    // ==================== Department Patterns ====================

    private static final Pattern DEPARTMENT_PATTERN = Pattern.compile(
            "(车间[A-Z]|[A-Z]车间|生产部|质检部|仓储部|物流部|采购部|" +
            "销售部|财务部|人事部|技术部|研发部|行政部|" +
            "一车间|二车间|三车间|包装车间|加工车间)"
    );

    // ==================== Status Patterns ====================

    private static final Pattern STATUS_PATTERN = Pattern.compile(
            "(运行中|待机|故障|维修中|停机|正常|异常|完成|进行中|" +
            "待处理|已处理|已完成|未完成|合格|不合格|在库|出库)"
    );

    // ==================== Public Methods ====================

    /**
     * Extract all slots from user input
     *
     * @param userInput Original user input
     * @return ExtractedSlots containing all extracted parameters
     */
    public ExtractedSlots extract(String userInput) {
        if (userInput == null || userInput.trim().isEmpty()) {
            log.warn("Empty input received for slot extraction");
            return ExtractedSlots.empty("");
        }

        String input = userInput.trim();
        log.debug("Starting slot extraction for input: {}", input);

        ExtractedSlots.ExtractedSlotsBuilder builder = ExtractedSlots.builder()
                .originalInput(input)
                .slots(new HashMap<>())
                .slotMatches(new ArrayList<>());

        // Extract all slot types
        extractDeviceId(input, builder);
        extractEmployeeId(input, builder);
        extractCustomerId(input, builder);
        extractBatchId(input, builder);
        extractOrderId(input, builder);
        extractProductId(input, builder);
        extractSupplierId(input, builder);
        extractMaterialId(input, builder);

        // Extract time ranges
        TimeRange timeRange = parseTimeRange(input);
        if (timeRange != null) {
            builder.timeRange(timeRange);
            builder.slots(addToSlots(builder.build().getSlots(),
                    SlotType.TIME_RANGE, timeRange.getOriginalExpression()));
        }

        // Extract comparison details
        ComparisonDetails comparisonDetails = extractComparisonDetails(input);
        if (comparisonDetails != null) {
            builder.comparisonDetails(comparisonDetails);
            builder.slots(addToSlots(builder.build().getSlots(),
                    SlotType.COMPARISON, comparisonDetails.getOriginalExpression()));
        }

        // Extract numeric details
        NumericDetails numericDetails = extractNumericDetails(input);
        if (numericDetails != null) {
            builder.numericDetails(numericDetails);
            builder.slots(addToSlots(builder.build().getSlots(),
                    SlotType.NUMBER, String.valueOf(numericDetails.getValue())));
        }

        // Extract metric
        extractMetric(input, builder);

        // Extract department
        extractDepartment(input, builder);

        // Extract status
        extractStatus(input, builder);

        // Extract person name
        extractPersonName(input, builder);

        // Generate normalized input
        ExtractedSlots result = builder.build();
        result.setNormalizedInput(generateNormalizedInput(input, result));

        log.info("Slot extraction completed: {} slots extracted from '{}'",
                result.getSlotCount(), input);
        log.debug("Extracted slots: {}", result.getSlots());

        return result;
    }

    /**
     * Extract a specific slot type from input
     *
     * @param input User input text
     * @param type  Slot type to extract
     * @return Extracted value or empty if not found
     */
    public Optional<String> extractSlot(String input, SlotType type) {
        if (input == null || type == null) {
            return Optional.empty();
        }

        Pattern pattern = getPatternForType(type);
        if (pattern == null) {
            log.debug("No pattern defined for slot type: {}", type);
            return Optional.empty();
        }

        Matcher matcher = pattern.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            log.debug("Extracted {} = '{}' from input", type, value);
            return Optional.ofNullable(value);
        }

        return Optional.empty();
    }

    /**
     * Parse time expression to TimeRange
     *
     * @param timeExpr Time expression from user input
     * @return Parsed TimeRange or null if not parseable
     */
    public TimeRange parseTimeRange(String timeExpr) {
        if (timeExpr == null || timeExpr.isEmpty()) {
            return null;
        }

        // Check single day patterns first
        Matcher singleDayMatcher = SINGLE_DAY_PATTERN.matcher(timeExpr);
        if (singleDayMatcher.find()) {
            String day = singleDayMatcher.group(1);
            return parseSingleDay(day);
        }

        // Check relative time patterns: 最近/过去 N 天/周/月/年
        Matcher relativeMatcher = RELATIVE_TIME_PATTERN.matcher(timeExpr);
        if (relativeMatcher.find()) {
            int amount = Integer.parseInt(relativeMatcher.group(2));
            String unit = relativeMatcher.group(3);
            return parseRelativeTime(amount, unit, relativeMatcher.group(0));
        }

        // Check calendar period patterns: 本周/本月/上周/上月
        Matcher calendarMatcher = CALENDAR_PERIOD_PATTERN.matcher(timeExpr);
        if (calendarMatcher.find()) {
            String prefix = calendarMatcher.group(1);
            String unit = calendarMatcher.group(2);
            return parseCalendarPeriod(prefix, unit);
        }

        // Check future time patterns: N天后
        Matcher futureMatcher = FUTURE_TIME_PATTERN.matcher(timeExpr);
        if (futureMatcher.find()) {
            int amount = Integer.parseInt(futureMatcher.group(1));
            String unit = futureMatcher.group(2);
            String suffix = futureMatcher.group(3);
            return parseFutureTime(amount, unit, suffix, futureMatcher.group(0));
        }

        log.debug("Could not parse time expression: {}", timeExpr);
        return null;
    }

    // ==================== Private Extraction Methods ====================

    private void extractDeviceId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = DEVICE_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.DEVICE_ID, value, matcher);
            }
        }
    }

    private void extractEmployeeId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = EMPLOYEE_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.EMPLOYEE_ID, value, matcher);
            }
        }
    }

    private void extractCustomerId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = CUSTOMER_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.CUSTOMER_ID, value, matcher);
            }
        }
    }

    private void extractBatchId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = BATCH_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.BATCH_ID, value, matcher);
            }
        }
    }

    private void extractOrderId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = ORDER_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.ORDER_ID, value, matcher);
            }
        }
    }

    private void extractProductId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = PRODUCT_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.PRODUCT_ID, value, matcher);
            }
        }
    }

    private void extractSupplierId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = SUPPLIER_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.SUPPLIER_ID, value, matcher);
            }
        }
    }

    private void extractMaterialId(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = MATERIAL_ID_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = getFirstNonNullGroup(matcher);
            if (value != null) {
                addSlotToBuilder(builder, SlotType.MATERIAL_ID, value, matcher);
            }
        }
    }

    private void extractMetric(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = METRIC_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = matcher.group(1);
            addSlotToBuilder(builder, SlotType.METRIC, value, matcher);
        }
    }

    private void extractDepartment(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = DEPARTMENT_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = matcher.group(1);
            addSlotToBuilder(builder, SlotType.DEPARTMENT, value, matcher);
        }
    }

    private void extractStatus(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        Matcher matcher = STATUS_PATTERN.matcher(input);
        if (matcher.find()) {
            String value = matcher.group(1);
            addSlotToBuilder(builder, SlotType.STATUS, value, matcher);
        }
    }

    private void extractPersonName(String input, ExtractedSlots.ExtractedSlotsBuilder builder) {
        // Try to find common Chinese names (surname + 1-2 characters)
        for (String surname : COMMON_SURNAMES) {
            int idx = input.indexOf(surname);
            if (idx >= 0 && idx + 2 <= input.length()) {
                // Extract 2-3 characters starting from surname
                int endIdx = Math.min(idx + 3, input.length());
                String potentialName = input.substring(idx, endIdx);

                // Validate it looks like a name (no numbers or special chars)
                if (potentialName.matches("^[\u4e00-\u9fa5]{2,3}$")) {
                    addSlotToBuilder(builder, SlotType.PERSON_NAME, potentialName, idx, endIdx, potentialName);
                    break;
                }
            }
        }
    }

    // ==================== Comparison Extraction ====================

    private ComparisonDetails extractComparisonDetails(String input) {
        // Check for YoY
        if (YOY_PATTERN.matcher(input).find()) {
            return ComparisonDetails.builder()
                    .type(ComparisonDetails.ComparisonType.YOY)
                    .originalExpression(findMatch(YOY_PATTERN, input))
                    .build();
        }

        // Check for MoM
        if (MOM_PATTERN.matcher(input).find()) {
            return ComparisonDetails.builder()
                    .type(ComparisonDetails.ComparisonType.MOM)
                    .originalExpression(findMatch(MOM_PATTERN, input))
                    .build();
        }

        // Check for QoQ
        if (QOQ_PATTERN.matcher(input).find()) {
            return ComparisonDetails.builder()
                    .type(ComparisonDetails.ComparisonType.QOQ)
                    .originalExpression(findMatch(QOQ_PATTERN, input))
                    .build();
        }

        // Check for ranking
        Matcher rankingMatcher = RANKING_PATTERN.matcher(input);
        if (rankingMatcher.find()) {
            String rankWord = rankingMatcher.group(1);
            ComparisonDetails.SortDirection direction =
                    (rankWord.contains("最高") || rankWord.contains("最大") ||
                     rankWord.contains("最多") || rankWord.contains("第一") ||
                     rankWord.contains("最好"))
                    ? ComparisonDetails.SortDirection.DESC
                    : ComparisonDetails.SortDirection.ASC;

            // Check if it's MAX/MIN or RANKING
            ComparisonDetails.ComparisonType type =
                    (rankWord.equals("第一") || rankWord.equals("倒数"))
                    ? ComparisonDetails.ComparisonType.RANKING
                    : (rankWord.contains("最高") || rankWord.contains("最大") ||
                       rankWord.contains("最多") || rankWord.contains("最好"))
                      ? ComparisonDetails.ComparisonType.MAX
                      : ComparisonDetails.ComparisonType.MIN;

            return ComparisonDetails.builder()
                    .type(type)
                    .direction(direction)
                    .originalExpression(rankWord)
                    .build();
        }

        // Check for trend
        if (TREND_PATTERN.matcher(input).find()) {
            return ComparisonDetails.builder()
                    .type(ComparisonDetails.ComparisonType.TREND)
                    .originalExpression(findMatch(TREND_PATTERN, input))
                    .build();
        }

        return null;
    }

    // ==================== Numeric Extraction ====================

    private NumericDetails extractNumericDetails(String input) {
        // Check for TOP N
        Matcher topMatcher = TOP_N_PATTERN.matcher(input);
        if (topMatcher.find()) {
            String numStr = topMatcher.group(2) != null ? topMatcher.group(2) : topMatcher.group(3);
            if (numStr != null) {
                return NumericDetails.builder()
                        .type(NumericDetails.NumericType.TOP_N)
                        .value(Integer.parseInt(numStr))
                        .originalExpression(topMatcher.group(0))
                        .build();
            }
        }

        // Check for BOTTOM N
        Matcher bottomMatcher = BOTTOM_N_PATTERN.matcher(input);
        if (bottomMatcher.find()) {
            String numStr = bottomMatcher.group(2) != null ? bottomMatcher.group(2) : bottomMatcher.group(4);
            if (numStr != null) {
                return NumericDetails.builder()
                        .type(NumericDetails.NumericType.BOTTOM_N)
                        .value(Integer.parseInt(numStr))
                        .originalExpression(bottomMatcher.group(0))
                        .build();
            }
        }

        // Check for comparison operators
        Matcher compMatcher = COMPARISON_OP_PATTERN.matcher(input);
        if (compMatcher.find()) {
            String op = compMatcher.group(1);
            int value = Integer.parseInt(compMatcher.group(2));
            boolean isPercentage = "%".equals(compMatcher.group(3));

            NumericDetails.NumericType type;
            if (op.matches("超过|大于|高于|多于")) {
                type = isPercentage ? NumericDetails.NumericType.PERCENTAGE : NumericDetails.NumericType.GREATER_THAN;
            } else {
                type = isPercentage ? NumericDetails.NumericType.PERCENTAGE : NumericDetails.NumericType.LESS_THAN;
            }

            return NumericDetails.builder()
                    .type(type)
                    .value(value)
                    .originalExpression(compMatcher.group(0))
                    .build();
        }

        // Check for standalone percentage
        Matcher pctMatcher = PERCENTAGE_PATTERN.matcher(input);
        if (pctMatcher.find()) {
            return NumericDetails.builder()
                    .type(NumericDetails.NumericType.PERCENTAGE)
                    .value((int) Double.parseDouble(pctMatcher.group(1)))
                    .originalExpression(pctMatcher.group(0))
                    .build();
        }

        return null;
    }

    // ==================== Time Parsing Helpers ====================

    private TimeRange parseSingleDay(String day) {
        LocalDate date = LocalDate.now();
        switch (day) {
            case "今天":
                return TimeRange.today();
            case "昨天":
                return TimeRange.yesterday();
            case "前天":
                return TimeRange.builder()
                        .startDate(date.minusDays(2))
                        .endDate(date.minusDays(2))
                        .originalExpression("前天")
                        .rangeType(TimeRange.TimeRangeType.POINT)
                        .build();
            case "明天":
                return TimeRange.builder()
                        .startDate(date.plusDays(1))
                        .endDate(date.plusDays(1))
                        .originalExpression("明天")
                        .rangeType(TimeRange.TimeRangeType.POINT)
                        .isFuture(true)
                        .build();
            case "后天":
                return TimeRange.builder()
                        .startDate(date.plusDays(2))
                        .endDate(date.plusDays(2))
                        .originalExpression("后天")
                        .rangeType(TimeRange.TimeRangeType.POINT)
                        .isFuture(true)
                        .build();
            default:
                return null;
        }
    }

    private TimeRange parseRelativeTime(int amount, String unit, String originalExpr) {
        switch (unit) {
            case "天":
                return TimeRange.lastDays(amount, originalExpr);
            case "周":
                return TimeRange.lastWeeks(amount, originalExpr);
            case "月":
                return TimeRange.lastMonths(amount, originalExpr);
            case "年":
                LocalDate today = LocalDate.now();
                return TimeRange.builder()
                        .startDate(today.minusYears(amount))
                        .endDate(today)
                        .originalExpression(originalExpr)
                        .rangeType(TimeRange.TimeRangeType.RELATIVE)
                        .build();
            default:
                return null;
        }
    }

    private TimeRange parseCalendarPeriod(String prefix, String unit) {
        boolean isCurrent = prefix.equals("本") || prefix.startsWith("这");
        boolean isPrevious = prefix.startsWith("上");
        boolean isNext = prefix.startsWith("下");

        String expression = prefix + unit;

        switch (unit) {
            case "周":
                if (isCurrent) return TimeRange.thisWeek();
                if (isPrevious) return TimeRange.lastWeek();
                if (isNext) {
                    LocalDate today = LocalDate.now();
                    LocalDate startOfNextWeek = today.plusWeeks(1).minusDays(today.getDayOfWeek().getValue() - 1);
                    return TimeRange.builder()
                            .startDate(startOfNextWeek)
                            .endDate(startOfNextWeek.plusDays(6))
                            .originalExpression(expression)
                            .rangeType(TimeRange.TimeRangeType.CALENDAR_PERIOD)
                            .isFuture(true)
                            .build();
                }
                break;
            case "月":
                if (isCurrent) return TimeRange.thisMonth();
                if (isPrevious) return TimeRange.lastMonth();
                if (isNext) {
                    LocalDate today = LocalDate.now();
                    LocalDate startOfNextMonth = today.plusMonths(1).withDayOfMonth(1);
                    return TimeRange.builder()
                            .startDate(startOfNextMonth)
                            .endDate(startOfNextMonth.withDayOfMonth(startOfNextMonth.lengthOfMonth()))
                            .originalExpression(expression)
                            .rangeType(TimeRange.TimeRangeType.CALENDAR_PERIOD)
                            .isFuture(true)
                            .build();
                }
                break;
            case "季度":
                // Implement quarter logic
                break;
            case "年":
                LocalDate today = LocalDate.now();
                int year = isCurrent ? today.getYear() : (isPrevious ? today.getYear() - 1 : today.getYear() + 1);
                return TimeRange.builder()
                        .startDate(LocalDate.of(year, 1, 1))
                        .endDate(LocalDate.of(year, 12, 31))
                        .originalExpression(expression)
                        .rangeType(TimeRange.TimeRangeType.CALENDAR_PERIOD)
                        .isFuture(isNext)
                        .build();
        }

        return null;
    }

    private TimeRange parseFutureTime(int amount, String unit, String suffix, String originalExpr) {
        LocalDate today = LocalDate.now();
        LocalDate endDate;

        switch (unit) {
            case "天":
                endDate = today.plusDays(amount);
                break;
            case "周":
                endDate = today.plusWeeks(amount);
                break;
            case "月":
                endDate = today.plusMonths(amount);
                break;
            case "年":
                endDate = today.plusYears(amount);
                break;
            default:
                return null;
        }

        // "内" means within the period (today to end), "后" means at that point
        LocalDate startDate = suffix.equals("内") ? today : endDate;

        return TimeRange.builder()
                .startDate(startDate)
                .endDate(endDate)
                .originalExpression(originalExpr)
                .rangeType(TimeRange.TimeRangeType.RELATIVE)
                .isFuture(true)
                .build();
    }

    // ==================== Utility Methods ====================

    private Pattern getPatternForType(SlotType type) {
        switch (type) {
            case DEVICE_ID: return DEVICE_ID_PATTERN;
            case EMPLOYEE_ID: return EMPLOYEE_ID_PATTERN;
            case CUSTOMER_ID: return CUSTOMER_ID_PATTERN;
            case BATCH_ID: return BATCH_ID_PATTERN;
            case ORDER_ID: return ORDER_ID_PATTERN;
            case PRODUCT_ID: return PRODUCT_ID_PATTERN;
            case SUPPLIER_ID: return SUPPLIER_ID_PATTERN;
            case MATERIAL_ID: return MATERIAL_ID_PATTERN;
            case METRIC: return METRIC_PATTERN;
            case DEPARTMENT: return DEPARTMENT_PATTERN;
            case STATUS: return STATUS_PATTERN;
            default: return null;
        }
    }

    private String getFirstNonNullGroup(Matcher matcher) {
        for (int i = 1; i <= matcher.groupCount(); i++) {
            String group = matcher.group(i);
            if (group != null && !group.isEmpty()) {
                return group;
            }
        }
        return null;
    }

    private String findMatch(Pattern pattern, String input) {
        Matcher matcher = pattern.matcher(input);
        if (matcher.find()) {
            return matcher.group(0);
        }
        return null;
    }

    private void addSlotToBuilder(ExtractedSlots.ExtractedSlotsBuilder builder,
                                   SlotType type, String value, Matcher matcher) {
        addSlotToBuilder(builder, type, value, matcher.start(), matcher.end(), matcher.group(0));
    }

    private void addSlotToBuilder(ExtractedSlots.ExtractedSlotsBuilder builder,
                                   SlotType type, String value,
                                   int startPos, int endPos, String matchedText) {
        // Build the slot match
        SlotMatch match = SlotMatch.builder()
                .slotType(type)
                .value(value)
                .startPos(startPos)
                .endPos(endPos)
                .matchedText(matchedText)
                .confidence(1.0)
                .build();

        // Get current state
        ExtractedSlots current = builder.build();

        // Add to slot matches
        List<SlotMatch> matches = new ArrayList<>(current.getSlotMatches());
        matches.add(match);
        builder.slotMatches(matches);

        // Add to slots map
        Map<SlotType, String> slots = new HashMap<>(current.getSlots());
        slots.put(type, value);
        builder.slots(slots);

        log.debug("Extracted slot: {} = '{}' at position [{}-{}]", type, value, startPos, endPos);
    }

    private Map<SlotType, String> addToSlots(Map<SlotType, String> slots, SlotType type, String value) {
        Map<SlotType, String> newSlots = new HashMap<>(slots);
        newSlots.put(type, value);
        return newSlots;
    }

    private String generateNormalizedInput(String input, ExtractedSlots slots) {
        if (slots.getSlotMatches().isEmpty()) {
            return input;
        }

        // Sort matches by position (descending) to replace from end to start
        List<SlotMatch> sortedMatches = new ArrayList<>(slots.getSlotMatches());
        sortedMatches.sort((a, b) -> b.getStartPos() - a.getStartPos());

        StringBuilder normalized = new StringBuilder(input);
        for (SlotMatch match : sortedMatches) {
            String placeholder = "{" + match.getSlotType().name() + "}";
            normalized.replace(match.getStartPos(), match.getEndPos(), placeholder);
        }

        return normalized.toString();
    }
}
