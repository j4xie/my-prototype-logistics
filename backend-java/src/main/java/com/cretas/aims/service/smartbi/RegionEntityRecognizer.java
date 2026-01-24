package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.RegionEntity;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.entity.smartbi.enums.RegionType;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
 * @version 2.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class RegionEntityRecognizer extends BaseEntityRecognizer<RegionEntity, RegionEntityRecognizer.RegionTrieNode> {

    // ==================== Configuration ====================

    @Value("${smartbi.region.dictionary-file:config/smartbi/region_dictionary.json}")
    private String dictionaryFile;

    // ==================== Trie Node ====================

    /**
     * Region-specific Trie node
     */
    public static class RegionTrieNode extends BaseTrieNode {
        /**
         * Region type if this is an end node
         */
        public RegionType regionType;

        /**
         * Parent region (for provinces: region name; for cities: province name)
         */
        public String parentRegion;

        public RegionTrieNode() {
            super();
        }
    }

    // ==================== Indexes ====================

    /**
     * Region information index for quick lookup
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

    // ==================== Inner Classes ====================

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
        super(objectMapper);
    }

    // ==================== BaseEntityRecognizer Implementation ====================

    @Override
    protected String getDictionaryFile() {
        return dictionaryFile;
    }

    @Override
    protected String getDictType() {
        return "region";
    }

    @Override
    protected String getRecognizerName() {
        return "RegionEntityRecognizer";
    }

    @Override
    protected RegionTrieNode createTrieNode() {
        return new RegionTrieNode();
    }

    @Override
    protected RegionEntity createEntity(String matchedText, RegionTrieNode node, int start, int end) {
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

    @Override
    protected int getEntityStartIndex(RegionEntity entity) {
        return entity.getStartIndex();
    }

    @Override
    protected void clearIndexes() {
        regionIndex.clear();
        provinceToRegion.clear();
        cityToProvince.clear();
    }

    @Override
    protected void collectAdditionalStatistics(Map<String, Object> stats) {
        stats.put("regionCount", getAllRegions(RegionType.REGION).size());
        stats.put("provinceCount", getAllRegions(RegionType.PROVINCE).size());
        stats.put("cityCount", getAllRegions(RegionType.CITY).size());
        stats.put("totalIndexSize", regionIndex.size());
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void processDictionaryData(Map<String, Object> dictionary) {
        // Load suffixes
        if (dictionary.containsKey("suffixes")) {
            List<String> loadedSuffixes = (List<String>) dictionary.get("suffixes");
            this.suffixes = new ArrayList<>(loadedSuffixes);
        }

        // Load regions (大区)
        if (dictionary.containsKey("regions")) {
            Map<String, Map<String, Object>> regions =
                    (Map<String, Map<String, Object>>) dictionary.get("regions");
            loadRegions(regions);
        }

        // Load provinces (省份)
        if (dictionary.containsKey("provinces")) {
            Map<String, Map<String, Object>> provinces =
                    (Map<String, Map<String, Object>>) dictionary.get("provinces");
            loadProvinces(provinces);
        }

        // Load major cities (for logging only)
        if (dictionary.containsKey("majorCities")) {
            List<String> majorCities = (List<String>) dictionary.get("majorCities");
            log.debug("Loaded {} major cities for priority matching", majorCities.size());
        }
    }

    @Override
    protected void processDbEntry(SmartBiDictionary entry) {
        String name = entry.getName();

        // Add to Trie
        addToTrieWithType(name, RegionType.PROVINCE, name, entry.getParentName(), false, null);

        // Process aliases
        List<String> aliases = parseAliases(entry.getAliases());
        for (String alias : aliases) {
            addToTrieWithType(alias, RegionType.PROVINCE, name, entry.getParentName(), true, alias);
        }
    }

    @Override
    protected void initDefaultDictionary() {
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

            addToTrieWithType(regionName, RegionType.REGION, regionName, null, false, null);
            for (String alias : entry.getValue()) {
                addToTrieWithType(alias, RegionType.REGION, regionName, null, true, alias);
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
            addToTrieWithType(province, RegionType.PROVINCE, province, null, false, null);
            addToTrieWithType(province + "省", RegionType.PROVINCE, province, null, false, null);
            addToTrieWithType(province + "市", RegionType.PROVINCE, province, null, false, null);
            regionIndex.put(province, info);
        }

        // Default major cities
        String[] defaultCities = {
                "杭州", "南京", "苏州", "无锡", "宁波",
                "深圳", "广州", "东莞", "佛山",
                "成都", "武汉", "西安", "郑州", "长沙"
        };

        for (String city : defaultCities) {
            addToTrieWithType(city, RegionType.CITY, city, null, false, null);
            addToTrieWithType(city + "市", RegionType.CITY, city, null, false, null);
        }

        log.info("Default dictionary initialized with {} entries", regionIndex.size());
    }

    // ==================== Private Loading Methods ====================

    @SuppressWarnings("unchecked")
    private void loadRegions(Map<String, Map<String, Object>> regions) {
        for (Map.Entry<String, Map<String, Object>> entry : regions.entrySet()) {
            String regionName = entry.getKey();
            Map<String, Object> regionData = entry.getValue();

            RegionInfo info = new RegionInfo(regionName, RegionType.REGION);

            addToTrieWithType(regionName, RegionType.REGION, regionName, null, false, null);

            if (regionData.containsKey("aliases")) {
                List<String> aliases = (List<String>) regionData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrieWithType(alias, RegionType.REGION, regionName, null, true, alias);
                }
            }

            if (regionData.containsKey("provinces")) {
                List<String> provinces = (List<String>) regionData.get("provinces");
                info.childRegions.addAll(provinces);
                for (String province : provinces) {
                    provinceToRegion.put(province, regionName);
                }
            }

            regionIndex.put(regionName, info);
        }
    }

    @SuppressWarnings("unchecked")
    private void loadProvinces(Map<String, Map<String, Object>> provinces) {
        for (Map.Entry<String, Map<String, Object>> entry : provinces.entrySet()) {
            String provinceName = entry.getKey();
            Map<String, Object> provinceData = entry.getValue();

            String parentRegion = null;
            if (provinceData.containsKey("region")) {
                parentRegion = (String) provinceData.get("region");
                provinceToRegion.put(provinceName, parentRegion);
            }

            RegionInfo info = new RegionInfo(provinceName, RegionType.PROVINCE);
            info.parentRegion = parentRegion;

            addToTrieWithType(provinceName, RegionType.PROVINCE, provinceName, parentRegion, false, null);

            for (String suffix : Arrays.asList("省", "市", "自治区", "特别行政区")) {
                String withSuffix = provinceName + suffix;
                if (!provinceName.endsWith(suffix)) {
                    addToTrieWithType(withSuffix, RegionType.PROVINCE, provinceName, parentRegion, false, null);
                }
            }

            if (provinceData.containsKey("aliases")) {
                List<String> aliases = (List<String>) provinceData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrieWithType(alias, RegionType.PROVINCE, provinceName, parentRegion, true, alias);
                }
            }

            if (provinceData.containsKey("cities")) {
                List<String> cities = (List<String>) provinceData.get("cities");
                info.childRegions.addAll(cities);
                for (String city : cities) {
                    addToTrieWithType(city, RegionType.CITY, city, provinceName, false, null);
                    addToTrieWithType(city + "市", RegionType.CITY, city, provinceName, false, null);
                    cityToProvince.put(city, provinceName);
                }
            }

            regionIndex.put(provinceName, info);
        }
    }

    /**
     * Add a term to Trie with region-specific fields
     */
    private void addToTrieWithType(String term, RegionType type, String normalizedName,
                                    String parentRegion, boolean isAlias, String aliasText) {
        addToTrie(term, node -> {
            node.regionType = type;
            node.normalizedName = normalizedName;
            node.parentRegion = parentRegion;
            node.isAlias = isAlias;
            node.aliasText = aliasText;
        });
    }

    // ==================== Public API Methods ====================

    /**
     * Quick check if text contains any region entity
     */
    public boolean containsRegion(String text) {
        return containsEntity(text);
    }

    /**
     * Normalize a region name by removing common suffixes
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

        if (regionIndex.containsKey(result)) {
            return result;
        }

        for (Map.Entry<String, RegionInfo> entry : regionIndex.entrySet()) {
            if (entry.getValue().aliases.contains(regionName)) {
                return entry.getKey();
            }
        }

        return result;
    }

    /**
     * Get the region type for a given region name
     */
    public RegionType getRegionType(String regionName) {
        String normalized = normalize(regionName);
        RegionInfo info = regionIndex.get(normalized);
        return info != null ? info.type : null;
    }

    /**
     * Get parent region for a province or city
     */
    public String getParentRegion(String regionName) {
        String normalized = normalize(regionName);

        if (cityToProvince.containsKey(normalized)) {
            return cityToProvince.get(normalized);
        }

        if (provinceToRegion.containsKey(normalized)) {
            return provinceToRegion.get(normalized);
        }

        return null;
    }

    /**
     * Get the major region (大区) that contains the given region
     */
    public String getMajorRegion(String regionName) {
        String normalized = normalize(regionName);

        RegionInfo info = regionIndex.get(normalized);
        if (info != null && info.type == RegionType.REGION) {
            return normalized;
        }

        if (cityToProvince.containsKey(normalized)) {
            String province = cityToProvince.get(normalized);
            return provinceToRegion.get(province);
        }

        return provinceToRegion.get(normalized);
    }

    /**
     * Get all provinces in a major region
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
     * Check if a region name is valid
     */
    public boolean isValidRegion(String regionName) {
        if (regionName == null || regionName.isEmpty()) {
            return false;
        }

        String normalized = normalize(regionName);

        if (regionIndex.containsKey(normalized)) {
            return true;
        }

        return cityToProvince.containsKey(normalized);
    }

    /**
     * Get all known region names of a specific type
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
}
