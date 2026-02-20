package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.intent.*;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.IntentSemanticsParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 意图语义解析器实现
 *
 * 将意图执行请求解析为结构化的语义对象。
 * 通过静态映射表和配置信息进行解析。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Service
public class IntentSemanticsParserImpl implements IntentSemanticsParser {

    // intentCode到语义的映射表（后续可从配置表读取）
    private static final Map<String, SemanticMapping> SEMANTIC_MAPPINGS = new HashMap<>();

    static {
        // 数据操作类
        SEMANTIC_MAPPINGS.put("BATCH_UPDATE", new SemanticMapping(DomainType.DATA, ActionType.UPDATE, ObjectType.BATCH));
        SEMANTIC_MAPPINGS.put("MATERIAL_BATCH_QUERY", new SemanticMapping(DomainType.DATA, ActionType.QUERY, ObjectType.MATERIAL_BATCH));
        SEMANTIC_MAPPINGS.put("PRODUCT_TYPE_QUERY", new SemanticMapping(DomainType.DATA, ActionType.QUERY, ObjectType.PRODUCT));
        SEMANTIC_MAPPINGS.put("PRODUCT_UPDATE", new SemanticMapping(DomainType.DATA, ActionType.UPDATE, ObjectType.PRODUCT));
        SEMANTIC_MAPPINGS.put("DATA_OPERATION", new SemanticMapping(DomainType.DATA, ActionType.UPDATE, ObjectType.BATCH));

        // 质量类
        SEMANTIC_MAPPINGS.put("QUALITY_CHECK_EXECUTE", new SemanticMapping(DomainType.QUALITY, ActionType.EXECUTE, ObjectType.CHECK));
        SEMANTIC_MAPPINGS.put("QUALITY_RECORD_QUERY", new SemanticMapping(DomainType.QUALITY, ActionType.QUERY, ObjectType.RECORD));

        // 排程类
        SEMANTIC_MAPPINGS.put("SCHEDULE_QUERY", new SemanticMapping(DomainType.SCHEDULE, ActionType.QUERY, ObjectType.PLAN));
        SEMANTIC_MAPPINGS.put("SCHEDULE_OPTIMIZE", new SemanticMapping(DomainType.SCHEDULE, ActionType.ANALYZE, ObjectType.PLAN));

        // 电子秤类
        SEMANTIC_MAPPINGS.put("SCALE_ADD_DEVICE", new SemanticMapping(DomainType.SCALE, ActionType.CREATE, ObjectType.DEVICE));
        SEMANTIC_MAPPINGS.put("SCALE_WEIGHT_DETECT", new SemanticMapping(DomainType.SCALE, ActionType.DETECT, ObjectType.DEVICE));

        // 出货类
        SEMANTIC_MAPPINGS.put("SHIPMENT_QUERY", new SemanticMapping(DomainType.SHIPMENT, ActionType.QUERY, ObjectType.SHIPMENT));
        SEMANTIC_MAPPINGS.put("SHIPMENT_CREATE", new SemanticMapping(DomainType.SHIPMENT, ActionType.CREATE, ObjectType.SHIPMENT));

        // 表单类
        SEMANTIC_MAPPINGS.put("FORM_GENERATE", new SemanticMapping(DomainType.FORM, ActionType.CREATE, ObjectType.FORM_SCHEMA));

        // 元数据类
        SEMANTIC_MAPPINGS.put("META_INTENT_QUERY", new SemanticMapping(DomainType.META, ActionType.QUERY, ObjectType.INTENT));
        SEMANTIC_MAPPINGS.put("META_INTENT_UPDATE", new SemanticMapping(DomainType.META, ActionType.UPDATE, ObjectType.INTENT));
    }

    // 状态值映射表：中文到英文常量的映射
    private static final Map<String, String> SHIPMENT_STATUS_MAPPINGS = Map.ofEntries(
            Map.entry("已发货", "SHIPPED"),
            Map.entry("待发货", "PENDING"),
            Map.entry("已送达", "DELIVERED"),
            Map.entry("运输中", "IN_TRANSIT"),
            Map.entry("已取消", "CANCELLED"),
            Map.entry("待确认", "PENDING_CONFIRMATION"),
            Map.entry("配送中", "IN_DELIVERY")
    );

