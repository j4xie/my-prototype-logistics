package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.FieldUpdateFact;
import com.cretas.aims.dto.intent.ValidationResult;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.repository.FormTemplateRepository;
import com.cretas.aims.service.RuleEngineService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * 表单意图处理器
 *
 * 处理 FORM 分类的意图:
 * - FORM_GENERATION: 生成新字段
 * - FORM_MODIFICATION: 修改现有字段
 * - FORM_VALIDATION: 添加验证规则
 *
 * 支持两种AI后端：
 * - Python AI服务 (legacy)
 * - DashScope 直接调用 (推荐)
 *
 * @author Cretas Team
 * @version 1.1.0
 * @since 2026-01-02
 */
@Slf4j
@Component
public class FormIntentHandler implements IntentHandler {

    private final FormTemplateRepository formTemplateRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig dashScopeConfig;
    private final RuleEngineService ruleEngineService;

    @Value("${cretas.ai.service.url:http://localhost:8083}")
    private String aiServiceUrl;

    @Autowired
    public FormIntentHandler(FormTemplateRepository formTemplateRepository,
                             RestTemplate restTemplate,
                             ObjectMapper objectMapper,
                             RuleEngineService ruleEngineService,
                             @Autowired(required = false) DashScopeClient dashScopeClient,
                             @Autowired(required = false) DashScopeConfig dashScopeConfig) {
        this.formTemplateRepository = formTemplateRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.ruleEngineService = ruleEngineService;
        this.dashScopeClient = dashScopeClient;
        this.dashScopeConfig = dashScopeConfig;
    }

