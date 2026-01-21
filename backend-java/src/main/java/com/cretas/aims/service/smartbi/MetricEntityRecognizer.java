package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.MetricEntity;
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
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Metric Entity Recognizer Service
 *
 * Efficient metric entity recognition using Trie tree data structure.
 * Supports recognition of various business metrics:
 * - Sales metrics (销售额, 销量, 均价, 客单价, 订单数)
 * - Finance metrics (利润, 毛利, 成本, 费用, 回款率)
 * - Comparison metrics (同比, 环比, 增长率)
 * - Analysis metrics (占比, 转化率)
 * - Customer metrics (客户数)
 *
 * Features:
 * - O(n) matching complexity using Trie tree
 * - Alias support (e.g., "营收" -> "销售额")
 * - Position tracking for matched entities
 * - Metric metadata retrieval (category, unit, aggregation)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class MetricEntityRecognizer {

    // ==================== Configuration ====================

    @Value("${smartbi.metric.dictionary-file:config/smartbi/metric_dictionary.json}")
    private String dictionaryFile;

    private final ObjectMapper objectMapper;

    @Autowired
    private SmartBiDictionaryRepository dictionaryRepository;

    // ==================== Trie Data Structures ====================

    /**
     * Root node of the Trie tree
     */
    private TrieNode root;

    /**
     * Metric information index for quick lookup
     * Key: normalized metric name
     * Value: MetricInfo containing category, unit, aggregation, and aliases
     */
    private final Map<String, MetricInfo> metricIndex = new ConcurrentHashMap<>();

    /**
     * Category descriptions
     */
    private final Map<String, String> categoryDescriptions = new ConcurrentHashMap<>();

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
        /**
         * Child nodes mapped by character
         */
        Map<Character, TrieNode> children = new HashMap<>();

        /**
         * Whether this node marks the end of a valid metric name
         */
        boolean isEnd = false;

        /**
         * Normalized name of the metric
         */
        String normalizedName;

        /**
         * Metric category (sales, finance, comparison, analysis, customer)
         */
        String category;

        /**
         * Unit of the metric
         */
        String unit;

        /**
         * Aggregation type (SUM, AVG, COUNT, CALC)
         */
        String aggregation;

        /**
         * Whether this entry is an alias
         */
        boolean isAlias = false;

        /**
         * The alias text (if isAlias is true)
         */
        String aliasText;

        TrieNode() {
        }
    }

    /**
     * Metric information stored in the index
     */
    public static class MetricInfo {
        private String standardName;
        private String category;
        private String unit;
        private String aggregation;
        private List<String> aliases = new ArrayList<>();

        public MetricInfo(String standardName, String category, String unit, String aggregation) {
            this.standardName = standardName;
            this.category = category;
            this.unit = unit;
            this.aggregation = aggregation;
        }

        public String getStandardName() {
            return standardName;
        }

        public String getCategory() {
            return category;
        }

        public String getUnit() {
            return unit;
        }

        public String getAggregation() {
            return aggregation;
        }

        public List<String> getAliases() {
            return aliases;
        }
    }

    // ==================== Constructor ====================

    public MetricEntityRecognizer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ==================== Initialization ====================

    /**
     * Initialize the recognizer by loading dictionary and building Trie
     */
    @PostConstruct
    public void init() {
        log.info("Initializing MetricEntityRecognizer...");
        root = new TrieNode();
        loadDictionary();
        loadFromDatabase();
        log.info("MetricEntityRecognizer initialized with {} metrics in index", metricIndex.size());
    }

    /**
     * Load metric dictionary from JSON file
     */
    private void loadDictionary() {
        try {
            ClassPathResource resource = new ClassPathResource(dictionaryFile);
            if (!resource.exists()) {
                log.warn("Metric dictionary file not found: {}, using defaults", dictionaryFile);
                initDefaultDictionary();
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                Map<String, Object> dictionary = objectMapper.readValue(
                        is, new TypeReference<Map<String, Object>>() {});

                // Load metrics
                if (dictionary.containsKey("metrics")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Map<String, Object>> metrics =
                            (Map<String, Map<String, Object>>) dictionary.get("metrics");
                    loadMetrics(metrics);
                }

                // Load category descriptions
                if (dictionary.containsKey("categories")) {
                    @SuppressWarnings("unchecked")
                    Map<String, String> categories = (Map<String, String>) dictionary.get("categories");
                    categoryDescriptions.putAll(categories);
                }

                log.info("Successfully loaded metric dictionary from: {}", dictionaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to load metric dictionary: {}", e.getMessage());
            initDefaultDictionary();
        }
    }

    /**
     * Load metric data and build Trie entries
     */
    private void loadMetrics(Map<String, Map<String, Object>> metrics) {
        for (Map.Entry<String, Map<String, Object>> entry : metrics.entrySet()) {
            String metricName = entry.getKey();
            Map<String, Object> metricData = entry.getValue();

            // Extract metric properties
            String category = (String) metricData.getOrDefault("category", "unknown");
            String unit = (String) metricData.getOrDefault("unit", "");
            String aggregation = (String) metricData.getOrDefault("aggregation", "SUM");

            // Create metric info
            MetricInfo info = new MetricInfo(metricName, category, unit, aggregation);

            // Add to Trie - standard name
            addToTrie(metricName, metricName, category, unit, aggregation, false, null);

            // Add aliases
            if (metricData.containsKey("aliases")) {
                @SuppressWarnings("unchecked")
                List<String> aliases = (List<String>) metricData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrie(alias, metricName, category, unit, aggregation, true, alias);
                }
            }

            metricIndex.put(metricName, info);
        }
    }

    /**
     * Add a term to the Trie tree
     */
    private void addToTrie(String term, String normalizedName, String category,
                           String unit, String aggregation, boolean isAlias, String aliasText) {
        if (term == null || term.isEmpty()) {
            return;
        }

        TrieNode current = root;
        for (char c : term.toCharArray()) {
            current.children.putIfAbsent(c, new TrieNode());
            current = current.children.get(c);
        }

        // Only update end node info if not already set (prefer non-alias over alias)
        if (!current.isEnd || (!current.isAlias && isAlias)) {
            current.isEnd = true;
            current.normalizedName = normalizedName;
            current.category = category;
            current.unit = unit;
            current.aggregation = aggregation;
            current.isAlias = isAlias;
            current.aliasText = aliasText;
        }
    }

    /**
     * Initialize default dictionary when file is not available
     */
    private void initDefaultDictionary() {
        log.info("Initializing default metric dictionary...");

        // Default category descriptions
        categoryDescriptions.put("sales", "销售类指标");
        categoryDescriptions.put("finance", "财务类指标");
        categoryDescriptions.put("comparison", "对比类指标");
        categoryDescriptions.put("analysis", "分析类指标");
        categoryDescriptions.put("customer", "客户类指标");

        // Default sales metrics
        addDefaultMetric("销售额", "sales", "元", "SUM",
                Arrays.asList("销售金额", "营业额", "营收", "收入", "总收入", "销售收入"));
        addDefaultMetric("销量", "sales", "件", "SUM",
                Arrays.asList("销售量", "销售数量", "卖出数量", "出货量"));
        addDefaultMetric("均价", "sales", "元", "AVG",
                Arrays.asList("平均价格", "单价", "平均单价"));
        addDefaultMetric("客单价", "sales", "元", "AVG",
                Arrays.asList("人均消费", "平均客单", "订单均价"));
        addDefaultMetric("订单数", "sales", "单", "COUNT",
                Arrays.asList("订单量", "单数", "成交数"));

        // Default finance metrics
        addDefaultMetric("利润", "finance", "元", "SUM",
                Arrays.asList("净利润", "纯利润", "盈利", "利润额"));
        addDefaultMetric("毛利", "finance", "元", "SUM",
                Arrays.asList("毛利润", "毛利额"));
        addDefaultMetric("成本", "finance", "元", "SUM",
                Arrays.asList("总成本", "成本额", "花费"));
        addDefaultMetric("费用", "finance", "元", "SUM",
                Arrays.asList("支出", "开支", "费用支出"));
        addDefaultMetric("回款率", "finance", "%", "CALC",
                Arrays.asList("回款比例", "收款率", "回款"));

        // Default comparison metrics
        addDefaultMetric("同比", "comparison", "%", "CALC",
                Arrays.asList("同比增长", "同比变化", "年同比", "YoY"));
        addDefaultMetric("环比", "comparison", "%", "CALC",
                Arrays.asList("环比增长", "环比变化", "月环比", "MoM"));
        addDefaultMetric("增长率", "comparison", "%", "CALC",
                Arrays.asList("增长比例", "增速", "增幅"));

        // Default analysis metrics
        addDefaultMetric("占比", "analysis", "%", "CALC",
                Arrays.asList("比例", "百分比", "份额", "市场份额"));
        addDefaultMetric("转化率", "analysis", "%", "CALC",
                Arrays.asList("转化比例", "成交率", "下单率"));

        // Default customer metrics
        addDefaultMetric("客户数", "customer", "人", "COUNT",
                Arrays.asList("客户量", "用户数", "顾客数"));

        log.info("Default dictionary initialized with {} entries", metricIndex.size());
    }

    /**
     * Helper method to add a default metric with its aliases
     */
    private void addDefaultMetric(String name, String category, String unit,
                                   String aggregation, List<String> aliases) {
        MetricInfo info = new MetricInfo(name, category, unit, aggregation);
        info.aliases.addAll(aliases);

        addToTrie(name, name, category, unit, aggregation, false, null);
        for (String alias : aliases) {
            addToTrie(alias, name, category, unit, aggregation, true, alias);
        }

        metricIndex.put(name, info);
    }

    /**
     * Load metric dictionary entries from database
     * Supports dynamic configuration without service restart
     */
    private void loadFromDatabase() {
        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByDictTypeAndIsActiveTrueOrderByPriorityAsc("metric");

            for (SmartBiDictionary entry : entries) {
                String name = entry.getName();

                // Parse metadata to get category, unit, aggregation
                String category = "通用";
                String unit = "";
                String aggregation = "SUM";

                if (entry.getMetadata() != null && !entry.getMetadata().isEmpty()) {
                    try {
                        Map<String, Object> metadata = objectMapper.readValue(
                                entry.getMetadata(),
                                new TypeReference<Map<String, Object>>() {});
                        if (metadata.containsKey("category")) {
                            category = metadata.get("category").toString();
                        }
                        if (metadata.containsKey("unit")) {
                            unit = metadata.get("unit").toString();
                        }
                        if (metadata.containsKey("aggregation")) {
                            aggregation = metadata.get("aggregation").toString();
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse metadata for metric: {}", entry.getName());
                    }
                }

                // Create MetricInfo if not exists
                MetricInfo info = metricIndex.get(name);
                if (info == null) {
                    info = new MetricInfo(name, category, unit, aggregation);
                    metricIndex.put(name, info);
                }

                // Add to Trie - standard name
                addToTrie(name, name, category, unit, aggregation, false, null);

                // Process aliases
                if (entry.getAliases() != null && !entry.getAliases().isEmpty()) {
                    try {
                        List<String> aliases = objectMapper.readValue(
                                entry.getAliases(),
                                new TypeReference<List<String>>() {});
                        for (String alias : aliases) {
                            addToTrie(alias, name, category, unit, aggregation, true, alias);
                            if (!info.aliases.contains(alias)) {
                                info.aliases.add(alias);
                            }
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse aliases for metric: {}", entry.getName());
                    }
                }
            }

            log.info("Loaded {} metric entries from database", entries.size());
        } catch (Exception e) {
            log.warn("Failed to load metric dictionary from database: {}", e.getMessage());
        }
    }

    // ==================== Recognition Methods ====================

    /**
     * Recognize all metric entities in the given text
     *
     * Uses Trie-based matching for O(n) complexity where n is text length.
     * Returns all matched metrics with their positions and metadata.
     *
     * @param text Input text to analyze
     * @return List of recognized MetricEntity objects, sorted by position
     */
    public List<MetricEntity> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<MetricEntity> entities = new ArrayList<>();
        int textLength = text.length();

        // Scan through text using Trie matching
        for (int i = 0; i < textLength; i++) {
            TrieNode current = root;
            int j = i;
            TrieNode lastMatch = null;
            int lastMatchEnd = i;

            // Try to find the longest match starting at position i
            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    lastMatch = current;
                    lastMatchEnd = j;
                }
            }

            // If we found a match, create MetricEntity
            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                MetricEntity entity = createEntity(matchedText, lastMatch, i, lastMatchEnd);
                entities.add(entity);
                entitiesFound++;

                // Skip to end of match to avoid overlapping matches
                i = lastMatchEnd - 1;
            }
        }

        // Sort by position
        entities.sort(Comparator.comparingInt(MetricEntity::getStartIndex));

        return entities;
    }

    /**
     * Create MetricEntity from Trie match
     */
    private MetricEntity createEntity(String matchedText, TrieNode node, int start, int end) {
        MetricEntity.MetricEntityBuilder builder = MetricEntity.builder()
                .text(matchedText)
                .normalizedName(node.normalizedName)
                .category(node.category)
                .unit(node.unit)
                .aggregation(node.aggregation)
                .startIndex(start)
                .endIndex(end);

        if (node.isAlias) {
            builder.matchedByAlias(true)
                   .matchedAlias(node.aliasText)
                   .confidence(0.9);
        } else {
            builder.confidence(1.0);
        }

        return builder.build();
    }

    /**
     * Quick check if text contains any metric entity
     *
     * More efficient than recognize() when you only need a boolean result.
     *
     * @param text Input text to check
     * @return true if text contains at least one metric entity
     */
    public boolean containsMetric(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }

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

        return false;
    }

    // ==================== Query Methods ====================

    /**
     * Get metric information by name
     *
     * @param metricName Metric name (standard or alias)
     * @return MetricInfo or null if not found
     */
    public MetricInfo getMetricInfo(String metricName) {
        if (metricName == null || metricName.isEmpty()) {
            return null;
        }

        // Check direct match
        if (metricIndex.containsKey(metricName)) {
            return metricIndex.get(metricName);
        }

        // Try to find by alias
        for (Map.Entry<String, MetricInfo> entry : metricIndex.entrySet()) {
            if (entry.getValue().aliases.contains(metricName)) {
                return entry.getValue();
            }
        }

        return null;
    }

    /**
     * Get all metrics in a specific category
     *
     * @param category Category name (sales, finance, comparison, analysis, customer)
     * @return List of metric names in the category
     */
    public List<String> getMetricsByCategory(String category) {
        if (category == null || category.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> result = new ArrayList<>();
        for (Map.Entry<String, MetricInfo> entry : metricIndex.entrySet()) {
            if (category.equals(entry.getValue().category)) {
                result.add(entry.getKey());
            }
        }
        return result;
    }

    /**
     * Get all known metric names
     *
     * @return List of all standard metric names
     */
    public List<String> getAllMetricNames() {
        return new ArrayList<>(metricIndex.keySet());
    }

    /**
     * Get all known aliases for a metric
     *
     * @param metricName Standard metric name
     * @return List of aliases or empty list if metric not found
     */
    public List<String> getAliases(String metricName) {
        MetricInfo info = metricIndex.get(metricName);
        if (info != null) {
            return new ArrayList<>(info.aliases);
        }
        return Collections.emptyList();
    }

    /**
     * Check if a metric name is valid (exists in dictionary)
     *
     * @param metricName Metric name to check
     * @return true if valid metric name or alias
     */
    public boolean isValidMetric(String metricName) {
        return getMetricInfo(metricName) != null;
    }

    /**
     * Normalize a metric name to its standard form
     *
     * @param metricName Metric name (may be alias)
     * @return Normalized standard name or original if not found
     */
    public String normalize(String metricName) {
        if (metricName == null || metricName.isEmpty()) {
            return metricName;
        }

        MetricInfo info = getMetricInfo(metricName);
        return info != null ? info.standardName : metricName;
    }

    /**
     * Get category description
     *
     * @param category Category code
     * @return Category description or the code itself if not found
     */
    public String getCategoryDescription(String category) {
        return categoryDescriptions.getOrDefault(category, category);
    }

    /**
     * Get all available categories
     *
     * @return Map of category codes to descriptions
     */
    public Map<String, String> getAllCategories() {
        return new LinkedHashMap<>(categoryDescriptions);
    }

    // ==================== Management Methods ====================

    /**
     * Reload the dictionary from file and database
     */
    public void reload() {
        log.info("Reloading metric dictionary...");
        root = new TrieNode();
        metricIndex.clear();
        categoryDescriptions.clear();
        loadDictionary();
        loadFromDatabase();
        log.info("Metric dictionary reloaded with {} entries", metricIndex.size());
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
        stats.put("metricCount", metricIndex.size());

        // Count by category
        Map<String, Integer> categoryCount = new LinkedHashMap<>();
        for (String category : categoryDescriptions.keySet()) {
            categoryCount.put(category, getMetricsByCategory(category).size());
        }
        stats.put("categoryBreakdown", categoryCount);

        // Count total aliases
        int totalAliases = 0;
        for (MetricInfo info : metricIndex.values()) {
            totalAliases += info.aliases.size();
        }
        stats.put("totalAliases", totalAliases);

        return stats;
    }

    /**
     * Reset statistics counters
     */
    public void resetStatistics() {
        totalRecognitions = 0;
        entitiesFound = 0;
        log.info("MetricEntityRecognizer statistics reset");
    }
}