    private static final Map<String, String> QUALITY_STATUS_MAPPINGS = Map.ofEntries(
            Map.entry("合格", "PASSED"),
            Map.entry("不合格", "FAILED"),
            Map.entry("待检", "PENDING"),
            Map.entry("检验中", "IN_PROGRESS"),
            Map.entry("待复检", "PENDING_RECHECK"),
            Map.entry("已复检", "RECHECKED")
    );

    private static final Map<String, String> BATCH_STATUS_MAPPINGS = Map.ofEntries(
            Map.entry("进行中", "IN_PROGRESS"),
            Map.entry("已完成", "COMPLETED"),
            Map.entry("待开始", "PENDING"),
            Map.entry("已暂停", "PAUSED"),
            Map.entry("已取消", "CANCELLED"),
            Map.entry("待质检", "PENDING_QC"),
            Map.entry("待入库", "PENDING_STORAGE")
    );

    private static final Map<String, String> GENERAL_STATUS_MAPPINGS = Map.ofEntries(
            Map.entry("待处理", "PENDING"),
            Map.entry("处理中", "IN_PROGRESS"),
            Map.entry("已完成", "COMPLETED"),
            Map.entry("已取消", "CANCELLED"),
            Map.entry("暂停", "PAUSED"),
            Map.entry("正常", "NORMAL"),
            Map.entry("异常", "ABNORMAL"),
            Map.entry("已确认", "CONFIRMED"),
            Map.entry("未确认", "UNCONFIRMED")
    );

    @Override
    public IntentSemantics parse(IntentExecuteRequest request, AIIntentConfig intentConfig, String factoryId) {
        // 1. 先从context解析
        IntentSemantics semantics = parseFromContext(request, intentConfig);

        // 2. 判断是否需要AI辅助
        if (needsAIParsing(request, semantics)) {
            // TODO: 调用AI服务补充解析
            log.debug("需要AI辅助解析，但当前版本暂不支持");
        }

        return semantics;
    }

    @Override
    public IntentSemantics parseFromContext(IntentExecuteRequest request, AIIntentConfig intentConfig) {
        String intentCode = intentConfig.getIntentCode();
        Map<String, Object> context = request.getContext();

        // 构建有效的上下文，确保 userInput 也被包含
        Map<String, Object> effectiveContext = new HashMap<>();
        if (context != null) {
            effectiveContext.putAll(context);
        }
        // 如果请求顶层有 userInput，合并到 context 中（优先级高于 context 内的 userInput）
        if (request.getUserInput() != null && !request.getUserInput().isEmpty()) {
            effectiveContext.put("userInput", request.getUserInput());
        }

        // 从映射表获取基础语义
        SemanticMapping mapping = SEMANTIC_MAPPINGS.get(intentCode);

        // 初始化语义对象
        IntentSemantics semantics = new IntentSemantics();
        semantics.setRawContext(effectiveContext);
        semantics.setParseMethod(ParseMethod.CONTEXT);
        semantics.setParseConfidence(1.0);
        semantics.setConstraints(new ArrayList<>());

        if (mapping != null) {
            semantics.setDomain(mapping.domain);
            semantics.setAction(mapping.action);
            semantics.setObject(mapping.object);
        } else {
            // 尝试从intentConfig的语义字段获取（如果已配置）
            DomainType domain = parseDomainFromConfig(intentConfig);
            if (domain != null) {
                semantics.setDomain(domain);
            }
        }

        // 从 effectiveContext 中提取约束（包括 userInput）
        extractConstraints(semantics, effectiveContext);

        return semantics;
    }

    @Override
    public boolean needsAIParsing(IntentExecuteRequest request, IntentSemantics partialSemantics) {
        // 如果核心语义层级缺失，需要AI辅助
        if (partialSemantics.getDomain() == null ||
            partialSemantics.getAction() == null ||
            partialSemantics.getObject() == null) {
            return true;
        }

        // 如果有userInput但约束为空，可能需要AI解析
        Map<String, Object> context = request.getContext();
        if (context != null && context.containsKey("userInput")) {
            String userInput = (String) context.get("userInput");
            if (userInput != null && !userInput.isEmpty() &&
                (partialSemantics.getConstraints() == null || partialSemantics.getConstraints().isEmpty())) {
                return true;
            }
        }

        return false;
    }

