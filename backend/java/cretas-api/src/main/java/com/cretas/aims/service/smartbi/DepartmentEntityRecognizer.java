package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DepartmentEntity;
import com.cretas.aims.entity.smartbi.SmartBiDictionary;
import com.cretas.aims.entity.smartbi.enums.DepartmentType;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
 * @version 2.0.0
 * @since 2026-01-20
 */
@Slf4j
@Service
public class DepartmentEntityRecognizer extends BaseEntityRecognizer<DepartmentEntity, DepartmentEntityRecognizer.DepartmentTrieNode> {

    // ==================== Configuration ====================

    @Value("${smartbi.department.dictionary-file:config/smartbi/department_dictionary.json}")
    private String dictionaryFile;

    // ==================== Trie Node ====================

    /**
     * Department-specific Trie node
     */
    public static class DepartmentTrieNode extends BaseTrieNode {
        /**
         * Department type if this is an end node
         */
        public DepartmentType departmentType;

        /**
         * Parent department (for sub-departments)
         */
        public String parentDepartment;

        public DepartmentTrieNode() {
            super();
        }
    }

    // ==================== Indexes ====================

    /**
     * Department information index for quick lookup
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

    // ==================== Inner Classes ====================

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
        super(objectMapper);
    }

    // ==================== BaseEntityRecognizer Implementation ====================

    @Override
    protected String getDictionaryFile() {
        return dictionaryFile;
    }

    @Override
    protected String getDictType() {
        return "department";
    }

    @Override
    protected String getRecognizerName() {
        return "DepartmentEntityRecognizer";
    }

    @Override
    protected DepartmentTrieNode createTrieNode() {
        return new DepartmentTrieNode();
    }

    @Override
    protected DepartmentEntity createEntity(String matchedText, DepartmentTrieNode node, int start, int end) {
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

    @Override
    protected int getEntityStartIndex(DepartmentEntity entity) {
        return entity.getStartIndex();
    }

    @Override
    protected void clearIndexes() {
        departmentIndex.clear();
        subDeptToDept.clear();
    }

    @Override
    protected void collectAdditionalStatistics(Map<String, Object> stats) {
        stats.put("departmentCount", getAllDepartments(DepartmentType.DEPARTMENT).size());
        stats.put("subDepartmentCount", getAllDepartments(DepartmentType.SUB_DEPARTMENT).size());
        stats.put("totalIndexSize", departmentIndex.size());
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void processDictionaryData(Map<String, Object> dictionary) {
        // Load suffixes
        if (dictionary.containsKey("suffixes")) {
            List<String> loadedSuffixes = (List<String>) dictionary.get("suffixes");
            this.suffixes = new ArrayList<>(loadedSuffixes);
        }

        // Load patterns
        if (dictionary.containsKey("patterns")) {
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
            Map<String, Map<String, Object>> departments =
                    (Map<String, Map<String, Object>>) dictionary.get("departments");
            loadDepartments(departments);
        }
    }

    @Override
    protected void processDbEntry(SmartBiDictionary entry) {
        String name = entry.getName();

        // Add to Trie
        addToTrieWithType(name, DepartmentType.DEPARTMENT, name, entry.getParentName(), false, null);

        // Process aliases
        List<String> aliases = parseAliases(entry.getAliases());
        for (String alias : aliases) {
            addToTrieWithType(alias, DepartmentType.DEPARTMENT, name, entry.getParentName(), true, alias);
        }
    }

    @Override
    protected void initDefaultDictionary() {
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

            addToTrieWithType(deptName, DepartmentType.DEPARTMENT, deptName, null, false, null);
            String nameWithoutSuffix = removeSuffix(deptName);
            if (!nameWithoutSuffix.equals(deptName)) {
                addToTrieWithType(nameWithoutSuffix, DepartmentType.DEPARTMENT, deptName, null, false, null);
            }

            for (String alias : entry.getValue()) {
                addToTrieWithType(alias, DepartmentType.DEPARTMENT, deptName, null, true, alias);
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
                addToTrieWithType(subDept, DepartmentType.SUB_DEPARTMENT, subDept, parentDept, false, null);
                subDeptToDept.put(subDept, parentDept);
            }
        }

        log.info("Default dictionary initialized with {} entries", departmentIndex.size());
    }

    // ==================== Override recognize() for pattern matching ====================

    @Override
    public List<DepartmentEntity> recognize(String text) {
        if (text == null || text.isEmpty()) {
            return Collections.emptyList();
        }

        totalRecognitions++;
        List<DepartmentEntity> entities = new ArrayList<>();
        Set<String> matchedRanges = new HashSet<>();
        int textLength = text.length();

        // Trie matching
        for (int i = 0; i < textLength; i++) {
            BaseTrieNode current = root;
            int j = i;
            BaseTrieNode lastMatch = null;
            int lastMatchEnd = i;

            while (j < textLength && current.children.containsKey(text.charAt(j))) {
                current = current.children.get(text.charAt(j));
                j++;

                if (current.isEnd) {
                    lastMatch = current;
                    lastMatchEnd = j;
                }
            }

            if (lastMatch != null) {
                String matchedText = text.substring(i, lastMatchEnd);
                String rangeKey = i + "-" + lastMatchEnd;
                if (!matchedRanges.contains(rangeKey)) {
                    DepartmentTrieNode node = (DepartmentTrieNode) lastMatch;
                    DepartmentEntity entity = createEntity(matchedText, node, i, lastMatchEnd);
                    entities.add(entity);
                    matchedRanges.add(rangeKey);
                    entitiesFound++;
                }
                i = lastMatchEnd - 1;
            }
        }

        // Pattern matching for numbered departments
        recognizeByPattern(text, entities, matchedRanges);

        // Sort by position
        entities.sort(Comparator.comparingInt(DepartmentEntity::getStartIndex));

        return entities;
    }

    // ==================== Private Loading Methods ====================

    @SuppressWarnings("unchecked")
    private void loadDepartments(Map<String, Map<String, Object>> departments) {
        for (Map.Entry<String, Map<String, Object>> entry : departments.entrySet()) {
            String deptName = entry.getKey();
            Map<String, Object> deptData = entry.getValue();

            DepartmentInfo info = new DepartmentInfo(deptName, DepartmentType.DEPARTMENT);

            addToTrieWithType(deptName, DepartmentType.DEPARTMENT, deptName, null, false, null);

            String nameWithoutSuffix = removeSuffix(deptName);
            if (!nameWithoutSuffix.equals(deptName)) {
                addToTrieWithType(nameWithoutSuffix, DepartmentType.DEPARTMENT, deptName, null, false, null);
            }

            if (deptData.containsKey("aliases")) {
                List<String> aliases = (List<String>) deptData.get("aliases");
                info.aliases.addAll(aliases);
                for (String alias : aliases) {
                    addToTrieWithType(alias, DepartmentType.DEPARTMENT, deptName, null, true, alias);
                }
            }

            if (deptData.containsKey("subDepartments")) {
                List<String> subDepts = (List<String>) deptData.get("subDepartments");
                info.subDepartments.addAll(subDepts);
                for (String subDept : subDepts) {
                    addToTrieWithType(subDept, DepartmentType.SUB_DEPARTMENT, subDept, deptName, false, null);
                    subDeptToDept.put(subDept, deptName);

                    String subDeptWithoutSuffix = removeSuffix(subDept);
                    if (!subDeptWithoutSuffix.equals(subDept)) {
                        addToTrieWithType(subDeptWithoutSuffix, DepartmentType.SUB_DEPARTMENT, subDept, deptName, false, null);
                    }
                }
            }

            departmentIndex.put(deptName, info);
        }
    }

    private void addToTrieWithType(String term, DepartmentType type, String normalizedName,
                                    String parentDepartment, boolean isAlias, String aliasText) {
        addToTrie(term, node -> {
            node.departmentType = type;
            node.normalizedName = normalizedName;
            node.parentDepartment = parentDepartment;
            node.isAlias = isAlias;
            node.aliasText = aliasText;
        });
    }

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

    private void recognizeByPattern(String text, List<DepartmentEntity> entities, Set<String> matchedRanges) {
        if (numberedPattern != null) {
            matchPattern(text, numberedPattern, "numbered", entities, matchedRanges);
        }
        if (digitalPattern != null) {
            matchPattern(text, digitalPattern, "digital", entities, matchedRanges);
        }
    }

    private void matchPattern(String text, Pattern pattern, String patternType,
                              List<DepartmentEntity> entities, Set<String> matchedRanges) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            int start = matcher.start();
            int end = matcher.end();
            String rangeKey = start + "-" + end;

            if (!matchedRanges.contains(rangeKey)) {
                String matchedText = matcher.group();
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

    private String findPotentialParent(String text, int patternStart) {
        int lookback = Math.min(patternStart, 10);
        if (lookback <= 0) {
            return null;
        }

        String prefix = text.substring(patternStart - lookback, patternStart);

        for (String deptName : departmentIndex.keySet()) {
            String nameWithoutSuffix = removeSuffix(deptName);
            if (prefix.endsWith(nameWithoutSuffix) || prefix.endsWith(deptName)) {
                return deptName;
            }
        }

        return null;
    }

    // ==================== Public API Methods ====================

    /**
     * Quick check if text contains any department entity
     */
    public boolean containsDepartment(String text) {
        if (containsEntity(text)) {
            return true;
        }

        // Also check patterns
        if (numberedPattern != null && numberedPattern.matcher(text).find()) {
            return true;
        }
        return digitalPattern != null && digitalPattern.matcher(text).find();
    }

