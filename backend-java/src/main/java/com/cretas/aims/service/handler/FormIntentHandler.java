package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.config.FormTemplate;
import com.cretas.aims.repository.FormTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 表单意图处理器
 *
 * 处理 FORM 分类的意图:
 * - FORM_GENERATION: 生成新字段
 * - FORM_MODIFICATION: 修改现有字段
 * - FORM_VALIDATION: 添加验证规则
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FormIntentHandler implements IntentHandler {

    private final FormTemplateRepository formTemplateRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

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
                    .message("执行失败: " + e.getMessage())
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
                    .message("预览失败: " + e.getMessage())
                    .executedAt(LocalDateTime.now())
                    .build();
        }
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
     */
    private Map<String, Object> callAIGenerateSchema(String factoryId, IntentExecuteRequest request) {
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
            log.error("调用AI服务失败: {}", e.getMessage());
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
}
