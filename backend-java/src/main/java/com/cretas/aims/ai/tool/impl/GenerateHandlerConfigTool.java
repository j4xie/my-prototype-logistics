package com.cretas.aims.ai.tool.impl;

import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.ai.tool.AbstractTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 生成Handler配置建议工具
 *
 * 这是一个纯建议工具，不执行实际的配置创建操作。
 * 当LLM需要为某个实体类型生成Handler配置时，调用此工具获取建议的：
 * - Handler类别（路由到哪个Handler）
 * - 参数模板（Handler需要的参数结构）
 * - 验证规则模板（Drools规则建议）
 *
 * 适用场景：
 * - 创建新的数据操作意图
 * - 创建表单生成意图
 * - 了解现有Handler的参数结构
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
@Slf4j
@Component
public class GenerateHandlerConfigTool extends AbstractTool {

    /**
     * 实体类型到Handler类别的映射
     */
    private static final Map<String, String> ENTITY_TO_HANDLER = new HashMap<>();

    /**
     * Handler参数模板
     */
    private static final Map<String, Map<String, Object>> HANDLER_PARAM_TEMPLATES = new HashMap<>();

    /**
     * 验证规则建议模板
     */
    private static final Map<String, List<String>> VALIDATION_RULE_TEMPLATES = new HashMap<>();

    static {
        // 实体到Handler映射
        ENTITY_TO_HANDLER.put("MaterialBatch", "MATERIAL");
        ENTITY_TO_HANDLER.put("ProcessingBatch", "PRODUCTION");
        ENTITY_TO_HANDLER.put("ProductType", "MATERIAL");
        ENTITY_TO_HANDLER.put("ProductionPlan", "PRODUCTION");
        ENTITY_TO_HANDLER.put("QualityCheckRecord", "QUALITY");
        ENTITY_TO_HANDLER.put("ShipmentRecord", "SHIPMENT");
        ENTITY_TO_HANDLER.put("Equipment", "EQUIPMENT");
        ENTITY_TO_HANDLER.put("AttendanceRecord", "ATTENDANCE");

        // Handler参数模板
        initHandlerParamTemplates();

        // 验证规则模板
        initValidationRuleTemplates();
    }

    private static void initHandlerParamTemplates() {
        // QUERY操作参数模板
        Map<String, Object> queryParams = new HashMap<>();
        queryParams.put("entityType", "实体类型，如：MaterialBatch");
        queryParams.put("filters", "过滤条件，如：{\"status\": \"ACTIVE\", \"batchNumber\": \"B001\"}");
        queryParams.put("page", "页码（可选，默认0）");
        queryParams.put("size", "每页大小（可选，默认20）");
        queryParams.put("sort", "排序字段（可选，如：createdAt,desc）");
        HANDLER_PARAM_TEMPLATES.put("QUERY", queryParams);

        // CREATE操作参数模板
        Map<String, Object> createParams = new HashMap<>();
        createParams.put("entityType", "实体类型");
        createParams.put("data", "实体数据，包含所有必填字段");
        createParams.put("validateOnly", "是否仅验证不保存（可选，默认false）");
        HANDLER_PARAM_TEMPLATES.put("CREATE", createParams);

        // UPDATE操作参数模板
        Map<String, Object> updateParams = new HashMap<>();
        updateParams.put("entityType", "实体类型");
        updateParams.put("entityId", "实体ID或唯一标识");
        updateParams.put("updates", "要更新的字段，如：{\"status\": \"COMPLETED\"}");
        updateParams.put("forceExecute", "是否强制执行（可选，默认false）");
        HANDLER_PARAM_TEMPLATES.put("UPDATE", updateParams);

        // DELETE操作参数模板
        Map<String, Object> deleteParams = new HashMap<>();
        deleteParams.put("entityType", "实体类型");
        deleteParams.put("entityId", "实体ID或唯一标识");
        deleteParams.put("forceExecute", "必须显式确认删除（必需，设为true）");
        deleteParams.put("reason", "删除原因（可选，建议提供）");
        HANDLER_PARAM_TEMPLATES.put("DELETE", deleteParams);

        // FORM操作参数模板
        Map<String, Object> formParams = new HashMap<>();
        formParams.put("entityType", "实体类型");
        formParams.put("formType", "表单类型：CREATE/UPDATE/VIEW");
        formParams.put("fields", "需要包含的字段列表（可选，默认全部）");
        formParams.put("layout", "布局模式：LINEAR/GRID（可选）");
        HANDLER_PARAM_TEMPLATES.put("FORM", formParams);
    }

