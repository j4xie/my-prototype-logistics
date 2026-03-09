package com.cretas.aims.service.skill.impl;

import com.cretas.aims.dto.skill.SkillDefinition;
import com.cretas.aims.entity.smartbi.SmartBiSkill;
import com.cretas.aims.repository.smartbi.SmartBiSkillRepository;
import com.cretas.aims.service.skill.SkillRegistry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Skill注册中心实现
 *
 * <p>Central registry for managing AI skill definitions. Skills can be loaded from:</p>
 * <ul>
 *   <li>Database - SmartBiSkill entities (takes precedence)</li>
 *   <li>Classpath - SKILL.md files with YAML frontmatter</li>
 *   <li>Programmatic - default skills defined in code</li>
 * </ul>
 *
 * <p>SKILL.md file format:</p>
 * <pre>
 * ---
 * name: skill-name
 * displayName: Display Name
 * description: Skill description
 * version: 1.0.0
 * triggers:
 *   - trigger1
 *   - trigger2
 * tools:
 *   - ToolName
 * contextNeeded:
 *   - factoryId
 * ---
 * # Prompt Template Content
 * {{userQuery}}
 * </pre>
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-01-18
 */
@Service
@Slf4j
public class SkillRegistryImpl implements SkillRegistry {

    /**
     * Skill定义映射表: skillName -> SkillDefinition
     */
    private final Map<String, SkillDefinition> skillMap = new ConcurrentHashMap<>();

    private final SmartBiSkillRepository skillRepository;
    private final ObjectMapper objectMapper;
    private final PathMatchingResourcePatternResolver resourceResolver;

    /**
     * Directory path for skill definition files
     * Default: classpath:skills/
     */
    @Value("${cretas.skills.directory:classpath:skills/}")
    private String skillsDirectory;

    @Value("${cretas.skills.min_match_score:0.1}")
    private double defaultMinMatchScore;

    /**
     * Whether to load default programmatic skills
     */
    @Value("${cretas.skills.load-defaults:true}")
    private boolean loadDefaults;

    @Autowired
    public SkillRegistryImpl(SmartBiSkillRepository skillRepository, ObjectMapper objectMapper) {
        this.skillRepository = skillRepository;
        this.objectMapper = objectMapper;
        this.resourceResolver = new PathMatchingResourcePatternResolver();
    }

    @PostConstruct
    public void init() {
        log.info("Initializing Skill Registry...");
        loadSkills();
        log.info("Skill Registry initialized with {} skills", skillMap.size());
    }

    /**
     * Load all skills from multiple sources:
     * 1. Database (SmartBiSkill entities) - highest precedence
     * 2. Classpath SKILL.md files - medium precedence
     * 3. Default programmatic skills - lowest precedence
     */
    public void loadSkills() {
        int dbCount = 0;
        int fileCount = 0;
        int defaultCount = 0;

        try {
            // 1. Load default skills first (lowest precedence)
            if (loadDefaults) {
                defaultCount = initializeDefaultSkills();
            }

            // 2. Load from classpath:skills/**/SKILL.md files (overrides defaults)
            fileCount = loadSkillsFromClasspath();

            // 3. Load from database (highest precedence, overrides everything)
            dbCount = loadSkillsFromDatabase();

            log.info("Skills loaded: {} from database, {} from files, {} defaults, total: {}",
                    dbCount, fileCount, defaultCount, skillMap.size());

        } catch (Exception e) {
            log.error("Failed to load skills", e);
        }
    }