    @Override
    public String getSupportedCategory() {
        return "FORM";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("FormIntentHandler.handle: factoryId={}, intentCode={}, entityType={}",
                factoryId, intentConfig.getIntentCode(), request.getEntityType());

        try {
            // 1. 优先从 context 中解析字段定义（无需AI）
            Map<String, Object> generatedSchema = parseFieldsFromContext(request);

            // 2. 如果 context 没有字段定义，调用AI服务生成Schema
            if (generatedSchema == null) {
                generatedSchema = callAIGenerateSchema(factoryId, request);

                if (generatedSchema == null || !Boolean.TRUE.equals(generatedSchema.get("success"))) {
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("FORM")
                            .status("FAILED")
                            .message("AI生成Schema失败: " + (generatedSchema != null ?
                                    generatedSchema.get("message") : "无响应") +
                                    "\n\n您可以直接提供 context 参数: {fields: [{name, type, label, required}]}")
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }

            // 2. 获取或创建FormTemplate
            String entityType = request.getEntityType();
            if (entityType == null || entityType.isEmpty()) {
                entityType = "CUSTOM";
            }

            FormTemplate template = formTemplateRepository
                    .findActiveByFactoryIdAndEntityType(factoryId, entityType)
                    .orElse(null);

            List<Map<String, Object>> newFields = (List<Map<String, Object>>) generatedSchema.get("fields");

            // ====== DROOLS GATEWAY: 字段级规则验证 ======
            ValidationResult fieldValidation = validateFieldsWithDrools(
                    factoryId, entityType, newFields, userId, userRole);
            if (!fieldValidation.isValid()) {
                log.warn("字段规则验证失败: entityType={}, violations={}",
                        entityType, fieldValidation.getViolations().size());
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName())
                        .intentCategory("FORM")
                        .status("VALIDATION_FAILED")
                        .message("字段定义不符合业务规则: " + fieldValidation.getViolationsSummary())
                        .validationViolations(fieldValidation.getViolations())
                        .recommendations(fieldValidation.getRecommendations())
                        .executedAt(LocalDateTime.now())
                        .build();
            }
            log.debug("字段规则验证通过: entityType={}, fieldCount={}", entityType, newFields.size());

            List<IntentExecuteResponse.AffectedEntity> affected = new ArrayList<>();

            if (template != null) {
                // 3a. 更新现有模板 - 合并字段
                Map<String, Object> existingSchema = parseSchema(template.getSchemaJson());
                Map<String, Object> mergedSchema = mergeSchemaFields(existingSchema, newFields);

                // 创建新版本
                template.setSchemaJson(objectMapper.writeValueAsString(mergedSchema));
                template.incrementVersion();
                formTemplateRepository.save(template);

                affected.add(IntentExecuteResponse.AffectedEntity.builder()
                        .entityType("FormTemplate")
                        .entityId(template.getId())
                        .entityName(template.getName())
                        .action("UPDATED")
                        .changes(Map.of(
                                "addedFields", newFields.size(),
                                "newVersion", template.getVersion()
                        ))
                        .build());

                log.info("更新FormTemplate: id={}, version={}, addedFields={}",
                        template.getId(), template.getVersion(), newFields.size());
            } else {
                // 3b. 创建新模板
                Map<String, Object> newSchema = buildInitialSchema(newFields, entityType);

                template = FormTemplate.builder()
                        .factoryId(factoryId)
                        .entityType(entityType)
                        .name(entityType + "_表单模板")
                        .schemaJson(objectMapper.writeValueAsString(newSchema))
                        .version(1)
                        .isActive(true)
                        .createdBy(userId)
                        .source("AI_ASSISTANT")
                        .build();
                formTemplateRepository.save(template);

                affected.add(IntentExecuteResponse.AffectedEntity.builder()
                        .entityType("FormTemplate")
                        .entityId(template.getId())
                        .entityName(template.getName())
                        .action("CREATED")
                        .changes(Map.of(
                                "fieldCount", newFields.size(),
                                "entityType", entityType
                        ))
                        .build());

                log.info("创建FormTemplate: id={}, entityType={}, fieldCount={}",
                        template.getId(), entityType, newFields.size());
            }

            // 4. 构建响应
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("FORM")
                    .sensitivityLevel(intentConfig.getSensitivityLevel())
                    .status("COMPLETED")
                    .message("成功生成并保存了 " + newFields.size() + " 个字段到表单模板")
                    .quotaCost(intentConfig.getQuotaCost())
                    .resultData(Map.of(
                            "templateId", template.getId(),
                            "version", template.getVersion(),
                            "generatedFields", newFields,
                            "suggestions", generatedSchema.getOrDefault("suggestions", List.of())
                    ))
                    .affectedEntities(affected)
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(List.of(
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("VIEW_TEMPLATE")
                                    .actionName("查看模板")
                                    .description("查看更新后的表单模板")
                                    .endpoint("/api/mobile/" + factoryId + "/form-templates/" + template.getId())
                                    .build(),
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("ROLLBACK")
                                    .actionName("回滚版本")
                                    .description("如果不满意可以回滚到上一个版本")
                                    .endpoint("/api/mobile/" + factoryId + "/form-templates/" + template.getId() + "/rollback")
                                    .build()
                    ))
                    .build();

        } catch (Exception e) {
            log.error("FormIntentHandler执行失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("FORM")
                    .status("FAILED")
                    .message("执行失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("FormIntentHandler.preview: factoryId={}, entityType={}", factoryId, request.getEntityType());

        try {
            // 调用AI服务生成Schema (预览模式)
            Map<String, Object> generatedSchema = callAIGenerateSchema(factoryId, request);

            if (generatedSchema == null || !Boolean.TRUE.equals(generatedSchema.get("success"))) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("AI生成Schema失败")
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            // 生成确认Token
            String confirmToken = UUID.randomUUID().toString();
            // TODO: 将预览数据存入缓存，供confirm使用

            List<Map<String, Object>> fields = (List<Map<String, Object>>) generatedSchema.get("fields");

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("FORM")
                    .status("PREVIEW")
                    .message("预览生成的字段，确认后将保存到表单模板")
                    .resultData(Map.of(
                            "previewFields", fields,
                            "suggestions", generatedSchema.getOrDefault("suggestions", List.of())
                    ))
                    .confirmableAction(IntentExecuteResponse.ConfirmableAction.builder()
                            .confirmToken(confirmToken)
                            .description("确认添加 " + fields.size() + " 个字段到表单模板")
                            .expiresInSeconds(300)
                            .previewData(generatedSchema)
                            .build())
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("FormIntentHandler预览失败: {}", e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .status("FAILED")
                    .message("预览失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式
        return true;
    }

    // ==================== 辅助方法 ====================

    /**
     * 从 context 中解析字段定义（无需AI服务）
     * 支持格式: {fields: [{name, type, label, required, ...}]}
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseFieldsFromContext(IntentExecuteRequest request) {
        if (request.getContext() == null || request.getContext().isEmpty()) {
            return null;
        }

        Object fieldsObj = request.getContext().get("fields");
        if (fieldsObj == null) {
            return null;
        }

        List<Map<String, Object>> fields;
        if (fieldsObj instanceof List) {
            fields = (List<Map<String, Object>>) fieldsObj;
        } else {
            return null;
        }

        if (fields.isEmpty()) {
            return null;
        }

        // 验证字段格式
        for (Map<String, Object> field : fields) {
            if (field.get("name") == null) {
                log.warn("字段缺少 name 属性: {}", field);
                return null;
            }
            // 设置默认类型
            if (field.get("type") == null) {
                field.put("type", "string");
            }
        }

        log.info("从context解析表单字段: fieldCount={}", fields.size());

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("fields", fields);
        result.put("suggestions", List.of());
        return result;
    }

    /**
     * 调用AI服务生成Schema
     * 优先使用DashScope直接调用，fallback到Python服务
     */
    private Map<String, Object> callAIGenerateSchema(String factoryId, IntentExecuteRequest request) {
        // 检查是否启用DashScope直接调用
        if (shouldUseDashScope()) {
            return callDashScopeGenerateSchema(factoryId, request);
        }
        return callPythonAIGenerateSchema(factoryId, request);
    }

    /**
     * 检查是否应该使用DashScope直接调用
     */
    private boolean shouldUseDashScope() {
        return dashScopeConfig != null
            && dashScopeClient != null
            && dashScopeConfig.shouldUseDirect("form-parse");
    }

    /**
     * 使用DashScope直接生成表单Schema
     */
    private Map<String, Object> callDashScopeGenerateSchema(String factoryId, IntentExecuteRequest request) {
        try {
            log.info("使用DashScope直接生成表单Schema: factoryId={}", factoryId);

            String systemPrompt = buildFormSchemaPrompt(request.getEntityType());
            String userInput = request.getUserInput();

            // 调用DashScope
            String response = dashScopeClient.chatLowTemp(systemPrompt, userInput);
            log.debug("DashScope表单生成响应: {}", response);

            // 解析JSON响应
            return parseFormSchemaResponse(response);

        } catch (Exception e) {
            log.error("DashScope表单生成失败: {}", e.getMessage());
            // Fallback to Python service
            log.info("Fallback到Python AI服务");
            return callPythonAIGenerateSchema(factoryId, request);
        }
    }

    /**
     * 构建表单Schema生成提示词
     */
    private String buildFormSchemaPrompt(String entityType) {
        return """
            你是一个表单字段生成专家。根据用户描述生成表单字段定义。

            输出格式为JSON:
            {
              "success": true,
              "fields": [
                {
                  "name": "fieldName",
                  "type": "text|number|date|select|checkbox",
                  "label": "字段中文名",
                  "required": true/false,
                  "description": "字段说明"
                }
              ],
              "suggestions": ["建议1", "建议2"],
              "message": "成功生成N个字段定义"
            }

            实体类型: """ + (entityType != null ? entityType : "CUSTOM") + """

            只返回JSON，不要其他内容。
            """;
    }

    /**
     * 解析DashScope表单Schema响应
     */
    private Map<String, Object> parseFormSchemaResponse(String response) {
        try {
            // 清理可能的markdown代码块
            String jsonStr = response.trim();
            if (jsonStr.startsWith("```json")) {
                jsonStr = jsonStr.substring(7);
            }
            if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.substring(3);
            }
            if (jsonStr.endsWith("```")) {
                jsonStr = jsonStr.substring(0, jsonStr.length() - 3);
            }
            jsonStr = jsonStr.trim();

            return objectMapper.readValue(jsonStr, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("解析DashScope响应失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 调用Python AI服务生成Schema (Legacy)
     */
    private Map<String, Object> callPythonAIGenerateSchema(String factoryId, IntentExecuteRequest request) {
        try {
            String url = aiServiceUrl + "/api/ai/form/generate-schema";

            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("user_input", request.getUserInput());
            aiRequest.put("entity_type", request.getEntityType());
            aiRequest.put("factory_id", factoryId);

            if (request.getContext() != null) {
                Object existingFields = request.getContext().get("existingFields");
                if (existingFields != null) {
                    aiRequest.put("existing_fields", existingFields);
                }
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(aiRequest, headers);

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                return response.getBody();
            }
            return null;

        } catch (Exception e) {
            log.error("调用Python AI服务失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 解析现有Schema JSON
     */
    private Map<String, Object> parseSchema(String schemaJson) {
        try {
            if (schemaJson == null || schemaJson.isEmpty()) {
                return new HashMap<>();
            }
            return objectMapper.readValue(schemaJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("解析Schema失败: {}", e.getMessage());
            return new HashMap<>();
        }
    }

    /**
     * 合并Schema字段
     */
    private Map<String, Object> mergeSchemaFields(Map<String, Object> existingSchema,
                                                   List<Map<String, Object>> newFields) {
        Map<String, Object> result = new HashMap<>(existingSchema);

        // 获取或创建properties
        Map<String, Object> properties = (Map<String, Object>) result.getOrDefault("properties", new HashMap<>());

        // 添加新字段
        for (Map<String, Object> field : newFields) {
            String fieldName = (String) field.get("name");
            if (fieldName != null) {
                properties.put(fieldName, field);
            }
        }

        result.put("properties", properties);
        return result;
    }

    /**
     * 构建初始Schema
     */
    private Map<String, Object> buildInitialSchema(List<Map<String, Object>> fields, String entityType) {
        Map<String, Object> schema = new HashMap<>();
        schema.put("type", "object");
        schema.put("title", entityType + "表单");

        Map<String, Object> properties = new HashMap<>();
        for (Map<String, Object> field : fields) {
            String fieldName = (String) field.get("name");
            if (fieldName != null) {
                properties.put(fieldName, field);
            }
        }

        schema.put("properties", properties);
        return schema;
    }

    /**
     * 使用 Drools 验证字段定义
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param newFields 新字段列表
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 验证结果
     */
    private ValidationResult validateFieldsWithDrools(String factoryId, String entityType,
                                                       List<Map<String, Object>> newFields,
                                                       Long userId, String userRole) {
        try {
            // 聚合所有字段的验证结果
            ValidationResult aggregatedResult = ValidationResult.builder()
                    .valid(true)
                    .build();

            // 遍历每个字段进行验证
            for (Map<String, Object> field : newFields) {
                String fieldName = (String) field.get("name");
                String fieldType = (String) field.get("type");
                Object defaultValue = field.get("defaultValue");
                Boolean required = (Boolean) field.getOrDefault("required", false);

                // 构建字段更新事实对象
                FieldUpdateFact fact = FieldUpdateFact.builder()
                        .entityType(entityType)
                        .entityId(null)  // 新建字段，暂无实体ID
                        .fieldName(fieldName)
                        .oldValue(null)  // 新建字段，无旧值
                        .newValue(defaultValue)
                        .factoryId(factoryId)
                        .hasRelatedBatches(false)
                        .relatedBatchCount(0)
                        .operation("CREATE")
                        .userId(userId)
                        .username("system")
                        .userRole(userRole)
                        .build();

                // 调用 RuleEngineService 执行字段验证规则
                ValidationResult fieldResult = ruleEngineService.executeRulesWithAudit(
                        factoryId,
                        "fieldValidation",   // 规则组
                        entityType,          // 实体类型
                        fieldName,           // 实体ID (使用字段名)
                        userId,              // 执行者ID
                        "system",            // 执行者名称
                        userRole,            // 执行者角色
                        fact                 // Drools 事实对象
                );

                // 聚合验证结果
                if (!fieldResult.isValid()) {
                    aggregatedResult.setValid(false);
                }
                aggregatedResult.getViolations().addAll(fieldResult.getViolations());
                aggregatedResult.getRecommendations().addAll(fieldResult.getRecommendations());
                aggregatedResult.getFiredRules().addAll(fieldResult.getFiredRules());

                log.debug("字段验证完成: fieldName={}, valid={}, violations={}",
                        fieldName, fieldResult.isValid(), fieldResult.getViolations().size());
            }

            log.debug("所有字段验证完成: entityType={}, totalFields={}, valid={}, totalViolations={}",
                    entityType, newFields.size(), aggregatedResult.isValid(),
                    aggregatedResult.getViolations().size());

            return aggregatedResult;

        } catch (Exception e) {
            log.error("字段规则验证异常: entityType={}, error={}", entityType, e.getMessage(), e);
            // 验证异常时返回通过，避免阻塞业务（可根据需求调整为验证失败）
            return ValidationResult.builder()
                    .valid(true)
                    .build();
        }
    }
}