    private static void initValidationRuleTemplates() {
        // QUERY操作验证规则
        VALIDATION_RULE_TEMPLATES.put("QUERY", Arrays.asList(
                "检查用户是否有查询此实体的权限",
                "验证过滤条件字段是否存在于实体Schema",
                "限制单次查询最大返回数量（防止大数据量查询）",
                "记录查询审计日志（如涉及敏感数据）"
        ));

        // CREATE操作验证规则
        VALIDATION_RULE_TEMPLATES.put("CREATE", Arrays.asList(
                "验证所有必填字段是否提供",
                "检查字段值类型和格式是否正确",
                "验证外键引用是否存在",
                "检查唯一性约束（如批次号、编码等）",
                "验证业务规则（如日期逻辑、数量范围等）",
                "检查用户是否有创建权限"
        ));

        // UPDATE操作验证规则
        VALIDATION_RULE_TEMPLATES.put("UPDATE", Arrays.asList(
                "验证实体是否存在",
                "检查实体是否处于可修改状态（如：未锁定、未删除）",
                "验证更新字段是否允许修改（如：某些字段创建后不可修改）",
                "检查字段值类型和格式",
                "验证业务规则（如：状态流转规则）",
                "检查用户是否有修改权限",
                "记录修改审计日志"
        ));

        // DELETE操作验证规则
        VALIDATION_RULE_TEMPLATES.put("DELETE", Arrays.asList(
                "验证实体是否存在",
                "检查是否有关联数据（级联删除或阻止删除）",
                "验证实体是否处于可删除状态",
                "要求显式确认（forceExecute=true）",
                "检查用户是否有删除权限（通常需要高级权限）",
                "记录删除审计日志"
        ));

        // FORM操作验证规则
        VALIDATION_RULE_TEMPLATES.put("FORM", Arrays.asList(
                "验证实体类型是否存在",
                "检查请求的字段是否存在于实体Schema",
                "验证用户是否有访问这些字段的权限",
                "根据formType决定字段的只读/可编辑状态"
        ));
    }

    @Override
    public String getToolName() {
        return "generate_handler_config";
    }

    @Override
    public String getDescription() {
        return "生成Handler配置建议，包括：推荐的Handler类别、参数模板、验证规则模板。" +
                "这是一个纯建议工具，不执行实际操作，仅提供配置指导。" +
                "适用场景：创建新的数据操作意图、表单生成意图、了解现有Handler参数结构。";
    }

    @Override
    public Map<String, Object> getParametersSchema() {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");

        Map<String, Object> properties = new HashMap<>();

        // entityType: 实体类型（必需）
        Map<String, Object> entityType = new HashMap<>();
        entityType.put("type", "string");
        entityType.put("description", "实体类型，如：MaterialBatch、ProcessingBatch、QualityCheckRecord等");
        properties.put("entityType", entityType);

        // operationType: 操作类型（必需）
        Map<String, Object> operationType = new HashMap<>();
        operationType.put("type", "string");
        operationType.put("description", "操作类型，决定Handler的处理逻辑");
        operationType.put("enum", Arrays.asList("QUERY", "CREATE", "UPDATE", "DELETE", "FORM"));
        properties.put("operationType", operationType);

        schema.put("properties", properties);
        schema.put("required", Arrays.asList("entityType", "operationType"));

        return schema;
    }

