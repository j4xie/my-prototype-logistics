package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DimensionEntity;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dimension Entity Recognizer Service
 *
 * Efficient dimension entity recognition using Trie tree data structure.
 * Supports recognition of:
 * - Department dimension (部门维度)
 * - Region dimension (区域维度)
 * - Product dimension (产品维度)
 * - Person dimension (人员维度)
 * - Time dimension (时间维度)
 * - Customer dimension (客户维度)
 * - Channel dimension (渠道维度)
 *
 * Features:
 * - O(n) matching complexity using Trie tree
 * - Multiple patterns per dimension
 * - Time granularity detection (day, week, month, quarter, year)
 * - Position tracking for matched entities
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class DimensionEntityRecognizer extends BaseEntityRecognizer<DimensionEntity, DimensionEntityRecognizer.DimensionTrieNode> {

    // ==================== Configuration ====================

    @Value("${smartbi.dimension.dictionary-file:config/smartbi/dimension_dictionary.json}")
    private String dictionaryFile;

    // ==================== Trie Node ====================

    /**
     * Dimension-specific Trie node
     */
    public static class DimensionTrieNode extends BaseTrieNode {
        /**
         * Dimension type (e.g., "department", "region", "time")
         */
        public String dimensionType;

        /**
         * Description of the dimension
         */
        public String description;

        /**
         * Database field for this dimension
         */
        public String dbField;

        /**
         * Time granularity (only for time dimension patterns)
         */
        public String granularity;

        public DimensionTrieNode() {
            super();
        }
    }

    // ==================== Additional Trie ====================

    /**
     * Root node of the Trie tree for time granularity patterns
     */
    private DimensionTrieNode granularityRoot;

    // ==================== Indexes ====================

    /**
     * Dimension information index for quick lookup
     */
    private final Map<String, DimensionInfo> dimensionIndex = new ConcurrentHashMap<>();

    /**
     * Time granularity patterns
     */
    private final Map<String, List<String>> granularityPatterns = new ConcurrentHashMap<>();

    // ==================== Inner Classes ====================

    /**
     * Dimension information stored in the index
     */
    private static class DimensionInfo {
        String type;
        String description;
        String dbField;
        List<String> patterns = new ArrayList<>();

        DimensionInfo(String type, String description, String dbField) {
            this.type = type;
            this.description = description;
            this.dbField = dbField;
        }
    }

    // ==================== Constructor ====================

    public DimensionEntityRecognizer(ObjectMapper objectMapper) {
        super(objectMapper);
    }

    // ==================== BaseEntityRecognizer Implementation ====================

    @Override
    protected String getDictionaryFile() {
        return dictionaryFile;
    }

    @Override
    protected String getDictType() {
        return "dimension";
    }

    @Override
    protected String getRecognizerName() {
        return "DimensionEntityRecognizer";
    }

    @Override
    protected DimensionTrieNode createTrieNode() {
        return new DimensionTrieNode();
    }

    @Override
    public void init() {
        log.info("Initializing DimensionEntityRecognizer...");
        root = createTrieNode();
        granularityRoot = createTrieNode();
        loadDictionary();
        loadFromDatabase();
        log.info("DimensionEntityRecognizer initialized with {} dimensions", dimensionIndex.size());
    }

    @Override
    protected DimensionEntity createEntity(String matchedText, DimensionTrieNode node, int start, int end) {
        DimensionEntity entity = DimensionEntity.builder()
                .text(matchedText)
                .dimensionType(node.dimensionType)
                .description(node.description)
                .dbField(node.dbField)
                .granularity(node.granularity)
                .startIndex(start)
                .endIndex(end)
                .confidence(1.0)
                .build();

        // Check for time granularity
        if (entity.isTime()) {
            String granularity = getTimeGranularity(matchedText);
            if (granularity != null) {
                entity.setGranularity(granularity);
            }
        }

        return entity;
    }

    @Override
    protected int getEntityStartIndex(DimensionEntity entity) {
        return entity.getStartIndex();
    }

    @Override
    protected void clearIndexes() {
        dimensionIndex.clear();
        granularityPatterns.clear();
        granularityRoot = createTrieNode();
    }

    @Override
    protected void collectAdditionalStatistics(Map<String, Object> stats) {
        stats.put("dimensionCount", dimensionIndex.size());
        stats.put("granularityCount", granularityPatterns.size());
        stats.put("dimensions", new ArrayList<>(dimensionIndex.keySet()));
        stats.put("granularities", new ArrayList<>(granularityPatterns.keySet()));
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void processDictionaryData(Map<String, Object> dictionary) {
        // Load dimensions
        if (dictionary.containsKey("dimensions")) {
            Map<String, Map<String, Object>> dimensions =
                    (Map<String, Map<String, Object>>) dictionary.get("dimensions");
            loadDimensions(dimensions);
        }

        // Load granularities
        if (dictionary.containsKey("granularities")) {
            Map<String, List<String>> granularities =
                    (Map<String, List<String>>) dictionary.get("granularities");
            loadGranularities(granularities);
        }
    }

    @Override
    protected void processDbEntry(SmartBiDictionary entry) {
        String pattern = entry.getName();
        String dimensionType = "custom";
        String dbField = null;
        String description = entry.getName() + "维度";

        Map<String, Object> metadata = parseMetadata(entry.getMetadata());
        if (metadata.containsKey("dimensionType")) {
            dimensionType = metadata.get("dimensionType").toString();
        }
        if (metadata.containsKey("dbField")) {
            dbField = metadata.get("dbField").toString();
        }
        if (metadata.containsKey("description")) {
            description = metadata.get("description").toString();
        }

        addDimensionToTrie(pattern, dimensionType, description, dbField);

        // Process aliases
        List<String> aliases = parseAliases(entry.getAliases());
        for (String alias : aliases) {
            addDimensionToTrie(alias, dimensionType, description, dbField);
        }
    }

    @Override
    protected void initDefaultDictionary() {
        log.info("Initializing default dimension dictionary...");

        // Default dimensions
        Map<String, String[]> defaultDimensions = new LinkedHashMap<>();
        defaultDimensions.put("department", new String[]{"按部门", "分部门", "各部门", "部门维度", "每个部门"});
        defaultDimensions.put("region", new String[]{"按区域", "分区域", "各区域", "按地区", "分地区", "各地区"});
        defaultDimensions.put("product", new String[]{"按产品", "分产品", "各产品", "按商品", "分商品", "各商品", "分品类", "按品类"});
        defaultDimensions.put("person", new String[]{"按人员", "分人员", "各人员", "按销售", "分销售", "各销售", "按员工", "分员工"});
        defaultDimensions.put("time", new String[]{"按月", "分月", "每月", "月度", "按周", "分周", "每周", "按日", "分日", "每日", "按年", "分年", "每年"});
        defaultDimensions.put("customer", new String[]{"按客户", "分客户", "各客户", "客户维度"});
        defaultDimensions.put("channel", new String[]{"按渠道", "分渠道", "各渠道", "渠道维度"});

        Map<String, String> dbFields = new LinkedHashMap<>();
        dbFields.put("department", "department_id");
        dbFields.put("region", "region_id");
        dbFields.put("product", "product_id");
        dbFields.put("person", "user_id");
        dbFields.put("time", "date");
        dbFields.put("customer", "customer_id");
        dbFields.put("channel", "channel_id");

        for (Map.Entry<String, String[]> entry : defaultDimensions.entrySet()) {
            String dimensionType = entry.getKey();
            String[] patterns = entry.getValue();
            String dbField = dbFields.get(dimensionType);
            String description = dimensionType + "维度";

            DimensionInfo info = new DimensionInfo(dimensionType, description, dbField);
            info.patterns.addAll(Arrays.asList(patterns));

            for (String pattern : patterns) {
                addToTrieWithDimension(pattern, dimensionType, description, dbField, null);
            }

            dimensionIndex.put(dimensionType, info);
        }

        // Default granularities
        Map<String, String[]> defaultGranularities = new LinkedHashMap<>();
        defaultGranularities.put("day", new String[]{"按日", "分日", "每日", "日度", "天"});
        defaultGranularities.put("week", new String[]{"按周", "分周", "每周", "周度"});
        defaultGranularities.put("month", new String[]{"按月", "分月", "每月", "月度"});
        defaultGranularities.put("quarter", new String[]{"按季度", "分季度", "每季度", "季度"});
        defaultGranularities.put("year", new String[]{"按年", "分年", "每年", "年度"});

        for (Map.Entry<String, String[]> entry : defaultGranularities.entrySet()) {
            String granularity = entry.getKey();
            String[] patterns = entry.getValue();

            granularityPatterns.put(granularity, Arrays.asList(patterns));

            for (String pattern : patterns) {
                addToGranularityTrie(pattern, granularity);
            }
        }

        log.info("Default dictionary initialized with {} dimensions", dimensionIndex.size());
    }

    // ==================== Private Loading Methods ====================

    @SuppressWarnings("unchecked")
    private void loadDimensions(Map<String, Map<String, Object>> dimensions) {
        for (Map.Entry<String, Map<String, Object>> entry : dimensions.entrySet()) {
            String dimensionType = entry.getKey();
            Map<String, Object> dimensionData = entry.getValue();

            String description = (String) dimensionData.getOrDefault("description", dimensionType + "维度");
            String dbField = (String) dimensionData.getOrDefault("dbField", dimensionType + "_id");

            DimensionInfo info = new DimensionInfo(dimensionType, description, dbField);

            if (dimensionData.containsKey("patterns")) {
                List<String> patterns = (List<String>) dimensionData.get("patterns");
                info.patterns.addAll(patterns);
                for (String pattern : patterns) {
                    addToTrieWithDimension(pattern, dimensionType, description, dbField, null);
                }
            }

            dimensionIndex.put(dimensionType, info);
        }
    }

    private void loadGranularities(Map<String, List<String>> granularities) {
        for (Map.Entry<String, List<String>> entry : granularities.entrySet()) {
            String granularity = entry.getKey();
            List<String> patterns = entry.getValue();

            granularityPatterns.put(granularity, new ArrayList<>(patterns));

            for (String pattern : patterns) {
                addToGranularityTrie(pattern, granularity);
            }
        }
    }

    private void addToTrieWithDimension(String term, String dimensionType,
                                         String description, String dbField, String granularity) {
        addToTrie(term, node -> {
            node.dimensionType = dimensionType;
            node.description = description;
            node.dbField = dbField;
            node.granularity = granularity;
        });
    }

    private void addToGranularityTrie(String term, String granularity) {
        if (term == null || term.isEmpty()) {
            return;
        }

        BaseTrieNode current = granularityRoot;
        for (char c : term.toCharArray()) {
            current.children.putIfAbsent(c, createTrieNode());
            current = current.children.get(c);
        }

        DimensionTrieNode endNode = (DimensionTrieNode) current;
        endNode.isEnd = true;
        endNode.dimensionType = "time";
        endNode.description = "时间维度";
        endNode.dbField = "date";
        endNode.granularity = granularity;
    }

    private void addDimensionToTrie(String pattern, String dimensionType, String description, String dbField) {
        if (pattern == null || pattern.isEmpty()) {
            return;
        }
        addToTrieWithDimension(pattern, dimensionType, description, dbField, null);

        // Update dimension index
        if (!dimensionIndex.containsKey(dimensionType)) {
            DimensionInfo info = new DimensionInfo(dimensionType, description, dbField);
            info.patterns.add(pattern);
            dimensionIndex.put(dimensionType, info);
        } else {
            DimensionInfo info = dimensionIndex.get(dimensionType);
            if (!info.patterns.contains(pattern)) {
                info.patterns.add(pattern);
            }
        }
    }

    // ==================== Public API Methods ====================

    /**
     * Quick check if text contains any dimension entity
     */
    public boolean containsDimension(String text) {
        return containsEntity(text);
    }

    /**
     * Parse the primary (first) dimension from text
     */
    public DimensionEntity parsePrimaryDimension(String text) {
        List<DimensionEntity> entities = recognize(text);
        return entities.isEmpty() ? null : entities.get(0);
    }

    /**
     * Parse all dimensions from text
     */
    public List<DimensionEntity> parseAllDimensions(String text) {
        return recognize(text);
    }

    /**
     * Get time granularity from text
     */
    public String getTimeGranularity(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }

        int textLength = text.length();

        for (int i = 0; i < textLength; i++) {
            BaseTrieNode current = granularityRoot;
            int j = i;
            DimensionTrieNode lastMatch = null;

            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    lastMatch = (DimensionTrieNode) current;
                }
            }

            if (lastMatch != null && lastMatch.granularity != null) {
                return lastMatch.granularity;
            }
        }

        return null;
    }

    /**
     * Get dimension information by type
     */
    public Map<String, String> getDimensionInfo(String dimensionType) {
        DimensionInfo info = dimensionIndex.get(dimensionType);
        if (info == null) {
            return null;
        }

        Map<String, String> result = new HashMap<>();
        result.put("type", info.type);
        result.put("description", info.description);
        result.put("dbField", info.dbField);
        return result;
    }

    /**
     * Get database field for a dimension type
     */
    public String getDbField(String dimensionType) {
        DimensionInfo info = dimensionIndex.get(dimensionType);
        return info != null ? info.dbField : null;
    }

    /**
     * Get all known dimension types
     */
    public List<String> getAllDimensionTypes() {
        return new ArrayList<>(dimensionIndex.keySet());
    }

    /**
     * Get all known granularity types
     */
    public List<String> getAllGranularities() {
        return new ArrayList<>(granularityPatterns.keySet());
    }

    /**
     * Check if a dimension type is valid
     */
    public boolean isValidDimensionType(String dimensionType) {
        return dimensionIndex.containsKey(dimensionType);
    }

    /**
     * Check if a granularity is valid
     */
    public boolean isValidGranularity(String granularity) {
        return granularityPatterns.containsKey(granularity);
    }
}
