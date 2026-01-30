package com.cretas.aims.service.smartbi;

import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.repository.smartbi.SmartBiDictionaryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Base Entity Recognizer using Trie tree for efficient pattern matching.
 *
 * Provides common functionality for all entity recognizers:
 * - Trie tree construction and matching
 * - Dictionary loading from JSON files and database
 * - Statistics tracking
 * - Hot reload support
 *
 * Subclasses must implement:
 * - createTrieNode(): Create specific TrieNode instance
 * - createEntity(): Create entity from matched node
 * - initDefaultDictionary(): Initialize default patterns
 * - processDictionaryData(): Process JSON dictionary data
 * - processDbEntry(): Process database dictionary entry
 * - getEntityStartIndex(): Get entity start index for sorting
 *
 * @param <E> Entity type (e.g., RegionEntity, MetricEntity)
 * @param <N> TrieNode type extending BaseTrieNode
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
@Slf4j
public abstract class BaseEntityRecognizer<E, N extends BaseEntityRecognizer.BaseTrieNode> {

    // ==================== Trie Data Structures ====================

    /**
     * Base Trie node containing common fields
     */
    public static class BaseTrieNode {
        /**
         * Child nodes mapped by character
         */
        public Map<Character, BaseTrieNode> children = new HashMap<>();

        /**
         * Whether this node marks the end of a valid pattern
         */
        public boolean isEnd = false;

        /**
         * Whether this entry is an alias
         */
        public boolean isAlias = false;

        /**
         * The alias text (if isAlias is true)
         */
        public String aliasText;

        /**
         * Normalized name of the entity
         */
        public String normalizedName;

        public BaseTrieNode() {
        }
    }

    // ==================== Dependencies ====================

    protected final ObjectMapper objectMapper;

    @Autowired
    protected SmartBiDictionaryRepository dictionaryRepository;

    // ==================== Trie State ====================

    /**
     * Root node of the Trie tree
     */
    protected N root;

    // ==================== Statistics ====================

    /**
     * Total number of recognition operations performed
     */
    protected long totalRecognitions = 0;

    /**
     * Total number of entities found
     */
    protected long entitiesFound = 0;

    // ==================== Constructor ====================

    protected BaseEntityRecognizer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ==================== Abstract Methods ====================

    /**
     * Get the path to the dictionary JSON file
     */
    protected abstract String getDictionaryFile();

    /**
     * Get the dictionary type for database queries (e.g., "region", "metric")
     */
    protected abstract String getDictType();

    /**
     * Get the recognizer name for logging
     */
    protected abstract String getRecognizerName();

    /**
     * Create a new TrieNode instance
     */
    protected abstract N createTrieNode();

    /**
     * Create an entity from a Trie match
     *
     * @param matchedText The matched text
     * @param node The matched TrieNode
     * @param start Start index in original text
     * @param end End index in original text
     * @return Created entity
     */
    protected abstract E createEntity(String matchedText, N node, int start, int end);

    /**
     * Initialize default dictionary when file is not available
     */
    protected abstract void initDefaultDictionary();

    /**
     * Process dictionary data loaded from JSON file
     *
     * @param dictionary The parsed JSON dictionary
     */
    protected abstract void processDictionaryData(Map<String, Object> dictionary);

    /**
     * Process a database dictionary entry
     *
     * @param entry The dictionary entry from database
     */
    protected abstract void processDbEntry(SmartBiDictionary entry);

    /**
     * Get the start index of an entity for sorting
     *
     * @param entity The entity
     * @return Start index
     */
    protected abstract int getEntityStartIndex(E entity);

    /**
     * Collect additional statistics specific to this recognizer
     *
     * @param stats The statistics map to populate
     */
    protected abstract void collectAdditionalStatistics(Map<String, Object> stats);

    // ==================== Initialization ====================

    /**
     * Initialize the recognizer by loading dictionary and building Trie
     */
    @PostConstruct
    public void init() {
        log.info("Initializing {}...", getRecognizerName());
        root = createTrieNode();
        loadDictionary();
        loadFromDatabase();
        log.info("{} initialized successfully", getRecognizerName());
    }

