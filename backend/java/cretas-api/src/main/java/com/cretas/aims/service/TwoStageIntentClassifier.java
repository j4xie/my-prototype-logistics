package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import com.cretas.aims.dto.SemanticMatchResult;
import com.cretas.aims.dto.intent.ExtractedSlots;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Two-Stage Intent Classifier
 *
 * Implements a two-stage intent classification system based on noun-first classification
 * (industry best practice). This approach separates domain recognition from action recognition
 * for more accurate intent understanding.
 *
 * <p>Classification Pipeline:</p>
 * <ol>
 *   <li><b>Stage 1 - Domain Classification (Noun-first)</b>: Identify the business domain
 *       based on noun keywords in the input</li>
 *   <li><b>Stage 2 - Action Classification (Context-sensitive)</b>: Determine the intended
 *       action based on contextual clues, not just verbs</li>
 *   <li><b>Stage 3 - Intent Composition</b>: Combine domain + action to get final intent code</li>
 * </ol>
 *
 * <p>Key Design Principles:</p>
 * <ul>
 *   <li>Default to QUERY for safety (querying is safer than creating/updating)</li>
 *   <li>Use contextual analysis, not just verb matching</li>
 *   <li>Noun-first approach reduces false positives from action verbs</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Slf4j
@Service
public class TwoStageIntentClassifier {

    private final IntentCompositionConfig compositionConfig;
    private final SlotExtractor slotExtractor;
    private final ComparisonQueryHandler comparisonQueryHandler;
    private final SemanticIntentMatcher semanticMatcher;

    @Autowired
    public TwoStageIntentClassifier(
            IntentCompositionConfig compositionConfig,
            @Lazy SlotExtractor slotExtractor,
            @Lazy ComparisonQueryHandler comparisonQueryHandler,
            @Lazy SemanticIntentMatcher semanticMatcher) {
        this.compositionConfig = compositionConfig;
        this.slotExtractor = slotExtractor;
        this.comparisonQueryHandler = comparisonQueryHandler;
        this.semanticMatcher = semanticMatcher;
    }

    // ==================== Enums ====================

    /**
     * Classified domain based on noun keywords
     */
    public enum ClassifiedDomain {
        MATERIAL,    // 原料, 物料, 材料, 入库
        SHIPMENT,    // 发货, 出货, 配送, 物流
        ORDER,       // 订单, 下单, 接单
        ATTENDANCE,  // 考勤, 打卡, 出勤, 签到
        EQUIPMENT,   // 设备, 机器, 机台
        QUALITY,     // 质检, 质量, 检测
        PROCESSING,  // 生产, 加工, 批次
        ALERT,       // 告警, 预警, 报警
        SUPPLIER,    // 供应商, 供货商
        CUSTOMER,    // 客户, 买家
        UNKNOWN
    }

    /**
     * Classified action based on context analysis
     */
    public enum ClassifiedAction {
        QUERY,   // Default safe action - read-only
        CREATE,  // Create new records
        UPDATE,  // Modify existing records
        DELETE,  // Remove records (rarely used)
        UNKNOWN
    }

    // ==================== Result Class ====================

    /**
     * Result of two-stage classification
     * v9.0: Extended with modifiers for multi-dimensional intent mapping
     * v14.0: Extended with extracted slots for parameterized queries
     */
    @Data
    @Builder
    @AllArgsConstructor
    public static class TwoStageResult {
        private ClassifiedDomain domain;
        private ClassifiedAction action;
        private String composedIntent;
        private double confidence;
        private boolean successful;
        private String domainKeyword;
        private String actionContext;

        // v9.0: Multi-dimensional classification fields
        private Set<String> modifiers;      // e.g., ["STATS", "ANOMALY", "FUTURE"]
        private String timeScope;           // "PAST", "PRESENT", "FUTURE"
        private String targetScope;         // "PERSONAL", "DEPARTMENTAL", "ALL"

        // v14.0: Slot extraction fields for parameterized queries
        private ExtractedSlots extractedSlots;  // Extracted parameters from input
        private Map<String, Object> parameters; // Flattened parameter map for API use
    }

    // ==================== Domain Keywords ====================

    /**
     * Domain keyword mappings (noun-first approach)
     */
    private static final Map<ClassifiedDomain, List<String>> DOMAIN_KEYWORDS = new HashMap<>();

