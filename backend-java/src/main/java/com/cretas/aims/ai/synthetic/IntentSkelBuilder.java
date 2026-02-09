package com.cretas.aims.ai.synthetic;

import com.cretas.aims.entity.learning.TrainingSample;
import com.cretas.aims.repository.learning.TrainingSampleRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Intent Skeleton Builder Service
 *
 * Builds intent "skeletons" from historical verified data for synthetic sample generation.
 * A skeleton captures the structural patterns and slot values from real user queries,
 * enabling generation of new synthetic training samples.
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentSkelBuilder {

    private final TrainingSampleRepository trainingSampleRepository;

    // ========== Slot Type Definitions ==========

    /** Time-related keywords */
    private static final Set<String> TIME_KEYWORDS = Set.of(
        "今天", "昨天", "明天", "本周", "上周", "下周", "本月", "上月", "下月",
        "今年", "去年", "明年", "最近", "近期", "当前", "现在", "刚才",
        "早上", "上午", "中午", "下午", "晚上", "凌晨",
        "一月", "二月", "三月", "四月", "五月", "六月",
        "七月", "八月", "九月", "十月", "十一月", "十二月",
        "第一季度", "第二季度", "第三季度", "第四季度", "Q1", "Q2", "Q3", "Q4",
        "过去7天", "过去30天", "过去一周", "过去一个月"
    );

    /** Action-related keywords */
    private static final Set<String> ACTION_KEYWORDS = Set.of(
        "查询", "查看", "显示", "统计", "分析", "对比", "比较", "汇总", "导出",
        "查", "看", "找", "搜", "搜索", "获取", "展示", "列出", "计算",
        "预测", "预估", "估算", "追踪", "跟踪", "监控", "告诉我", "帮我查"
    );

    /** Metric-related keywords */
    private static final Set<String> METRIC_KEYWORDS = Set.of(
        "产量", "销量", "库存", "成本", "利润", "营收", "收入", "支出", "费用",
        "合格率", "良品率", "不良率", "完成率", "达成率", "效率", "产能",
        "数量", "金额", "总额", "均价", "单价", "毛利", "净利", "增长率",
        "订单数", "客户数", "供应商数", "员工数", "出勤率", "缺勤率",
        "周转率", "周转天数", "账龄", "余额", "欠款", "应收", "应付"
    );

    /** Entity-related keywords (product, material, customer, etc.) */
    private static final Set<String> ENTITY_KEYWORDS = Set.of(
        "产品", "商品", "物料", "原料", "成品", "半成品", "在制品",
        "客户", "供应商", "供货商", "厂商", "经销商", "代理商",
        "订单", "采购单", "销售单", "入库单", "出库单", "盘点单",
        "车间", "产线", "工序", "工位", "仓库", "库区", "库位",
        "部门", "员工", "班组", "班次"
    );

    /** Pattern for extracting time expressions */
    private static final Pattern TIME_PATTERN = Pattern.compile(
        "(\\d{4}年?\\d{1,2}月?\\d{1,2}日?|\\d{1,2}月\\d{1,2}日|" +
        "今天|昨天|明天|本周|上周|下周|本月|上月|下月|今年|去年|" +
        "最近\\d+天|过去\\d+天|近\\d+天|\\d+号|第[一二三四]季度|Q[1-4])"
    );

    /** Pattern for extracting numeric values */
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d+(\\.\\d+)?");

    // ========== Inner Classes ==========

    /**
     * Slot definition for intent skeleton
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Slot {
        /** Slot name (TIME, ACTION, METRIC, ENTITY) */
        private String name;

        /** Whether this slot is required */
        private boolean required;

        /** Candidate slot values extracted from samples */
        @Builder.Default
        private Set<String> values = new HashSet<>();

        /**
         * Add a value to the slot
         */
        public void addValue(String value) {
            if (value != null && !value.trim().isEmpty()) {
                values.add(value.trim());
            }
        }

        /**
         * Merge another slot's values
         */
        public void merge(Slot other) {
            if (other != null && other.values != null) {
                values.addAll(other.values);
            }
        }
    }

    /**
     * Intent Skeleton - captures patterns and slots from real samples
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IntentSkel {
        /** Intent code this skeleton represents */
        private String intentCode;

        /** Factory ID (for factory-specific patterns) */
        private String factoryId;

        /** Slots extracted from samples */
        private List<Slot> slots = new ArrayList<>();

        /** Expression patterns mined from samples */
        private List<String> patterns = new ArrayList<>();

        /** Unique skeleton identifier */
        private String skeletonId;

        /** Number of samples used to build this skeleton */
        private int sampleCount;

        /** Creation timestamp */
        private long createdAt;

        /**
         * Get slot by name
         */
        public Optional<Slot> getSlot(String name) {
            return slots.stream()
                .filter(s -> s.getName().equals(name))
                .findFirst();
        }

        /**
         * Add a slot to the skeleton
         */
        public void addSlot(Slot slot) {
            slots.add(slot);
        }

        /**
         * Add a pattern to the skeleton
         */
        public void addPattern(String pattern) {
            if (pattern != null && !pattern.trim().isEmpty()) {
                patterns.add(pattern.trim());
            }
        }

        /**
         * Check if skeleton is valid for generation
         */
        public boolean isValidForGeneration() {
            return !patterns.isEmpty() &&
                   slots.stream().anyMatch(s -> !s.getValues().isEmpty());
        }

        /**
         * Get skeleton ID (alias for skeletonId)
         */
        public String getId() {
            return skeletonId;
        }

        /**
         * Static builder method
         */
        public static IntentSkel create(String intentCode, String factoryId,
                                         List<Slot> slots, List<String> patterns,
                                         int sampleCount) {
            IntentSkel skel = new IntentSkel();
            skel.setIntentCode(intentCode);
            skel.setFactoryId(factoryId);
            skel.setSlots(slots != null ? slots : new ArrayList<>());
            skel.setPatterns(patterns != null ? patterns : new ArrayList<>());
            skel.setSkeletonId(UUID.randomUUID().toString());
            skel.setSampleCount(sampleCount);
            skel.setCreatedAt(System.currentTimeMillis());
            return skel;
        }

        /**
         * Static builder for empty skeleton
         */
        public static IntentSkel empty(String intentCode, String factoryId) {
            return create(intentCode, factoryId, new ArrayList<>(), new ArrayList<>(), 0);
        }
    }

    // ========== Public Methods ==========

    /**
     * Build intent skeleton from historical verified samples
     *
     * @param intentCode Intent code to build skeleton for
     * @param factoryId Factory ID for factory-specific patterns
     * @return IntentSkel containing extracted patterns and slots
     */
    public IntentSkel buildFromHistory(String intentCode, String factoryId) {
        log.info("Building skeleton for intent: {}, factory: {}", intentCode, factoryId);

        // Fetch verified real samples
        List<TrainingSample> samples = trainingSampleRepository.findVerifiedRealSamples(
            factoryId, intentCode
        );

        if (samples.isEmpty()) {
            log.warn("No verified samples found for intent: {}, factory: {}",
                intentCode, factoryId);
            return IntentSkel.empty(intentCode, factoryId);
        }

        log.info("Found {} verified samples for skeleton building", samples.size());

        // Extract slot values from samples
        List<Slot> slots = extractSlotValues(samples);

        // Mine expression patterns from samples
        List<String> patterns = minePatterns(samples);

        IntentSkel skeleton = IntentSkel.create(
            intentCode, factoryId, slots, patterns, samples.size()
        );

        log.info("Built skeleton with {} slots and {} patterns",
            slots.size(), patterns.size());

        return skeleton;
    }

    // ========== Slot Extraction ==========

    /**
     * Extract slot values from training samples
     *
     * Analyzes user inputs to identify TIME, ACTION, METRIC, and ENTITY slot values
     *
     * @param samples List of training samples to analyze
     * @return List of slots with extracted values
     */
    public List<Slot> extractSlotValues(List<TrainingSample> samples) {
        Slot timeSlot = Slot.builder()
            .name("TIME")
            .required(false)
            .values(new HashSet<>())
            .build();

        Slot actionSlot = Slot.builder()
            .name("ACTION")
            .required(true)
            .values(new HashSet<>())
            .build();

        Slot metricSlot = Slot.builder()
            .name("METRIC")
            .required(true)
            .values(new HashSet<>())
            .build();

        Slot entitySlot = Slot.builder()
            .name("ENTITY")
            .required(false)
            .values(new HashSet<>())
            .build();

        for (TrainingSample sample : samples) {
            String input = sample.getUserInput();
            if (input == null || input.trim().isEmpty()) {
                continue;
            }

            // Extract TIME values
            extractTimeValues(input, timeSlot);

            // Extract ACTION values
            extractActionValues(input, actionSlot);

            // Extract METRIC values
            extractMetricValues(input, metricSlot);

            // Extract ENTITY values
            extractEntityValues(input, entitySlot);
        }

        List<Slot> slots = new ArrayList<>();
        slots.add(timeSlot);
        slots.add(actionSlot);
        slots.add(metricSlot);
        slots.add(entitySlot);

        // Log extraction results
        log.debug("Extracted slots - TIME: {}, ACTION: {}, METRIC: {}, ENTITY: {}",
            timeSlot.getValues().size(),
            actionSlot.getValues().size(),
            metricSlot.getValues().size(),
            entitySlot.getValues().size());

        return slots;
    }

    /**
     * Extract time-related values from input
     */
    private void extractTimeValues(String input, Slot timeSlot) {
        // Match predefined time keywords
        for (String keyword : TIME_KEYWORDS) {
            if (input.contains(keyword)) {
                timeSlot.addValue(keyword);
            }
        }

        // Match time patterns (dates, etc.)
        Matcher matcher = TIME_PATTERN.matcher(input);
        while (matcher.find()) {
            timeSlot.addValue(matcher.group());
        }
    }

    /**
     * Extract action-related values from input
     */
    private void extractActionValues(String input, Slot actionSlot) {
        for (String keyword : ACTION_KEYWORDS) {
            if (input.contains(keyword)) {
                actionSlot.addValue(keyword);
            }
        }
    }

    /**
     * Extract metric-related values from input
     */
    private void extractMetricValues(String input, Slot metricSlot) {
        for (String keyword : METRIC_KEYWORDS) {
            if (input.contains(keyword)) {
                metricSlot.addValue(keyword);
            }
        }
    }

    /**
     * Extract entity-related values from input
     */
    private void extractEntityValues(String input, Slot entitySlot) {
        for (String keyword : ENTITY_KEYWORDS) {
            if (input.contains(keyword)) {
                entitySlot.addValue(keyword);
            }
        }
    }

    // ========== Pattern Mining ==========

    /**
     * Mine expression patterns from training samples
     *
     * Extracts common patterns like "{ACTION}{TIME}的{METRIC}"
     *
     * @param samples List of training samples to analyze
     * @return List of mined patterns with slot placeholders
     */
    public List<String> minePatterns(List<TrainingSample> samples) {
        List<String> patterns = new ArrayList<>();
        Map<String, Integer> patternCounts = new HashMap<>();

        for (TrainingSample sample : samples) {
            String input = sample.getUserInput();
            if (input == null || input.trim().isEmpty()) {
                continue;
            }

            // Convert input to pattern by replacing slot values with placeholders
            String pattern = convertToPattern(input);
            if (pattern != null && !pattern.equals(input)) {
                patternCounts.merge(pattern, 1, Integer::sum);
            }
        }

        // Sort by frequency and take top patterns
        patterns = patternCounts.entrySet().stream()
            .filter(e -> e.getValue() >= 1)  // At least 1 occurrence
            .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
            .limit(20)  // Top 20 patterns
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());

        // If no patterns found, generate basic patterns from samples
        if (patterns.isEmpty()) {
            patterns = generateBasicPatterns(samples);
        }

        log.debug("Mined {} patterns from {} samples", patterns.size(), samples.size());

        return patterns;
    }

    /**
     * Convert a user input to a pattern by replacing slot values with placeholders
     */
    private String convertToPattern(String input) {
        String pattern = input;

        // Replace TIME values
        for (String keyword : TIME_KEYWORDS) {
            if (pattern.contains(keyword)) {
                pattern = pattern.replace(keyword, "{TIME}");
            }
        }

        // Replace time patterns
        Matcher timeMatcher = TIME_PATTERN.matcher(pattern);
        pattern = timeMatcher.replaceAll("{TIME}");

        // Replace ACTION values
        for (String keyword : ACTION_KEYWORDS) {
            if (pattern.contains(keyword)) {
                pattern = pattern.replace(keyword, "{ACTION}");
            }
        }

        // Replace METRIC values
        for (String keyword : METRIC_KEYWORDS) {
            if (pattern.contains(keyword)) {
                pattern = pattern.replace(keyword, "{METRIC}");
            }
        }

        // Replace ENTITY values
        for (String keyword : ENTITY_KEYWORDS) {
            if (pattern.contains(keyword)) {
                pattern = pattern.replace(keyword, "{ENTITY}");
            }
        }

        // Replace numbers with placeholder
        Matcher numberMatcher = NUMBER_PATTERN.matcher(pattern);
        pattern = numberMatcher.replaceAll("{NUMBER}");

        // Normalize consecutive placeholders
        pattern = normalizePattern(pattern);

        return pattern;
    }

    /**
     * Normalize pattern by merging consecutive same placeholders
     */
    private String normalizePattern(String pattern) {
        // Merge consecutive same placeholders
        pattern = pattern.replaceAll("\\{TIME\\}\\s*\\{TIME\\}", "{TIME}");
        pattern = pattern.replaceAll("\\{ACTION\\}\\s*\\{ACTION\\}", "{ACTION}");
        pattern = pattern.replaceAll("\\{METRIC\\}\\s*\\{METRIC\\}", "{METRIC}");
        pattern = pattern.replaceAll("\\{ENTITY\\}\\s*\\{ENTITY\\}", "{ENTITY}");
        pattern = pattern.replaceAll("\\{NUMBER\\}\\s*\\{NUMBER\\}", "{NUMBER}");

        // Clean up extra whitespace
        pattern = pattern.replaceAll("\\s+", " ").trim();

        return pattern;
    }

    /**
     * Generate basic patterns when mining yields no results
     */
    private List<String> generateBasicPatterns(List<TrainingSample> samples) {
        List<String> patterns = new ArrayList<>();

        // Common query patterns
        patterns.add("{ACTION}{TIME}的{METRIC}");
        patterns.add("{ACTION}{ENTITY}的{METRIC}");
        patterns.add("{TIME}{ENTITY}的{METRIC}");
        patterns.add("{ACTION}{METRIC}");
        patterns.add("{METRIC}{ENTITY}");
        patterns.add("{TIME}的{METRIC}是多少");
        patterns.add("{ACTION}一下{TIME}的{METRIC}");
        patterns.add("帮我{ACTION}{ENTITY}的{METRIC}");

        return patterns;
    }

    // ========== Utility Methods ==========

    /**
     * Check if a skeleton exists for the given intent and factory
     */
    public boolean hasSkeletonData(String intentCode, String factoryId) {
        List<TrainingSample> samples = trainingSampleRepository.findVerifiedRealSamples(
            factoryId, intentCode
        );
        return !samples.isEmpty();
    }

    /**
     * Get sample count for an intent
     */
    public int getSampleCount(String intentCode, String factoryId) {
        List<TrainingSample> samples = trainingSampleRepository.findVerifiedRealSamples(
            factoryId, intentCode
        );
        return samples.size();
    }

    /**
     * Get all available intent codes for a factory
     *
     * @param factoryId Factory ID
     * @return List of distinct intent codes that have verified real samples
     */
    public List<String> getAvailableIntentCodes(String factoryId) {
        return trainingSampleRepository.findDistinctIntentCodes(factoryId);
    }
}