    /**
     * Load dictionary from JSON file
     */
    protected void loadDictionary() {
        String dictionaryFile = getDictionaryFile();
        try {
            ClassPathResource resource = new ClassPathResource(dictionaryFile);
            if (!resource.exists()) {
                log.warn("{} dictionary file not found: {}, using defaults", getRecognizerName(), dictionaryFile);
                initDefaultDictionary();
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                Map<String, Object> dictionary = objectMapper.readValue(
                        is, new TypeReference<Map<String, Object>>() {});
                processDictionaryData(dictionary);
                log.info("Successfully loaded {} dictionary from: {}", getRecognizerName(), dictionaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to load {} dictionary: {}", getRecognizerName(), e.getMessage());
            initDefaultDictionary();
        }
    }

    /**
     * Load dictionary entries from database
     */
    protected void loadFromDatabase() {
        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByDictTypeAndIsActiveTrueOrderByPriorityAsc(getDictType());

            for (SmartBiDictionary entry : entries) {
                processDbEntry(entry);
            }

            log.info("Loaded {} {} entries from database", entries.size(), getDictType());
        } catch (Exception e) {
            log.warn("Failed to load {} dictionary from database: {}", getDictType(), e.getMessage());
        }
    }

    /**
     * Parse aliases from JSON string
     *
     * @param aliasesJson JSON string containing aliases array
     * @return List of aliases, or empty list if parsing fails
     */
    protected List<String> parseAliases(String aliasesJson) {
        if (aliasesJson == null || aliasesJson.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(aliasesJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse aliases: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Parse metadata from JSON string
     *
     * @param metadataJson JSON string containing metadata object
     * @return Metadata map, or empty map if parsing fails
     */
    protected Map<String, Object> parseMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isEmpty()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(metadataJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse metadata: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    // ==================== Trie Operations ====================

    /**
     * Add a term to the Trie tree
     *
     * @param term The term to add
     * @param nodeConfigurer Consumer to configure the end node
     */
    protected void addToTrie(String term, java.util.function.Consumer<N> nodeConfigurer) {
        if (term == null || term.isEmpty()) {
            return;
        }

        BaseTrieNode current = root;
        for (char c : term.toCharArray()) {
            current.children.putIfAbsent(c, createTrieNode());
            current = current.children.get(c);
        }

        @SuppressWarnings("unchecked")
        N endNode = (N) current;

        // Only configure if not already set (prefer non-alias over alias)
        if (!endNode.isEnd || (endNode.isAlias && nodeConfigurer != null)) {
            endNode.isEnd = true;
            if (nodeConfigurer != null) {
                nodeConfigurer.accept(endNode);
            }
        }
    }

    /**
     * Add a term to the Trie with basic fields only
     *
     * @param term The term to add
     * @param normalizedName The normalized name
     * @param isAlias Whether this is an alias
     * @param aliasText The alias text if isAlias is true
     */
    protected void addToTrieBasic(String term, String normalizedName, boolean isAlias, String aliasText) {
        addToTrie(term, node -> {
            node.normalizedName = normalizedName;
            node.isAlias = isAlias;
            node.aliasText = aliasText;
        });
    }

    // ==================== Recognition Methods ====================

    /**
     * Recognize all entities in the given text
     *
     * Uses Trie-based matching for O(n) complexity where n is text length.
     * Returns all matched entities with their positions.
     *
     * @param text Input text to analyze
     * @return List of recognized entities, sorted by position
     */
    public List<E> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<E> entities = new ArrayList<>();
        int textLength = text.length();

        // Scan through text using Trie matching
        for (int i = 0; i < textLength; i++) {
            BaseTrieNode current = root;
            int j = i;
            BaseTrieNode lastMatch = null;
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

            // If we found a match, create entity
            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                @SuppressWarnings("unchecked")
                N matchedNode = (N) lastMatch;
                E entity = createEntity(matchedText, matchedNode, i, lastMatchEnd);
                if (entity != null) {
                    entities.add(entity);
                    entitiesFound++;
                }

                // Skip to end of match to avoid overlapping matches
                i = lastMatchEnd - 1;
            }
        }

        // Sort by position
        entities.sort(Comparator.comparingInt(this::getEntityStartIndex));

        return entities;
    }

    /**
     * Quick check if text contains any entity
     *
     * More efficient than recognize() when you only need a boolean result.
     *
     * @param text Input text to check
     * @return true if text contains at least one entity
     */
    public boolean containsEntity(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }

        int textLength = text.length();

        for (int i = 0; i < textLength; i++) {
            BaseTrieNode current = root;
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

    /**
     * Get the first entity found in the text
     *
     * @param text Input text
     * @return First entity or null if not found
     */
    public E recognizeFirst(String text) {
        List<E> entities = recognize(text);
        return entities.isEmpty() ? null : entities.get(0);
    }

    // ==================== Management Methods ====================

    /**
     * Reload the dictionary from file and database
     */
    public void reload() {
        log.info("Reloading {} dictionary...", getRecognizerName());
        root = createTrieNode();
        clearIndexes();
        loadDictionary();
        loadFromDatabase();
        log.info("{} dictionary reloaded", getRecognizerName());
    }

    /**
     * Clear any additional indexes maintained by the subclass
     * Override this method to clear subclass-specific indexes
     */
    protected void clearIndexes() {
        // Default implementation does nothing
        // Subclasses should override to clear their specific indexes
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
        collectAdditionalStatistics(stats);
        return stats;
    }

    /**
     * Reset statistics counters
     */
    public void resetStatistics() {
        totalRecognitions = 0;
        entitiesFound = 0;
        log.info("{} statistics reset", getRecognizerName());
    }

    // ==================== Utility Methods ====================

    /**
     * Calculate confidence score based on match type
     *
     * @param isAlias Whether matched by alias
     * @return Confidence score (1.0 for exact match, 0.9 for alias)
     */
    protected double calculateConfidence(boolean isAlias) {
        return isAlias ? 0.9 : 1.0;
    }
}
