package com.cretas.aims.service.impl;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.intent.*;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.IntentSemanticsParser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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
            constraints.add(Constraint.set("date", dateStr));
            log.debug("从用户输入提取日期: {}", dateStr);
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
            "(?:状态[：:]?\\s*)?(待处理|已完成|进行中|暂停|取消|已确认|未确认|正常|异常|PENDING|COMPLETED|IN_PROGRESS|CANCELLED)",
            java.util.regex.Pattern.CASE_INSENSITIVE
        );
        java.util.regex.Matcher statusMatcher = statusPattern.matcher(userInput);
        if (statusMatcher.find()) {
            String status = statusMatcher.group(1);
            constraints.add(Constraint.set("status", status));
            log.debug("从用户输入提取状态: {}", status);
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