    /**
     * Normalize a department name
     */
    public String normalize(String departmentName) {
        if (departmentName == null || departmentName.isEmpty()) {
            return departmentName;
        }

        // Check aliases
        for (Map.Entry<String, DepartmentInfo> entry : departmentIndex.entrySet()) {
            if (entry.getValue().aliases.contains(departmentName)) {
                return entry.getKey();
            }
            for (String subDept : entry.getValue().subDepartments) {
                if (subDept.equals(departmentName)) {
                    return subDept;
                }
            }
        }

        if (departmentIndex.containsKey(departmentName)) {
            return departmentName;
        }

        if (subDeptToDept.containsKey(departmentName)) {
            return departmentName;
        }

        String withoutSuffix = removeSuffix(departmentName);
        String standardName = withoutSuffix + "部";
        if (departmentIndex.containsKey(standardName)) {
            return standardName;
        }

        return departmentName;
    }

    /**
     * Get the department type for a given department name
     */
    public DepartmentType getDepartmentType(String departmentName) {
        String normalized = normalize(departmentName);

        DepartmentInfo info = departmentIndex.get(normalized);
        if (info != null) {
            return info.type;
        }

        if (subDeptToDept.containsKey(normalized)) {
            return DepartmentType.SUB_DEPARTMENT;
        }

        return null;
    }