    /**
     * 从意图配置中解析Domain类型
     */
    private DomainType parseDomainFromConfig(AIIntentConfig config) {
        // 这里后续会从config的semanticDomain/semanticAction/semanticObject字段读取
        // 当前版本先基于intentCategory做简单推断
        String category = config.getIntentCategory();
        if (category != null) {
            switch (category.toUpperCase()) {
                case "DATA_OPERATION":
                case "DATA_OP":
                    return DomainType.DATA;
                case "QUALITY":
                    return DomainType.QUALITY;
                case "SCHEDULE":
                    return DomainType.SCHEDULE;
                case "SCALE":
                    return DomainType.SCALE;
                case "SHIPMENT":
                    return DomainType.SHIPMENT;
                case "FORM":
                    return DomainType.FORM;
                case "META":
                    return DomainType.META;
                default:
                    return DomainType.SYSTEM;
            }
        }
        return null;
    }

    /**
     * 从context中提取约束条件
     */
    private void extractConstraints(IntentSemantics semantics, Map<String, Object> context) {
        List<Constraint> constraints = semantics.getConstraints();
        if (constraints == null) {
            constraints = new ArrayList<>();
            semantics.setConstraints(constraints);
        }

        // 提取常见字段作为约束
        String[] commonFields = {"batchNumber", "batchId", "productId", "quantity",
                                  "status", "materialTypeId", "equipmentId", "date"};

        for (String field : commonFields) {
            if (context.containsKey(field) && context.get(field) != null) {
                constraints.add(Constraint.set(field, context.get(field)));
            }
        }

        // 从userInput文本中提取参数
        if (context.containsKey("userInput")) {
            String userInput = (String) context.get("userInput");
            if (userInput != null && !userInput.isEmpty()) {
                extractFromUserInput(semantics, constraints, userInput);
            }
        }

        // 提取objectId
        if (context.containsKey("objectId")) {
            semantics.setObjectId(String.valueOf(context.get("objectId")));
        } else if (context.containsKey("batchId")) {
            semantics.setObjectId(String.valueOf(context.get("batchId")));
        } else if (context.containsKey("id")) {
            semantics.setObjectId(String.valueOf(context.get("id")));
        }
    }