    static {
        // v10.0: 扩充 Material 领域关键词覆盖
        DOMAIN_KEYWORDS.put(ClassifiedDomain.MATERIAL, Arrays.asList(
                // 原有基础词
                "原料", "物料", "材料", "入库", "库存", "仓库", "批号", "原材料",
                // v10.0 新增 - 进货/到货相关
                "到货", "进货", "来料", "收货", "要到", "将到",
                // v10.0 新增 - 库存查询相关
                "存量", "余量", "剩余", "盘点",
                // v10.0 新增 - 效期相关
                "临期", "过期", "保质期", "效期", "有效期"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.SHIPMENT, Arrays.asList(
                "发货", "出货", "配送", "物流", "运输", "出库", "送货", "发运"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.ORDER, Arrays.asList(
                "订单", "下单", "接单", "订货", "订购"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.ATTENDANCE, Arrays.asList(
                "考勤", "打卡", "出勤", "签到", "签退", "上班", "下班", "请假",
                "没来", "缺勤", "迟到", "早退", "来了", "打个卡"  // v9.0: 扩展考勤语义
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.EQUIPMENT, Arrays.asList(
                "设备", "机器", "机台", "机械", "仪器", "设施", "工具"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.QUALITY, Arrays.asList(
                "质检", "质量", "检测", "检验", "品控", "品质", "合格", "不合格"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.PROCESSING, Arrays.asList(
                "生产", "加工", "批次", "工序", "产线", "车间", "生产线", "加工单",
                "产量", "产能", "工单"  // v9.0: 扩展生产关键词
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.ALERT, Arrays.asList(
                "告警", "预警", "报警", "警报", "异常", "故障", "警告"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.SUPPLIER, Arrays.asList(
                "供应商", "供货商", "供方", "采购商", "进货", "采购"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.CUSTOMER, Arrays.asList(
                "客户", "买家", "顾客", "客户单", "销售"
        ));
    }

    // ==================== Action Context Patterns ====================

    /**
     * Time-related words that indicate QUERY action
     * v9.0: Extended with future tense words
     */
    private static final List<String> TIME_WORDS = Arrays.asList(
            // Past/Present (existing)
            "今天", "昨天", "最近", "上周", "本周", "这周", "上个月", "本月",
            "天内", "周内", "月内", "年内", "过去", "之前", "以来", "期间",
            // Future tense (v9.0 new)
            "明天", "后天", "下周", "下个月", "将来", "接下来",
            "即将", "要到", "预计", "计划", "后续"
    );

    /**
     * Question words that indicate QUERY action
     */
    private static final List<String> QUESTION_WORDS = Arrays.asList(
            "有没有", "多少", "哪些", "什么", "怎么样", "如何", "是否", "有无",
            "几个", "几条", "几批", "多久", "啥时候", "什么时候"
    );

    /**
     * Status words that indicate QUERY action
     */
    private static final List<String> STATUS_WORDS = Arrays.asList(
            "情况", "状况", "记录", "明细", "详情", "列表", "清单", "统计",
            "汇总", "报表", "数据", "信息"
    );

    /**
     * Create words that indicate CREATE action
     */
    private static final List<String> CREATE_WORDS = Arrays.asList(
            "新增", "登记", "添加", "创建", "录入", "新建", "增加", "注册"
    );

    /**
     * v9.0: Attendance action patterns (for clock in/sign in)
     * These are only CREATE when used with imperative words
     */
    private static final List<String> ATTENDANCE_ACTION_WORDS = Arrays.asList(
            "签到", "打卡", "打个卡", "签退"
    );

    /**
     * Action/Update words that indicate UPDATE action
     */
    private static final List<String> ACTION_WORDS = Arrays.asList(
            "启动", "停止", "执行", "修改", "更新", "编辑", "变更", "调整",
            "启用", "禁用", "开始", "结束", "完成", "取消", "处理", "解决"  // v9.0: 扩展
    );

    /**
     * Delete words that indicate DELETE action
     */
    private static final List<String> DELETE_WORDS = Arrays.asList(
            "删除", "移除", "清除", "清空", "作废", "去掉", "销毁", "注销", "撤销"
    );

    /**
     * Imperative words (need context to determine action)
     */
    private static final List<String> IMPERATIVE_WORDS = Arrays.asList(
            "帮我", "请", "给我", "麻烦", "帮忙", "需要", "我要", "想要"  // v9.0: 扩展祈使词
    );

    /**
     * Pattern for matching "N天内", "N周内", "N天后" etc.
     * v9.0: Extended with future patterns
     */
    private static final Pattern TIME_RANGE_PATTERN = Pattern.compile(
            "\\d+[天周月年]内|\\d+[天周月年]前|\\d+[天周月年]后"
    );

    // ==================== v9.0 Modifier Keywords ====================

    /**
     * v9.0: Stats/aggregation words that indicate STATS modifier
     */
    private static final List<String> STATS_WORDS = Arrays.asList(
            "统计", "汇总", "合计", "总数", "数量", "平均", "最大", "最小",
            "多少", "几个", "几条", "几批", "有几"
    );

    /**
     * v9.0: Anomaly words that indicate ANOMALY modifier
     */
    private static final List<String> ANOMALY_WORDS = Arrays.asList(
            "没来", "缺勤", "缺席", "没有来", "谁没", "没打卡", "未打卡",
            "异常", "问题", "故障", "不正常", "缺", "漏",
            "迟到", "早退", "旷工"  // v9.0: 扩展考勤异常词
    );

    /**
     * v9.0: Future tense words for FUTURE modifier
     */
    private static final List<String> FUTURE_WORDS = Arrays.asList(
            "明天", "后天", "下周", "下个月", "将要", "即将", "要到",
            "预计", "计划", "待", "将", "后续"
    );

    /**
     * v9.0: Personal scope words that indicate PERSONAL target
     */
    private static final List<String> PERSONAL_WORDS = Arrays.asList(
            "我的", "张三", "李四", "这个人", "他的", "她的",
            "某人", "个人", "本人", "自己"
    );

    /**
     * v9.0: Departmental scope words that indicate DEPARTMENTAL target
     */
    private static final List<String> DEPARTMENTAL_WORDS = Arrays.asList(
            "部门", "车间", "全厂", "全部", "所有", "整个", "团队", "小组"
    );

    /**
     * v9.0: Critical/important words that indicate CRITICAL modifier
     */
    private static final List<String> CRITICAL_WORDS = Arrays.asList(
            "关键", "重要", "严重", "紧急", "优先", "高优", "核心"
    );

    /**
     * v9.0: Monthly scope words for time scope detection
     */
    private static final List<String> MONTHLY_WORDS = Arrays.asList(
            "本月", "这个月", "上个月", "月度", "月报"
    );

    // ==================== v13.0 新增 Modifier 词库 ====================

    /**
     * v13.0: Negation words that indicate NEGATION modifier
     * 用于识别否定/排除类查询
     */
    private static final List<String> NEGATION_WORDS = Arrays.asList(
            "不要", "别", "没有", "非", "除了", "排除", "不包括", "不含",
            "不是", "除...外", "去掉", "不算", "剔除", "过滤掉", "屏蔽"
    );

    /**
     * v13.0: Ranking words that indicate RANKING modifier
     * 用于识别排名/排行类查询
     */
    private static final List<String> RANKING_WORDS = Arrays.asList(
            "排名", "排行", "前几", "前10", "前十", "前五", "前三", "前N",
            "TOP", "top", "最高", "最低", "最多", "最少", "最大", "最小",
            "榜单", "排序", "倒数", "末位", "垫底"
    );

    /**
     * v13.0: Comparison words that indicate COMPARISON modifier
     * 用于识别对比/比较类查询
     */
    private static final List<String> COMPARISON_WORDS = Arrays.asList(
            "对比", "比较", "vs", "VS", "相比", "比", "差异", "差距",
            "增长", "下降", "变化", "波动", "趋势"
    );

    /**
     * v13.0: Month-over-Month comparison words (环比)
     */
    private static final List<String> MOM_WORDS = Arrays.asList(
            "环比", "比上月", "比上周", "上期对比", "MoM", "mom",
            "与上月", "跟上月", "和上月", "较上月", "上月同期"
    );

    /**
     * v13.0: Year-over-Year comparison words (同比)
     */
    private static final List<String> YOY_WORDS = Arrays.asList(
            "同比", "比去年", "年同期", "YoY", "yoy", "去年同期",
            "与去年", "跟去年", "较去年", "上年同期"
    );

    /**
     * v13.0: Quarter-over-Quarter comparison words (季环比)
     */
    private static final List<String> QOQ_WORDS = Arrays.asList(
            "季环比", "比上季", "上季度", "QoQ", "qoq", "季度对比"
    );

    /**
     * v13.0: Aggregation/summary type words
     * 用于识别聚合类型
     */
    private static final List<String> AGGREGATION_WORDS = Arrays.asList(
            "总计", "合计", "累计", "汇总", "求和", "总和", "总额",
            "平均", "均值", "占比", "百分比", "比例", "率"
    );

    // ==================== Public Methods ====================

    /**
     * Main classification method - performs multi-stage classification
     * v9.0: Extended with Stage 3 Modifier classification
     * v14.0: Extended with Stage 0 Slot Extraction for parameterized queries
     *
     * @param input User input text
     * @return Classification result with domain, action, modifiers, slots, and composed intent
     */
    public TwoStageResult classify(String input) {
        if (input == null || input.trim().isEmpty()) {
            log.warn("Empty input received for classification");
            return TwoStageResult.builder()
                    .domain(ClassifiedDomain.UNKNOWN)
                    .action(ClassifiedAction.UNKNOWN)
                    .composedIntent("UNKNOWN_INTENT")
                    .confidence(0.0)
                    .successful(false)
                    .domainKeyword(null)
                    .actionContext(null)
                    .modifiers(Collections.emptySet())
                    .timeScope("PRESENT")
                    .targetScope("ALL")
                    .extractedSlots(null)
                    .parameters(Collections.emptyMap())
                    .build();
        }

        String normalizedInput = input.trim();
        log.debug("Starting multi-stage classification for input: {}", normalizedInput);

        // Stage 0: Slot Extraction (v14.0)
        ExtractedSlots extractedSlots = null;
        Map<String, Object> parameters = new HashMap<>();
        if (slotExtractor != null) {
            extractedSlots = slotExtractor.extract(normalizedInput);
            if (extractedSlots != null && extractedSlots.hasAnySlots()) {
                parameters = extractedSlots.toParameterMap();
                log.debug("Stage 0 - Extracted {} slots: {}", extractedSlots.getSlotCount(), extractedSlots.getSlots());
            }
        }

        // Stage 0.5: Semantic Matching (v14.1)
        // Try semantic similarity matching before rule-based classification
        if (semanticMatcher != null && semanticMatcher.isSemanticMatchingAvailable()) {
            SemanticMatchResult semanticResult = semanticMatcher.matchBySimilarity(normalizedInput, null);
            if (semanticResult != null && semanticResult.isMatched() && semanticResult.getSimilarity() >= 0.80) {
                log.info("Stage 0.5 - Semantic match found: '{}' -> {} (similarity: {:.3f})",
                        normalizedInput, semanticResult.getIntentCode(), semanticResult.getSimilarity());

                // Return early with semantic match result
                return TwoStageResult.builder()
                        .domain(inferDomainFromIntent(semanticResult.getIntentCode()))
                        .action(ClassifiedAction.QUERY)
                        .composedIntent(semanticResult.getIntentCode())
                        .confidence(semanticResult.getSimilarity())
                        .successful(true)
                        .domainKeyword(semanticResult.getMatchedPhrase())
                        .actionContext("SEMANTIC_MATCH")
                        .modifiers(Collections.emptySet())
                        .timeScope("PRESENT")
                        .targetScope("ALL")
                        .extractedSlots(extractedSlots)
                        .parameters(parameters)
                        .build();
            }
        }

        // Stage 1: Domain Classification
        DomainResult domainResult = classifyDomainWithKeyword(normalizedInput);
        ClassifiedDomain domain = domainResult.domain;
        String domainKeyword = domainResult.keyword;
        log.debug("Stage 1 - Domain: {} (keyword: {})", domain, domainKeyword);

        // Stage 2: Action Classification
        ActionResult actionResult = classifyActionWithContext(normalizedInput);
        ClassifiedAction action = actionResult.action;
        String actionContext = actionResult.context;
        log.debug("Stage 2 - Action: {} (context: {})", action, actionContext);

        // Stage 3: Modifier Classification (v9.0)
        Set<String> modifiers = classifyModifiers(normalizedInput);

        // v14.0: Merge modifiers from slot extraction (comparison/ranking detection)
        if (comparisonQueryHandler != null && extractedSlots != null) {
            Set<String> slotModifiers = comparisonQueryHandler.generateModifiers(extractedSlots);
            if (!slotModifiers.isEmpty()) {
                modifiers = new HashSet<>(modifiers);
                modifiers.addAll(slotModifiers);
                log.debug("Stage 3 - Added slot-based modifiers: {}", slotModifiers);
            }
        }

        String timeScope = classifyTimeScope(normalizedInput);
        String targetScope = classifyTargetScope(normalizedInput);
        log.debug("Stage 3 - Modifiers: {}, TimeScope: {}, TargetScope: {}",
                modifiers, timeScope, targetScope);

        // Stage 4: Intent Composition (v9.0: with multi-dimensional mapping)
        // v14.0: Check if ComparisonQueryHandler suggests a specific intent
        String composedIntent = null;
        if (comparisonQueryHandler != null && extractedSlots != null) {
            composedIntent = comparisonQueryHandler.determineIntent(domain, extractedSlots);
            if (composedIntent != null) {
                log.debug("Stage 4 - Intent from ComparisonQueryHandler: {}", composedIntent);
            }
        }

        // Fall back to IntentCompositionConfig if no specific intent determined
        if (composedIntent == null) {
            composedIntent = compositionConfig.getIntent(domain.name(), action.name(), modifiers);
        }
        if (composedIntent == null) {
            composedIntent = domain.name() + "_" + action.name(); // Fallback pattern
        }
        log.debug("Stage 4 - Composed Intent: {}", composedIntent);

        // Calculate confidence (v14.0: boost confidence if slots extracted)
        double confidence = calculateConfidence(domain, action, domainKeyword, actionContext);
        if (extractedSlots != null && extractedSlots.hasAnySlots()) {
            // Boost confidence slightly for parameterized queries
            confidence = Math.min(1.0, confidence + 0.05);
        }
        boolean successful = domain != ClassifiedDomain.UNKNOWN && action != ClassifiedAction.UNKNOWN;

        TwoStageResult result = TwoStageResult.builder()
                .domain(domain)
                .action(action)
                .composedIntent(composedIntent)
                .confidence(confidence)
                .successful(successful)
                .domainKeyword(domainKeyword)
                .actionContext(actionContext)
                .modifiers(modifiers)
                .timeScope(timeScope)
                .targetScope(targetScope)
                .extractedSlots(extractedSlots)
                .parameters(parameters)
                .build();

        log.info("Multi-stage classification completed: domain={}, action={}, modifiers={}, " +
                        "timeScope={}, targetScope={}, intent={}, confidence={}, slotsExtracted={}",
                domain, action, modifiers, timeScope, targetScope, composedIntent, confidence,
                extractedSlots != null ? extractedSlots.getSlotCount() : 0);

        return result;
    }

    /**
     * Stage 1: Classify domain based on noun keywords
     *
     * @param input User input text
     * @return Classified domain
     */
    public ClassifiedDomain classifyDomain(String input) {
        return classifyDomainWithKeyword(input).domain;
    }

    /**
     * Stage 2: Classify action based on context
     *
     * @param input User input text
     * @return Classified action
     */
    public ClassifiedAction classifyAction(String input) {
        return classifyActionWithContext(input).action;
    }

    // ==================== Private Helper Methods ====================

    /**
     * Internal domain classification with keyword tracking
     */
    private DomainResult classifyDomainWithKeyword(String input) {
        for (Map.Entry<ClassifiedDomain, List<String>> entry : DOMAIN_KEYWORDS.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (input.contains(keyword)) {
                    log.debug("Domain keyword matched: '{}' -> {}", keyword, entry.getKey());
                    return new DomainResult(entry.getKey(), keyword);
                }
            }
        }
        log.debug("No domain keyword matched, returning UNKNOWN");
        return new DomainResult(ClassifiedDomain.UNKNOWN, null);
    }

    /**
     * Internal action classification with context tracking
     * v9.0: Reordered - CREATE/UPDATE checked before STATUS to avoid false QUERY classification
     */
    private ActionResult classifyActionWithContext(String input) {
        // Rule 0: Delete words indicate DELETE (highest priority)
        if (hasDeleteWords(input)) {
            log.debug("Delete words detected, classifying as DELETE");
            return new ActionResult(ClassifiedAction.DELETE, "delete_words");
        }

        // Rule 1: Create words indicate CREATE (high priority - checked first)
        if (hasCreateWords(input)) {
            log.debug("Create words detected, classifying as CREATE");
            return new ActionResult(ClassifiedAction.CREATE, "create_words");
        }

        // Rule 2: Action/Update words indicate UPDATE (high priority)
        if (hasActionWords(input)) {
            log.debug("Action words detected, classifying as UPDATE");
            return new ActionResult(ClassifiedAction.UPDATE, "action_words");
        }

        // Rule 3: Time words indicate QUERY
        if (hasTimeContext(input)) {
            log.debug("Time context detected, classifying as QUERY");
            return new ActionResult(ClassifiedAction.QUERY, "time_context");
        }

        // Rule 4: Question words indicate QUERY
        if (isQuestion(input)) {
            log.debug("Question pattern detected, classifying as QUERY");
            return new ActionResult(ClassifiedAction.QUERY, "question_pattern");
        }

        // Rule 5: Status words indicate QUERY
        if (hasStatusWords(input)) {
            log.debug("Status words detected, classifying as QUERY");
            return new ActionResult(ClassifiedAction.QUERY, "status_words");
        }

        // Rule 6: Imperative with attendance action - clock in/sign in
        if (hasImperativeWithAttendanceAction(input)) {
            log.debug("Imperative with attendance action detected, classifying as CREATE");
            return new ActionResult(ClassifiedAction.CREATE, "imperative_attendance_action");
        }

        // Rule 7: Imperative without time words - context dependent
        if (hasImperativeWithoutTime(input)) {
            // Default to CREATE for imperative requests without clear context
            log.debug("Imperative without time detected, defaulting to CREATE");
            return new ActionResult(ClassifiedAction.CREATE, "imperative_without_time");
        }

        // Default: QUERY is the safest action (read-only)
        log.debug("No action pattern matched, defaulting to QUERY (safe default)");
        return new ActionResult(ClassifiedAction.QUERY, "safe_default");
    }

    /**
     * Check if input contains time-related context
     */
    private boolean hasTimeContext(String input) {
        // Check explicit time words
        for (String word : TIME_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        // Check time range patterns like "7天内", "3周前"
        return TIME_RANGE_PATTERN.matcher(input).find();
    }

    /**
     * Check if input is a question
     */
    private boolean isQuestion(String input) {
        // Check question marks
        if (input.contains("?") || input.contains("?")) {
            return true;
        }
        // Check question words
        for (String word : QUESTION_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if input contains status-related words
     */
    private boolean hasStatusWords(String input) {
        for (String word : STATUS_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if input contains create-related words
     */
    private boolean hasCreateWords(String input) {
        for (String word : CREATE_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if input contains delete-related words
     */
    private boolean hasDeleteWords(String input) {
        for (String word : DELETE_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if input contains action/update words
     */
    private boolean hasActionWords(String input) {
        for (String word : ACTION_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if input has imperative words but no time context
     */
    private boolean hasImperativeWithoutTime(String input) {
        boolean hasImperative = false;
        for (String word : IMPERATIVE_WORDS) {
            if (input.contains(word)) {
                hasImperative = true;
                break;
            }
        }
        return hasImperative && !hasTimeContext(input);
    }

    /**
     * v9.0: Check if input has imperative words with attendance action (clock in/sign in)
     * E.g., "我要签到", "帮我打卡"
     */
    private boolean hasImperativeWithAttendanceAction(String input) {
        boolean hasImperative = false;
        for (String word : IMPERATIVE_WORDS) {
            if (input.contains(word)) {
                hasImperative = true;
                break;
            }
        }
        if (!hasImperative) {
            return false;
        }
        // Check for attendance action words
        for (String word : ATTENDANCE_ACTION_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calculate confidence score based on classification quality
     */
    private double calculateConfidence(ClassifiedDomain domain, ClassifiedAction action,
                                       String domainKeyword, String actionContext) {
        if (domain == ClassifiedDomain.UNKNOWN || action == ClassifiedAction.UNKNOWN) {
            return 0.50; // Low confidence for unknown classifications
        }

        // Base confidence for successful classification
        double confidence = 0.90;

        // Slight penalty for safe_default action context
        if ("safe_default".equals(actionContext)) {
            confidence -= 0.05;
        }

        // Slight bonus for explicit context matches
        if ("time_context".equals(actionContext) || "question_pattern".equals(actionContext)) {
            confidence += 0.02;
        }

        // Ensure confidence is within bounds
        return Math.min(1.0, Math.max(0.0, confidence));
    }

    // ==================== v9.0 Modifier Classification Methods ====================

    /**
     * v9.0: Stage 3 - Classify modifiers based on semantic keywords
     * v13.0: Extended with NEGATION, RANKING, COMPARISON, MOM, YOY, QOQ modifiers
     *
     * @param input User input text
     * @return Set of modifier codes
     */
    private Set<String> classifyModifiers(String input) {
        Set<String> modifiers = new HashSet<>();

        // Check for STATS modifier
        if (hasStatsWords(input)) {
            modifiers.add("STATS");
            log.debug("Modifier detected: STATS");
        }

        // Check for ANOMALY modifier
        if (hasAnomalyWords(input)) {
            modifiers.add("ANOMALY");
            log.debug("Modifier detected: ANOMALY");
        }

        // Check for FUTURE modifier
        if (hasFutureWords(input)) {
            modifiers.add("FUTURE");
            log.debug("Modifier detected: FUTURE");
        }

        // Check for CRITICAL modifier
        if (hasCriticalWords(input)) {
            modifiers.add("CRITICAL");
            log.debug("Modifier detected: CRITICAL");
        }

        // Check for MONTHLY modifier (for attendance)
        if (hasMonthlyWords(input)) {
            modifiers.add("MONTHLY");
            log.debug("Modifier detected: MONTHLY");
        }

        // Check for PERSONAL modifier (for personal scope queries)
        if (hasPersonalWords(input)) {
            modifiers.add("PERSONAL");
            log.debug("Modifier detected: PERSONAL");
        }

        // v13.0: Check for NEGATION modifier (否定/排除)
        if (hasNegationWords(input)) {
            modifiers.add("NEGATION");
            log.debug("Modifier detected: NEGATION");
        }

        // v13.0: Check for RANKING modifier (排名/排行)
        if (hasRankingWords(input)) {
            modifiers.add("RANKING");
            log.debug("Modifier detected: RANKING");
        }

        // v13.0: Check for COMPARISON modifier (对比/比较)
        if (hasComparisonWords(input)) {
            modifiers.add("COMPARISON");
            log.debug("Modifier detected: COMPARISON");
        }

        // v13.0: Check for MOM modifier (环比)
        if (hasMomWords(input)) {
            modifiers.add("MOM");
            log.debug("Modifier detected: MOM");
        }

        // v13.0: Check for YOY modifier (同比)
        if (hasYoyWords(input)) {
            modifiers.add("YOY");
            log.debug("Modifier detected: YOY");
        }

        // v13.0: Check for QOQ modifier (季环比)
        if (hasQoqWords(input)) {
            modifiers.add("QOQ");
            log.debug("Modifier detected: QOQ");
        }

        // v13.0: Check for AGGREGATION modifier (聚合统计)
        if (hasAggregationWords(input)) {
            modifiers.add("AGGREGATION");
            log.debug("Modifier detected: AGGREGATION");
        }

        return modifiers;
    }

    /**
     * v9.0: Check if input contains personal scope words
     */
    private boolean hasPersonalWords(String input) {
        for (String word : PERSONAL_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v9.0: Classify time scope (PAST, PRESENT, FUTURE)
     *
     * @param input User input text
     * @return Time scope string
     */
    private String classifyTimeScope(String input) {
        // Check for future indicators
        for (String word : FUTURE_WORDS) {
            if (input.contains(word)) {
                return "FUTURE";
            }
        }
        // Check for future time range patterns (N天后, N周后)
        if (Pattern.compile("\\d+[天周月年]后").matcher(input).find()) {
            return "FUTURE";
        }

        // Check for past indicators
        if (input.contains("昨天") || input.contains("之前") ||
                input.contains("过去") || input.contains("上周") ||
                input.contains("上个月")) {
            return "PAST";
        }
        // Check for past time range patterns (N天前, N天内 - both indicate looking back)
        if (Pattern.compile("\\d+[天周月年]前").matcher(input).find() ||
                Pattern.compile("\\d+[天周月年]内").matcher(input).find()) {
            return "PAST";
        }

        // Default to present
        return "PRESENT";
    }

    /**
     * v9.0: Classify target scope (PERSONAL, DEPARTMENTAL, ALL)
     *
     * @param input User input text
     * @return Target scope string
     */
    private String classifyTargetScope(String input) {
        // Check for personal scope
        for (String word : PERSONAL_WORDS) {
            if (input.contains(word)) {
                return "PERSONAL";
            }
        }

        // Check for departmental scope
        for (String word : DEPARTMENTAL_WORDS) {
            if (input.contains(word)) {
                return "DEPARTMENTAL";
            }
        }

        // Default to ALL
        return "ALL";
    }

    /**
     * v9.0: Check if input contains stats/aggregation words
     */
    private boolean hasStatsWords(String input) {
        for (String word : STATS_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v9.0: Check if input contains anomaly words
     */
    private boolean hasAnomalyWords(String input) {
        for (String word : ANOMALY_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v9.0: Check if input contains future tense words
     */
    private boolean hasFutureWords(String input) {
        for (String word : FUTURE_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        // Also check for future time range patterns
        return Pattern.compile("\\d+[天周月年]后").matcher(input).find();
    }

    /**
     * v9.0: Check if input contains critical/important words
     */
    private boolean hasCriticalWords(String input) {
        for (String word : CRITICAL_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v9.0: Check if input contains monthly time scope words
     */
    private boolean hasMonthlyWords(String input) {
        for (String word : MONTHLY_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    // ==================== v13.0 新增 Modifier 检测方法 ====================

    /**
     * v13.0: Check if input contains negation words (否定/排除)
     */
    private boolean hasNegationWords(String input) {
        for (String word : NEGATION_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v13.0: Check if input contains ranking words (排名/排行)
     */
    private boolean hasRankingWords(String input) {
        for (String word : RANKING_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v13.0: Check if input contains comparison words (对比/比较)
     */
    private boolean hasComparisonWords(String input) {
        for (String word : COMPARISON_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v13.0: Check if input contains MOM words (环比)
     */
    private boolean hasMomWords(String input) {
        for (String word : MOM_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v13.0: Check if input contains YOY words (同比)
     */
    private boolean hasYoyWords(String input) {
        for (String word : YOY_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v13.0: Check if input contains QOQ words (季环比)
     */
    private boolean hasQoqWords(String input) {
        for (String word : QOQ_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * v13.0: Check if input contains aggregation words (聚合统计)
     */
    private boolean hasAggregationWords(String input) {
        for (String word : AGGREGATION_WORDS) {
            if (input.contains(word)) {
                return true;
            }
        }
        return false;
    }

    // ==================== v14.1 Semantic Matching Helper Methods ====================

    /**
     * v14.1: Infer domain from intent code (for semantic matching results)
     * Extracts domain from intent codes like "ORDER_LIST", "MATERIAL_BATCH_QUERY"
     *
     * @param intentCode Intent code from semantic matching
     * @return Corresponding ClassifiedDomain
     */
    private ClassifiedDomain inferDomainFromIntent(String intentCode) {
        if (intentCode == null || intentCode.isEmpty()) {
            return ClassifiedDomain.UNKNOWN;
        }

        String upperIntent = intentCode.toUpperCase();

        // Direct domain prefix matching
        if (upperIntent.startsWith("MATERIAL") || upperIntent.startsWith("INVENTORY") ||
                upperIntent.startsWith("STOCK") || upperIntent.startsWith("WAREHOUSE")) {
            return ClassifiedDomain.MATERIAL;
        }
        if (upperIntent.startsWith("SHIPMENT") || upperIntent.startsWith("DELIVERY") ||
                upperIntent.startsWith("LOGISTICS") || upperIntent.startsWith("DISPATCH")) {
            return ClassifiedDomain.SHIPMENT;
        }
        if (upperIntent.startsWith("ORDER") || upperIntent.startsWith("PURCHASE")) {
            return ClassifiedDomain.ORDER;
        }
        if (upperIntent.startsWith("ATTENDANCE") || upperIntent.startsWith("CLOCK") ||
                upperIntent.startsWith("CHECKIN") || upperIntent.startsWith("SIGNIN")) {
            return ClassifiedDomain.ATTENDANCE;
        }
        if (upperIntent.startsWith("EQUIPMENT") || upperIntent.startsWith("DEVICE") ||
                upperIntent.startsWith("MACHINE")) {
            return ClassifiedDomain.EQUIPMENT;
        }
        if (upperIntent.startsWith("QUALITY") || upperIntent.startsWith("QC") ||
                upperIntent.startsWith("INSPECTION")) {
            return ClassifiedDomain.QUALITY;
        }
        if (upperIntent.startsWith("PROCESSING") || upperIntent.startsWith("PRODUCTION") ||
                upperIntent.startsWith("BATCH") || upperIntent.startsWith("MANUFACTURE")) {
            return ClassifiedDomain.PROCESSING;
        }
        if (upperIntent.startsWith("ALERT") || upperIntent.startsWith("ALARM") ||
                upperIntent.startsWith("WARNING") || upperIntent.startsWith("ANOMALY")) {
            return ClassifiedDomain.ALERT;
        }
        if (upperIntent.startsWith("SUPPLIER") || upperIntent.startsWith("VENDOR")) {
            return ClassifiedDomain.SUPPLIER;
        }
        if (upperIntent.startsWith("CUSTOMER") || upperIntent.startsWith("CLIENT") ||
                upperIntent.startsWith("SALES")) {
            return ClassifiedDomain.CUSTOMER;
        }

        // Keyword-based fallback for complex intent codes
        if (upperIntent.contains("MATERIAL") || upperIntent.contains("INVENTORY") ||
                upperIntent.contains("STOCK")) {
            return ClassifiedDomain.MATERIAL;
        }
        if (upperIntent.contains("SHIPMENT") || upperIntent.contains("DELIVERY")) {
            return ClassifiedDomain.SHIPMENT;
        }
        if (upperIntent.contains("ORDER")) {
            return ClassifiedDomain.ORDER;
        }
        if (upperIntent.contains("ATTENDANCE") || upperIntent.contains("CLOCK")) {
            return ClassifiedDomain.ATTENDANCE;
        }
        if (upperIntent.contains("EQUIPMENT") || upperIntent.contains("DEVICE")) {
            return ClassifiedDomain.EQUIPMENT;
        }
        if (upperIntent.contains("QUALITY") || upperIntent.contains("INSPECTION")) {
            return ClassifiedDomain.QUALITY;
        }
        if (upperIntent.contains("PROCESSING") || upperIntent.contains("PRODUCTION")) {
            return ClassifiedDomain.PROCESSING;
        }
        if (upperIntent.contains("ALERT") || upperIntent.contains("ALARM")) {
            return ClassifiedDomain.ALERT;
        }

        log.debug("Could not infer domain from intent code: {}", intentCode);
        return ClassifiedDomain.UNKNOWN;
    }

    // ==================== Internal Result Classes ====================

    /**
     * Internal class to hold domain classification result with keyword
     */
    private static class DomainResult {
        final ClassifiedDomain domain;
        final String keyword;

        DomainResult(ClassifiedDomain domain, String keyword) {
            this.domain = domain;
            this.keyword = keyword;
        }
    }

    /**
     * Internal class to hold action classification result with context
     */
    private static class ActionResult {
        final ClassifiedAction action;
        final String context;

        ActionResult(ClassifiedAction action, String context) {
            this.action = action;
            this.context = context;
        }
    }
}
