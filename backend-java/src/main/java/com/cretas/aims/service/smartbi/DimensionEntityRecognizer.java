package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DimensionEntity;
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
 * @version 1.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class DimensionEntityRecognizer {

    // ==================== Configuration ====================

    @Value("${smartbi.dimension.dictionary-file:config/smartbi/dimension_dictionary.json}")
    private String dictionaryFile;

    private final ObjectMapper objectMapper;

    @Autowired
    private SmartBiDictionaryRepository dictionaryRepository;

    // ==================== Trie Data Structures ====================

    /**
     * Root node of the Trie tree for dimension patterns
     */
    private TrieNode root;

    /**
     * Root node of the Trie tree for time granularity patterns
     */
    private TrieNode granularityRoot;

    /**
     * Dimension information index for quick lookup
     * Key: dimension type (e.g., "department", "region")
     * Value: DimensionInfo containing patterns, description, and dbField
     */
    private final Map<String, DimensionInfo> dimensionIndex = new ConcurrentHashMap<>();

    /**
     * Time granularity patterns
     * Key: granularity name (e.g., "day", "month")
     * Value: List of patterns
     */
    private final Map<String, List<String>> granularityPatterns = new ConcurrentHashMap<>();

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
         * Whether this node marks the end of a valid pattern
         */
        boolean isEnd = false;

        /**
         * Dimension type if this is an end node
         */
        String dimensionType;

        /**
         * Description of the dimension
         */
        String description;

        /**
         * Database field for this dimension
         */
        String dbField;

        /**
         * Time granularity (only for time dimension patterns)
         */
        String granularity;

        TrieNode() {
        }
    }

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
        this.objectMapper = objectMapper;
    }

    // ==================== Initialization ====================

    /**
     * Initialize the recognizer by loading dictionary and building Trie
     */
    @PostConstruct
    public void init() {
        log.info("Initializing DimensionEntityRecognizer...");
        root = new TrieNode();
        granularityRoot = new TrieNode();
        loadDictionary();
        loadFromDatabase();
        log.info("DimensionEntityRecognizer initialized with {} dimensions", dimensionIndex.size());
    }

    /**
     * Load dimension dictionary from JSON file
     */
    private void loadDictionary() {
        try {
            ClassPathResource resource = new ClassPathResource(dictionaryFile);
            if (!resource.exists()) {
                log.warn("Dimension dictionary file not found: {}, using defaults", dictionaryFile);
                initDefaultDictionary();
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                Map<String, Object> dictionary = objectMapper.readValue(
                        is, new TypeReference<Map<String, Object>>() {});

                // Load dimensions
                if (dictionary.containsKey("dimensions")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Map<String, Object>> dimensions =
                            (Map<String, Map<String, Object>>) dictionary.get("dimensions");
                    loadDimensions(dimensions);
                }

                // Load granularities
                if (dictionary.containsKey("granularities")) {
                    @SuppressWarnings("unchecked")
                    Map<String, List<String>> granularities =
                            (Map<String, List<String>>) dictionary.get("granularities");
                    loadGranularities(granularities);
                }

                log.info("Successfully loaded dimension dictionary from: {}", dictionaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to load dimension dictionary: {}", e.getMessage());
            initDefaultDictionary();
        }
    }

    /**
     * Load dimension data and build Trie entries
     */
    private void loadDimensions(Map<String, Map<String, Object>> dimensions) {
        for (Map.Entry<String, Map<String, Object>> entry : dimensions.entrySet()) {
            String dimensionType = entry.getKey();
            Map<String, Object> dimensionData = entry.getValue();

            String description = (String) dimensionData.getOrDefault("description", dimensionType + "维度");
            String dbField = (String) dimensionData.getOrDefault("dbField", dimensionType + "_id");

            // Create dimension info
            DimensionInfo info = new DimensionInfo(dimensionType, description, dbField);

            // Load patterns
            if (dimensionData.containsKey("patterns")) {
                @SuppressWarnings("unchecked")
                List<String> patterns = (List<String>) dimensionData.get("patterns");
                info.patterns.addAll(patterns);
                for (String pattern : patterns) {
                    addToTrie(root, pattern, dimensionType, description, dbField, null);
                }
            }

            dimensionIndex.put(dimensionType, info);
        }
    }

    /**
     * Load time granularity patterns and build Trie entries
     */
    private void loadGranularities(Map<String, List<String>> granularities) {
        for (Map.Entry<String, List<String>> entry : granularities.entrySet()) {
            String granularity = entry.getKey();
            List<String> patterns = entry.getValue();

            granularityPatterns.put(granularity, new ArrayList<>(patterns));

            for (String pattern : patterns) {
                addToTrie(granularityRoot, pattern, "time", "时间维度", "date", granularity);
            }
        }
    }

    /**
     * Add a term to the Trie tree
     */
    private void addToTrie(TrieNode trieRoot, String term, String dimensionType,
                           String description, String dbField, String granularity) {
        if (term == null || term.isEmpty()) {
            return;
        }

        TrieNode current = trieRoot;
        for (char c : term.toCharArray()) {
            current.children.putIfAbsent(c, new TrieNode());
            current = current.children.get(c);
        }

        current.isEnd = true;
        current.dimensionType = dimensionType;
        current.description = description;
        current.dbField = dbField;
        current.granularity = granularity;
    }

    /**
     * Initialize default dictionary when file is not available
     */
    private void initDefaultDictionary() {
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
                addToTrie(root, pattern, dimensionType, description, dbField, null);
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
                addToTrie(granularityRoot, pattern, "time", "时间维度", "date", granularity);
            }
        }

        log.info("Default dictionary initialized with {} dimensions", dimensionIndex.size());
    }

    /**
     * 从数据库加载动态配置的维度词条
     */
    private void loadFromDatabase() {
        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByDictTypeAndIsActiveTrueOrderByPriorityAsc("dimension");

            for (SmartBiDictionary entry : entries) {
                String pattern = entry.getName();
                String dimensionType = "custom";
                String dbField = null;
                String description = entry.getName() + "维度";

                // 从元数据获取维度类型和数据库字段
                if (entry.getMetadata() != null && !entry.getMetadata().isEmpty()) {
                    try {
                        Map<String, Object> metadata = objectMapper.readValue(
                                entry.getMetadata(),
                                new TypeReference<Map<String, Object>>() {});
                        if (metadata.containsKey("dimensionType")) {
                            dimensionType = metadata.get("dimensionType").toString();
                        }
                        if (metadata.containsKey("dbField")) {
                            dbField = metadata.get("dbField").toString();
                        }
                        if (metadata.containsKey("description")) {
                            description = metadata.get("description").toString();
                        }
                    } catch (Exception e) {
                        log.warn("解析维度元数据失败: {}", entry.getName());
                    }
                }

                // 添加到 Trie 树
                addDimensionToTrie(pattern, dimensionType, description, dbField);

                // 处理别名
                if (entry.getAliases() != null && !entry.getAliases().isEmpty()) {
                    try {
                        List<String> aliases = objectMapper.readValue(
                                entry.getAliases(),
                                new TypeReference<List<String>>() {});
                        for (String alias : aliases) {
                            addDimensionToTrie(alias, dimensionType, description, dbField);
                        }
                    } catch (Exception e) {
                        log.warn("解析维度别名失败: {}", entry.getName());
                    }
                }
            }

            log.info("从数据库加载了 {} 个维度词条", entries.size());
        } catch (Exception e) {
            log.warn("从数据库加载维度字典失败: {}", e.getMessage());
        }
    }

    /**
     * 添加维度到 Trie 树的辅助方法
     */
    private void addDimensionToTrie(String pattern, String dimensionType, String description, String dbField) {
        if (pattern == null || pattern.isEmpty()) {
            return;
        }
        addToTrie(root, pattern, dimensionType, description, dbField, null);

        // 更新维度索引
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

    // ==================== Recognition Methods ====================

    /**
     * Recognize all dimension entities in the given text
     *
     * Uses Trie-based matching for O(n) complexity where n is text length.
     * Returns all matched dimensions with their positions and types.
     *
     * @param text Input text to analyze
     * @return List of recognized DimensionEntity objects, sorted by position
     */
    public List<DimensionEntity> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<DimensionEntity> entities = new ArrayList<>();
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

            // If we found a match, create DimensionEntity
            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                DimensionEntity entity = createEntity(matchedText, lastMatch, i, lastMatchEnd);

                // Check for time granularity
                if (entity.isTime()) {
                    String granularity = getTimeGranularity(matchedText);
                    if (granularity != null) {
                        entity.setGranularity(granularity);
                    }
                }

                entities.add(entity);
                entitiesFound++;

                // Skip to end of match to avoid overlapping matches
                i = lastMatchEnd - 1;
            }
        }

        // Sort by position
        entities.sort(Comparator.comparingInt(DimensionEntity::getStartIndex));

        return entities;
    }

    /**
     * Create DimensionEntity from Trie match
     */
    private DimensionEntity createEntity(String matchedText, TrieNode node, int start, int end) {
        return DimensionEntity.builder()
                .text(matchedText)
                .dimensionType(node.dimensionType)
                .description(node.description)
                .dbField(node.dbField)
                .granularity(node.granularity)
                .startIndex(start)
                .endIndex(end)
                .confidence(1.0)
                .build();
    }

    /**
     * Parse the primary (first) dimension from text
     *
     * Returns the first matched dimension, typically representing the main analysis dimension.
     *
     * @param text Input text to analyze
     * @return Primary DimensionEntity or null if none found
     */
    public DimensionEntity parsePrimaryDimension(String text) {
        List<DimensionEntity> entities = recognize(text);
        return entities.isEmpty() ? null : entities.get(0);
    }

    /**
     * Parse all dimensions from text
     *
     * Returns all matched dimensions for multi-dimensional analysis.
     *
     * @param text Input text to analyze
     * @return List of all recognized DimensionEntity objects
     */
    public List<DimensionEntity> parseAllDimensions(String text) {
        return recognize(text);
    }

    /**
     * Get time granularity from text
     *
     * Detects the time granularity (day, week, month, quarter, year) from text.
     *
     * @param text Input text to analyze
     * @return Granularity string (day, week, month, quarter, year) or null if not found
     */
    public String getTimeGranularity(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }

        int textLength = text.length();

        // Scan through text using granularity Trie matching
        for (int i = 0; i < textLength; i++) {
            TrieNode current = granularityRoot;
            int j = i;
            TrieNode lastMatch = null;

            // Try to find a match starting at position i
            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    lastMatch = current;
                }
            }

            // If we found a match, return the granularity
            if (lastMatch != null && lastMatch.granularity != null) {
                return lastMatch.granularity;
            }
        }

        return null;
    }

    /**
     * Quick check if text contains any dimension entity
     *
     * More efficient than recognize() when you only need a boolean result.
     *
     * @param text Input text to check
     * @return true if text contains at least one dimension entity
     */
    public boolean containsDimension(String text) {
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
     * Get dimension information by type
     *
     * @param dimensionType Dimension type (e.g., "department", "region")
     * @return Map containing description and dbField, or null if not found
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
     *
     * @param dimensionType Dimension type
     * @return Database field name or null if not found
     */
    public String getDbField(String dimensionType) {
        DimensionInfo info = dimensionIndex.get(dimensionType);
        return info != null ? info.dbField : null;
    }

    /**
     * Get all known dimension types
     *
     * @return List of dimension type names
     */
    public List<String> getAllDimensionTypes() {
        return new ArrayList<>(dimensionIndex.keySet());
    }

    /**
     * Get all known granularity types
     *
     * @return List of granularity names
     */
    public List<String> getAllGranularities() {
        return new ArrayList<>(granularityPatterns.keySet());
    }

    /**
     * Check if a dimension type is valid
     *
     * @param dimensionType Dimension type to check
     * @return true if valid dimension type
     */
    public boolean isValidDimensionType(String dimensionType) {
        return dimensionIndex.containsKey(dimensionType);
    }

    /**
     * Check if a granularity is valid
     *
     * @param granularity Granularity to check
     * @return true if valid granularity
     */
    public boolean isValidGranularity(String granularity) {
        return granularityPatterns.containsKey(granularity);
    }

    // ==================== Management Methods ====================

    /**
     * Reload the dictionary from file and database
     * Can be called to refresh dimension data at runtime without restarting
     */
    public void reload() {
        log.info("Reloading dimension dictionary...");
        root = new TrieNode();
        granularityRoot = new TrieNode();
        dimensionIndex.clear();
        granularityPatterns.clear();
        loadDictionary();
        loadFromDatabase();
        log.info("Dimension dictionary reloaded with {} dimensions", dimensionIndex.size());
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
        stats.put("dimensionCount", dimensionIndex.size());
        stats.put("granularityCount", granularityPatterns.size());
        stats.put("dimensions", new ArrayList<>(dimensionIndex.keySet()));
        stats.put("granularities", new ArrayList<>(granularityPatterns.keySet()));
        return stats;
    }

    /**
     * Reset statistics counters
     */
    public void resetStatistics() {
        totalRecognitions = 0;
        entitiesFound = 0;
        log.info("DimensionEntityRecognizer statistics reset");
    }
}
