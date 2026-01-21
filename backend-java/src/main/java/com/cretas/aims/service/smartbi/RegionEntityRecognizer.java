package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.RegionEntity;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.entity.smartbi.enums.RegionType;
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
 * Region Entity Recognizer Service
 *
 * Efficient region entity recognition using Trie tree data structure.
 * Supports recognition of:
 * - Major regions (7 regions: HuaDong, HuaNan, HuaBei, HuaZhong, XiNan, XiBei, DongBei)
 * - All 34 provinces/municipalities/autonomous regions
 * - Major cities across China
 *
 * Features:
 * - O(n) matching complexity using Trie tree
 * - Suffix handling (e.g., "江苏省" -> "江苏")
 * - Alias support (e.g., "华东地区" -> "华东")
 * - Position tracking for matched entities
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class RegionEntityRecognizer {

    // ==================== Configuration ====================

    @Value("${smartbi.region.dictionary-file:config/smartbi/region_dictionary.json}")
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
     * Region information index for quick lookup
     * Key: normalized region name
     * Value: RegionInfo containing type, parent, and aliases
     */
    private final Map<String, RegionInfo> regionIndex = new ConcurrentHashMap<>();

    /**
     * Province to region mapping
     */
    private final Map<String, String> provinceToRegion = new ConcurrentHashMap<>();

    /**
     * City to province mapping
     */
    private final Map<String, String> cityToProvince = new ConcurrentHashMap<>();

    /**
     * Suffixes to remove for normalization
     */
    private List<String> suffixes = new ArrayList<>();

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
         * Whether this node marks the end of a valid region name
         */
        boolean isEnd = false;

        /**
         * Region type if this is an end node
         */
        RegionType regionType;

        /**
         * Normalized name of the region
         */
        String normalizedName;

        /**
         * Parent region (for provinces: region name; for cities: province name)
         */
        String parentRegion;

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
     * Region information stored in the index
     */
    private static class RegionInfo {
        String standardName;
        RegionType type;
        String parentRegion;
        List<String> aliases = new ArrayList<>();
        List<String> childRegions = new ArrayList<>();

        RegionInfo(String standardName, RegionType type) {
            this.standardName = standardName;
            this.type = type;
        }
    }

    // ==================== Constructor ====================

    public RegionEntityRecognizer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ==================== Initialization ====================

    /**
     * Initialize the recognizer by loading dictionary and building Trie
     */
    @PostConstruct
    public void init() {
        log.info("Initializing RegionEntityRecognizer...");
        root = new TrieNode();
        loadDictionary();  // 从 JSON 加载默认配置
        loadFromDatabase(); // 从数据库加载动态配置
        log.info("RegionEntityRecognizer initialized with {} regions in index", regionIndex.size());
    }

    /**
     * Load region dictionary from JSON file
     */
    private void loadDictionary() {
        try {
            ClassPathResource resource = new ClassPathResource(dictionaryFile);
            if (!resource.exists()) {
                log.warn("Region dictionary file not found: {}, using defaults", dictionaryFile);
                initDefaultDictionary();
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                Map<String, Object> dictionary = objectMapper.readValue(
                        is, new TypeReference<Map<String, Object>>() {});

                // Load suffixes
                if (dictionary.containsKey("suffixes")) {
                    @SuppressWarnings("unchecked")
                    List<String> loadedSuffixes = (List<String>) dictionary.get("suffixes");
                    this.suffixes = new ArrayList<>(loadedSuffixes);
                }

                // Load regions (大区)
                if (dictionary.containsKey("regions")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Map<String, Object>> regions =
                            (Map<String, Map<String, Object>>) dictionary.get("regions");
                    loadRegions(regions);
                }

                // Load provinces (省份)
                if (dictionary.containsKey("provinces")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Map<String, Object>> provinces =
                            (Map<String, Map<String, Object>>) dictionary.get("provinces");
                    loadProvinces(provinces);
                }

                // Load major cities (重点城市 - for quick lookup)
                if (dictionary.containsKey("majorCities")) {
                    @SuppressWarnings("unchecked")
                    List<String> majorCities = (List<String>) dictionary.get("majorCities");
                    // Major cities are already loaded via provinces, but we can use this for prioritization
                    log.debug("Loaded {} major cities for priority matching", majorCities.size());
                }

                log.info("Successfully loaded region dictionary from: {}", dictionaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to load region dictionary: {}", e.getMessage());
            initDefaultDictionary();
        }
    }

    /**
     * Load region data and build Trie entries
     */
    private void loadRegions(Map<String, Map<String, Object>> regions) {
        for (Map.Entry<String, Map<String, Object>> entry : regions.entrySet()) {
            String regionName = entry.getKey();
            Map<String, Object> regionData = entry.getValue();

            // Create region info
            RegionInfo info = new RegionInfo(regionName, RegionType.REGION);

            // Add to Trie - standard name
            addToTrie(regionName, RegionType.REGION, regionName, null, false, null);

            // Add aliases
            if (regionData.containsKey("aliases")) {
                @SuppressWarnings("unchecked")
                List<String> aliases = (List<String>) regionData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrie(alias, RegionType.REGION, regionName, null, true, alias);
                }
            }

            // Track provinces belonging to this region
            if (regionData.containsKey("provinces")) {
                @SuppressWarnings("unchecked")
                List<String> provinces = (List<String>) regionData.get("provinces");
                info.childRegions.addAll(provinces);
                for (String province : provinces) {
                    provinceToRegion.put(province, regionName);
                }
            }

            regionIndex.put(regionName, info);
        }
    }

    /**
     * Load province data and build Trie entries
     */
    private void loadProvinces(Map<String, Map<String, Object>> provinces) {
        for (Map.Entry<String, Map<String, Object>> entry : provinces.entrySet()) {
            String provinceName = entry.getKey();
            Map<String, Object> provinceData = entry.getValue();

            // Get parent region
            String parentRegion = null;
            if (provinceData.containsKey("region")) {
                parentRegion = (String) provinceData.get("region");
                provinceToRegion.put(provinceName, parentRegion);
            }

            // Create province info
            RegionInfo info = new RegionInfo(provinceName, RegionType.PROVINCE);
            info.parentRegion = parentRegion;

            // Add to Trie - standard name
            addToTrie(provinceName, RegionType.PROVINCE, provinceName, parentRegion, false, null);

            // Add with suffix (e.g., "江苏省")
            for (String suffix : Arrays.asList("省", "市", "自治区", "特别行政区")) {
                String withSuffix = provinceName + suffix;
                if (!provinceName.endsWith(suffix)) {
                    addToTrie(withSuffix, RegionType.PROVINCE, provinceName, parentRegion, false, null);
                }
            }

            // Add aliases
            if (provinceData.containsKey("aliases")) {
                @SuppressWarnings("unchecked")
                List<String> aliases = (List<String>) provinceData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrie(alias, RegionType.PROVINCE, provinceName, parentRegion, true, alias);
                }
            }

            // Load cities
            if (provinceData.containsKey("cities")) {
                @SuppressWarnings("unchecked")
                List<String> cities = (List<String>) provinceData.get("cities");
                info.childRegions.addAll(cities);
                for (String city : cities) {
                    // Add city to Trie
                    addToTrie(city, RegionType.CITY, city, provinceName, false, null);
                    // Add with "市" suffix
                    addToTrie(city + "市", RegionType.CITY, city, provinceName, false, null);
                    cityToProvince.put(city, provinceName);
                }
            }

            regionIndex.put(provinceName, info);
        }
    }

    /**
     * Add a term to the Trie tree
     */
    private void addToTrie(String term, RegionType type, String normalizedName,
                           String parentRegion, boolean isAlias, String aliasText) {
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
            current.regionType = type;
            current.normalizedName = normalizedName;
            current.parentRegion = parentRegion;
            current.isAlias = isAlias;
            current.aliasText = aliasText;
        }
    }

    /**
     * 从数据库加载动态配置的区域词条
     * 数据库配置优先级高于 JSON 文件
     */
    private void loadFromDatabase() {
        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByDictTypeAndIsActiveTrueOrderByPriorityAsc("region");

            for (SmartBiDictionary entry : entries) {
                String name = entry.getName();

                // 添加到 Trie 树
                addToTrie(name, RegionType.PROVINCE, name, entry.getParentName(), false, null);

                // 处理别名
                if (entry.getAliases() != null && !entry.getAliases().isEmpty()) {
                    try {
                        List<String> aliases = objectMapper.readValue(
                                entry.getAliases(),
                                new TypeReference<List<String>>() {});
                        for (String alias : aliases) {
                            addToTrie(alias, RegionType.PROVINCE, name, entry.getParentName(), true, alias);
                        }
                    } catch (Exception e) {
                        log.warn("解析别名失败: {}", entry.getName(), e);
                    }
                }
            }

            log.info("从数据库加载了 {} 个区域词条", entries.size());
        } catch (Exception e) {
            log.warn("从数据库加载区域字典失败，将仅使用 JSON 配置: {}", e.getMessage());
        }
    }

    /**
     * Initialize default dictionary when file is not available
     */
    private void initDefaultDictionary() {
        log.info("Initializing default region dictionary...");

        // Default suffixes
        suffixes = Arrays.asList("省", "市", "区", "县", "自治区", "特别行政区", "地区", "大区", "区域");

        // Default regions
        Map<String, List<String>> defaultRegions = new LinkedHashMap<>();
        defaultRegions.put("华东", Arrays.asList("华东地区", "华东区", "华东区域"));
        defaultRegions.put("华南", Arrays.asList("华南地区", "华南区", "华南区域"));
        defaultRegions.put("华北", Arrays.asList("华北地区", "华北区", "华北区域"));
        defaultRegions.put("华中", Arrays.asList("华中地区", "华中区", "华中区域"));
        defaultRegions.put("西南", Arrays.asList("西南地区", "西南区", "西南区域"));
        defaultRegions.put("西北", Arrays.asList("西北地区", "西北区", "西北区域"));
        defaultRegions.put("东北", Arrays.asList("东北地区", "东北区", "东北区域"));

        for (Map.Entry<String, List<String>> entry : defaultRegions.entrySet()) {
            String regionName = entry.getKey();
            RegionInfo info = new RegionInfo(regionName, RegionType.REGION);
            info.aliases.addAll(entry.getValue());

            addToTrie(regionName, RegionType.REGION, regionName, null, false, null);
            for (String alias : entry.getValue()) {
                addToTrie(alias, RegionType.REGION, regionName, null, true, alias);
            }

            regionIndex.put(regionName, info);
        }

        // Default provinces and municipalities
        String[] defaultProvinces = {
                "北京", "天津", "上海", "重庆",
                "河北", "山西", "辽宁", "吉林", "黑龙江",
                "江苏", "浙江", "安徽", "福建", "江西", "山东",
                "河南", "湖北", "湖南", "广东", "海南",
                "四川", "贵州", "云南", "陕西", "甘肃", "青海",
                "台湾", "内蒙古", "广西", "西藏", "宁夏", "新疆", "香港", "澳门"
        };

        for (String province : defaultProvinces) {
            RegionInfo info = new RegionInfo(province, RegionType.PROVINCE);
            addToTrie(province, RegionType.PROVINCE, province, null, false, null);
            addToTrie(province + "省", RegionType.PROVINCE, province, null, false, null);
            addToTrie(province + "市", RegionType.PROVINCE, province, null, false, null);
            regionIndex.put(province, info);
        }

        // Default major cities
        String[] defaultCities = {
                "杭州", "南京", "苏州", "无锡", "宁波",
                "深圳", "广州", "东莞", "佛山",
                "成都", "武汉", "西安", "郑州", "长沙"
        };

        for (String city : defaultCities) {
            addToTrie(city, RegionType.CITY, city, null, false, null);
            addToTrie(city + "市", RegionType.CITY, city, null, false, null);
        }

        log.info("Default dictionary initialized with {} entries", regionIndex.size());
    }

    // ==================== Recognition Methods ====================

    /**
     * Recognize all region entities in the given text
     *
     * Uses Trie-based matching for O(n) complexity where n is text length.
     * Returns all matched regions with their positions and types.
     *
     * @param text Input text to analyze
     * @return List of recognized RegionEntity objects, sorted by position
     */
    public List<RegionEntity> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<RegionEntity> entities = new ArrayList<>();
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

            // If we found a match, create RegionEntity
            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                RegionEntity entity = createEntity(matchedText, lastMatch, i, lastMatchEnd);
                entities.add(entity);
                entitiesFound++;

                // Skip to end of match to avoid overlapping matches
                i = lastMatchEnd - 1;
            }
        }

        // Sort by position
        entities.sort(Comparator.comparingInt(RegionEntity::getStartIndex));

        return entities;
    }

    /**
     * Create RegionEntity from Trie match
     */
    private RegionEntity createEntity(String matchedText, TrieNode node, int start, int end) {
        RegionEntity.RegionEntityBuilder builder = RegionEntity.builder()
                .text(matchedText)
                .type(node.regionType)
                .normalizedName(node.normalizedName)
                .parentRegion(node.parentRegion)
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
     * Normalize a region name by removing common suffixes
     *
     * Examples:
     * - "江苏省" -> "江苏"
     * - "杭州市" -> "杭州"
     * - "内蒙古自治区" -> "内蒙古"
     *
     * @param regionName The region name to normalize
     * @return Normalized region name
     */
    public String normalize(String regionName) {
        if (regionName == null || regionName.isEmpty()) {
            return regionName;
        }

        String result = regionName;

        // Remove suffixes in order of length (longest first)
        List<String> sortedSuffixes = new ArrayList<>(suffixes);
        sortedSuffixes.sort((a, b) -> b.length() - a.length());

        for (String suffix : sortedSuffixes) {
            if (result.endsWith(suffix) && result.length() > suffix.length()) {
                result = result.substring(0, result.length() - suffix.length());
                break;
            }
        }

        // Also check if the normalized name exists in our index
        if (regionIndex.containsKey(result)) {
            return result;
        }

        // Try to find by alias
        for (Map.Entry<String, RegionInfo> entry : regionIndex.entrySet()) {
            if (entry.getValue().aliases.contains(regionName)) {
                return entry.getKey();
            }
        }

        return result;
    }

    /**
     * Quick check if text contains any region entity
     *
     * More efficient than recognize() when you only need a boolean result.
     *
     * @param text Input text to check
     * @return true if text contains at least one region entity
     */
    public boolean containsRegion(String text) {
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
     * Get the region type for a given region name
     *
     * @param regionName Region name (normalized or with suffix)
     * @return RegionType or null if not found
     */
    public RegionType getRegionType(String regionName) {
        String normalized = normalize(regionName);
        RegionInfo info = regionIndex.get(normalized);
        return info != null ? info.type : null;
    }

    /**
     * Get parent region for a province or city
     *
     * @param regionName Province or city name
     * @return Parent region name or null if not found
     */
    public String getParentRegion(String regionName) {
        String normalized = normalize(regionName);

        // Check if it's a city
        if (cityToProvince.containsKey(normalized)) {
            return cityToProvince.get(normalized);
        }

        // Check if it's a province
        if (provinceToRegion.containsKey(normalized)) {
            return provinceToRegion.get(normalized);
        }

        return null;
    }

    /**
     * Get the major region (大区) that contains the given region
     *
     * Works for provinces and cities.
     *
     * @param regionName Province or city name
     * @return Major region name or null if not found
     */
    public String getMajorRegion(String regionName) {
        String normalized = normalize(regionName);

        // Check if it's already a major region
        RegionInfo info = regionIndex.get(normalized);
        if (info != null && info.type == RegionType.REGION) {
            return normalized;
        }

        // Check if it's a city, get province first
        if (cityToProvince.containsKey(normalized)) {
            String province = cityToProvince.get(normalized);
            return provinceToRegion.get(province);
        }

        // Check if it's a province
        return provinceToRegion.get(normalized);
    }

    /**
     * Get all provinces in a major region
     *
     * @param regionName Major region name (e.g., "华东")
     * @return List of province names or empty list if region not found
     */
    public List<String> getProvincesInRegion(String regionName) {
        String normalized = normalize(regionName);
        RegionInfo info = regionIndex.get(normalized);

        if (info != null && info.type == RegionType.REGION) {
            return new ArrayList<>(info.childRegions);
        }

        return Collections.emptyList();
    }

    /**
     * Get all cities in a province
     *
     * @param provinceName Province name
     * @return List of city names or empty list if province not found
     */
    public List<String> getCitiesInProvince(String provinceName) {
        String normalized = normalize(provinceName);
        RegionInfo info = regionIndex.get(normalized);

        if (info != null && info.type == RegionType.PROVINCE) {
            return new ArrayList<>(info.childRegions);
        }

        return Collections.emptyList();
    }

    /**
     * Check if a region name is valid (exists in dictionary)
     *
     * @param regionName Region name to check
     * @return true if valid region name
     */
    public boolean isValidRegion(String regionName) {
        if (regionName == null || regionName.isEmpty()) {
            return false;
        }

        String normalized = normalize(regionName);

        // Check direct match
        if (regionIndex.containsKey(normalized)) {
            return true;
        }

        // Check if it's a city
        if (cityToProvince.containsKey(normalized)) {
            return true;
        }

        return false;
    }

    /**
     * Get all known region names of a specific type
     *
     * @param type Region type to filter by
     * @return List of region names
     */
    public List<String> getAllRegions(RegionType type) {
        List<String> result = new ArrayList<>();

        for (Map.Entry<String, RegionInfo> entry : regionIndex.entrySet()) {
            if (entry.getValue().type == type) {
                result.add(entry.getKey());
            }
        }

        if (type == RegionType.CITY) {
            result.addAll(cityToProvince.keySet());
        }

        return result;
    }

    // ==================== Management Methods ====================

    /**
     * 重新加载字典（热更新）
     */
    public void reload() {
        log.info("Reloading RegionEntityRecognizer...");
        root = new TrieNode();
        regionIndex.clear();
        provinceToRegion.clear();
        cityToProvince.clear();
        loadDictionary();
        loadFromDatabase();
        log.info("RegionEntityRecognizer reloaded with {} entries", regionIndex.size());
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
        stats.put("regionCount", getAllRegions(RegionType.REGION).size());
        stats.put("provinceCount", getAllRegions(RegionType.PROVINCE).size());
        stats.put("cityCount", getAllRegions(RegionType.CITY).size());
        stats.put("totalIndexSize", regionIndex.size());
        return stats;
    }

    /**
     * Reset statistics counters
     */
    public void resetStatistics() {
        totalRecognitions = 0;
        entitiesFound = 0;
        log.info("RegionEntityRecognizer statistics reset");
    }
}
