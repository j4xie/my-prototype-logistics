package com.cretas.aims.service.impl;

import com.cretas.aims.config.IntentSlotConfiguration;
import com.cretas.aims.config.TimeNormalizationRules;
import com.cretas.aims.dto.clarification.ClarificationDecision;
import com.cretas.aims.dto.clarification.ClarificationDecision.ClarificationType;
import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.conversation.EntitySlot;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.slot.RequiredSlot;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.SmartClarificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 智能澄清服务实现
 *
 * 实现 Phase 3 增强澄清机制：
 * 1. 智能澄清触发 - 基于业务实体检测决定是否需要澄清
 * 2. 精准问题生成 - 基于缺失 slot 生成针对性问题
 * 3. 结合历史上下文推断缺失信息
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmartClarificationServiceImpl implements SmartClarificationService {

    private final IntentSlotConfiguration slotConfiguration;
    private final TimeNormalizationRules timeNormalizationRules;

    /**
     * 是否启用智能澄清
     */
    @Value("${cretas.ai.clarification.enabled:true}")
    private boolean enabled;

    /**
     * 澄清触发的最低置信度阈值
     * 低于此值时考虑澄清
     */
    @Value("${cretas.ai.clarification.confidence-threshold:0.6}")
    private double confidenceThreshold;

    /**
     * 高风险操作的敏感度级别阈值
     */
    @Value("${cretas.ai.clarification.high-risk-sensitivity:3}")
    private int highRiskSensitivity;

    // ==================== 实体检测正则模式 ====================

    /**
     * 时间实体模式
     */
    private static final List<Pattern> TIME_PATTERNS = Arrays.asList(
            // 相对时间
            Pattern.compile("(今天|昨天|前天|明天|本周|上周|下周|本月|上月|下月|今年|去年)"),
            // 具体日期
            Pattern.compile("(\\d{4}[年/-]\\d{1,2}[月/-]\\d{1,2}[日号]?)"),
            Pattern.compile("(\\d{1,2}[月]\\d{1,2}[日号])"),
            // 时间范围
            Pattern.compile("(最近\\d+[天周月年])"),
            Pattern.compile("(过去\\d+[天周月年])"),
            // 季度
            Pattern.compile("([第一二三四1234]季度)")
    );

    /**
     * 数量实体模式
     */
    private static final Pattern QUANTITY_PATTERN = Pattern.compile(
            "(\\d+(?:\\.\\d+)?\\s*(?:kg|公斤|斤|吨|个|件|批|箱|袋|桶)?)"
    );

    /**
     * 批次号模式
     */
    private static final Pattern BATCH_PATTERN = Pattern.compile(
            "(?:批次[号]?|批号|MB|MT|WO)[:-]?\\s*([A-Za-z0-9-]+)"
    );

    /**
     * 物料名称关键词
     */
    private static final Set<String> MATERIAL_KEYWORDS = new HashSet<>(Arrays.asList(
            "原料", "材料", "物料", "牛肉", "猪肉", "羊肉", "鸡肉", "鱼肉",
            "蔬菜", "水果", "调料", "香料", "添加剂", "包装材料"
    ));

    /**
     * 高风险操作关键词
     */
    private static final Set<String> HIGH_RISK_ACTIONS = new HashSet<>(Arrays.asList(
            "删除", "移除", "清空", "作废", "撤销", "批量修改", "全部更新"
    ));

    // ==================== 澄清问题模板 ====================

    private static final Map<String, String> SLOT_QUESTION_TEMPLATES = new HashMap<>();
    static {
        // 时间相关
        SLOT_QUESTION_TEMPLATES.put("startDate", "您想查询哪个时间段的数据？(今天/本周/本月/指定日期)");
        SLOT_QUESTION_TEMPLATES.put("endDate", "截止到什么时间？");
        SLOT_QUESTION_TEMPLATES.put("timeRange", "请指定查询的时间范围");

        // 物料相关
        SLOT_QUESTION_TEMPLATES.put("materialTypeId", "您想查询哪种物料？请提供物料名称或编号");
        SLOT_QUESTION_TEMPLATES.put("materialName", "请问是哪种原材料？");
        SLOT_QUESTION_TEMPLATES.put("batchId", "请提供批次号，例如：MB-20240115-001");
        SLOT_QUESTION_TEMPLATES.put("batchNumber", "请提供要操作的批次号");

        // 数量相关
        SLOT_QUESTION_TEMPLATES.put("quantity", "数量是多少？(可带单位，如：100kg)");
        SLOT_QUESTION_TEMPLATES.put("weight", "重量是多少？");
        SLOT_QUESTION_TEMPLATES.put("amount", "金额是多少？");

        // 实体相关
        SLOT_QUESTION_TEMPLATES.put("supplierId", "请选择供应商");
        SLOT_QUESTION_TEMPLATES.put("customerId", "请选择客户");
        SLOT_QUESTION_TEMPLATES.put("warehouseId", "请选择仓库");

        // 操作相关
        SLOT_QUESTION_TEMPLATES.put("action", "您想对这些数据进行什么操作？(查询/统计/导出)");
        SLOT_QUESTION_TEMPLATES.put("status", "请选择状态");
        SLOT_QUESTION_TEMPLATES.put("reason", "请说明原因");
    }

    @Override
    public ClarificationDecision decideClarification(
            String userInput,
            AIIntentConfig intent,
            IntentMatchResult matchResult,
            ConversationContext context) {

        if (!enabled) {
            return ClarificationDecision.noNeed(1.0);
        }

        if (userInput == null || userInput.trim().isEmpty()) {
            return ClarificationDecision.need(
                    ClarificationType.INCOMPLETE_PARAMS,
                    "输入为空",
                    Collections.emptyList(),
                    0.0);
        }

        log.debug("开始智能澄清决策: input='{}', intent={}",
                userInput, intent != null ? intent.getIntentCode() : "null");

        try {
            // Step 1: 检测用户输入中的业务实体
            Map<String, Object> detectedEntities = detectBusinessEntities(userInput);
            log.debug("检测到的实体: {}", detectedEntities);

            // Step 2: 获取意图的必需槽位
            List<String> requiredSlots = getRequiredSlotsForIntent(intent);

            // Step 3: 找出缺失的槽位
            List<String> missingSlots = findMissingSlots(requiredSlots, detectedEntities);

            // Step 4: 尝试从上下文推断缺失信息
            Map<String, Object> inferredDefaults = new HashMap<>();
            if (!missingSlots.isEmpty() && context != null) {
                inferredDefaults = inferFromContext(missingSlots, context);
                // 移除已推断的槽位
                missingSlots.removeAll(inferredDefaults.keySet());
                log.debug("从上下文推断: {}, 剩余缺失: {}", inferredDefaults.keySet(), missingSlots);
            }

            // Step 5: 评估是否需要澄清
            double matchConfidence = matchResult != null && matchResult.getConfidence() != null
                    ? matchResult.getConfidence() : 0.5;

            // 如果意图匹配置信度高且无强制缺失，不需要澄清
            if (matchConfidence >= 0.85 && missingSlots.isEmpty()) {
                ClarificationDecision decision = ClarificationDecision.noNeed(matchConfidence);
                decision.setDetectedEntities(detectedEntities);
                decision.setInferredDefaults(inferredDefaults);
                return decision;
            }

            // 如果还有缺失槽位
            if (!missingSlots.isEmpty()) {
                // 检查是否为高风险操作需要强制澄清
                boolean isHighRisk = requiresMandatoryClarification(intent,
                        matchResult != null ? String.valueOf(matchResult.getActionType()) : null);

                if (isHighRisk) {
                    ClarificationDecision decision = ClarificationDecision.need(
                            determineClarificationType(missingSlots),
                            "高风险操作需要确认参数",
                            missingSlots,
                            0.3);
                    decision.setDetectedEntities(detectedEntities);
                    decision.setPriority(9);
                    return decision;
                }

                // 评估不澄清直接执行的置信度
                double proceedConfidence = calculateProceedConfidence(
                        missingSlots, detectedEntities, inferredDefaults, matchConfidence);

                if (proceedConfidence >= confidenceThreshold) {
                    // 可以使用推断值继续执行
                    ClarificationDecision decision = ClarificationDecision.inferrable(
                            determineClarificationType(missingSlots),
                            "部分参数通过推断补全",
                            inferredDefaults,
                            buildInferenceExplanation(inferredDefaults),
                            proceedConfidence);
                    decision.setDetectedEntities(detectedEntities);
                    decision.setMissingSlots(missingSlots);
                    return decision;
                } else {
                    // 需要澄清
                    ClarificationDecision decision = ClarificationDecision.need(
                            determineClarificationType(missingSlots),
                            "缺少必要参数: " + String.join(", ", missingSlots),
                            missingSlots,
                            proceedConfidence);
                    decision.setDetectedEntities(detectedEntities);
                    decision.setInferredDefaults(inferredDefaults);

                    // 生成建议问题
                    List<String> questions = generateClarificationQuestions(decision, intent, context);
                    decision.setSuggestedQuestions(questions);

                    return decision;
                }
            }

            // 所有信息都已获取
            ClarificationDecision decision = ClarificationDecision.noNeed(matchConfidence);
            decision.setDetectedEntities(detectedEntities);
            decision.setInferredDefaults(inferredDefaults);
            return decision;

        } catch (Exception e) {
            log.warn("智能澄清决策失败: {}", e.getMessage());
            return ClarificationDecision.noNeed(0.5);
        }
    }

    @Override
    public List<String> generateClarificationQuestions(
            ClarificationDecision decision,
            AIIntentConfig intent,
            ConversationContext context) {

        List<String> questions = new ArrayList<>();

        if (decision == null || !decision.hasMissingSlots()) {
            return questions;
        }

        for (String slotName : decision.getMissingSlots()) {
            String question = generateQuestionForSlot(slotName, null, intent, context);
            if (question != null && !question.isEmpty()) {
                questions.add(question);
            }
        }

        // 限制问题数量，避免一次问太多
        if (questions.size() > 3) {
            questions = questions.subList(0, 3);
        }

        return questions;
    }

    @Override
    public String generateQuestionForSlot(
            String slotName,
            String slotType,
            AIIntentConfig intent,
            ConversationContext context) {

        // 优先使用预定义模板
        String template = SLOT_QUESTION_TEMPLATES.get(slotName);
        if (template != null) {
            return template;
        }

        // 尝试从槽位配置获取
        if (slotConfiguration != null && intent != null) {
            List<RequiredSlot> slots = slotConfiguration.getMandatorySlots(intent.getIntentCode());
            for (RequiredSlot slot : slots) {
                if (slot.getName().equals(slotName) && slot.getValidationHint() != null) {
                    return slot.getValidationHint();
                }
            }
        }

        // 默认问题格式
        String label = getSlotLabel(slotName);
        return "请提供" + label;
    }

    @Override
    public Map<String, Object> detectBusinessEntities(String userInput) {
        Map<String, Object> entities = new HashMap<>();

        if (userInput == null || userInput.isEmpty()) {
            return entities;
        }

        // 检测时间实体
        for (Pattern pattern : TIME_PATTERNS) {
            Matcher matcher = pattern.matcher(userInput);
            if (matcher.find()) {
                String timeExpr = matcher.group(1);
                entities.put("timeExpression", timeExpr);

                // 尝试解析为具体日期范围
                try {
                    java.util.Optional<TimeNormalizationRules.TimeRange> rangeOpt = timeNormalizationRules.normalize(timeExpr, java.time.LocalDateTime.now());
                    if (rangeOpt.isPresent() && rangeOpt.get().isValid()) {
                        TimeNormalizationRules.TimeRange range = rangeOpt.get();
                        entities.put("startDate", range.getStart().toLocalDate().toString());
                        entities.put("endDate", range.getEnd().toLocalDate().toString());
                    }
                } catch (Exception e) {
                    log.debug("时间解析失败: {}", timeExpr);
                }
                break;
            }
        }

        // 检测数量实体
        Matcher quantityMatcher = QUANTITY_PATTERN.matcher(userInput);
        if (quantityMatcher.find()) {
            entities.put("quantity", quantityMatcher.group(1));
        }

        // 检测批次号
        Matcher batchMatcher = BATCH_PATTERN.matcher(userInput);
        if (batchMatcher.find()) {
            entities.put("batchId", batchMatcher.group(1));
            entities.put("batchNumber", batchMatcher.group(1));
        }

        // 检测物料关键词
        for (String keyword : MATERIAL_KEYWORDS) {
            if (userInput.contains(keyword)) {
                entities.put("materialKeyword", keyword);
                break;
            }
        }

        return entities;
    }

    @Override
    public Map<String, Object> inferFromContext(
            List<String> missingSlots,
            ConversationContext context) {

        Map<String, Object> inferred = new HashMap<>();

        if (context == null || missingSlots == null || missingSlots.isEmpty()) {
            return inferred;
        }

        for (String slotName : missingSlots) {
            Object value = inferSlotFromContext(slotName, context);
            if (value != null) {
                inferred.put(slotName, value);
            }
        }

        return inferred;
    }

    @Override
    public double evaluateConfidenceWithoutClarification(
            ClarificationDecision decision,
            IntentMatchResult matchResult) {

        if (decision == null) {
            return 0.5;
        }

        double baseConfidence = matchResult != null && matchResult.getConfidence() != null
                ? matchResult.getConfidence() : 0.5;

        // 如果没有缺失槽位，直接返回匹配置信度
        if (!decision.hasMissingSlots()) {
            return baseConfidence;
        }

        // 根据缺失槽位数量和类型调整置信度
        int missingCount = decision.getMissingSlots().size();
        int inferredCount = decision.hasInferredDefaults() ? decision.getInferredDefaults().size() : 0;

        // 每个缺失槽位降低 0.1 置信度
        double penalty = (missingCount - inferredCount) * 0.1;

        return Math.max(0.0, baseConfidence - penalty);
    }

    @Override
    public String buildClarificationMessage(
            ClarificationDecision decision,
            List<String> questions,
            AIIntentConfig intent) {

        StringBuilder sb = new StringBuilder();

        // 开场白
        if (intent != null && intent.getIntentName() != null) {
            sb.append("好的，我来帮您处理「").append(intent.getIntentName()).append("」。\n\n");
        } else {
            sb.append("好的，我来帮您处理。\n\n");
        }

        // 说明已识别的信息（如果有）
        if (decision != null && decision.getDetectedEntities() != null
                && !decision.getDetectedEntities().isEmpty()) {
            sb.append("我已识别到以下信息：\n");
            for (Map.Entry<String, Object> entry : decision.getDetectedEntities().entrySet()) {
                sb.append("  - ").append(getSlotLabel(entry.getKey()))
                        .append(": ").append(entry.getValue()).append("\n");
            }
            sb.append("\n");
        }

        // 澄清问题
        if (questions != null && !questions.isEmpty()) {
            sb.append("还需要您提供以下信息：\n");
            for (int i = 0; i < questions.size(); i++) {
                sb.append(i + 1).append(". ").append(questions.get(i)).append("\n");
            }
            sb.append("\n请直接告诉我，我会帮您完成。");
        }

        return sb.toString();
    }

    @Override
    public boolean requiresMandatoryClarification(AIIntentConfig intent, String detectedAction) {
        // 检查意图敏感度级别 (HIGH 或 CRITICAL 视为高风险)
        if (intent != null && intent.getSensitivityLevel() != null
                && ("HIGH".equals(intent.getSensitivityLevel()) || "CRITICAL".equals(intent.getSensitivityLevel()))) {
            return true;
        }

        // 检查操作关键词
        if (detectedAction != null) {
            for (String highRiskAction : HIGH_RISK_ACTIONS) {
                if (detectedAction.contains(highRiskAction)) {
                    return true;
                }
            }
        }

        return false;
    }

    @Override
    public boolean isAvailable() {
        return enabled;
    }

    // ==================== 私有辅助方法 ====================

    private List<String> getRequiredSlotsForIntent(AIIntentConfig intent) {
        if (intent == null || slotConfiguration == null) {
            return Collections.emptyList();
        }

        List<RequiredSlot> slots = slotConfiguration.getMandatorySlots(intent.getIntentCode());
        List<String> slotNames = new ArrayList<>();
        for (RequiredSlot slot : slots) {
            if (slot.isRequired()) {
                slotNames.add(slot.getName());
            }
        }
        return slotNames;
    }

    private List<String> findMissingSlots(List<String> requiredSlots, Map<String, Object> detectedEntities) {
        List<String> missing = new ArrayList<>();
        for (String slotName : requiredSlots) {
            if (!detectedEntities.containsKey(slotName)
                    || detectedEntities.get(slotName) == null
                    || detectedEntities.get(slotName).toString().isEmpty()) {
                missing.add(slotName);
            }
        }
        return missing;
    }

    private Object inferSlotFromContext(String slotName, ConversationContext context) {
        // 从实体槽位推断
        if (context.getEntitySlots() != null) {
            switch (slotName.toLowerCase()) {
                case "batchid":
                case "batchnumber":
                    EntitySlot batchSlot = context.getSlot(EntitySlot.SlotType.BATCH);
                    if (batchSlot != null) {
                        return batchSlot.getId();
                    }
                    break;
                case "supplierid":
                    EntitySlot supplierSlot = context.getSlot(EntitySlot.SlotType.SUPPLIER);
                    if (supplierSlot != null) {
                        return supplierSlot.getId();
                    }
                    break;
                case "customerid":
                    EntitySlot customerSlot = context.getSlot(EntitySlot.SlotType.CUSTOMER);
                    if (customerSlot != null) {
                        return customerSlot.getId();
                    }
                    break;
                case "materialtypeid":
                    EntitySlot materialSlot = context.getSlot(EntitySlot.SlotType.MATERIAL_TYPE);
                    if (materialSlot != null) {
                        return materialSlot.getId();
                    }
                    break;
            }
        }

        // 时间槽位默认推断
        if (slotName.equalsIgnoreCase("startDate")) {
            return LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        }
        if (slotName.equalsIgnoreCase("endDate")) {
            return LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        }

        return null;
    }

    private ClarificationType determineClarificationType(List<String> missingSlots) {
        if (missingSlots == null || missingSlots.isEmpty()) {
            return ClarificationType.NONE;
        }

        for (String slot : missingSlots) {
            String lowerSlot = slot.toLowerCase();
            if (lowerSlot.contains("date") || lowerSlot.contains("time")) {
                return ClarificationType.MISSING_TIME;
            }
            if (lowerSlot.contains("batch") || lowerSlot.contains("material")
                    || lowerSlot.contains("supplier") || lowerSlot.contains("customer")) {
                return ClarificationType.MISSING_ENTITY;
            }
            if (lowerSlot.contains("action") || lowerSlot.contains("operation")) {
                return ClarificationType.AMBIGUOUS_ACTION;
            }
        }

        return ClarificationType.INCOMPLETE_PARAMS;
    }

    private double calculateProceedConfidence(
            List<String> missingSlots,
            Map<String, Object> detectedEntities,
            Map<String, Object> inferredDefaults,
            double matchConfidence) {

        int totalSlots = missingSlots.size() + detectedEntities.size();
        if (totalSlots == 0) {
            return matchConfidence;
        }

        // 已检测到的实体贡献
        int detectedCount = detectedEntities.size();
        // 推断的默认值贡献（权重较低）
        int inferredCount = inferredDefaults.size();

        double completeness = (detectedCount + inferredCount * 0.7) / totalSlots;
        return matchConfidence * 0.6 + completeness * 0.4;
    }

    private String buildInferenceExplanation(Map<String, Object> inferredDefaults) {
        if (inferredDefaults == null || inferredDefaults.isEmpty()) {
            return null;
        }

        StringBuilder sb = new StringBuilder("已自动填充：");
        List<String> items = new ArrayList<>();
        for (Map.Entry<String, Object> entry : inferredDefaults.entrySet()) {
            items.add(getSlotLabel(entry.getKey()) + "=" + entry.getValue());
        }
        sb.append(String.join("、", items));
        return sb.toString();
    }

    private String getSlotLabel(String slotName) {
        Map<String, String> labels = Map.ofEntries(
                Map.entry("batchId", "批次号"),
                Map.entry("batchNumber", "批次号"),
                Map.entry("quantity", "数量"),
                Map.entry("materialTypeId", "原材料类型"),
                Map.entry("materialName", "物料名称"),
                Map.entry("productId", "产品"),
                Map.entry("supplierId", "供应商"),
                Map.entry("customerId", "客户"),
                Map.entry("warehouseId", "仓库"),
                Map.entry("reason", "原因"),
                Map.entry("status", "状态"),
                Map.entry("startDate", "开始日期"),
                Map.entry("endDate", "结束日期"),
                Map.entry("timeRange", "时间范围"),
                Map.entry("timeExpression", "时间"),
                Map.entry("weight", "重量"),
                Map.entry("amount", "金额"),
                Map.entry("action", "操作"),
                Map.entry("materialKeyword", "物料类型")
        );
        return labels.getOrDefault(slotName, slotName);
    }
}
