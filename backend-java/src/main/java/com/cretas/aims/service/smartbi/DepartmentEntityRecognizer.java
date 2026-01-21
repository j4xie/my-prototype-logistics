package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DepartmentEntity;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.entity.smartbi.enums.DepartmentType;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Department Entity Recognizer Service
 *
 * Efficient department entity recognition using Trie tree data structure.
 * Supports recognition of:
 * - Main departments (销售部、市场部、研发部、财务部 etc.)
 * - Sub-departments (销售一部、前端组、应收组 etc.)
 *
 * Features:
 * - O(n) matching complexity using Trie tree
 * - Suffix handling (e.g., "销售部门" -> "销售部")
 * - Alias support (e.g., "研发团队" -> "研发部")
 * - Pattern matching for numbered departments (e.g., "销售一部", "销售2部")
 * - Position tracking for matched entities
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class DepartmentEntityRecognizer {

    // ==================== Configuration ====================

    @Value("${smartbi.department.dictionary-file:config/smartbi/department_dictionary.json}")
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
     * Department information index for quick lookup
     * Key: normalized department name
     * Value: DepartmentInfo containing type, parent, and aliases
     */
    private final Map<String, DepartmentInfo> departmentIndex = new ConcurrentHashMap<>();

    /**
     * Sub-department to department mapping
     */
    private final Map<String, String> subDeptToDept = new ConcurrentHashMap<>();

    /**
     * Suffixes to remove for normalization
     */
    private List<String> suffixes = new ArrayList<>();

    /**
     * Pattern for numbered departments (Chinese numerals)
     */
    private Pattern numberedPattern;

    /**
     * Pattern for numbered departments (Arabic numerals)
     */
    private Pattern digitalPattern;

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
         * Whether this node marks the end of a valid department name
         */
        boolean isEnd = false;

        /**
         * Department type if this is an end node
         */
        DepartmentType departmentType;

        /**
         * Normalized name of the department
         */
        String normalizedName;

        /**
         * Parent department (for sub-departments)
         */
        String parentDepartment;

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
     * Department information stored in the index
     */
    private static class DepartmentInfo {
        String standardName;
        DepartmentType type;
        String parentDepartment;
        List<String> aliases = new ArrayList<>();
        List<String> subDepartments = new ArrayList<>();

        DepartmentInfo(String standardName, DepartmentType type) {
            this.standardName = standardName;
            this.type = type;
        }
    }

    // ==================== Constructor ====================

    public DepartmentEntityRecognizer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // ==================== Initialization ====================

    /**
     * Initialize the recognizer by loading dictionary and building Trie
     */
    @PostConstruct
    public void init() {
        log.info("Initializing DepartmentEntityRecognizer...");
        root = new TrieNode();
        loadDictionary();
        loadFromDatabase();
        log.info("DepartmentEntityRecognizer initialized with {} departments in index", departmentIndex.size());
    }

    /**
     * Load department dictionary from JSON file
     */
    private void loadDictionary() {
        try {
            ClassPathResource resource = new ClassPathResource(dictionaryFile);
            if (!resource.exists()) {
                log.warn("Department dictionary file not found: {}, using defaults", dictionaryFile);
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

                // Load patterns
                if (dictionary.containsKey("patterns")) {
                    @SuppressWarnings("unchecked")
                    Map<String, String> patterns = (Map<String, String>) dictionary.get("patterns");
                    if (patterns.containsKey("numbered")) {
                        numberedPattern = Pattern.compile(patterns.get("numbered"));
                    }
                    if (patterns.containsKey("digital")) {
                        digitalPattern = Pattern.compile(patterns.get("digital"));
                    }
                }

                // Load departments
                if (dictionary.containsKey("departments")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Map<String, Object>> departments =
                            (Map<String, Map<String, Object>>) dictionary.get("departments");
                    loadDepartments(departments);
                }

                log.info("Successfully loaded department dictionary from: {}", dictionaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to load department dictionary: {}", e.getMessage());
            initDefaultDictionary();
        }
    }

    /**
     * Load department data and build Trie entries
     */
    private void loadDepartments(Map<String, Map<String, Object>> departments) {
        for (Map.Entry<String, Map<String, Object>> entry : departments.entrySet()) {
            String deptName = entry.getKey();
            Map<String, Object> deptData = entry.getValue();

            // Create department info
            DepartmentInfo info = new DepartmentInfo(deptName, DepartmentType.DEPARTMENT);

            // Add to Trie - standard name
            addToTrie(deptName, DepartmentType.DEPARTMENT, deptName, null, false, null);

            // Add without "部" suffix (e.g., "销售" for "销售部")
            String nameWithoutSuffix = removeSuffix(deptName);
            if (!nameWithoutSuffix.equals(deptName)) {
                addToTrie(nameWithoutSuffix, DepartmentType.DEPARTMENT, deptName, null, false, null);
            }

            // Add aliases
            if (deptData.containsKey("aliases")) {
                @SuppressWarnings("unchecked")
                List<String> aliases = (List<String>) deptData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrie(alias, DepartmentType.DEPARTMENT, deptName, null, true, alias);
                }
            }

            // Load sub-departments
            if (deptData.containsKey("subDepartments")) {
                @SuppressWarnings("unchecked")
                List<String> subDepts = (List<String>) deptData.get("subDepartments");
                info.subDepartments.addAll(subDepts);
                for (String subDept : subDepts) {
                    // Add sub-department to Trie
                    addToTrie(subDept, DepartmentType.SUB_DEPARTMENT, subDept, deptName, false, null);
                    subDeptToDept.put(subDept, deptName);

                    // Also add without suffix
                    String subDeptWithoutSuffix = removeSuffix(subDept);
                    if (!subDeptWithoutSuffix.equals(subDept)) {
                        addToTrie(subDeptWithoutSuffix, DepartmentType.SUB_DEPARTMENT, subDept, deptName, false, null);
                    }
                }
            }

            departmentIndex.put(deptName, info);
        }
    }

    /**
     * Add a term to the Trie tree
     */
    private void addToTrie(String term, DepartmentType type, String normalizedName,
                           String parentDepartment, boolean isAlias, String aliasText) {
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
            current.departmentType = type;
            current.normalizedName = normalizedName;
            current.parentDepartment = parentDepartment;
            current.isAlias = isAlias;
            current.aliasText = aliasText;
        }
    }

    /**
     * Remove suffix from department name
     */
    private String removeSuffix(String name) {
        if (name == null || name.isEmpty()) {
            return name;
        }

        for (String suffix : suffixes) {
            if (name.endsWith(suffix) && name.length() > suffix.length()) {
                return name.substring(0, name.length() - suffix.length());
            }
        }
        return name;
    }

    /**
     * Initialize default dictionary when file is not available
     */
    private void initDefaultDictionary() {
        log.info("Initializing default department dictionary...");

        // Default suffixes
        suffixes = Arrays.asList("部", "部门", "团队", "组", "中心");

        // Default patterns
        numberedPattern = Pattern.compile("[一二三四五六七八九十]部");
        digitalPattern = Pattern.compile("\\d+部");

        // Default departments with aliases
        Map<String, List<String>> defaultDepts = new LinkedHashMap<>();
        defaultDepts.put("销售部", Arrays.asList("销售", "销售团队", "销售组"));
        defaultDepts.put("市场部", Arrays.asList("市场", "市场团队", "营销部"));
        defaultDepts.put("研发部", Arrays.asList("研发", "技术研发", "开发部", "产品研发"));
        defaultDepts.put("财务部", Arrays.asList("财务", "财会部", "会计部"));
        defaultDepts.put("人事部", Arrays.asList("人事", "HR", "人力资源", "人力资源部"));
        defaultDepts.put("运营部", Arrays.asList("运营", "运营团队"));
        defaultDepts.put("技术部", Arrays.asList("技术", "IT部", "信息部"));
        defaultDepts.put("产品部", Arrays.asList("产品", "产品团队", "PM"));
        defaultDepts.put("行政部", Arrays.asList("行政", "综合部", "办公室"));
        defaultDepts.put("客服部", Arrays.asList("客服", "客户服务", "售后部"));

        for (Map.Entry<String, List<String>> entry : defaultDepts.entrySet()) {
            String deptName = entry.getKey();
            DepartmentInfo info = new DepartmentInfo(deptName, DepartmentType.DEPARTMENT);
            info.aliases.addAll(entry.getValue());

            addToTrie(deptName, DepartmentType.DEPARTMENT, deptName, null, false, null);
            // Add without suffix
            String nameWithoutSuffix = removeSuffix(deptName);
            if (!nameWithoutSuffix.equals(deptName)) {
                addToTrie(nameWithoutSuffix, DepartmentType.DEPARTMENT, deptName, null, false, null);
            }

            for (String alias : entry.getValue()) {
                addToTrie(alias, DepartmentType.DEPARTMENT, deptName, null, true, alias);
            }

            departmentIndex.put(deptName, info);
        }

        // Default sub-departments
        Map<String, List<String>> defaultSubDepts = new LinkedHashMap<>();
        defaultSubDepts.put("销售部", Arrays.asList("销售一部", "销售二部", "销售三部", "大客户部", "渠道销售部"));
        defaultSubDepts.put("研发部", Arrays.asList("前端组", "后端组", "测试组", "架构组"));
        defaultSubDepts.put("财务部", Arrays.asList("应收组", "应付组", "税务组", "出纳组"));

        for (Map.Entry<String, List<String>> entry : defaultSubDepts.entrySet()) {
            String parentDept = entry.getKey();
            DepartmentInfo parentInfo = departmentIndex.get(parentDept);
            if (parentInfo != null) {
                parentInfo.subDepartments.addAll(entry.getValue());
            }

            for (String subDept : entry.getValue()) {
                addToTrie(subDept, DepartmentType.SUB_DEPARTMENT, subDept, parentDept, false, null);
                subDeptToDept.put(subDept, parentDept);
            }
        }

        log.info("Default dictionary initialized with {} entries", departmentIndex.size());
    }

    /**
     * 从数据库加载动态配置的部门词条
     */
    private void loadFromDatabase() {
        try {
            List<SmartBiDictionary> entries = dictionaryRepository
                    .findByDictTypeAndIsActiveTrueOrderByPriorityAsc("department");

            for (SmartBiDictionary entry : entries) {
                String name = entry.getName();

                // 添加到 Trie 树
                addToTrie(name, DepartmentType.DEPARTMENT, name, entry.getParentName(), false, null);

                // 处理别名
                if (entry.getAliases() != null && !entry.getAliases().isEmpty()) {
                    try {
                        List<String> aliases = objectMapper.readValue(
                                entry.getAliases(),
                                new TypeReference<List<String>>() {});
                        for (String alias : aliases) {
                            addToTrie(alias, DepartmentType.DEPARTMENT, name, entry.getParentName(), true, alias);
                        }
                    } catch (Exception e) {
                        log.warn("解析别名失败: {}", entry.getName(), e);
                    }
                }
            }

            log.info("从数据库加载了 {} 个部门词条", entries.size());
        } catch (Exception e) {
            log.warn("从数据库加载部门字典失败: {}", e.getMessage());
        }
    }

    // ==================== Recognition Methods ====================

    /**
     * Recognize all department entities in the given text
     *
     * Uses Trie-based matching for O(n) complexity where n is text length.
     * Also performs pattern matching for numbered departments.
     * Returns all matched departments with their positions and types.
     *
     * @param text Input text to analyze
     * @return List of recognized DepartmentEntity objects, sorted by position
     */
    public List<DepartmentEntity> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<DepartmentEntity> entities = new ArrayList<>();
        Set<String> matchedRanges = new HashSet<>(); // Track matched positions to avoid duplicates
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

            // If we found a match, create DepartmentEntity
            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                String rangeKey = i + "-" + lastMatchEnd;
                if (!matchedRanges.contains(rangeKey)) {
                    DepartmentEntity entity = createEntity(matchedText, lastMatch, i, lastMatchEnd);
                    entities.add(entity);
                    matchedRanges.add(rangeKey);
                    entitiesFound++;
                }

                // Skip to end of match to avoid overlapping matches
                i = lastMatchEnd - 1;
            }
        }

        // Pattern matching for numbered departments (e.g., "一部", "2部")
        recognizeByPattern(text, entities, matchedRanges);

        // Sort by position
        entities.sort(Comparator.comparingInt(DepartmentEntity::getStartIndex));

        return entities;
    }

    /**
     * Recognize departments using pattern matching
     */
    private void recognizeByPattern(String text, List<DepartmentEntity> entities, Set<String> matchedRanges) {
        // Match Chinese numbered pattern (一部, 二部, etc.)
        if (numberedPattern != null) {
            matchPattern(text, numberedPattern, "numbered", entities, matchedRanges);
        }

        // Match digital numbered pattern (1部, 2部, etc.)
        if (digitalPattern != null) {
            matchPattern(text, digitalPattern, "digital", entities, matchedRanges);
        }
    }

    /**
     * Match a specific pattern and add found entities
     */
    private void matchPattern(String text, Pattern pattern, String patternType,
                              List<DepartmentEntity> entities, Set<String> matchedRanges) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            int start = matcher.start();
            int end = matcher.end();
            String rangeKey = start + "-" + end;

            if (!matchedRanges.contains(rangeKey)) {
                String matchedText = matcher.group();

                // Try to find parent department by looking at text before the match
                String parentDept = findPotentialParent(text, start);

                DepartmentEntity entity = DepartmentEntity.builder()
                        .text(matchedText)
                        .type(DepartmentType.SUB_DEPARTMENT)
                        .normalizedName(matchedText)
                        .parentDepartment(parentDept)
                        .startIndex(start)
                        .endIndex(end)
                        .matchedByPattern(true)
                        .matchedPattern(patternType)
                        .confidence(0.8)
                        .build();

                entities.add(entity);
                matchedRanges.add(rangeKey);
                entitiesFound++;
            }
        }
    }

    /**
     * Try to find a potential parent department before a pattern match
     */
    private String findPotentialParent(String text, int patternStart) {
        // Look at up to 10 characters before the pattern match
        int lookback = Math.min(patternStart, 10);
        if (lookback <= 0) {
            return null;
        }

        String prefix = text.substring(patternStart - lookback, patternStart);

        // Check if any known department name appears in the prefix
        for (String deptName : departmentIndex.keySet()) {
            String nameWithoutSuffix = removeSuffix(deptName);
            if (prefix.endsWith(nameWithoutSuffix) || prefix.endsWith(deptName)) {
                return deptName;
            }
        }

        return null;
    }

    /**
     * Create DepartmentEntity from Trie match
     */
    private DepartmentEntity createEntity(String matchedText, TrieNode node, int start, int end) {
        DepartmentEntity.DepartmentEntityBuilder builder = DepartmentEntity.builder()
                .text(matchedText)
                .type(node.departmentType)
                .normalizedName(node.normalizedName)
                .parentDepartment(node.parentDepartment)
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
     * Normalize a department name by removing common suffixes
     *
     * Examples:
     * - "销售部门" -> "销售部"
     * - "研发团队" -> "研发部"
     * - "财务" -> "财务部"
     *
     * @param departmentName The department name to normalize
     * @return Normalized department name
     */
    public String normalize(String departmentName) {
        if (departmentName == null || departmentName.isEmpty()) {
            return departmentName;
        }

        // First check if this is a known alias
        for (Map.Entry<String, DepartmentInfo> entry : departmentIndex.entrySet()) {
            if (entry.getValue().aliases.contains(departmentName)) {
                return entry.getKey();
            }
            // Also check sub-departments
            for (String subDept : entry.getValue().subDepartments) {
                if (subDept.equals(departmentName)) {
                    return subDept;
                }
            }
        }

        // Check if it's already a standard name
        if (departmentIndex.containsKey(departmentName)) {
            return departmentName;
        }

        // Check if it's a sub-department
        if (subDeptToDept.containsKey(departmentName)) {
            return departmentName;
        }

        // Try to find by removing suffixes and adding standard suffix
        String withoutSuffix = removeSuffix(departmentName);
        String standardName = withoutSuffix + "部";
        if (departmentIndex.containsKey(standardName)) {
            return standardName;
        }

        // Return original if no match found
        return departmentName;
    }

    /**
     * Quick check if text contains any department entity
     *
     * More efficient than recognize() when you only need a boolean result.
     *
     * @param text Input text to check
     * @return true if text contains at least one department entity
     */
    public boolean containsDepartment(String text) {
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

        // Also check patterns
        if (numberedPattern != null && numberedPattern.matcher(text).find()) {
            return true;
        }
        if (digitalPattern != null && digitalPattern.matcher(text).find()) {
            return true;
        }

        return false;
    }

    // ==================== Query Methods ====================

    /**
     * Get the department type for a given department name
     *
     * @param departmentName Department name (normalized or with suffix)
     * @return DepartmentType or null if not found
     */
    public DepartmentType getDepartmentType(String departmentName) {
        String normalized = normalize(departmentName);

        // Check in main index
        DepartmentInfo info = departmentIndex.get(normalized);
        if (info != null) {
            return info.type;
        }

        // Check if it's a sub-department
        if (subDeptToDept.containsKey(normalized)) {
            return DepartmentType.SUB_DEPARTMENT;
        }

        return null;
    }

    /**
     * Get parent department for a sub-department
     *
     * @param subDepartmentName Sub-department name
     * @return Parent department name or null if not found
     */
    public String getParentDepartment(String subDepartmentName) {
        String normalized = normalize(subDepartmentName);
        return subDeptToDept.get(normalized);
    }

    /**
     * Get all sub-departments for a department
     *
     * @param departmentName Department name
     * @return List of sub-department names or empty list if not found
     */
    public List<String> getSubDepartments(String departmentName) {
        String normalized = normalize(departmentName);
        DepartmentInfo info = departmentIndex.get(normalized);

        if (info != null) {
            return new ArrayList<>(info.subDepartments);
        }

        return Collections.emptyList();
    }

    /**
     * Check if a department name is valid (exists in dictionary)
     *
     * @param departmentName Department name to check
     * @return true if valid department name
     */
    public boolean isValidDepartment(String departmentName) {
        if (departmentName == null || departmentName.isEmpty()) {
            return false;
        }

        String normalized = normalize(departmentName);

        // Check direct match
        if (departmentIndex.containsKey(normalized)) {
            return true;
        }

        // Check if it's a sub-department
        if (subDeptToDept.containsKey(normalized)) {
            return true;
        }

        // Check aliases
        for (DepartmentInfo info : departmentIndex.values()) {
            if (info.aliases.contains(departmentName)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all known department names of a specific type
     *
     * @param type Department type to filter by
     * @return List of department names
     */
    public List<String> getAllDepartments(DepartmentType type) {
        List<String> result = new ArrayList<>();

        if (type == DepartmentType.DEPARTMENT) {
            result.addAll(departmentIndex.keySet());
        } else if (type == DepartmentType.SUB_DEPARTMENT) {
            result.addAll(subDeptToDept.keySet());
        }

        return result;
    }

    /**
     * Get all aliases for a department
     *
     * @param departmentName Department name
     * @return List of aliases or empty list if not found
     */
    public List<String> getAliases(String departmentName) {
        String normalized = normalize(departmentName);
        DepartmentInfo info = departmentIndex.get(normalized);

        if (info != null) {
            return new ArrayList<>(info.aliases);
        }

        return Collections.emptyList();
    }

    // ==================== Management Methods ====================

    /**
     * Reload the dictionary from file
     */
    public void reload() {
        log.info("Reloading department dictionary...");
        root = new TrieNode();
        departmentIndex.clear();
        subDeptToDept.clear();
        loadDictionary();
        loadFromDatabase();
        log.info("Department dictionary reloaded with {} entries", departmentIndex.size());
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
        stats.put("departmentCount", getAllDepartments(DepartmentType.DEPARTMENT).size());
        stats.put("subDepartmentCount", getAllDepartments(DepartmentType.SUB_DEPARTMENT).size());
        stats.put("totalIndexSize", departmentIndex.size());
        return stats;
    }

    /**
     * Reset statistics counters
     */
    public void resetStatistics() {
        totalRecognitions = 0;
        entitiesFound = 0;
        log.info("DepartmentEntityRecognizer statistics reset");
    }

    /**
     * Add a custom department at runtime
     *
     * @param departmentName Department name
     * @param aliases List of aliases
     * @param subDepartments List of sub-departments
     */
    public void addDepartment(String departmentName, List<String> aliases, List<String> subDepartments) {
        if (departmentName == null || departmentName.isEmpty()) {
            return;
        }

        DepartmentInfo info = new DepartmentInfo(departmentName, DepartmentType.DEPARTMENT);

        // Add to Trie
        addToTrie(departmentName, DepartmentType.DEPARTMENT, departmentName, null, false, null);
        String withoutSuffix = removeSuffix(departmentName);
        if (!withoutSuffix.equals(departmentName)) {
            addToTrie(withoutSuffix, DepartmentType.DEPARTMENT, departmentName, null, false, null);
        }

        // Add aliases
        if (aliases != null) {
            info.aliases.addAll(aliases);
            for (String alias : aliases) {
                addToTrie(alias, DepartmentType.DEPARTMENT, departmentName, null, true, alias);
            }
        }

        // Add sub-departments
        if (subDepartments != null) {
            info.subDepartments.addAll(subDepartments);
            for (String subDept : subDepartments) {
                addToTrie(subDept, DepartmentType.SUB_DEPARTMENT, subDept, departmentName, false, null);
                subDeptToDept.put(subDept, departmentName);
            }
        }

        departmentIndex.put(departmentName, info);
        log.info("Added department: {} with {} aliases and {} sub-departments",
                departmentName,
                aliases != null ? aliases.size() : 0,
                subDepartments != null ? subDepartments.size() : 0);
    }
}