    @Override
    public String execute(ToolCall toolCall, Map<String, Object> context) throws Exception {
        logExecutionStart(toolCall, context);

        try {
            // 1. 解析参数
            Map<String, Object> arguments = parseArguments(toolCall);
            String entityType = getRequiredParam(arguments, "entityType");
            String operationType = getRequiredParam(arguments, "operationType");

            // 2. 标准化实体类型（支持中文、小写等）
            String normalizedEntityType = normalizeEntityType(entityType);

            // 3. 确定Handler类别
            String handlerCategory = ENTITY_TO_HANDLER.getOrDefault(normalizedEntityType, "DATA_OP");

            // 4. 获取参数模板
            Map<String, Object> paramTemplate = HANDLER_PARAM_TEMPLATES.getOrDefault(operationType, new HashMap<>());

            // 5. 获取验证规则建议
            List<String> validationRules = VALIDATION_RULE_TEMPLATES.getOrDefault(operationType, new ArrayList<>());

            // 6. 生成Handler配置示例
            Map<String, Object> handlerConfig = buildHandlerConfigExample(
                    normalizedEntityType, operationType, handlerCategory, paramTemplate
            );

            // 7. 构建返回结果
            Map<String, Object> resultData = new HashMap<>();
            resultData.put("entityType", normalizedEntityType);
            resultData.put("operationType", operationType);
            resultData.put("recommendedHandlerCategory", handlerCategory);
            resultData.put("handlerDescription", getHandlerDescription(handlerCategory));
            resultData.put("parameterTemplate", paramTemplate);
            resultData.put("validationRules", validationRules);
            resultData.put("handlerConfigExample", handlerConfig);
            resultData.put("tips", Arrays.asList(
                    "参数模板中的字段可根据实际需求调整",
                    "验证规则需要在Drools规则文件中实现",
                    "建议在创建意图前先测试Handler参数是否正确",
                    "敏感操作（UPDATE/DELETE）需要设置更高的权限要求"
            ));

            String result = buildSuccessResult(resultData);
            logExecutionSuccess(toolCall, result);

            return result;

        } catch (IllegalArgumentException e) {
            log.warn("⚠️  参数验证失败: {}", e.getMessage());
            return buildErrorResult("参数验证失败: " + e.getMessage());

        } catch (Exception e) {
            logExecutionFailure(toolCall, e);
            return buildErrorResult("生成Handler配置失败: " + e.getMessage());
        }
    }

    /**
     * 标准化实体类型
     */
    private String normalizeEntityType(String entityType) {
        // 如果已经是标准格式，直接返回
        if (ENTITY_TO_HANDLER.containsKey(entityType)) {
            return entityType;
        }

        // 尝试匹配中文
        Map<String, String> chineseMap = new HashMap<>();
        chineseMap.put("原料批次", "MaterialBatch");
        chineseMap.put("生产批次", "ProcessingBatch");
        chineseMap.put("产品类型", "ProductType");
        chineseMap.put("生产计划", "ProductionPlan");
        chineseMap.put("质检记录", "QualityCheckRecord");
        chineseMap.put("出货记录", "ShipmentRecord");
        chineseMap.put("设备", "Equipment");
        chineseMap.put("考勤", "AttendanceRecord");

        if (chineseMap.containsKey(entityType)) {
            return chineseMap.get(entityType);
        }

        // 尝试大小写不敏感匹配
        for (String key : ENTITY_TO_HANDLER.keySet()) {
            if (key.equalsIgnoreCase(entityType)) {
                return key;
            }
        }

        // 如果找不到，返回原值（让上层处理）
        return entityType;
    }

    /**
     * 获取Handler描述
     */
    private String getHandlerDescription(String handlerCategory) {
        Map<String, String> descriptions = new HashMap<>();
        descriptions.put("MATERIAL", "物料管理Handler - 处理原料批次、产品类型等物料相关操作");
        descriptions.put("PRODUCTION", "生产管理Handler - 处理生产批次、生产计划等生产相关操作");
        descriptions.put("QUALITY", "质量管理Handler - 处理质检记录、质量分析等质量相关操作");
        descriptions.put("SHIPMENT", "出货管理Handler - 处理出货记录、物流跟踪等出货相关操作");
        descriptions.put("EQUIPMENT", "设备管理Handler - 处理设备信息、设备维护等设备相关操作");
        descriptions.put("ATTENDANCE", "考勤管理Handler - 处理考勤记录、排班信息等考勤相关操作");
        descriptions.put("DATA_OP", "通用数据操作Handler - 处理未明确分类的实体数据操作");

        return descriptions.getOrDefault(handlerCategory, "未知Handler类别");
    }

    /**
     * 构建Handler配置示例
     */
    private Map<String, Object> buildHandlerConfigExample(
            String entityType, String operationType, String handlerCategory, Map<String, Object> paramTemplate
    ) {
        Map<String, Object> example = new HashMap<>();
        example.put("intentCategory", handlerCategory);

        // 根据操作类型生成示例参数
        Map<String, Object> exampleParams = new HashMap<>();
        exampleParams.putAll(paramTemplate);

        // 替换占位符为实际值
        for (Map.Entry<String, Object> entry : exampleParams.entrySet()) {
            if (entry.getValue() instanceof String) {
                String value = (String) entry.getValue();
                if (value.contains("实体类型")) {
                    exampleParams.put(entry.getKey(), entityType);
                }
            }
        }

        example.put("handlerParams", exampleParams);

        return example;
    }

    /**
     * 此工具不需要特殊权限（仅提供建议）
     */
    @Override
    public boolean requiresPermission() {
        return false;
    }
}
