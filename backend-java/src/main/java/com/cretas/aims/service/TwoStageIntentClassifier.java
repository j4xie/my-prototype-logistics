package com.cretas.aims.service;

import com.cretas.aims.config.IntentCompositionConfig;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

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
@RequiredArgsConstructor
public class TwoStageIntentClassifier {

    private final IntentCompositionConfig compositionConfig;

    // ==================== Enums ====================

    /**
     * Classified domain based on noun keywords
     */
    public enum ClassifiedDomain {
        MATERIAL,    // 原料, 物料, 材料, 入库
        SHIPMENT,    // 发货, 出货, 配送, 物流
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
    }

    // ==================== Domain Keywords ====================

    /**
     * Domain keyword mappings (noun-first approach)
     */
    private static final Map<ClassifiedDomain, List<String>> DOMAIN_KEYWORDS = new HashMap<>();

    static {
        DOMAIN_KEYWORDS.put(ClassifiedDomain.MATERIAL, Arrays.asList(
                "原料", "物料", "材料", "入库", "库存", "仓库", "批号", "原材料"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.SHIPMENT, Arrays.asList(
                "发货", "出货", "配送", "物流", "运输", "出库", "送货", "发运"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.ATTENDANCE, Arrays.asList(
                "考勤", "打卡", "出勤", "签到", "签退", "上班", "下班", "请假"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.EQUIPMENT, Arrays.asList(
                "设备", "机器", "机台", "机械", "仪器", "设施", "工具"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.QUALITY, Arrays.asList(
                "质检", "质量", "检测", "检验", "品控", "品质", "合格", "不合格"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.PROCESSING, Arrays.asList(
                "生产", "加工", "批次", "工序", "产线", "车间", "生产线", "加工单"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.ALERT, Arrays.asList(
                "告警", "预警", "报警", "警报", "异常", "故障", "警告"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.SUPPLIER, Arrays.asList(
                "供应商", "供货商", "供方", "采购商", "进货", "采购"
        ));
        DOMAIN_KEYWORDS.put(ClassifiedDomain.CUSTOMER, Arrays.asList(
                "客户", "买家", "顾客", "订单", "客户单", "销售"
        ));
    }

    // ==================== Action Context Patterns ====================

    /**
     * Time-related words that indicate QUERY action
     */
    private static final List<String> TIME_WORDS = Arrays.asList(
            "今天", "昨天", "最近", "上周", "本周", "这周", "上个月", "本月",
            "天内", "周内", "月内", "年内", "过去", "之前", "以来", "期间"
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
     * Action/Update words that indicate UPDATE action
     */
    private static final List<String> ACTION_WORDS = Arrays.asList(
            "启动", "停止", "执行", "修改", "更新", "编辑", "变更", "调整",
            "启用", "禁用", "开始", "结束", "完成", "取消"
    );

    /**
     * Imperative words (need context to determine action)
     */
    private static final List<String> IMPERATIVE_WORDS = Arrays.asList(
            "帮我", "请", "给我", "麻烦", "帮忙", "需要"
    );

    /**
     * Pattern for matching "N天内", "N周内" etc.
     */
    private static final Pattern TIME_RANGE_PATTERN = Pattern.compile(
            "\\d+[天周月年]内|\\d+[天周月年]前"
    );

    // ==================== Public Methods ====================

    /**
     * Main classification method - performs two-stage classification
     *
     * @param input User input text
     * @return Classification result with domain, action, and composed intent
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
                    .build();
        }

        String normalizedInput = input.trim();
        log.debug("Starting two-stage classification for input: {}", normalizedInput);

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

        // Stage 3: Intent Composition
        String composedIntent = compositionConfig.getIntent(domain.name(), action.name());
        if (composedIntent == null) {
            composedIntent = domain.name() + "_" + action.name(); // Fallback pattern
        }
        log.debug("Stage 3 - Composed Intent: {}", composedIntent);

        // Calculate confidence
        double confidence = calculateConfidence(domain, action, domainKeyword, actionContext);
        boolean successful = domain != ClassifiedDomain.UNKNOWN && action != ClassifiedAction.UNKNOWN;

        TwoStageResult result = TwoStageResult.builder()
                .domain(domain)
                .action(action)
                .composedIntent(composedIntent)
                .confidence(confidence)
                .successful(successful)
                .domainKeyword(domainKeyword)
                .actionContext(actionContext)
                .build();

        log.info("Two-stage classification completed: domain={}, action={}, intent={}, confidence={}",
                domain, action, composedIntent, confidence);

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
     */
    private ActionResult classifyActionWithContext(String input) {
        // Rule 1: Time words indicate QUERY
        if (hasTimeContext(input)) {
            log.debug("Time context detected, classifying as QUERY");
            return new ActionResult(ClassifiedAction.QUERY, "time_context");
        }

        // Rule 2: Question words indicate QUERY
        if (isQuestion(input)) {
            log.debug("Question pattern detected, classifying as QUERY");
            return new ActionResult(ClassifiedAction.QUERY, "question_pattern");
        }

        // Rule 3: Status words indicate QUERY
        if (hasStatusWords(input)) {
            log.debug("Status words detected, classifying as QUERY");
            return new ActionResult(ClassifiedAction.QUERY, "status_words");
        }

        // Rule 4: Create words indicate CREATE
        if (hasCreateWords(input)) {
            log.debug("Create words detected, classifying as CREATE");
            return new ActionResult(ClassifiedAction.CREATE, "create_words");
        }

        // Rule 5: Action words indicate UPDATE
        if (hasActionWords(input)) {
            log.debug("Action words detected, classifying as UPDATE");
            return new ActionResult(ClassifiedAction.UPDATE, "action_words");
        }

        // Rule 6: Imperative without time words - context dependent
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