    /**
     * Get parent department for a sub-department
     */
    public String getParentDepartment(String subDepartmentName) {
        String normalized = normalize(subDepartmentName);
        return subDeptToDept.get(normalized);
    }

    /**
     * Get all sub-departments for a department
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
     * Check if a department name is valid
     */
    public boolean isValidDepartment(String departmentName) {
        if (departmentName == null || departmentName.isEmpty()) {
            return false;
        }

        String normalized = normalize(departmentName);

        if (departmentIndex.containsKey(normalized)) {
            return true;
        }

        if (subDeptToDept.containsKey(normalized)) {
            return true;
        }

        for (DepartmentInfo info : departmentIndex.values()) {
            if (info.aliases.contains(departmentName)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all known department names of a specific type
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
     */
    public List<String> getAliases(String departmentName) {
        String normalized = normalize(departmentName);
        DepartmentInfo info = departmentIndex.get(normalized);

        if (info != null) {
            return new ArrayList<>(info.aliases);
        }

        return Collections.emptyList();
    }

    /**
     * Add a custom department at runtime
     */
    public void addDepartment(String departmentName, List<String> aliases, List<String> subDepartments) {
        if (departmentName == null || departmentName.isEmpty()) {
            return;
        }

        DepartmentInfo info = new DepartmentInfo(departmentName, DepartmentType.DEPARTMENT);

        addToTrieWithType(departmentName, DepartmentType.DEPARTMENT, departmentName, null, false, null);
        String withoutSuffix = removeSuffix(departmentName);
        if (!withoutSuffix.equals(departmentName)) {
            addToTrieWithType(withoutSuffix, DepartmentType.DEPARTMENT, departmentName, null, false, null);
        }

        if (aliases != null) {
            info.aliases.addAll(aliases);
            for (String alias : aliases) {
                addToTrieWithType(alias, DepartmentType.DEPARTMENT, departmentName, null, true, alias);
            }
        }

        if (subDepartments != null) {
            info.subDepartments.addAll(subDepartments);
            for (String subDept : subDepartments) {
                addToTrieWithType(subDept, DepartmentType.SUB_DEPARTMENT, subDept, departmentName, false, null);
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
