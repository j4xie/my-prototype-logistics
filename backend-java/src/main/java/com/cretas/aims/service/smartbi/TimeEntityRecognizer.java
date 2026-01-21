package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DateRange;
import com.cretas.aims.dto.smartbi.TimeEntity;
import com.cretas.aims.dto.smartbi.TimeEntity.TimeGranularity;
import com.cretas.aims.dto.smartbi.TimeEntity.TimeType;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.repository.smartbi.SmartBiDictionaryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
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
 * @version 1.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class TimeEntityRecognizer {

    // ==================== Configuration ====================

    @Value("${smartbi.time.dictionary-file:config/smartbi/time_dictionary.json}")
    private String dictionaryFile;

    private final ObjectMapper objectMapper;

    @Autowired
    private SmartBiDictionaryRepository dictionaryRepository;

    // ==================== Trie Data Structures ====================

    /**
     * Root node of the Trie tree for fixed pattern matching
     */
    private TrieNode root;

    /**
     * Time type information index
     * Key: pattern text
     * Value: TimeTypeInfo containing type and description
     */
    private final Map<String, TimeTypeInfo> timeTypeIndex = new ConcurrentHashMap<>();

    /**
     * Quarter patterns mapping
     * Key: quarter text (e.g., "Q1", "第一季度")
     * Value: quarter number (1-4)
     */
    private final Map<String, Integer> quarterPatterns = new ConcurrentHashMap<>();

    /**
     * Compiled regex patterns for dynamic matching
     */
    private final Map<String, Pattern> dynamicPatterns = new ConcurrentHashMap<>();

    /**
     * Statistics
     */
    private long totalRecognitions = 0;
    private long entitiesFound = 0;

    // ==================== Inner Classes ====================

    /**
     * Trie node for efficient string matching
     */
    private static class TrieNode {
        Map<Character, TrieNode> children = new HashMap<>();
        boolean isEnd = false;
        TimeType timeType;
        TimeGranularity granularity;
        String description;

        TrieNode() {}
    }

    /**
     * Time type information stored in the index
     */
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
        this.objectMapper = objectMapper;
    }

    // ==================== Initialization ====================

    /**
     * Initialize the recognizer by loading dictionary and building Trie
     */
    @PostConstruct
    public void init() {
        log.info("Initializing TimeEntityRecognizer...");
        root = new TrieNode();
        loadDictionary();
        loadFromDatabase();
        log.info("TimeEntityRecognizer initialized with {} patterns in index", timeTypeIndex.size());
    }

    /**
     * Load time dictionary from JSON file
     */
    private void loadDictionary() {
        try {
            ClassPathResource resource = new ClassPathResource(dictionaryFile);
            if (!resource.exists()) {
                log.warn("Time dictionary file not found: {}, using defaults", dictionaryFile);
                initDefaultDictionary();
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                Map<String, Object> dictionary = objectMapper.readValue(
                        is, new TypeReference<Map<String, Object>>() {});

                // Load relative time patterns
                if (dictionary.containsKey("relativeTime")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Map<String, Object>> relativeTime =
                            (Map<String, Map<String, Object>>) dictionary.get("relativeTime");
                    loadRelativeTimePatterns(relativeTime);
                }

                // Load quarter patterns
                if (dictionary.containsKey("quarters")) {
                    @SuppressWarnings("unchecked")
                    Map<String, List<String>> quarters =
                            (Map<String, List<String>>) dictionary.get("quarters");
                    loadQuarterPatterns(quarters);
                }

                // Load dynamic patterns (regex)
                if (dictionary.containsKey("dynamicPatterns")) {
                    @SuppressWarnings("unchecked")
                    Map<String, String> dynPatterns =
                            (Map<String, String>) dictionary.get("dynamicPatterns");
                    loadDynamicPatterns(dynPatterns);
                }

                log.info("Successfully loaded time dictionary from: {}", dictionaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to load time dictionary: {}", e.getMessage());
            initDefaultDictionary();
        }
    }

    /**
     * Load relative time patterns and build Trie entries
     */
    private void loadRelativeTimePatterns(Map<String, Map<String, Object>> relativeTime) {
        for (Map.Entry<String, Map<String, Object>> entry : relativeTime.entrySet()) {
            String typeStr = entry.getKey();
            Map<String, Object> typeData = entry.getValue();

            TimeType timeType = TimeType.valueOf(typeStr);
            TimeGranularity granularity = inferGranularityFromType(timeType);

            String description = (String) typeData.getOrDefault("description", typeStr);

            @SuppressWarnings("unchecked")
            List<String> patterns = (List<String>) typeData.get("patterns");

            if (patterns != null) {
                for (String pattern : patterns) {
                    addToTrie(pattern, timeType, granularity, description);
                    timeTypeIndex.put(pattern, new TimeTypeInfo(timeType, granularity, description));
                }
            }
        }
    }

    /**
     * Load quarter patterns
     */
    private void loadQuarterPatterns(Map<String, List<String>> quarters) {
        for (Map.Entry<String, List<String>> entry : quarters.entrySet()) {
            String quarterKey = entry.getKey();
            int quarterNum = Integer.parseInt(quarterKey.substring(1));
            List<String> patterns = entry.getValue();

            for (String pattern : patterns) {
                quarterPatterns.put(pattern, quarterNum);
                // Add to Trie for matching
                addToTrie(pattern, TimeType.ABSOLUTE_QUARTER, TimeGranularity.QUARTER, quarterKey);
            }
        }
    }

    /**
     * Load dynamic regex patterns
     */
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

    /**
     * Add a term to the Trie tree
     */
    private void addToTrie(String term, TimeType type, TimeGranularity granularity, String description) {
        if (term == null || term.isEmpty()) {
            return;
        }

        TrieNode current = root;
        for (char c : term.toCharArray()) {
            current.children.putIfAbsent(c, new TrieNode());
            current = current.children.get(c);
        }

        current.isEnd = true;
        current.timeType = type;
        current.granularity = granularity;
        current.description = description;
    }

    /**
     * Initialize default dictionary when file is not available
     */
    private void initDefaultDictionary() {
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
                addToTrie(pattern, type, granularity, pattern);
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
                addToTrie(pattern, TimeType.ABSOLUTE_QUARTER, TimeGranularity.QUARTER, "Q" + quarterNum);
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

    /**
     * 从数据库加载动态配置的时间词条
     */
    private void loadFromDatabase() {
        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByDictTypeAndIsActiveTrueOrderByPriorityAsc("time");

            for (SmartBiDictionary entry : entries) {
                String pattern = entry.getName();

                // 从元数据获取时间类型和粒度（默认为 TODAY/DAY）
                TimeType timeType = TimeType.TODAY;
                TimeGranularity granularity = TimeGranularity.DAY;

                if (entry.getMetadata() != null && !entry.getMetadata().isEmpty()) {
                    try {
                        Map<String, Object> metadata = objectMapper.readValue(
                                entry.getMetadata(),
                                new TypeReference<Map<String, Object>>() {});
                        if (metadata.containsKey("timeType")) {
                            timeType = TimeType.valueOf(metadata.get("timeType").toString());
                        }
                        if (metadata.containsKey("granularity")) {
                            granularity = TimeGranularity.valueOf(metadata.get("granularity").toString());
                        }
                    } catch (Exception e) {
                        log.warn("解析时间元数据失败: {}", entry.getName());
                    }
                }

                // 添加到 Trie 树
                addToTrie(pattern, timeType, granularity, entry.getName());
                timeTypeIndex.put(pattern, new TimeTypeInfo(timeType, granularity, entry.getName()));

                // 处理别名
                if (entry.getAliases() != null && !entry.getAliases().isEmpty()) {
                    try {
                        List<String> aliases = objectMapper.readValue(
                                entry.getAliases(),
                                new TypeReference<List<String>>() {});
                        for (String alias : aliases) {
                            addToTrie(alias, timeType, granularity, entry.getName());
                            timeTypeIndex.put(alias, new TimeTypeInfo(timeType, granularity, entry.getName()));
                        }
                    } catch (Exception e) {
                        log.warn("解析时间别名失败: {}", entry.getName());
                    }
                }
            }

            log.info("从数据库加载了 {} 个时间词条", entries.size());
        } catch (Exception e) {
            log.warn("从数据库加载时间字典失败: {}", e.getMessage());
        }
    }

    /**
     * Infer granularity from time type
     */
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

    // ==================== Recognition Methods ====================

    /**
     * Recognize all time entities in the given text
     *
     * Uses Trie-based matching for fixed patterns and regex for dynamic patterns.
     * Returns all matched time entities with their positions and calculated date ranges.
     *
     * @param text Input text to analyze
     * @return List of recognized TimeEntity objects, sorted by position
     */
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

    /**
     * Recognize time entities using Trie matching
     */
    private List<TimeEntity> recognizeByTrie(String text) {
        List<TimeEntity> entities = new ArrayList<>();
        int textLength = text.length();

        for (int i = 0; i < textLength; i++) {
            TrieNode current = root;
            int j = i;
            TrieNode lastMatch = null;
            int lastMatchEnd = i;

            // Find longest match starting at position i
            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    lastMatch = current;
                    lastMatchEnd = j;
                }
            }

            // If we found a match, create TimeEntity
            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                TimeEntity entity = createEntityFromTrie(matchedText, lastMatch, i, lastMatchEnd);
                if (entity != null) {
                    entities.add(entity);
                    // Skip to end of match to avoid overlapping matches
                    i = lastMatchEnd - 1;
                }
            }
        }

        return entities;
    }

    /**
     * Recognize time entities using regex matching
     */
    private List<TimeEntity> recognizeByRegex(String text) {
        List<TimeEntity> entities = new ArrayList<>();

        // Match dynamic patterns (last N days/weeks/months)
        matchDynamicPattern(text, "LAST_N_DAYS", TimeType.LAST_N_DAYS, TimeGranularity.DAY, entities);
        matchDynamicPattern(text, "LAST_N_WEEKS", TimeType.LAST_N_WEEKS, TimeGranularity.WEEK, entities);
        matchDynamicPattern(text, "LAST_N_MONTHS", TimeType.LAST_N_MONTHS, TimeGranularity.MONTH, entities);

        // Match absolute dates (must be before absolute month to avoid partial match)
        matchAbsoluteDate(text, entities);
        matchIsoDate(text, entities);

        // Match absolute month
        matchAbsoluteMonth(text, entities);

        // Match absolute year
        matchAbsoluteYear(text, entities);

        return entities;
    }

    /**
     * Match dynamic patterns like "最近N天"
     */
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

    /**
     * Match absolute date patterns like "2024年1月15日"
     */
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

    /**
     * Match ISO date patterns like "2024-01-15"
     */
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

    /**
     * Match absolute month patterns like "2024年1月"
     */
    private void matchAbsoluteMonth(String text, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get("ABSOLUTE_MONTH");
        if (pattern == null) return;

        // First, collect all absolute date matches to exclude them
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
            // Skip if this is actually part of a full date
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

    /**
     * Match absolute year patterns like "2024年"
     */
    private void matchAbsoluteYear(String text, List<TimeEntity> entities) {
        Pattern pattern = dynamicPatterns.get("ABSOLUTE_YEAR");
        if (pattern == null) return;

        // Collect all month matches to exclude
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
            // Skip if this is part of a month pattern
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

    /**
     * Create TimeEntity from Trie match
     */
    private TimeEntity createEntityFromTrie(String matchedText, TrieNode node, int start, int end) {
        TimeType timeType = node.timeType;
        TimeGranularity granularity = node.granularity;

        // Calculate date range based on time type
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

    /**
     * Calculate date range for a given time type
     */
    private DateRange calculateDateRange(TimeType timeType, String matchedText) {
        LocalDate today = LocalDate.now();

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
                // Handle quarter patterns like "Q1", "第一季度"
                if (quarterPatterns.containsKey(matchedText)) {
                    int quarterNum = quarterPatterns.get(matchedText);
                    return DateRange.quarter(today.getYear(), quarterNum);
                }
                return null;

            default:
                return null;
        }
    }

    /**
     * Calculate date range for dynamic patterns (last N days/weeks/months)
     */
    private DateRange calculateDynamicRange(TimeType timeType, int number) {
        LocalDate today = LocalDate.now();

        switch (timeType) {
            case LAST_N_DAYS:
                return DateRange.lastDays(number);

            case LAST_N_WEEKS:
                LocalDate weekStart = today.minusWeeks(number).with(DayOfWeek.MONDAY);
                LocalDate weekEnd = today;
                return DateRange.builder()
                        .startDate(weekStart)
                        .endDate(weekEnd)
                        .granularity("WEEK")
                        .originalExpression("最近" + number + "周")
                        .relative(true)
                        .build();

            case LAST_N_MONTHS:
                LocalDate monthStart = today.minusMonths(number).withDayOfMonth(1);
                LocalDate monthEnd = today;
                return DateRange.builder()
                        .startDate(monthStart)
                        .endDate(monthEnd)
                        .granularity("MONTH")
                        .originalExpression("最近" + number + "个月")
                        .relative(true)
                        .build();

            default:
                return null;
        }
    }

    /**
     * Calculate last quarter date range
     */
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

    /**
     * Extract number from regex matcher groups
     */
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

    /**
     * Check if a time entity overlaps with any existing entities
     */
    private boolean overlapsWithAny(TimeEntity newEntity, List<TimeEntity> existing) {
        for (TimeEntity entity : existing) {
            if (overlaps(newEntity, entity)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if two time entities overlap
     */
    private boolean overlaps(TimeEntity a, TimeEntity b) {
        return !(a.getEndIndex() <= b.getStartIndex() || a.getStartIndex() >= b.getEndIndex());
    }

    /**
     * Validate date components
     */
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

    /**
     * Validate month
     */
    private boolean isValidMonth(int month) {
        return month >= 1 && month <= 12;
    }

    // ==================== Public API Methods ====================

    /**
     * Parse time entity to DateRange
     *
     * @param entity TimeEntity to convert
     * @return DateRange representation
     */
    public DateRange parseToDateRange(TimeEntity entity) {
        if (entity == null) {
            return null;
        }
        return entity.toDateRange();
    }

    /**
     * Quick check if text contains any time entity
     *
     * @param text Input text to check
     * @return true if text contains at least one time entity
     */
    public boolean containsTimeEntity(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }

        // Check Trie matches
        int textLength = text.length();
        for (int i = 0; i < textLength; i++) {
            TrieNode current = root;
            int j = i;

            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    return true;
                }
            }
        }

        // Check regex patterns
        for (Pattern pattern : dynamicPatterns.values()) {
            if (pattern.matcher(text).find()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the first time entity found in the text
     *
     * @param text Input text
     * @return First TimeEntity or null if not found
     */
    public TimeEntity recognizeFirst(String text) {
        List<TimeEntity> entities = recognize(text);
        return entities.isEmpty() ? null : entities.get(0);
    }

    /**
     * Reload the dictionary from file and database
     */
    public void reload() {
        log.info("Reloading time dictionary...");
        root = new TrieNode();
        timeTypeIndex.clear();
        quarterPatterns.clear();
        dynamicPatterns.clear();
        loadDictionary();
        loadFromDatabase();
        log.info("Time dictionary reloaded with {} patterns", timeTypeIndex.size());
    }

    /**
     * Get recognition statistics
     *
     * @return Map containing statistics
     */
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalRecognitions", totalRecognitions);
        stats.put("entitiesFound", entitiesFound);
        stats.put("patternCount", timeTypeIndex.size());
        stats.put("quarterPatternCount", quarterPatterns.size());
        stats.put("dynamicPatternCount", dynamicPatterns.size());
        return stats;
    }

    /**
     * Reset statistics counters
     */
    public void resetStatistics() {
        totalRecognitions = 0;
        entitiesFound = 0;
        log.info("TimeEntityRecognizer statistics reset");
    }
}
