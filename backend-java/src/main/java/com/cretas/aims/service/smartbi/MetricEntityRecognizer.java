package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.MetricEntity;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
 * @version 2.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class MetricEntityRecognizer extends BaseEntityRecognizer<MetricEntity, MetricEntityRecognizer.MetricTrieNode> {

    // ==================== Configuration ====================

    @Value("${smartbi.metric.dictionary-file:config/smartbi/metric_dictionary.json}")
    private String dictionaryFile;

    // ==================== Trie Node ====================

    /**
     * Metric-specific Trie node
     */
    public static class MetricTrieNode extends BaseTrieNode {
        /**
         * Metric category (sales, finance, comparison, analysis, customer)
         */
        public String category;

        /**
         * Unit of the metric
         */
        public String unit;

        /**
         * Aggregation type (SUM, AVG, COUNT, CALC)
         */
        public String aggregation;

        public MetricTrieNode() {
            super();
        }
    }

    // ==================== Indexes ====================

    /**
     * Metric information index for quick lookup
     */
    private final Map<String, MetricInfo> metricIndex = new ConcurrentHashMap<>();

    /**
     * Category descriptions
     */
    private final Map<String, String> categoryDescriptions = new ConcurrentHashMap<>();

    // ==================== Inner Classes ====================

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

        public String getStandardName() { return standardName; }
        public String getCategory() { return category; }
        public String getUnit() { return unit; }
        public String getAggregation() { return aggregation; }
        public List<String> getAliases() { return aliases; }
    }

    // ==================== Constructor ====================

    public MetricEntityRecognizer(ObjectMapper objectMapper) {
        super(objectMapper);
    }

    // ==================== BaseEntityRecognizer Implementation ====================

    @Override
    protected String getDictionaryFile() {
        return dictionaryFile;
    }

    @Override
    protected String getDictType() {
        return "metric";
    }

    @Override
    protected String getRecognizerName() {
        return "MetricEntityRecognizer";
    }

    @Override
    protected MetricTrieNode createTrieNode() {
        return new MetricTrieNode();
    }

    @Override
    protected MetricEntity createEntity(String matchedText, MetricTrieNode node, int start, int end) {
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

    @Override
    protected int getEntityStartIndex(MetricEntity entity) {
        return entity.getStartIndex();
    }

    @Override
    protected void clearIndexes() {
        metricIndex.clear();
        categoryDescriptions.clear();
    }

    @Override
    protected void collectAdditionalStatistics(Map<String, Object> stats) {
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
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void processDictionaryData(Map<String, Object> dictionary) {
        // Load metrics
        if (dictionary.containsKey("metrics")) {
            Map<String, Map<String, Object>> metrics =
                    (Map<String, Map<String, Object>>) dictionary.get("metrics");
            loadMetrics(metrics);
        }

        // Load category descriptions
        if (dictionary.containsKey("categories")) {
            Map<String, String> categories = (Map<String, String>) dictionary.get("categories");
            categoryDescriptions.putAll(categories);
        }
    }

    @Override
    protected void processDbEntry(SmartBiDictionary entry) {
        String name = entry.getName();

        // Parse metadata to get category, unit, aggregation
        String category = "通用";
        String unit = "";
        String aggregation = "SUM";

        Map<String, Object> metadata = parseMetadata(entry.getMetadata());
        if (metadata.containsKey("category")) {
            category = metadata.get("category").toString();
        }
        if (metadata.containsKey("unit")) {
            unit = metadata.get("unit").toString();
        }
        if (metadata.containsKey("aggregation")) {
            aggregation = metadata.get("aggregation").toString();
        }

        // Create MetricInfo if not exists
        MetricInfo info = metricIndex.get(name);
        if (info == null) {
            info = new MetricInfo(name, category, unit, aggregation);
            metricIndex.put(name, info);
        }

        // Add to Trie
        addToTrieWithMetric(name, name, category, unit, aggregation, false, null);

        // Process aliases
        List<String> aliases = parseAliases(entry.getAliases());
        for (String alias : aliases) {
            addToTrieWithMetric(alias, name, category, unit, aggregation, true, alias);
            if (!info.aliases.contains(alias)) {
                info.aliases.add(alias);
            }
        }
    }

    @Override
    protected void initDefaultDictionary() {
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

    // ==================== Private Loading Methods ====================

    @SuppressWarnings("unchecked")
    private void loadMetrics(Map<String, Map<String, Object>> metrics) {
        for (Map.Entry<String, Map<String, Object>> entry : metrics.entrySet()) {
            String metricName = entry.getKey();
            Map<String, Object> metricData = entry.getValue();

            String category = (String) metricData.getOrDefault("category", "unknown");
            String unit = (String) metricData.getOrDefault("unit", "");
            String aggregation = (String) metricData.getOrDefault("aggregation", "SUM");

            MetricInfo info = new MetricInfo(metricName, category, unit, aggregation);

            addToTrieWithMetric(metricName, metricName, category, unit, aggregation, false, null);

            if (metricData.containsKey("aliases")) {
                List<String> aliases = (List<String>) metricData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrieWithMetric(alias, metricName, category, unit, aggregation, true, alias);
                }
            }

            metricIndex.put(metricName, info);
        }
    }

    private void addDefaultMetric(String name, String category, String unit,
                                   String aggregation, List<String> aliases) {
        MetricInfo info = new MetricInfo(name, category, unit, aggregation);
        info.aliases.addAll(aliases);

        addToTrieWithMetric(name, name, category, unit, aggregation, false, null);
        for (String alias : aliases) {
            addToTrieWithMetric(alias, name, category, unit, aggregation, true, alias);
        }

        metricIndex.put(name, info);
    }

    private void addToTrieWithMetric(String term, String normalizedName, String category,
                                      String unit, String aggregation, boolean isAlias, String aliasText) {
        addToTrie(term, node -> {
            node.normalizedName = normalizedName;
            node.category = category;
            node.unit = unit;
            node.aggregation = aggregation;
            node.isAlias = isAlias;
            node.aliasText = aliasText;
        });
    }

    // ==================== Public API Methods ====================

    /**
     * Quick check if text contains any metric entity
     */
    public boolean containsMetric(String text) {
        return containsEntity(text);
    }

    /**
     * Get metric information by name
     */
    public MetricInfo getMetricInfo(String metricName) {
        if (metricName == null || metricName.isEmpty()) {
            return null;
        }

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
     */
    public List<String> getAllMetricNames() {
        return new ArrayList<>(metricIndex.keySet());
    }

    /**
     * Get all known aliases for a metric
     */
    public List<String> getAliases(String metricName) {
        MetricInfo info = metricIndex.get(metricName);
        if (info != null) {
            return new ArrayList<>(info.aliases);
        }
        return Collections.emptyList();
    }

    /**
     * Check if a metric name is valid
     */
    public boolean isValidMetric(String metricName) {
        return getMetricInfo(metricName) != null;
    }

    /**
     * Normalize a metric name to its standard form
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
     */
    public String getCategoryDescription(String category) {
        return categoryDescriptions.getOrDefault(category, category);
    }

    /**
     * Get all available categories
     */
    public Map<String, String> getAllCategories() {
        return new LinkedHashMap<>(categoryDescriptions);
    }
}
