package com.cretas.aims.service.decoration.impl;

import com.cretas.aims.ai.client.PythonLLMClient;
import com.cretas.aims.dto.decoration.*;
import com.cretas.aims.entity.decoration.FactoryHomeLayout;
import com.cretas.aims.repository.FactoryHomeLayoutRepository;
import com.cretas.aims.service.decoration.DecorationService;
import com.cretas.aims.service.validator.LayoutValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 装饰服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-14
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DecorationServiceImpl implements DecorationService {

    private final FactoryHomeLayoutRepository layoutRepository;
    private final ObjectMapper objectMapper;
    private final PythonLLMClient pythonLLMClient;
    private final LayoutValidator layoutValidator;

    /** 5 种允许的模块 type — LayoutValidator.VALID_MODULE_IDS 镜像 (id == type 约定)。 */
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "welcome", "ai_insight", "stats_grid", "quick_actions", "dev_tools");

    /**
     * 默认模块配置 — 对齐前端 HomeModule (5 种 type + gridPosition/gridSize/name)
     */
    private static final List<HomeLayoutDTO.ModuleConfig> DEFAULT_MODULES = Arrays.asList(
            buildModule("welcome", "welcome", "欢迎区", true, 0, 0, 0, 2, 1),
            buildModule("ai_insight", "ai_insight", "AI洞察", true, 1, 0, 1, 2, 1),
            buildModule("stats_grid", "stats_grid", "数据统计", true, 2, 0, 2, 2, 2),
            buildModule("quick_actions", "quick_actions", "快捷操作", true, 3, 0, 4, 2, 1),
            buildModule("dev_tools", "dev_tools", "开发工具", false, 4, 0, 5, 1, 1)
    );

    /**
     * 默认主题配置 — 同时填新字段 (cardBorderRadius/secondaryColor/...) 和旧字段
     * (cardRadius/cardGap/...) 保证两侧消费者都能正常读取。
     */
    private static final HomeLayoutDTO.ThemeConfig DEFAULT_THEME = HomeLayoutDTO.ThemeConfig.builder()
            .primaryColor("#2E7D32")
            .secondaryColor("#4CAF50")
            .backgroundColor("#F5F5F5")
            .cardBorderRadius(12)
            .aiCardGradient(List.of("#1A237E", "#3949AB"))
            .textColor("#212121")
            .cardBackgroundColor("#FFFFFF")
            .cardRadius(12)
            .cardGap(12)
            .fontScale(1.0)
            .compactMode(false)
            .build();

    private static HomeLayoutDTO.ModuleConfig buildModule(
            String id, String type, String name, boolean visible,
            int order, int x, int y, int w, int h) {
        return HomeLayoutDTO.ModuleConfig.builder()
                .id(id)
                .type(type)
                .name(name)
                .visible(visible)
                .order(order)
                .gridPosition(HomeLayoutDTO.GridPosition.builder().x(x).y(y).build())
                .gridSize(HomeLayoutDTO.GridSize.builder().w(w).h(h).build())
                // 旧字段也填，保持向后兼容
                .title(name)
                .colSpan(w)
                .rowSpan(h)
                .build();
    }

    @Override
    public HomeLayoutDTO getHomeLayout(String factoryId) {
        log.debug("获取工厂首页布局: factoryId={}", factoryId);

        Optional<FactoryHomeLayout> layoutOpt = layoutRepository.findPublishedByFactoryId(factoryId);

        if (layoutOpt.isEmpty()) {
            // 返回默认布局
            return createDefaultLayout(factoryId);
        }

        return convertToDTO(layoutOpt.get());
    }

    @Override
    @Transactional
    public HomeLayoutDTO saveDraft(String factoryId, HomeLayoutDTO.SaveRequest request) {
        log.info("保存布局草稿: factoryId={}", factoryId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId)
                .orElse(createNewLayout(factoryId));

        // 更新配置
        updateLayoutFromRequest(layout, request);
        layout.setStatus(0); // 草稿状态

        FactoryHomeLayout saved = layoutRepository.save(layout);
        log.info("布局草稿已保存: id={}", saved.getId());

        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public HomeLayoutDTO publishLayout(String factoryId) {
        log.info("发布布局配置: factoryId={}", factoryId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId)
                .orElseThrow(() -> new IllegalArgumentException("布局配置不存在，请先保存草稿"));

        layout.setStatus(1); // 发布状态
        layout.setVersion(layout.getVersion() + 1);

        FactoryHomeLayout saved = layoutRepository.save(layout);
        log.info("布局已发布: id={}, version={}", saved.getId(), saved.getVersion());

        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public AILayoutResponse generateLayoutWithAI(String factoryId, AILayoutRequest request) {
        log.info("AI生成布局: factoryId={}, prompt={}", factoryId, request.getPrompt());

        long startTime = System.currentTimeMillis();
        List<HomeLayoutDTO.ModuleConfig> modules;
        HomeLayoutDTO.ThemeConfig theme;
        String explanation;
        List<String> suggestions;
        String modelUsed;

        try {
            String systemPrompt = buildLayoutGenerateSystemPrompt();
            String userPrompt = buildLayoutGenerateUserPrompt(request);
            log.debug("LLM systemPrompt 长度={}, userPrompt={}", systemPrompt.length(), userPrompt);

            String llmResponse = pythonLLMClient.chatLowTemp(systemPrompt, userPrompt);
            log.debug("LLM 响应: {}", llmResponse);

            ParsedLayout parsed = parseAndValidateLayout(llmResponse);
            modules = parsed.modules;
            theme = parsed.theme != null ? parsed.theme : DEFAULT_THEME;
            explanation = parsed.explanation != null && !parsed.explanation.isBlank()
                    ? parsed.explanation
                    : "已根据您的描述生成新布局。";
            suggestions = parsed.suggestions != null ? parsed.suggestions : List.of();
            modelUsed = "qwen-flash";  // Python llm_router slot=chat 实际选 qwen-flash-aliyun-b
        } catch (Exception e) {
            log.warn("LLM 生成布局失败，降级到规则布局: {}", e.getMessage());
            modules = generateModulesFromRequest(request);
            theme = generateThemeFromRequest(request);
            explanation = "AI 服务暂不可用，已用规则模板生成布局。";
            suggestions = List.of("再说一次需求", "重置为默认布局", "试试简洁风格");
            modelUsed = "rule-based-fallback";
        }

        // 持久化到 FactoryHomeLayout (扁平 modules JSON，对齐前端 HomeModule 形态)
        int gridColumns = request.getGridColumns() != null ? request.getGridColumns() : 2;
        int timeBasedFlag = Boolean.TRUE.equals(request.getTimeBasedEnabled()) ? 1 : 0;
        persistAIGeneratedLayout(factoryId, modules, theme, request.getPrompt(), gridColumns, timeBasedFlag);

        return AILayoutResponse.builder()
                .layout(modules)
                .theme(theme)
                .explanation(explanation)
                .generationTimeMs(System.currentTimeMillis() - startTime)
                .modelUsed(modelUsed)
                .suggestions(suggestions)
                .needsClarification(false)
                .clarificationQuestions(List.of())
                .gridColumns(gridColumns)
                .build();
    }

    /** 持久化 AI 生成的布局到 factory_home_layout. */
    private void persistAIGeneratedLayout(
            String factoryId,
            List<HomeLayoutDTO.ModuleConfig> modules,
            HomeLayoutDTO.ThemeConfig theme,
            String aiPrompt,
            int gridColumns,
            int timeBasedFlag) {
        FactoryHomeLayout entity = layoutRepository.findByFactoryId(factoryId)
                .orElse(createNewLayout(factoryId));
        entity.setModulesConfig(serializeModules(modules));
        entity.setThemeConfig(serializeTheme(theme));
        entity.setGridColumns(gridColumns);
        entity.setAiGenerated(1);
        entity.setAiPrompt(aiPrompt);
        entity.setTimeBasedEnabled(timeBasedFlag);
        entity.setStatus(0);
        layoutRepository.save(entity);
    }

    /**
     * LLM system prompt — 5 模块 type 白名单 + 2 列 Bento Grid 约束 + 严格 JSON 输出。
     */
    String buildLayoutGenerateSystemPrompt() {
        return """
                你是 Cretas 食品溯源系统的首页布局设计师。根据用户描述生成首页模块布局 JSON。

                【可用模块】(只能用以下 5 种 type，其他一律忽略)
                - welcome     欢迎卡片  (maxW=2, maxH=1)
                - ai_insight  AI 洞察   (maxW=2, maxH=2)
                - stats_grid  数据统计  (maxW=2, maxH=2) ⚠️ 必须存在 visible=true
                - quick_actions 快捷操作 (maxW=2, maxH=1)
                - dev_tools   开发工具  (maxW=1, maxH=1, 通常 visible=false)

                【布局约束】
                - 网格 2 列，模块按 gridPosition.y 升序铺排，同行不允许重叠
                - gridSize.w ∈ {1,2}, gridSize.h ∈ {1,2}
                - gridPosition.x ∈ {0,1}, gridPosition.x + gridSize.w ≤ 2
                - gridPosition.y ≥ 0
                - 每种 type 至少出现一次时，id 直接复用 type；如有多个同类型，id 加数字后缀 (例 stats_grid_2)
                - order 字段从 0 起递增，跟 modules 数组下标对齐

                【主题颜色范围】
                - primaryColor / secondaryColor：HEX 6 位
                - cardBorderRadius ∈ [4,16]

                【输出格式】严格 JSON 对象，不要 markdown 代码块，不要解释
                {
                  "modules": [
                    {
                      "id": "stats_grid",
                      "type": "stats_grid",
                      "name": "数据统计",
                      "visible": true,
                      "order": 0,
                      "gridPosition": {"x": 0, "y": 0},
                      "gridSize": {"w": 2, "h": 2}
                    }
                  ],
                  "theme": {
                    "primaryColor": "#2E7D32",
                    "backgroundColor": "#F5F5F5",
                    "cardBorderRadius": 12
                  },
                  "explanation": "一句话解释设计意图",
                  "suggestions": ["后续可以尝试的指令A", "指令B"]
                }
                """;
    }

    String buildLayoutGenerateUserPrompt(AILayoutRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("用户需求: ").append(request.getPrompt() != null ? request.getPrompt() : "生成一个适合工厂管理的首页布局").append('\n');
        if (request.getStylePreference() != null && !request.getStylePreference().isBlank()) {
            sb.append("偏好风格: ").append(request.getStylePreference()).append('\n');
        }
        if (request.getPageType() != null && !request.getPageType().isBlank()) {
            sb.append("页面类型: ").append(request.getPageType()).append('\n');
        }
        if (request.getOperationType() != null && !request.getOperationType().isBlank()) {
            sb.append("操作类型: ").append(request.getOperationType()).append('\n');
        }
        if (request.getCurrentLayout() != null && !request.getCurrentLayout().isEmpty()) {
            try {
                sb.append("当前布局: ").append(objectMapper.writeValueAsString(request.getCurrentLayout())).append('\n');
            } catch (JsonProcessingException ignore) {
                // 序列化失败就不带上下文
            }
        }
        if (request.getCurrentTheme() != null) {
            try {
                sb.append("当前主题: ").append(objectMapper.writeValueAsString(request.getCurrentTheme())).append('\n');
            } catch (JsonProcessingException ignore) {
                // 同上
            }
        }
        return sb.toString();
    }

    /** LLM 输出解析结果。 */
    private static class ParsedLayout {
        List<HomeLayoutDTO.ModuleConfig> modules;
        HomeLayoutDTO.ThemeConfig theme;
        String explanation;
        List<String> suggestions;
    }

    /**
     * 解析 LLM JSON 输出并验证。
     *
     * @throws IllegalStateException LLM 输出无效 (上层 catch 后走 fallback)
     */
    ParsedLayout parseAndValidateLayout(String llmResponse) {
        if (llmResponse == null || llmResponse.isBlank()) {
            throw new IllegalStateException("LLM 返回空内容");
        }
        // 去掉可能存在的 markdown 围栏
        String cleaned = llmResponse.replaceAll("(?s)```json\\s*", "")
                                    .replaceAll("(?s)```\\s*", "")
                                    .trim();

        JsonNode root;
        try {
            root = objectMapper.readTree(cleaned);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("LLM 输出不是合法 JSON: " + e.getMessage(), e);
        }
        if (!root.isObject() || !root.has("modules") || !root.get("modules").isArray()) {
            throw new IllegalStateException("LLM 输出缺少 modules 数组");
        }

        List<HomeLayoutDTO.ModuleConfig> modules;
        try {
            modules = objectMapper.convertValue(
                    root.get("modules"),
                    new TypeReference<List<HomeLayoutDTO.ModuleConfig>>() {});
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("modules 反序列化失败: " + e.getMessage(), e);
        }

        // 过滤非法 type / 缺关键字段
        modules = modules.stream()
                .filter(m -> m != null && m.getType() != null && ALLOWED_TYPES.contains(m.getType()))
                .filter(m -> m.getGridSize() != null && m.getGridPosition() != null)
                .map(this::normalizeModule)
                .collect(Collectors.toList());

        if (modules.isEmpty()) {
            throw new IllegalStateException("LLM 输出无任何有效模块");
        }

        // 走 LayoutValidator (它消费 Map 形态 with x/y/w/h flat keys)
        List<Map<String, Object>> validatorInput = modules.stream()
                .map(this::moduleToValidatorMap)
                .collect(Collectors.toList());
        LayoutValidator.ValidationResult v = layoutValidator.validate(validatorInput);
        if (!v.isValid()) {
            throw new IllegalStateException("布局验证失败: " + v.getErrorMessage());
        }

        ParsedLayout result = new ParsedLayout();
        result.modules = modules;
        result.theme = parseThemeFromNode(root.get("theme"));
        result.explanation = root.has("explanation") ? root.get("explanation").asText() : null;
        result.suggestions = parseSuggestions(root.get("suggestions"));
        return result;
    }

    private HomeLayoutDTO.ModuleConfig normalizeModule(HomeLayoutDTO.ModuleConfig m) {
        // id 缺省 = type
        if (m.getId() == null || m.getId().isBlank()) {
            m.setId(m.getType());
        }
        if (m.getName() == null || m.getName().isBlank()) {
            m.setName(getModuleName(m.getType()));
        }
        if (m.getVisible() == null) {
            m.setVisible(!"dev_tools".equals(m.getType()));
        }
        // 同步旧字段 (colSpan/rowSpan/title) 给老 caller 用
        if (m.getColSpan() == null && m.getGridSize() != null) {
            m.setColSpan(m.getGridSize().getW());
        }
        if (m.getRowSpan() == null && m.getGridSize() != null) {
            m.setRowSpan(m.getGridSize().getH());
        }
        if (m.getTitle() == null) {
            m.setTitle(m.getName());
        }
        return m;
    }

    private Map<String, Object> moduleToValidatorMap(HomeLayoutDTO.ModuleConfig m) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", m.getId());
        map.put("type", m.getType());
        map.put("visible", m.getVisible() != null ? m.getVisible() : true);
        map.put("x", m.getGridPosition() != null && m.getGridPosition().getX() != null
                ? m.getGridPosition().getX() : 0);
        map.put("y", m.getGridPosition() != null && m.getGridPosition().getY() != null
                ? m.getGridPosition().getY() : 0);
        map.put("w", m.getGridSize() != null && m.getGridSize().getW() != null
                ? m.getGridSize().getW() : 1);
        map.put("h", m.getGridSize() != null && m.getGridSize().getH() != null
                ? m.getGridSize().getH() : 1);
        return map;
    }

    private HomeLayoutDTO.ThemeConfig parseThemeFromNode(JsonNode themeNode) {
        if (themeNode == null || !themeNode.isObject()) {
            return DEFAULT_THEME;
        }
        try {
            HomeLayoutDTO.ThemeConfig t = objectMapper.treeToValue(themeNode, HomeLayoutDTO.ThemeConfig.class);
            if (t.getPrimaryColor() == null) t.setPrimaryColor(DEFAULT_THEME.getPrimaryColor());
            if (t.getBackgroundColor() == null) t.setBackgroundColor(DEFAULT_THEME.getBackgroundColor());
            return t;
        } catch (JsonProcessingException e) {
            log.debug("theme 解析失败，用默认主题: {}", e.getMessage());
            return DEFAULT_THEME;
        }
    }

    private List<String> parseSuggestions(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        node.forEach(n -> {
            if (n.isTextual()) {
                out.add(n.asText());
            } else if (n.isObject() && n.has("title")) {
                out.add(n.get("title").asText());
            }
        });
        return out;
    }

    @Override
    public LayoutSuggestionDTO getSuggestions(String factoryId) {
        log.debug("获取布局建议: factoryId={}", factoryId);

        // 获取使用统计
        String usageStatsJson = layoutRepository.findUsageStatsByFactoryId(factoryId);
        Map<String, Integer> moduleClicks = parseUsageStats(usageStatsJson);

        // 生成建议
        List<LayoutSuggestionDTO.Suggestion> suggestions = new ArrayList<>();
        List<LayoutSuggestionDTO.ModuleUsage> mostUsed = new ArrayList<>();
        List<LayoutSuggestionDTO.ModuleUsage> leastUsed = new ArrayList<>();

        if (!moduleClicks.isEmpty()) {
            // 按点击次数排序
            List<Map.Entry<String, Integer>> sortedClicks = new ArrayList<>(moduleClicks.entrySet());
            sortedClicks.sort((a, b) -> b.getValue().compareTo(a.getValue()));

            int totalClicks = moduleClicks.values().stream().mapToInt(Integer::intValue).sum();

            // 最常用模块
            for (int i = 0; i < Math.min(3, sortedClicks.size()); i++) {
                Map.Entry<String, Integer> entry = sortedClicks.get(i);
                mostUsed.add(LayoutSuggestionDTO.ModuleUsage.builder()
                        .moduleId(entry.getKey())
                        .moduleName(getModuleName(entry.getKey()))
                        .clickCount(entry.getValue())
                        .usagePercentage(totalClicks > 0 ? (double) entry.getValue() / totalClicks : 0)
                        .build());
            }

            // 最少使用模块
            for (int i = sortedClicks.size() - 1; i >= Math.max(0, sortedClicks.size() - 3); i--) {
                Map.Entry<String, Integer> entry = sortedClicks.get(i);
                leastUsed.add(LayoutSuggestionDTO.ModuleUsage.builder()
                        .moduleId(entry.getKey())
                        .moduleName(getModuleName(entry.getKey()))
                        .clickCount(entry.getValue())
                        .usagePercentage(totalClicks > 0 ? (double) entry.getValue() / totalClicks : 0)
                        .build());

                // 为使用较少的模块生成建议
                if (entry.getValue() < 5) {
                    suggestions.add(LayoutSuggestionDTO.Suggestion.builder()
                            .id(UUID.randomUUID().toString())
                            .type("visibility")
                            .title("考虑隐藏低使用率模块")
                            .description("\"" + getModuleName(entry.getKey()) + "\" 模块使用频率较低，可考虑隐藏以简化首页")
                            .confidence(0.7)
                            .targetModuleId(entry.getKey())
                            .action("hide")
                            .expectedBenefit("简化首页，提升加载速度")
                            .build());
                }
            }

            // 根据高使用率模块生成位置调整建议
            if (!mostUsed.isEmpty() && mostUsed.get(0).getClickCount() > 20) {
                suggestions.add(LayoutSuggestionDTO.Suggestion.builder()
                        .id(UUID.randomUUID().toString())
                        .type("module_reorder")
                        .title("调整高频模块位置")
                        .description("将 \"" + mostUsed.get(0).getModuleName() + "\" 移至首位可提高操作效率")
                        .confidence(0.85)
                        .targetModuleId(mostUsed.get(0).getModuleId())
                        .action("move_to_top")
                        .suggestedPosition(1)
                        .expectedBenefit("减少用户操作步骤")
                        .build());
            }
        }

        // 如果没有统计数据，提供默认建议
        if (suggestions.isEmpty()) {
            suggestions.add(LayoutSuggestionDTO.Suggestion.builder()
                    .id(UUID.randomUUID().toString())
                    .type("general")
                    .title("开始使用布局统计")
                    .description("继续使用系统，我们将根据您的使用习惯提供个性化布局建议")
                    .confidence(1.0)
                    .action("continue_usage")
                    .expectedBenefit("获得更准确的个性化建议")
                    .build());
        }

        return LayoutSuggestionDTO.builder()
                .suggestions(suggestions)
                .behaviorAnalysis(LayoutSuggestionDTO.BehaviorAnalysis.builder()
                        .mostUsedModules(mostUsed)
                        .leastUsedModules(leastUsed)
                        .peakUsageHours(Arrays.asList("09:00-11:00", "14:00-16:00"))
                        .analysisPeriodDays(7)
                        .build())
                .timestamp(System.currentTimeMillis())
                .build();
    }

    @Override
    @Transactional
    public void recordModuleClick(String factoryId, String moduleId) {
        log.debug("记录模块点击: factoryId={}, moduleId={}", factoryId, moduleId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId).orElse(null);
        if (layout == null) {
            return;
        }

        // 解析并更新使用统计
        Map<String, Object> usageStats = parseUsageStatsMap(layout.getUsageStats());
        @SuppressWarnings("unchecked")
        Map<String, Integer> moduleClicks = (Map<String, Integer>) usageStats.computeIfAbsent("moduleClicks", k -> new HashMap<>());

        moduleClicks.put(moduleId, moduleClicks.getOrDefault(moduleId, 0) + 1);
        usageStats.put("lastUpdated", LocalDateTime.now().toString());

        try {
            layout.setUsageStats(objectMapper.writeValueAsString(usageStats));
            layoutRepository.save(layout);
        } catch (JsonProcessingException e) {
            log.error("序列化使用统计失败", e);
        }
    }

    @Override
    @Transactional
    public HomeLayoutDTO resetToDefault(String factoryId) {
        log.info("重置为默认布局: factoryId={}", factoryId);

        FactoryHomeLayout layout = layoutRepository.findByFactoryId(factoryId)
                .orElse(createNewLayout(factoryId));

        layout.setModulesConfig(serializeModules(DEFAULT_MODULES));
        layout.setThemeConfig(serializeTheme(DEFAULT_THEME));
        layout.setGridColumns(2);
        layout.setTimeBasedEnabled(0);
        layout.setAiGenerated(0);
        layout.setAiPrompt(null);
        layout.setStatus(1);
        layout.setVersion(layout.getVersion() + 1);

        FactoryHomeLayout saved = layoutRepository.save(layout);
        return convertToDTO(saved);
    }

    @Override
    public List<HomeLayoutDTO.ModuleConfig> getAvailableModules(String factoryId) {
        // 返回所有可用模块
        return new ArrayList<>(DEFAULT_MODULES);
    }

    // ==================== 私有辅助方法 ====================

    private HomeLayoutDTO createDefaultLayout(String factoryId) {
        return HomeLayoutDTO.builder()
                .factoryId(factoryId)
                .modules(new ArrayList<>(DEFAULT_MODULES))
                .theme(DEFAULT_THEME)
                .gridColumns(2)
                .status(1)
                .version(1)
                .aiGenerated(0)
                .timeBasedEnabled(0)
                .build();
    }

    private FactoryHomeLayout createNewLayout(String factoryId) {
        return FactoryHomeLayout.builder()
                .factoryId(factoryId)
                .modulesConfig(serializeModules(DEFAULT_MODULES))
                .themeConfig(serializeTheme(DEFAULT_THEME))
                .gridColumns(2)
                .status(0)
                .version(1)
                .aiGenerated(0)
                .timeBasedEnabled(0)
                .build();
    }

    private HomeLayoutDTO convertToDTO(FactoryHomeLayout entity) {
        return HomeLayoutDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .modules(parseModules(entity.getModulesConfig()))
                .theme(parseTheme(entity.getThemeConfig()))
                .gridColumns(entity.getGridColumns())
                .status(entity.getStatus())
                .version(entity.getVersion())
                .aiGenerated(entity.getAiGenerated())
                .aiPrompt(entity.getAiPrompt())
                .timeBasedEnabled(entity.getTimeBasedEnabled())
                .morningModules(parseModules(entity.getMorningLayout()))
                .afternoonModules(parseModules(entity.getAfternoonLayout()))
                .eveningModules(parseModules(entity.getEveningLayout()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private void updateLayoutFromRequest(FactoryHomeLayout layout, HomeLayoutDTO.SaveRequest request) {
        if (request.getModules() != null) {
            layout.setModulesConfig(serializeModules(request.getModules()));
        }
        if (request.getTheme() != null) {
            layout.setThemeConfig(serializeTheme(request.getTheme()));
        }
        if (request.getGridColumns() != null) {
            layout.setGridColumns(request.getGridColumns());
        }
        if (request.getTimeBasedEnabled() != null) {
            layout.setTimeBasedEnabled(request.getTimeBasedEnabled() ? 1 : 0);
        }
        if (request.getMorningModules() != null) {
            layout.setMorningLayout(serializeModules(request.getMorningModules()));
        }
        if (request.getAfternoonModules() != null) {
            layout.setAfternoonLayout(serializeModules(request.getAfternoonModules()));
        }
        if (request.getEveningModules() != null) {
            layout.setEveningLayout(serializeModules(request.getEveningModules()));
        }
    }

    private List<HomeLayoutDTO.ModuleConfig> parseModules(String json) {
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            Map<String, Object> config = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            Object modulesObj = config.get("modules");
            if (modulesObj != null) {
                String modulesJson = objectMapper.writeValueAsString(modulesObj);
                return objectMapper.readValue(modulesJson, new TypeReference<List<HomeLayoutDTO.ModuleConfig>>() {});
            }
        } catch (JsonProcessingException e) {
            log.error("解析模块配置失败: {}", e.getMessage());
        }
        return new ArrayList<>();
    }

    private HomeLayoutDTO.ThemeConfig parseTheme(String json) {
        if (json == null || json.isEmpty()) {
            return DEFAULT_THEME;
        }
        try {
            return objectMapper.readValue(json, HomeLayoutDTO.ThemeConfig.class);
        } catch (JsonProcessingException e) {
            log.error("解析主题配置失败: {}", e.getMessage());
            return DEFAULT_THEME;
        }
    }

    private String serializeModules(List<HomeLayoutDTO.ModuleConfig> modules) {
        try {
            Map<String, Object> config = new HashMap<>();
            config.put("modules", modules);
            return objectMapper.writeValueAsString(config);
        } catch (JsonProcessingException e) {
            log.error("序列化模块配置失败", e);
            return "{}";
        }
    }

    private String serializeTheme(HomeLayoutDTO.ThemeConfig theme) {
        try {
            return objectMapper.writeValueAsString(theme);
        } catch (JsonProcessingException e) {
            log.error("序列化主题配置失败", e);
            return "{}";
        }
    }

    private Map<String, Integer> parseUsageStats(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            Map<String, Object> stats = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
            Object clicksObj = stats.get("moduleClicks");
            if (clicksObj != null) {
                String clicksJson = objectMapper.writeValueAsString(clicksObj);
                return objectMapper.readValue(clicksJson, new TypeReference<Map<String, Integer>>() {});
            }
        } catch (JsonProcessingException e) {
            log.error("解析使用统计失败: {}", e.getMessage());
        }
        return new HashMap<>();
    }

    private Map<String, Object> parseUsageStatsMap(String json) {
        if (json == null || json.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.error("解析使用统计失败: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    private String getModuleName(String moduleId) {
        Map<String, String> moduleNames = Map.ofEntries(
                Map.entry("welcome", "欢迎区"),
                Map.entry("ai_insight", "AI洞察"),
                Map.entry("stats_grid", "数据统计"),
                Map.entry("quick_actions", "快捷操作"),
                Map.entry("dev_tools", "开发工具"),
                // 老 ID 兼容
                Map.entry("today_stats", "今日统计"),
                Map.entry("recent_orders", "最近订单"),
                Map.entry("production_progress", "生产进度"),
                Map.entry("inventory_alerts", "库存预警"),
                Map.entry("quality_overview", "质量概览")
        );
        return moduleNames.getOrDefault(moduleId, moduleId);
    }

    /**
     * 规则降级路径：当 LLM 调用失败时用。复制 DEFAULT_MODULES, 根据 priorityModules /
     * excludedModules / stylePreference 微调。
     */
    private List<HomeLayoutDTO.ModuleConfig> generateModulesFromRequest(AILayoutRequest request) {
        // 深拷贝 DEFAULT_MODULES (避免共享可变状态)
        List<HomeLayoutDTO.ModuleConfig> modules = DEFAULT_MODULES.stream()
                .map(this::cloneModule)
                .collect(Collectors.toCollection(ArrayList::new));

        // 根据用户偏好调整 (旧字段路径)
        if (request.getPreferences() != null) {
            AILayoutRequest.Preferences prefs = request.getPreferences();
            if (prefs.getPriorityModules() != null && !prefs.getPriorityModules().isEmpty()) {
                modules.sort((a, b) -> {
                    int aIndex = prefs.getPriorityModules().indexOf(a.getId());
                    int bIndex = prefs.getPriorityModules().indexOf(b.getId());
                    if (aIndex == -1) aIndex = Integer.MAX_VALUE;
                    if (bIndex == -1) bIndex = Integer.MAX_VALUE;
                    return Integer.compare(aIndex, bIndex);
                });
            }
        }

        // 排除模块
        if (request.getExcludedModules() != null && !request.getExcludedModules().isEmpty()) {
            modules.removeIf(m -> request.getExcludedModules().contains(m.getId()));
        }

        // 重新计算 order + gridPosition.y (确保不重叠)
        int yCursor = 0;
        for (int i = 0; i < modules.size(); i++) {
            HomeLayoutDTO.ModuleConfig m = modules.get(i);
            m.setOrder(i);
            if (m.getGridPosition() == null) {
                m.setGridPosition(HomeLayoutDTO.GridPosition.builder().x(0).y(yCursor).build());
            } else {
                m.getGridPosition().setY(yCursor);
            }
            int h = m.getGridSize() != null && m.getGridSize().getH() != null ? m.getGridSize().getH() : 1;
            yCursor += h;
        }

        return modules;
    }

    private HomeLayoutDTO.ModuleConfig cloneModule(HomeLayoutDTO.ModuleConfig src) {
        HomeLayoutDTO.GridPosition pos = src.getGridPosition() != null
                ? HomeLayoutDTO.GridPosition.builder()
                    .x(src.getGridPosition().getX())
                    .y(src.getGridPosition().getY())
                    .build()
                : null;
        HomeLayoutDTO.GridSize size = src.getGridSize() != null
                ? HomeLayoutDTO.GridSize.builder()
                    .w(src.getGridSize().getW())
                    .h(src.getGridSize().getH())
                    .build()
                : null;
        return HomeLayoutDTO.ModuleConfig.builder()
                .id(src.getId())
                .type(src.getType())
                .name(src.getName())
                .visible(src.getVisible())
                .order(src.getOrder())
                .gridPosition(pos)
                .gridSize(size)
                .colSpan(src.getColSpan())
                .rowSpan(src.getRowSpan())
                .title(src.getTitle())
                .icon(src.getIcon())
                .config(src.getConfig() != null ? new HashMap<>(src.getConfig()) : null)
                .build();
    }

    private HomeLayoutDTO.ThemeConfig generateThemeFromRequest(AILayoutRequest request) {
        HomeLayoutDTO.ThemeConfig theme = HomeLayoutDTO.ThemeConfig.builder()
                .primaryColor(DEFAULT_THEME.getPrimaryColor())
                .secondaryColor(DEFAULT_THEME.getSecondaryColor())
                .backgroundColor(DEFAULT_THEME.getBackgroundColor())
                .cardBorderRadius(DEFAULT_THEME.getCardBorderRadius())
                .aiCardGradient(DEFAULT_THEME.getAiCardGradient())
                .textColor(DEFAULT_THEME.getTextColor())
                .cardBackgroundColor(DEFAULT_THEME.getCardBackgroundColor())
                .cardRadius(DEFAULT_THEME.getCardRadius())
                .cardGap(DEFAULT_THEME.getCardGap())
                .fontScale(DEFAULT_THEME.getFontScale())
                .compactMode(false)
                .build();

        if (request.getPreferences() != null) {
            AILayoutRequest.Preferences prefs = request.getPreferences();
            if (Boolean.TRUE.equals(prefs.getCompactLayout())) {
                theme.setCompactMode(true);
                theme.setCardGap(8);
            }
            if ("dark".equals(prefs.getColorScheme())) {
                theme.setBackgroundColor("#1A1A1A");
                theme.setCardBackgroundColor("#2A2A2A");
                theme.setPrimaryColor("#177DDC");
                theme.setTextColor("#FFFFFF");
            }
        }

        if ("modern".equals(request.getStyle())) {
            theme.setCardBorderRadius(12);
            theme.setCardRadius(12);
        } else if ("classic".equals(request.getStyle())) {
            theme.setCardBorderRadius(4);
            theme.setCardRadius(4);
        }

        return theme;
    }

}
