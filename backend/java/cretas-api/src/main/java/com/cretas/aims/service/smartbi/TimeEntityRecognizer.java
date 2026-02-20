package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DateRange;
import com.cretas.aims.dto.smartbi.TimeEntity;
import com.cretas.aims.dto.smartbi.TimeEntity.TimeGranularity;
import com.cretas.aims.dto.smartbi.TimeEntity.TimeType;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Time Entity Recognizer Service
 *
 * Efficient time entity recognition using Trie tree for fixed patterns
 * and regex matching for dynamic patterns.
 *
 * Supports recognition of:
 * - Relative time expressions: today, yesterday, this week, last month, etc.
 * - Dynamic patterns: last N days, last N weeks, last N months
 * - Absolute dates: 2024-01-15, 2024年1月15日
 * - Quarter expressions: Q1, first quarter, this quarter
 *
 * Features:
 * - O(n) matching complexity using Trie tree for fixed patterns
 * - Regex matching for dynamic and absolute date patterns
 * - Automatic date range calculation
 * - Position tracking for matched entities
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class TimeEntityRecognizer extends BaseEntityRecognizer<TimeEntity, TimeEntityRecognizer.TimeTrieNode> {

    // ==================== Configuration ====================

    @Value("${smartbi.time.dictionary-file:config/smartbi/time_dictionary.json}")
    private String dictionaryFile;

    // ==================== Trie Node ====================

    /**
     * Time-specific Trie node
     */
    public static class TimeTrieNode extends BaseTrieNode {
        public TimeType timeType;
        public TimeGranularity granularity;
        public String description;

        public TimeTrieNode() {
            super();
        }
    }

    // ==================== Additional Data Structures ====================

    /**
     * Time type information index
     */
    private final Map<String, TimeTypeInfo> timeTypeIndex = new ConcurrentHashMap<>();

    /**
     * Quarter patterns mapping
     */
    private final Map<String, Integer> quarterPatterns = new ConcurrentHashMap<>();

    /**
     * Compiled regex patterns for dynamic matching
     */
    private final Map<String, Pattern> dynamicPatterns = new ConcurrentHashMap<>();

    // ==================== Inner Classes ====================

    private static class TimeTypeInfo {
        TimeType type;
        TimeGranularity granularity;
        String description;

        TimeTypeInfo(TimeType type, TimeGranularity granularity, String description) {
            this.type = type;
            this.granularity = granularity;
            this.description = description;
        }
    }

    // ==================== Constructor ====================

    public TimeEntityRecognizer(ObjectMapper objectMapper) {
        super(objectMapper);
    }

    // ==================== BaseEntityRecognizer Implementation ====================

    @Override
    protected String getDictionaryFile() {
        return dictionaryFile;
    }

    @Override
    protected String getDictType() {
        return "time";
    }

    @Override
    protected String getRecognizerName() {
        return "TimeEntityRecognizer";
    }

    @Override
    protected TimeTrieNode createTrieNode() {
        return new TimeTrieNode();
    }

    @Override
    protected TimeEntity createEntity(String matchedText, TimeTrieNode node, int start, int end) {
        TimeType timeType = node.timeType;
        TimeGranularity granularity = node.granularity;

        DateRange range = calculateDateRange(timeType, matchedText);
        if (range == null) {
            return null;
        }

        // Handle quarter patterns specially
        if (timeType == TimeType.ABSOLUTE_QUARTER && quarterPatterns.containsKey(matchedText)) {
            int quarterNum = quarterPatterns.get(matchedText);
            LocalDate today = LocalDate.now();
            return TimeEntity.quarter(matchedText, timeType, today.getYear(), quarterNum,
                    range.getStartDate(), range.getEndDate(), false, start, end);
        }

        return TimeEntity.relative(matchedText, timeType, granularity,
                range.getStartDate(), range.getEndDate(), start, end);
    }

    @Override
    protected int getEntityStartIndex(TimeEntity entity) {
        return entity.getStartIndex();
    }

    @Override
    protected void clearIndexes() {
        timeTypeIndex.clear();
        quarterPatterns.clear();
        dynamicPatterns.clear();
    }

    @Override
    protected void collectAdditionalStatistics(Map<String, Object> stats) {
        stats.put("patternCount", timeTypeIndex.size());
        stats.put("quarterPatternCount", quarterPatterns.size());
        stats.put("dynamicPatternCount", dynamicPatterns.size());
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void processDictionaryData(Map<String, Object> dictionary) {
        // Load relative time patterns
        if (dictionary.containsKey("relativeTime")) {
            Map<String, Map<String, Object>> relativeTime =
                    (Map<String, Map<String, Object>>) dictionary.get("relativeTime");
            loadRelativeTimePatterns(relativeTime);
        }

        // Load quarter patterns
        if (dictionary.containsKey("quarters")) {
            Map<String, List<String>> quarters =
                    (Map<String, List<String>>) dictionary.get("quarters");
            loadQuarterPatterns(quarters);
        }

        // Load dynamic patterns (regex)
        if (dictionary.containsKey("dynamicPatterns")) {
            Map<String, String> dynPatterns =
                    (Map<String, String>) dictionary.get("dynamicPatterns");
            loadDynamicPatterns(dynPatterns);
        }
    }

    @Override
    protected void processDbEntry(SmartBiDictionary entry) {
        String pattern = entry.getName();

        TimeType timeType = TimeType.TODAY;
        TimeGranularity granularity = TimeGranularity.DAY;

        Map<String, Object> metadata = parseMetadata(entry.getMetadata());
        if (metadata.containsKey("timeType")) {
            timeType = TimeType.valueOf(metadata.get("timeType").toString());
        }
        if (metadata.containsKey("granularity")) {
            granularity = TimeGranularity.valueOf(metadata.get("granularity").toString());
        }

        addToTrieWithTime(pattern, timeType, granularity, entry.getName());
        timeTypeIndex.put(pattern, new TimeTypeInfo(timeType, granularity, entry.getName()));

        // Process aliases
        List<String> aliases = parseAliases(entry.getAliases());
        for (String alias : aliases) {
            addToTrieWithTime(alias, timeType, granularity, entry.getName());
            timeTypeIndex.put(alias, new TimeTypeInfo(timeType, granularity, entry.getName()));
        }
    }

    @Override
    protected void initDefaultDictionary() {
        log.info("Initializing default time dictionary...");

        // Default relative time patterns
        Map<TimeType, List<String>> defaultPatterns = new LinkedHashMap<>();
        defaultPatterns.put(TimeType.TODAY, Arrays.asList("今天", "当天", "今日", "本日"));
        defaultPatterns.put(TimeType.YESTERDAY, Arrays.asList("昨天", "昨日"));
        defaultPatterns.put(TimeType.THIS_WEEK, Arrays.asList("本周", "这周", "这一周", "当周"));
        defaultPatterns.put(TimeType.LAST_WEEK, Arrays.asList("上周", "上一周", "前一周"));
        defaultPatterns.put(TimeType.THIS_MONTH, Arrays.asList("本月", "这个月", "当月", "这月"));
        defaultPatterns.put(TimeType.LAST_MONTH, Arrays.asList("上月", "上个月", "前一个月"));
        defaultPatterns.put(TimeType.THIS_QUARTER, Arrays.asList("本季度", "这个季度", "当季", "本季"));
        defaultPatterns.put(TimeType.LAST_QUARTER, Arrays.asList("上季度", "上个季度", "前一季度"));
        defaultPatterns.put(TimeType.THIS_YEAR, Arrays.asList("今年", "本年", "这一年", "当年"));
        defaultPatterns.put(TimeType.LAST_YEAR, Arrays.asList("去年", "上一年", "前一年"));

        for (Map.Entry<TimeType, List<String>> entry : defaultPatterns.entrySet()) {
            TimeType type = entry.getKey();
            TimeGranularity granularity = inferGranularityFromType(type);
            for (String pattern : entry.getValue()) {
                addToTrieWithTime(pattern, type, granularity, pattern);
                timeTypeIndex.put(pattern, new TimeTypeInfo(type, granularity, pattern));
            }
        }

        // Default quarter patterns
        String[][] defaultQuarters = {
                {"Q1", "第一季度", "一季度", "1季度"},
                {"Q2", "第二季度", "二季度", "2季度"},
                {"Q3", "第三季度", "三季度", "3季度"},
                {"Q4", "第四季度", "四季度", "4季度"}
        };

        for (int i = 0; i < defaultQuarters.length; i++) {
            int quarterNum = i + 1;
            for (String pattern : defaultQuarters[i]) {
                quarterPatterns.put(pattern, quarterNum);
                addToTrieWithTime(pattern, TimeType.ABSOLUTE_QUARTER, TimeGranularity.QUARTER, "Q" + quarterNum);
            }
        }

        // Default dynamic patterns
        dynamicPatterns.put("LAST_N_DAYS", Pattern.compile("最近(\\d+)天|过去(\\d+)天|近(\\d+)天"));
        dynamicPatterns.put("LAST_N_WEEKS", Pattern.compile("最近(\\d+)周|过去(\\d+)周|近(\\d+)周"));
        dynamicPatterns.put("LAST_N_MONTHS", Pattern.compile("最近(\\d+)个?月|过去(\\d+)个?月|近(\\d+)个?月"));
        dynamicPatterns.put("ABSOLUTE_DATE", Pattern.compile("(\\d{4})年(\\d{1,2})月(\\d{1,2})日?"));
        dynamicPatterns.put("ABSOLUTE_MONTH", Pattern.compile("(\\d{4})年(\\d{1,2})月"));
        dynamicPatterns.put("ABSOLUTE_YEAR", Pattern.compile("(\\d{4})年"));
        dynamicPatterns.put("ISO_DATE", Pattern.compile("(\\d{4})-(\\d{1,2})-(\\d{1,2})"));

        log.info("Default dictionary initialized with {} patterns", timeTypeIndex.size());
    }

    // ==================== Override recognize() for regex patterns ====================

    @Override
    public List<TimeEntity> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<TimeEntity> entities = new ArrayList<>();

        // Phase 1: Trie-based matching for fixed patterns
        List<TimeEntity> trieMatches = recognizeByTrie(text);
        entities.addAll(trieMatches);

        // Phase 2: Regex matching for dynamic patterns
        List<TimeEntity> regexMatches = recognizeByRegex(text);

        // Add non-overlapping regex matches
        for (TimeEntity regexMatch : regexMatches) {
            if (!overlapsWithAny(regexMatch, entities)) {
                entities.add(regexMatch);
            }
        }

        entitiesFound += entities.size();

        // Sort by position
        entities.sort(Comparator.comparingInt(TimeEntity::getStartIndex));

        return entities;
    }

    // ==================== Private Loading Methods ====================

    @SuppressWarnings("unchecked")
    private void loadRelativeTimePatterns(Map<String, Map<String, Object>> relativeTime) {
        for (Map.Entry<String, Map<String, Object>> entry : relativeTime.entrySet()) {
            String typeStr = entry.getKey();
            Map<String, Object> typeData = entry.getValue();

            TimeType timeType = TimeType.valueOf(typeStr);
            TimeGranularity granularity = inferGranularityFromType(timeType);

            String description = (String) typeData.getOrDefault("description", typeStr);

            List<String> patterns = (List<String>) typeData.get("patterns");
            if (patterns != null) {
                for (String pattern : patterns) {
                    addToTrieWithTime(pattern, timeType, granularity, description);
                    timeTypeIndex.put(pattern, new TimeTypeInfo(timeType, granularity, description));
                }
            }
        }
    }

    private void loadQuarterPatterns(Map<String, List<String>> quarters) {
        for (Map.Entry<String, List<String>> entry : quarters.entrySet()) {
            String quarterKey = entry.getKey();
            int quarterNum = Integer.parseInt(quarterKey.substring(1));
            List<String> patterns = entry.getValue();

            for (String pattern : patterns) {
                quarterPatterns.put(pattern, quarterNum);
                addToTrieWithTime(pattern, TimeType.ABSOLUTE_QUARTER, TimeGranularity.QUARTER, quarterKey);
            }
        }
    }

    private void loadDynamicPatterns(Map<String, String> patterns) {
        for (Map.Entry<String, String> entry : patterns.entrySet()) {
            String patternName = entry.getKey();
            String regexStr = entry.getValue();
            try {
                Pattern pattern = Pattern.compile(regexStr);
                dynamicPatterns.put(patternName, pattern);
                log.debug("Loaded dynamic pattern: {} -> {}", patternName, regexStr);
            } catch (Exception e) {
                log.warn("Invalid regex pattern {}: {}", patternName, e.getMessage());
            }
        }
    }

    private void addToTrieWithTime(String term, TimeType type, TimeGranularity granularity, String description) {
        addToTrie(term, node -> {
            node.timeType = type;
            node.granularity = granularity;
            node.description = description;
        });
    }

    // ==================== Recognition Methods ====================

    private List<TimeEntity> recognizeByTrie(String text) {
        List<TimeEntity> entities = new ArrayList<>();
        int textLength = text.length();

        for (int i = 0; i < textLength; i++) {
            BaseTrieNode current = root;
            int j = i;
            BaseTrieNode lastMatch = null;
            int lastMatchEnd = i;

            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    lastMatch = current;
                    lastMatchEnd = j;
                }
            }

            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                TimeTrieNode node = (TimeTrieNode) lastMatch;
                TimeEntity entity = createEntity(matchedText, node, i, lastMatchEnd);
                if (entity != null) {
                    entities.add(entity);
                    i = lastMatchEnd - 1;
                }
            }
        }

        return entities;
    }

    private List<TimeEntity> recognizeByRegex(String text) {
        List<TimeEntity> entities = new ArrayList<>();

        // Match dynamic patterns (last N days/weeks/months)
        matchDynamicPattern(text, "LAST_N_DAYS", TimeType.LAST_N_DAYS, TimeGranularity.DAY, entities);
        matchDynamicPattern(text, "LAST_N_WEEKS", TimeType.LAST_N_WEEKS, TimeGranularity.WEEK, entities);
        matchDynamicPattern(text, "LAST_N_MONTHS", TimeType.LAST_N_MONTHS, TimeGranularity.MONTH, entities);

        // Match absolute dates
        matchAbsoluteDate(text, entities);
        matchIsoDate(text, entities);
        matchAbsoluteMonth(text, entities);
        matchAbsoluteYear(text, entities);

        return entities;
    }

    private void matchDynamicPattern(String text, String patternName, TimeType timeType,
                                      TimeGranularity granularity, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get(patternName);
        if (pattern == null) return;

        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            String matchedText = matcher.group();
            int number = extractNumber(matcher);

            if (number > 0) {
                DateRange range = calculateDynamicRange(timeType, number);
                TimeEntity entity = TimeEntity.dynamic(
                        matchedText, timeType, granularity,
                        range.getStartDate(), range.getEndDate(),
                        number, matcher.start(), matcher.end());
                entities.add(entity);
            }
        }
    }

    private void matchAbsoluteDate(String text, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get("ABSOLUTE_DATE");
        if (pattern == null) return;

        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            try {
                int year = Integer.parseInt(matcher.group(1));
                int month = Integer.parseInt(matcher.group(2));
                int day = Integer.parseInt(matcher.group(3));

                if (isValidDate(year, month, day)) {
                    LocalDate date = LocalDate.of(year, month, day);
                    TimeEntity entity = TimeEntity.absoluteDate(
                            matcher.group(), date, matcher.start(), matcher.end());
                    entities.add(entity);
                }
            } catch (Exception e) {
                log.debug("Failed to parse absolute date: {}", matcher.group());
            }
        }
    }

    private void matchIsoDate(String text, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get("ISO_DATE");
        if (pattern == null) return;

        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            try {
                int year = Integer.parseInt(matcher.group(1));
                int month = Integer.parseInt(matcher.group(2));
                int day = Integer.parseInt(matcher.group(3));

                if (isValidDate(year, month, day)) {
                    LocalDate date = LocalDate.of(year, month, day);
                    TimeEntity entity = TimeEntity.builder()
                            .text(matcher.group())
                            .timeType(TimeType.ISO_DATE)
                            .granularity(TimeGranularity.DAY)
                            .startDate(date)
                            .endDate(date)
                            .startIndex(matcher.start())
                            .endIndex(matcher.end())
                            .relative(false)
                            .year(year)
                            .month(month)
                            .day(day)
                            .confidence(1.0)
                            .build();
                    entities.add(entity);
                }
            } catch (Exception e) {
                log.debug("Failed to parse ISO date: {}", matcher.group());
            }
        }
    }

    private void matchAbsoluteMonth(String text, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get("ABSOLUTE_MONTH");
        if (pattern == null) return;

        Set<Integer> dateStarts = new HashSet<>();
        Pattern datePattern = dynamicPatterns.get("ABSOLUTE_DATE");
        if (datePattern != null) {
            Matcher dateMatcher = datePattern.matcher(text);
            while (dateMatcher.find()) {
                dateStarts.add(dateMatcher.start());
            }
        }

        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            if (dateStarts.contains(matcher.start())) {
                continue;
            }

            try {
                int year = Integer.parseInt(matcher.group(1));
                int month = Integer.parseInt(matcher.group(2));

                if (isValidMonth(month)) {
                    LocalDate startDate = LocalDate.of(year, month, 1);
                    LocalDate endDate = startDate.with(TemporalAdjusters.lastDayOfMonth());

                    TimeEntity entity = TimeEntity.absoluteMonth(
                            matcher.group(), year, month,
                            startDate, endDate, matcher.start(), matcher.end());
                    entities.add(entity);
                }
            } catch (Exception e) {
                log.debug("Failed to parse absolute month: {}", matcher.group());
            }
        }
    }

    private void matchAbsoluteYear(String text, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get("ABSOLUTE_YEAR");
        if (pattern == null) return;

        Set<Integer> monthStarts = new HashSet<>();
        Pattern monthPattern = dynamicPatterns.get("ABSOLUTE_MONTH");
        if (monthPattern != null) {
            Matcher monthMatcher = monthPattern.matcher(text);
            while (monthMatcher.find()) {
                monthStarts.add(monthMatcher.start());
            }
        }

        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            if (monthStarts.contains(matcher.start())) {
                continue;
            }

            try {
                int year = Integer.parseInt(matcher.group(1));
                if (year >= 1900 && year <= 2100) {
                    LocalDate startDate = LocalDate.of(year, 1, 1);
                    LocalDate endDate = LocalDate.of(year, 12, 31);

                    TimeEntity entity = TimeEntity.absoluteYear(
                            matcher.group(), year, startDate, endDate,
                            matcher.start(), matcher.end());
                    entities.add(entity);
                }
            } catch (Exception e) {
                log.debug("Failed to parse absolute year: {}", matcher.group());
            }
        }
    }

    // ==================== Date Calculation Methods ====================

    private TimeGranularity inferGranularityFromType(TimeType type) {
        switch (type) {
            case TODAY:
            case YESTERDAY:
            case LAST_N_DAYS:
            case ABSOLUTE_DATE:
            case ISO_DATE:
                return TimeGranularity.DAY;
            case THIS_WEEK:
            case LAST_WEEK:
            case LAST_N_WEEKS:
                return TimeGranularity.WEEK;
            case THIS_MONTH:
            case LAST_MONTH:
            case LAST_N_MONTHS:
            case ABSOLUTE_MONTH:
                return TimeGranularity.MONTH;
            case THIS_QUARTER:
            case LAST_QUARTER:
            case ABSOLUTE_QUARTER:
                return TimeGranularity.QUARTER;
            case THIS_YEAR:
            case LAST_YEAR:
            case ABSOLUTE_YEAR:
                return TimeGranularity.YEAR;
            default:
                return TimeGranularity.DAY;
        }
    }

    private DateRange calculateDateRange(TimeType timeType, String matchedText) {
        switch (timeType) {
            case TODAY:
                return DateRange.today();
            case YESTERDAY:
                return DateRange.yesterday();
            case THIS_WEEK:
                return DateRange.thisWeek();
            case LAST_WEEK:
                return DateRange.lastWeek();
            case THIS_MONTH:
                return DateRange.thisMonth();
            case LAST_MONTH:
                return DateRange.lastMonth();
            case THIS_QUARTER:
                return DateRange.thisQuarter();
            case LAST_QUARTER:
                return calculateLastQuarter();
            case THIS_YEAR:
                return DateRange.thisYear();
            case LAST_YEAR:
                return DateRange.lastYear();
            case ABSOLUTE_QUARTER:
                if (quarterPatterns.containsKey(matchedText)) {
                    int quarterNum = quarterPatterns.get(matchedText);
                    LocalDate today = LocalDate.now();
                    return DateRange.quarter(today.getYear(), quarterNum);
                }
                return null;
            default:
                return null;
        }
    }

    private DateRange calculateDynamicRange(TimeType timeType, int number) {
        LocalDate today = LocalDate.now();

        switch (timeType) {
            case LAST_N_DAYS:
                return DateRange.lastDays(number);

            case LAST_N_WEEKS:
                LocalDate weekStart = today.minusWeeks(number).with(DayOfWeek.MONDAY);
                return DateRange.builder()
                        .startDate(weekStart)
                        .endDate(today)
                        .granularity("WEEK")
                        .originalExpression("最近" + number + "周")
                        .relative(true)
                        .build();

            case LAST_N_MONTHS:
                LocalDate monthStart = today.minusMonths(number).withDayOfMonth(1);
                return DateRange.builder()
                        .startDate(monthStart)
                        .endDate(today)
                        .granularity("MONTH")
                        .originalExpression("最近" + number + "个月")
                        .relative(true)
                        .build();

            default:
                return null;
        }
    }

    private DateRange calculateLastQuarter() {
        LocalDate today = LocalDate.now();
        int currentQuarter = (today.getMonthValue() - 1) / 3 + 1;
        int lastQuarter = currentQuarter - 1;
        int year = today.getYear();

        if (lastQuarter == 0) {
            lastQuarter = 4;
            year--;
        }

        return DateRange.quarter(year, lastQuarter);
    }

    // ==================== Utility Methods ====================

    private int extractNumber(Matcher matcher) {
        for (int i = 1; i <= matcher.groupCount(); i++) {
            String group = matcher.group(i);
            if (group != null && !group.isEmpty()) {
                try {
                    return Integer.parseInt(group);
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return 0;
    }

    private boolean overlapsWithAny(TimeEntity newEntity, List<TimeEntity> existing) {
        for (TimeEntity entity : existing) {
            if (overlaps(newEntity, entity)) {
                return true;
            }
        }
        return false;
    }

    private boolean overlaps(TimeEntity a, TimeEntity b) {
        return !(a.getEndIndex() <= b.getStartIndex() || a.getStartIndex() >= b.getEndIndex());
    }

    private boolean isValidDate(int year, int month, int day) {
        if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
            return false;
        }
        try {
            LocalDate.of(year, month, day);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isValidMonth(int month) {
        return month >= 1 && month <= 12;
    }

    // ==================== Public API Methods ====================

    /**
     * Quick check if text contains any time entity
     */
    public boolean containsTimeEntity(String text) {
        if (containsEntity(text)) {
            return true;
        }

        // Also check regex patterns
        for (Pattern pattern : dynamicPatterns.values()) {
            if (pattern.matcher(text).find()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parse time entity to DateRange
     */
    public DateRange parseToDateRange(TimeEntity entity) {
        if (entity == null) {
            return null;
        }
        return entity.toDateRange();
    }
}