    /**
     * 从用户输入文本中提取参数
     * 支持批次号、产品ID、设备ID等常见标识符的智能提取
     */
    private void extractFromUserInput(IntentSemantics semantics, List<Constraint> constraints, String userInput) {
        // 批次号提取: MB-F001-001, BATCH-xxx, PB-xxx 等格式
        java.util.regex.Pattern batchPattern = java.util.regex.Pattern.compile(
            "(MB-[A-Z0-9]+-\\d+|BATCH-[A-Z0-9-]+|PB-[A-Z0-9]+-\\d+)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher batchMatcher = batchPattern.matcher(userInput);
        if (batchMatcher.find()) {
            String batchNumber = batchMatcher.group(1).toUpperCase();
            constraints.add(Constraint.set("batchNumber", batchNumber));
            semantics.setObjectId(batchNumber);
            semantics.setObjectIdentifier(batchNumber);
            log.debug("从用户输入提取批次号: {}", batchNumber);
        }

        // 产品类型ID提取: PT-F001-001 格式
        java.util.regex.Pattern productPattern = java.util.regex.Pattern.compile(
            "(PT-[A-Z0-9]+-\\d+)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher productMatcher = productPattern.matcher(userInput);
        if (productMatcher.find()) {
            String productId = productMatcher.group(1).toUpperCase();
            constraints.add(Constraint.set("productTypeId", productId));
            log.debug("从用户输入提取产品类型ID: {}", productId);
        }

        // 设备ID提取: EQ-xxx, SCALE-xxx 格式
        java.util.regex.Pattern equipPattern = java.util.regex.Pattern.compile(
            "(EQ-[A-Z0-9-]+|SCALE-[A-Z0-9-]+)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher equipMatcher = equipPattern.matcher(userInput);
        if (equipMatcher.find()) {
            String equipmentId = equipMatcher.group(1).toUpperCase();
            constraints.add(Constraint.set("equipmentId", equipmentId));
            log.debug("从用户输入提取设备ID: {}", equipmentId);
        }

        // 原材料类型ID提取: RMT-F001-001 格式
        java.util.regex.Pattern rmtPattern = java.util.regex.Pattern.compile(
            "(RMT-[A-Z0-9]+-\\d+)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher rmtMatcher = rmtPattern.matcher(userInput);
        if (rmtMatcher.find()) {
            String materialTypeId = rmtMatcher.group(1).toUpperCase();
            constraints.add(Constraint.set("materialTypeId", materialTypeId));
            log.debug("从用户输入提取原材料类型ID: {}", materialTypeId);
        }

        // 数量提取: "数量100" 或 "100个/kg/吨" 格式
        java.util.regex.Pattern qtyPattern = java.util.regex.Pattern.compile(
            "(?:数量|qty)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:个|kg|吨|斤)?",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher qtyMatcher = qtyPattern.matcher(userInput);
        if (qtyMatcher.find()) {
            try {
                Double quantity = Double.parseDouble(qtyMatcher.group(1));
                constraints.add(Constraint.set("quantity", quantity));
                log.debug("从用户输入提取数量: {}", quantity);
            } catch (NumberFormatException ignored) {}
        }

        // 用户名提取: "禁用用户zhangsan" 或 "用户名：xxx"
        java.util.regex.Pattern usernamePattern = java.util.regex.Pattern.compile(
            "(?:禁用|停用|冻结|启用)?(?:用户)?(?:名)?[：:]?\\s*([a-zA-Z][a-zA-Z0-9_]{2,20})",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher usernameMatcher = usernamePattern.matcher(userInput);
        if (usernameMatcher.find()) {
            String username = usernameMatcher.group(1);
            constraints.add(Constraint.set("username", username));
            log.debug("从用户输入提取用户名: {}", username);
        }

        // 客户名提取: "客户xxx" 或 "客户名：xxx"
        java.util.regex.Pattern customerPattern = java.util.regex.Pattern.compile(
            "(?:客户|客户名)[：:]?\\s*([\\u4e00-\\u9fa5a-zA-Z0-9_]+?)(?:，|。|的|$|\\s)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher customerMatcher = customerPattern.matcher(userInput);
        if (customerMatcher.find()) {
            String customerName = customerMatcher.group(1).trim();
            constraints.add(Constraint.set("customerName", customerName));
            log.debug("从用户输入提取客户名: {}", customerName);
        }

        // 供应商名提取: "供应商xxx"
        java.util.regex.Pattern supplierPattern = java.util.regex.Pattern.compile(
            "(?:供应商|供货商)[：:]?\\s*([\\u4e00-\\u9fa5a-zA-Z0-9_]+?)(?:，|。|的|$|\\s)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher supplierMatcher = supplierPattern.matcher(userInput);
        if (supplierMatcher.find()) {
            String supplierName = supplierMatcher.group(1).trim();
            constraints.add(Constraint.set("supplierName", supplierName));
            log.debug("从用户输入提取供应商名: {}", supplierName);
        }

        // 日期提取: yyyy-MM-dd 或 今天/昨天/本周/本月
        java.util.regex.Pattern datePattern = java.util.regex.Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2}|今[天日]|昨[天日]|前天|本周|本月|上周|上月)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher dateMatcher = datePattern.matcher(userInput);
        if (dateMatcher.find()) {
            String dateStr = dateMatcher.group(1);
            // 解析为LocalDate对象
            LocalDate parsedDate = parseRelativeDate(dateStr);
            if (parsedDate != null) {
                // 同时存储原始字符串和解析后的LocalDate
                constraints.add(Constraint.set("date", dateStr));
                constraints.add(Constraint.set("parsedDate", parsedDate.toString()));
                log.debug("从用户输入提取并解析日期: {} → {}", dateStr, parsedDate);
            } else {
                // 解析失败时仅存储原始字符串
                constraints.add(Constraint.set("date", dateStr));
                log.debug("从用户输入提取日期（未解析）: {}", dateStr);
            }
        }

        // 生产计划号提取: PLAN-xxx 格式
        java.util.regex.Pattern planPattern = java.util.regex.Pattern.compile(
            "(PLAN-[A-Z0-9-]+)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher planMatcher = planPattern.matcher(userInput);
        if (planMatcher.find()) {
            String planNumber = planMatcher.group(1).toUpperCase();
            constraints.add(Constraint.set("planNumber", planNumber));
            log.debug("从用户输入提取计划号: {}", planNumber);
        }

        // 告警ID提取: 告警xxx 或 ID:xxx
        java.util.regex.Pattern alertPattern = java.util.regex.Pattern.compile(
            "(?:告警|警报|异常)?\\s*(?:ID|编号)?[：:]?\\s*(\\d+)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher alertMatcher = alertPattern.matcher(userInput);
        if (alertMatcher.find()) {
            String alertId = alertMatcher.group(1);
            constraints.add(Constraint.set("alertId", alertId));
            log.debug("从用户输入提取告警ID: {}", alertId);
        }

        // 状态提取: "状态xxx" 或 "待处理/已完成/进行中"
        java.util.regex.Pattern statusPattern = java.util.regex.Pattern.compile(
            "(?:状态[：:]?\\s*)?(已发货|待发货|已送达|运输中|已取消|配送中|合格|不合格|待检|检验中|待复检|已复检|进行中|已完成|待开始|已暂停|待质检|待入库|待处理|处理中|暂停|正常|异常|已确认|未确认|PENDING|COMPLETED|IN_PROGRESS|CANCELLED|SHIPPED|DELIVERED)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher statusMatcher = statusPattern.matcher(userInput);
        if (statusMatcher.find()) {
            String status = statusMatcher.group(1);
            // 尝试将中文状态映射为英文常量
            String mappedStatus = mapStatusValue(status);
            constraints.add(Constraint.set("status", mappedStatus));
            log.debug("从用户输入提取状态: {} → {}", status, mappedStatus);
        }
    }

    /**
     * 将中文状态值映射为英文常量
     * 按优先级尝试：出货状态 → 质量状态 → 批次状态 → 通用状态
     *
     * @param chineseStatus 中文状态或英文状态
     * @return 映射后的英文状态常量（如果无法映射，返回原值）
     */
    private String mapStatusValue(String chineseStatus) {
        if (chineseStatus == null) {
            return null;
        }

        String trimmed = chineseStatus.trim();

        // 如果已经是英文大写，直接返回
        if (trimmed.matches("^[A-Z_]+$")) {
            return trimmed;
        }

        // 依次尝试各类状态映射
        String mapped = SHIPMENT_STATUS_MAPPINGS.get(trimmed);
        if (mapped != null) {
            return mapped;
        }

        mapped = QUALITY_STATUS_MAPPINGS.get(trimmed);
        if (mapped != null) {
            return mapped;
        }

        mapped = BATCH_STATUS_MAPPINGS.get(trimmed);
        if (mapped != null) {
            return mapped;
        }

        mapped = GENERAL_STATUS_MAPPINGS.get(trimmed);
        if (mapped != null) {
            return mapped;
        }

        // 如果无法映射，返回原值（可能是自定义状态）
        log.debug("无法映射状态值: {}，返回原值", chineseStatus);
        return trimmed;
    }

    /**
     * 将相对日期描述转换为LocalDate对象
     * 支持：今天、昨天、前天、本周、本月、上周、上月、以及标准日期格式
     *
     * @param dateStr 日期字符串（相对或绝对）
     * @return LocalDate对象，如果解析失败返回null
     */
    private LocalDate parseRelativeDate(String dateStr) {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null;
        }

        String trimmed = dateStr.trim();
        LocalDate today = LocalDate.now();

        // 相对日期处理
        switch (trimmed) {
            case "今天":
            case "今日":
                return today;
            case "昨天":
            case "昨日":
                return today.minusDays(1);
            case "前天":
                return today.minusDays(2);
            case "本周":
                // 返回本周一
                return today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "上周":
                // 返回上周一
                return today.minusWeeks(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "本月":
                // 返回本月1号
                return today.with(TemporalAdjusters.firstDayOfMonth());
            case "上月":
                // 返回上月1号
                return today.minusMonths(1).with(TemporalAdjusters.firstDayOfMonth());
        }

        // 尝试解析标准日期格式 yyyy-MM-dd
        try {
            return LocalDate.parse(trimmed);
        } catch (Exception e) {
            log.warn("无法解析日期: {}", dateStr);
            return null;
        }
    }

    /**
     * 内部映射结构
     * 用于存储intentCode到语义层级的映射关系
     */
    private static class SemanticMapping {
        final DomainType domain;
        final ActionType action;
        final ObjectType object;

        SemanticMapping(DomainType domain, ActionType action, ObjectType object) {
            this.domain = domain;
            this.action = action;
            this.object = object;
        }
    }
}