    /**
     * 初始化默认Skill定义
     * 作为fallback，当数据库和文件中没有定义时使用
     *
     * @return number of default skills registered
     */
    private int initializeDefaultSkills() {
        int count = 0;

        // 库存分析Skill — 物料库存查询 + 低库存预警
        registerWithSource(SkillDefinition.builder()
                .name("inventory-analysis")
                .displayName("库存分析")
                .description("分析库存数据，包括库存量、库存周转、预警等")
                .version("2.0.0")
                .triggers(Arrays.asList("库存分析", "库存预警", "低库存", "过期物料", "库存量", "还有多少", "存货"))
                .tools(Arrays.asList("material_batch_query", "material_low_stock_alert", "material_expired_query"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("分析工厂${factoryId}的库存情况，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 生产追踪Skill — 加工批次 + 生产计划
        registerWithSource(SkillDefinition.builder()
                .name("production-tracking")
                .displayName("生产追踪")
                .description("追踪生产进度、批次状态、产能等")
                .version("2.0.0")
                .triggers(Arrays.asList("生产进度", "产量", "生产追踪", "工单", "批次状态", "加工进度"))
                .tools(Arrays.asList("processing_batch_list", "processing_batch_detail", "processing_step_query"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("查询工厂${factoryId}的生产状态，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 质量检查Skill — 质检查询 + 质检统计
        registerWithSource(SkillDefinition.builder()
                .name("quality-inspection")
                .displayName("质量检查")
                .description("查询和分析质量检查记录")
                .version("2.0.0")
                .triggers(Arrays.asList("质检记录", "质检结果", "质量统计", "不合格", "合格率", "质量检查"))
                .tools(Arrays.asList("quality_check_query", "quality_stats_query", "quality_record_query"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("查询工厂${factoryId}的质检信息，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 物料批次Skill — 批次查询 + 批次创建 (already correct)
        registerWithSource(SkillDefinition.builder()
                .name("material-batch")
                .displayName("物料批次管理")
                .description("查询和管理物料批次信息")
                .version("2.0.0")
                .triggers(Arrays.asList("物料批次", "批次查询", "创建批次", "入库登记", "批号查询"))
                .tools(Arrays.asList("material_batch_query", "material_batch_create"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("处理工厂${factoryId}的物料批次请求，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 人员排班Skill — 排班查询 + 考勤统计 + 在线人数
        registerWithSource(SkillDefinition.builder()
                .name("personnel-scheduling")
                .displayName("人员排班")
                .description("管理人员排班、调度、出勤等")
                .version("2.0.0")
                .triggers(Arrays.asList("排班", "调度", "上班", "出勤", "人员", "员工"))
                .tools(Arrays.asList("scheduling_list", "attendance_stats", "query_online_staff_count"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("处理工厂${factoryId}的人员排班请求，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 报表生成Skill — 仪表盘概览 + 生产报表 + KPI
        registerWithSource(SkillDefinition.builder()
                .name("report-generation")
                .displayName("报表生成")
                .description("生成各类业务报表")
                .version("2.0.0")
                .triggers(Arrays.asList("报表", "报告", "仪表盘", "KPI", "汇总报表", "生产报表"))
                .tools(Arrays.asList("report_dashboard_overview", "report_production", "report_kpi"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("为工厂${factoryId}生成报表，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 设备故障诊断Skill — 状态查询 + 活跃告警 + 健康诊断
        registerWithSource(SkillDefinition.builder()
                .name("equipment-diagnosis")
                .displayName("设备故障诊断")
                .description("诊断设备故障，查询设备状态、告警和健康状况")
                .version("1.0.0")
                .triggers(Arrays.asList("设备故障", "设备报警", "设备异常", "设备状态", "设备健康", "机器故障", "停机"))
                .tools(Arrays.asList("equipment_status_query", "alert_active", "equipment_health_diagnosis"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("诊断工厂${factoryId}的设备问题，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 订单发货Skill — 订单查询 + 发货创建 + 发货统计
        registerWithSource(SkillDefinition.builder()
                .name("order-fulfillment")
                .displayName("订单发货")
                .description("处理订单发货流程，包括查询订单和创建发货单")
                .version("1.0.0")
                .triggers(Arrays.asList("发货", "出货", "物流", "配送", "发运", "订单发货"))
                .tools(Arrays.asList("order_query", "shipment_create", "shipment_query"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("处理工厂${factoryId}的发货请求，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 产品溯源Skill — 批次溯源 + 全链路追踪 + 加工时间线
        registerWithSource(SkillDefinition.builder()
                .name("traceability")
                .displayName("产品溯源")
                .description("追溯产品全链路信息，包括批次追踪和加工时间线")
                .version("1.0.0")
                .triggers(Arrays.asList("溯源", "追溯", "来源", "批次追踪", "食品安全", "溯源码"))
                .tools(Arrays.asList("trace_batch", "trace_full", "processing_batch_timeline"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("追溯工厂${factoryId}的产品信息，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 供应商评估Skill — 列表 + 评价 + 排名 + 采购统计
        registerWithSource(SkillDefinition.builder()
                .name("supplier-evaluation")
                .displayName("供应商评估")
                .description("评估供应商表现，包括排名和采购统计")
                .version("1.0.0")
                .triggers(Arrays.asList("供应商", "供货商", "供应商评价", "供应商排名", "采购评估"))
                .tools(Arrays.asList("supplier_list", "supplier_evaluate", "supplier_ranking"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("评估工厂${factoryId}的供应商，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 餐饮经营分析Skill — 营业额 + 菜品排名 + 客单价 + 高峰时段
        registerWithSource(SkillDefinition.builder()
                .name("restaurant-operations")
                .displayName("餐饮经营分析")
                .description("分析餐厅经营状况，包括营业额、菜品销量、客单价等")
                .version("1.0.0")
                .triggers(Arrays.asList("餐厅", "门店", "营业额", "菜品销量", "翻台率", "客单价"))
                .tools(Arrays.asList("restaurant_daily_revenue", "restaurant_dish_sales_ranking", "restaurant_avg_ticket"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("分析${factoryId}的餐饮经营情况，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 餐饮损耗管理Skill — 损耗汇总 + 异常检测 + 过期预警 + 低库存
        registerWithSource(SkillDefinition.builder()
                .name("restaurant-wastage")
                .displayName("餐饮损耗管理")
                .description("管理餐饮损耗，包括损耗统计、异常检测和食材预警")
                .version("1.0.0")
                .triggers(Arrays.asList("损耗", "浪费", "报损", "废料", "食材过期", "食材库存"))
                .tools(Arrays.asList("restaurant_wastage_summary", "restaurant_wastage_anomaly", "restaurant_ingredient_expiry_alert"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("管理${factoryId}的餐饮损耗，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 成本分析Skill — BOM成本 + 成本偏差 + 成本趋势
        registerWithSource(SkillDefinition.builder()
                .name("cost-analysis")
                .displayName("成本分析")
                .description("分析生产成本，包括BOM成本、偏差分析和趋势")
                .version("1.0.0")
                .triggers(Arrays.asList("成本", "费用", "BOM成本", "成本偏差", "成本趋势", "利润"))
                .tools(Arrays.asList("report_bom_cost", "report_cost_variance", "report_cost_trend_analysis"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("分析工厂${factoryId}的成本，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        // 生产人员管理Skill — 批次工人 + 工人分配 + 到岗确认
        registerWithSource(SkillDefinition.builder()
                .name("production-workforce")
                .displayName("生产人员管理")
                .description("管理生产线人员，包括工人分配、到岗确认和实时人数")
                .version("1.0.0")
                .triggers(Arrays.asList("工人", "派工", "工人到岗", "批次人员", "分配工人", "在岗人数"))
                .tools(Arrays.asList("processing_batch_workers", "processing_worker_assign", "production_confirm_workers_present"))
                .contextNeeded(Arrays.asList("factoryId"))
                .promptTemplate("管理工厂${factoryId}的生产人员，用户问题：${userQuery}")
                .source("default")
                .enabled(true)
                .build());
        count++;

        return count;
    }

    /**
     * Register a skill and track its source
     */
    private void registerWithSource(SkillDefinition skill) {
        if (skill == null || skill.getName() == null) {
            return;
        }
        skillMap.put(skill.getName(), skill);
        log.debug("Registered skill from {}: {}", skill.getSource(), skill.getName());
    }

    /**
     * Load skills from database
     * Database skills take precedence over all other sources
     *
     * @return number of skills loaded from database
     */
    private int loadSkillsFromDatabase() {
        int loaded = 0;

        try {
            List<SmartBiSkill> dbSkills = skillRepository.findByEnabledTrueOrderByPriorityAsc();

            for (SmartBiSkill dbSkill : dbSkills) {
                try {
                    SkillDefinition definition = convertFromEntity(dbSkill);
                    skillMap.put(definition.getName(), definition);
                    loaded++;
                    log.debug("Loaded skill from database: {}", definition.getName());
                } catch (Exception e) {
                    log.warn("Failed to convert skill from database: {}", dbSkill.getName(), e);
                }
            }
        } catch (Exception e) {
            log.error("Failed to load skills from database", e);
        }

        return loaded;
    }

    /**
     * Load skills from classpath SKILL.md files
     *
     * @return number of skills loaded from files
     */
    private int loadSkillsFromClasspath() {
        int loaded = 0;

        try {
            // Build the pattern to match SKILL.md files
            String pattern = skillsDirectory.endsWith("/")
                    ? skillsDirectory + "**/SKILL.md"
                    : skillsDirectory + "/**/SKILL.md";

            Resource[] resources = resourceResolver.getResources(pattern);
            log.debug("Found {} SKILL.md files in {}", resources.length, skillsDirectory);

            for (Resource resource : resources) {
                try {
                    SkillDefinition definition = parseSkillDefinition(resource);
                    if (definition != null) {
                        skillMap.put(definition.getName(), definition);
                        loaded++;
                        log.debug("Loaded skill from file: {}", definition.getName());
                    }
                } catch (Exception e) {
                    log.warn("Failed to parse skill file: {}", resource.getFilename(), e);
                }
            }

        } catch (IOException e) {
            log.error("Failed to scan for skill files in: {}", skillsDirectory, e);
        }

        return loaded;
    }

    /**
     * Parse a SKILL.md file with YAML frontmatter
     *
     * @param resource the resource to parse
     * @return the parsed SkillDefinition or null if parsing fails
     */
    private SkillDefinition parseSkillDefinition(Resource resource) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

            StringBuilder frontmatter = new StringBuilder();
            StringBuilder content = new StringBuilder();
            boolean inFrontmatter = false;
            boolean frontmatterClosed = false;

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().equals("---")) {
                    if (!inFrontmatter && !frontmatterClosed) {
                        inFrontmatter = true;
                    } else if (inFrontmatter) {
                        inFrontmatter = false;
                        frontmatterClosed = true;
                    }
                } else if (inFrontmatter) {
                    frontmatter.append(line).append("\n");
                } else if (frontmatterClosed) {
                    content.append(line).append("\n");
                }
            }

            if (frontmatter.length() == 0) {
                log.warn("No YAML frontmatter found in: {}", resource.getFilename());
                return null;
            }

            // Parse YAML frontmatter
            Map<String, Object> yaml = parseYaml(frontmatter.toString());
            if (yaml == null || !yaml.containsKey("name")) {
                log.warn("Invalid YAML frontmatter in: {}", resource.getFilename());
                return null;
            }

            // Build SkillDefinition
            SkillDefinition.SkillDefinitionBuilder builder = SkillDefinition.builder()
                    .name((String) yaml.get("name"))
                    .displayName((String) yaml.getOrDefault("displayName", yaml.get("name")))
                    .description((String) yaml.get("description"))
                    .version((String) yaml.getOrDefault("version", "1.0.0"))
                    .promptTemplate(content.toString().trim())
                    .enabled(true)
                    .source("file:" + resource.getFilename());

            // Parse triggers
            if (yaml.containsKey("triggers")) {
                Object triggers = yaml.get("triggers");
                if (triggers instanceof List) {
                    builder.triggers(((List<?>) triggers).stream()
                            .map(Object::toString)
                            .collect(Collectors.toList()));
                }
            }

            // Parse tools
            if (yaml.containsKey("tools")) {
                Object tools = yaml.get("tools");
                if (tools instanceof List) {
                    builder.tools(((List<?>) tools).stream()
                            .map(Object::toString)
                            .collect(Collectors.toList()));
                }
            }

            // Parse contextNeeded
            if (yaml.containsKey("contextNeeded")) {
                Object contextNeeded = yaml.get("contextNeeded");
                if (contextNeeded instanceof List) {
                    builder.contextNeeded(((List<?>) contextNeeded).stream()
                            .map(Object::toString)
                            .collect(Collectors.toList()));
                }
            }

            // Parse priority
            if (yaml.containsKey("priority")) {
                Object priority = yaml.get("priority");
                if (priority instanceof Number) {
                    builder.priority(((Number) priority).intValue());
                } else if (priority instanceof String) {
                    try {
                        builder.priority(Integer.parseInt((String) priority));
                    } catch (NumberFormatException e) {
                        log.warn("Invalid priority value in {}: {}", resource.getFilename(), priority);
                    }
                }
            }

            // Parse category
            if (yaml.containsKey("category")) {
                builder.category((String) yaml.get("category"));
            }

            // Parse requiredPermission
            if (yaml.containsKey("requiredPermission")) {
                builder.requiredPermission((String) yaml.get("requiredPermission"));
            }

            // Parse config
            if (yaml.containsKey("config")) {
                Object config = yaml.get("config");
                if (config instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> configMap = (Map<String, Object>) config;
                    builder.config(configMap);
                }
            }

            return builder.build();

        } catch (IOException e) {
            log.error("Failed to read skill file: {}", resource.getFilename(), e);
            return null;
        }
    }

    /**
     * Simple YAML parser for frontmatter
     * Supports basic key-value pairs and lists
     *
     * @param yaml the YAML string to parse
     * @return parsed map or null if parsing fails
     */
    private Map<String, Object> parseYaml(String yaml) {
        Map<String, Object> result = new LinkedHashMap<>();
        String currentKey = null;
        List<String> currentList = null;

        String[] lines = yaml.split("\n");

        for (String line : lines) {
            // Skip empty lines and comments
            if (line.trim().isEmpty() || line.trim().startsWith("#")) {
                continue;
            }

            // Check if this is a list item
            if (line.matches("^\\s+-\\s+.*")) {
                if (currentKey != null && currentList != null) {
                    String value = line.replaceFirst("^\\s+-\\s+", "").trim();
                    // Remove quotes if present
                    if ((value.startsWith("\"") && value.endsWith("\"")) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length() - 1);
                    }
                    currentList.add(value);
                }
                continue;
            }

            // Check if this is a key-value pair
            int colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                // Save previous list if any
                if (currentKey != null && currentList != null) {
                    result.put(currentKey, currentList);
                }

                String key = line.substring(0, colonIndex).trim();
                String value = line.substring(colonIndex + 1).trim();

                if (value.isEmpty()) {
                    // Start of a list
                    currentKey = key;
                    currentList = new ArrayList<>();
                } else {
                    // Simple key-value
                    // Remove quotes if present
                    if ((value.startsWith("\"") && value.endsWith("\"")) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length() - 1);
                    }
                    result.put(key, value);
                    currentKey = null;
                    currentList = null;
                }
            }
        }

        // Save final list if any
        if (currentKey != null && currentList != null) {
            result.put(currentKey, currentList);
        }

        return result;
    }

    /**
     * Convert a SmartBiSkill entity to SkillDefinition DTO
     *
     * @param entity the database entity
     * @return the DTO
     */
    private SkillDefinition convertFromEntity(SmartBiSkill entity) {
        SkillDefinition.SkillDefinitionBuilder builder = SkillDefinition.builder()
                .name(entity.getName())
                .displayName(entity.getDisplayName())
                .description(entity.getDescription())
                .version(entity.getVersion())
                .promptTemplate(entity.getPromptTemplate())
                .enabled(entity.getEnabled() != null ? entity.getEnabled() : true)
                .priority(entity.getPriority() != null ? entity.getPriority() : 100)
                .category(entity.getCategory())
                .requiredPermission(entity.getRequiredPermission())
                .source("database")
                .databaseId(entity.getId());

        // Parse JSON fields
        try {
            if (entity.getTriggers() != null && !entity.getTriggers().isEmpty()) {
                List<String> triggers = objectMapper.readValue(entity.getTriggers(),
                        new TypeReference<List<String>>() {});
                builder.triggers(triggers);
            }
        } catch (Exception e) {
            log.warn("Failed to parse triggers for skill {}: {}", entity.getName(), e.getMessage());
        }

        try {
            if (entity.getTools() != null && !entity.getTools().isEmpty()) {
                List<String> tools = objectMapper.readValue(entity.getTools(),
                        new TypeReference<List<String>>() {});
                builder.tools(tools);
            }
        } catch (Exception e) {
            log.warn("Failed to parse tools for skill {}: {}", entity.getName(), e.getMessage());
        }

        try {
            if (entity.getContextNeeded() != null && !entity.getContextNeeded().isEmpty()) {
                List<String> contextNeeded = objectMapper.readValue(entity.getContextNeeded(),
                        new TypeReference<List<String>>() {});
                builder.contextNeeded(contextNeeded);
            }
        } catch (Exception e) {
            log.warn("Failed to parse contextNeeded for skill {}: {}", entity.getName(), e.getMessage());
        }

        try {
            if (entity.getConfig() != null && !entity.getConfig().isEmpty()) {
                Map<String, Object> config = objectMapper.readValue(entity.getConfig(),
                        new TypeReference<Map<String, Object>>() {});
                builder.config(config);
            }
        } catch (Exception e) {
            log.warn("Failed to parse config for skill {}: {}", entity.getName(), e.getMessage());
        }

        return builder.build();
    }

    /**
     * Reload all skills from all sources
     * Clears existing cache and reloads fresh data
     */
    public void reloadSkills() {
        log.info("Reloading all skills...");
        skillMap.clear();
        loadSkills();
    }

    @Override
    public void register(SkillDefinition skillDefinition) {
        if (skillDefinition == null || skillDefinition.getName() == null) {
            log.warn("Cannot register skill: definition or name is null");
            return;
        }

        String skillName = skillDefinition.getName();
        if (skillMap.containsKey(skillName)) {
            log.warn("Skill already exists, updating: {}", skillName);
        }

        skillMap.put(skillName, skillDefinition);
        log.info("Registered skill: name={}, displayName={}, triggers={}, enabled={}",
                skillName,
                skillDefinition.getDisplayName(),
                skillDefinition.getTriggers(),
                skillDefinition.isEnabled());
    }

    @Override
    public void registerAll(List<SkillDefinition> skillDefinitions) {
        if (skillDefinitions == null || skillDefinitions.isEmpty()) {
            return;
        }
        skillDefinitions.forEach(this::register);
    }

    @Override
    public void unregister(String skillName) {
        if (skillName == null) {
            return;
        }
        SkillDefinition removed = skillMap.remove(skillName);
        if (removed != null) {
            log.info("Unregistered skill: {}", skillName);
        }
    }

    @Override
    public Optional<SkillDefinition> getSkill(String skillName) {
        return Optional.ofNullable(skillMap.get(skillName));
    }

    @Override
    public List<SkillDefinition> getAllSkills() {
        return new ArrayList<>(skillMap.values());
    }

    @Override
    public List<SkillDefinition> getEnabledSkills() {
        return skillMap.values().stream()
                .filter(SkillDefinition::isEnabled)
                .collect(Collectors.toList());
    }

    @Override
    public List<SkillDefinition> findMatchingSkills(String userQuery) {
        return findMatchingSkills(userQuery, defaultMinMatchScore);
    }

    @Override
    public Optional<SkillDefinition> findBestMatch(String userQuery) {
        List<SkillDefinition> matches = findMatchingSkills(userQuery);
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
    }

    @Override
    public List<SkillDefinition> findMatchingSkills(String userQuery, double minScore) {
        if (userQuery == null || userQuery.trim().isEmpty()) {
            return Collections.emptyList();
        }

        // 收集匹配的Skill及其得分
        List<Map.Entry<SkillDefinition, Double>> scoredSkills = new ArrayList<>();

        for (SkillDefinition skill : getEnabledSkills()) {
            double score = skill.calculateMatchScore(userQuery);
            if (score >= minScore) {
                scoredSkills.add(new AbstractMap.SimpleEntry<>(skill, score));
            }
        }

        // 按得分降序排序
        scoredSkills.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        // 返回排序后的Skill列表
        List<SkillDefinition> result = scoredSkills.stream()
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        log.debug("Found {} matching skills for query: '{}'", result.size(),
                userQuery.length() > 50 ? userQuery.substring(0, 50) + "..." : userQuery);

        return result;
    }

    @Override
    public boolean hasSkill(String skillName) {
        return skillMap.containsKey(skillName);
    }

    @Override
    public int getSkillCount() {
        return skillMap.size();
    }

    @Override
    public void clear() {
        skillMap.clear();
        log.warn("Skill Registry cleared");
    }

    @Override
    public void refresh() {
        reloadSkills();
    }

    // ==================== Additional Utility Methods ====================

    /**
     * Get skills by category
     *
     * @param category the category
     * @return list of skills in the category
     */
    public List<SkillDefinition> getSkillsByCategory(String category) {
        if (category == null) {
            return Collections.emptyList();
        }
        return skillMap.values().stream()
                .filter(s -> category.equals(s.getCategory()) && s.isEnabled())
                .sorted(Comparator.comparingInt(s -> s.getPriority() != null ? s.getPriority() : 100))
                .collect(Collectors.toList());
    }

    /**
     * Get all distinct categories
     *
     * @return set of category names
     */
    public Set<String> getAllCategories() {
        return skillMap.values().stream()
                .map(SkillDefinition::getCategory)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /**
     * Get the count of enabled skills
     *
     * @return number of enabled skills
     */
    public int getEnabledSkillCount() {
        return (int) skillMap.values().stream().filter(SkillDefinition::isEnabled).count();
    }

    /**
     * Get skills that require a specific tool
     *
     * @param toolName the tool name
     * @return list of skills using the tool
     */
    public List<SkillDefinition> getSkillsByTool(String toolName) {
        if (toolName == null) {
            return Collections.emptyList();
        }
        return skillMap.values().stream()
                .filter(s -> s.hasTool(toolName) && s.isEnabled())
                .collect(Collectors.toList());
    }

    /**
     * Get registry statistics
     *
     * @return map of statistics
     */
    public Map<String, Object> getStatistics() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalSkills", skillMap.size());
        stats.put("enabledSkills", getEnabledSkillCount());
        stats.put("categories", getAllCategories().size());
        stats.put("fromDatabase", skillMap.values().stream().filter(SkillDefinition::isFromDatabase).count());
        stats.put("fromFiles", skillMap.values().stream().filter(SkillDefinition::isFromFile).count());
        stats.put("fromDefaults", skillMap.values().stream()
                .filter(s -> "default".equals(s.getSource()))
                .count());
        return stats;
    }

    /**
     * Get skills sorted by priority
     *
     * @return list of skills sorted by priority (ascending)
     */
    public List<SkillDefinition> getSkillsSortedByPriority() {
        return skillMap.values().stream()
                .filter(SkillDefinition::isEnabled)
                .sorted(Comparator.comparingInt(s -> s.getPriority() != null ? s.getPriority() : 100))
                .collect(Collectors.toList());
    }

    /**
     * Find skills by required permission
     *
     * @param permission the permission to check
     * @return list of skills requiring the permission
     */
    public List<SkillDefinition> getSkillsByPermission(String permission) {
        if (permission == null) {
            return Collections.emptyList();
        }
        return skillMap.values().stream()
                .filter(s -> permission.equals(s.getRequiredPermission()) && s.isEnabled())
                .collect(Collectors.toList());
    }

    /**
     * Check if any skill requires a specific context field
     *
     * @param contextField the context field name
     * @return list of skills requiring the context
     */
    public List<SkillDefinition> getSkillsByContextNeeded(String contextField) {
        if (contextField == null) {
            return Collections.emptyList();
        }
        return skillMap.values().stream()
                .filter(s -> s.needsContext(contextField) && s.isEnabled())
                .collect(Collectors.toList());
    }
}
