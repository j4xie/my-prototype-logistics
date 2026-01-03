package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 数据操作意图处理器
 *
 * 处理 DATA_OP 分类的意图:
 * - BATCH_UPDATE: 修改批次信息
 * - PRODUCT_UPDATE: 修改产品信息
 * - PLAN_UPDATE: 修改生产计划
 * - STATUS_CHANGE: 变更状态
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataOperationIntentHandler implements IntentHandler {

    private final ProductTypeRepository productTypeRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${cretas.ai.service.url:http://localhost:8085}")
    private String aiServiceUrl;

    // 支持的实体类型映射
    private static final Map<String, String> ENTITY_ALIASES = Map.ofEntries(
            Map.entry("产品", "PRODUCT_TYPE"),
            Map.entry("产品类型", "PRODUCT_TYPE"),
            Map.entry("生产计划", "PRODUCTION_PLAN"),
            Map.entry("计划", "PRODUCTION_PLAN"),
            Map.entry("批次", "PRODUCTION_BATCH"),
            Map.entry("生产批次", "PRODUCTION_BATCH"),
            Map.entry("加工批次", "PRODUCTION_BATCH"),
            Map.entry("PROCESSING_BATCH", "PRODUCTION_BATCH"),
            Map.entry("ProcessingBatch", "PRODUCTION_BATCH"),
            Map.entry("原材料", "MATERIAL_BATCH"),
            Map.entry("原料批次", "MATERIAL_BATCH"),
            Map.entry("原材料批次", "MATERIAL_BATCH")
    );

    @Override
    public String getSupportedCategory() {
        return "DATA_OP";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("DataOperationIntentHandler.handle: factoryId={}, intentCode={}, userInput={}",
                factoryId, intentConfig.getIntentCode(),
                request.getUserInput().length() > 50 ?
                    request.getUserInput().substring(0, 50) + "..." : request.getUserInput());

        try {
            // 1. 调用AI服务解析用户意图
            Map<String, Object> parsedIntent = callAIParseIntent(factoryId, request);

            if (parsedIntent == null || !Boolean.TRUE.equals(parsedIntent.get("success"))) {
                return buildFailedResponse(intentConfig, "AI解析意图失败: " +
                        (parsedIntent != null ? parsedIntent.get("message") : "无响应"));
            }

            // 2. 提取解析结果
            String entityType = (String) parsedIntent.get("entityType");
            String entityId = (String) parsedIntent.get("entityId");
            String entityIdentifier = (String) parsedIntent.get("entityIdentifier"); // 如批次号
            Map<String, Object> updates = (Map<String, Object>) parsedIntent.get("updates");
            String operation = (String) parsedIntent.getOrDefault("operation", "UPDATE");

            if (entityType == null || (entityId == null && entityIdentifier == null)) {
                return buildFailedResponse(intentConfig,
                        "无法识别要操作的实体，请提供更具体的信息（如批次号、产品ID等）");
            }

            if (updates == null || updates.isEmpty()) {
                return buildFailedResponse(intentConfig, "未识别到要修改的内容");
            }

            // 3. 执行数据操作
            IntentExecuteResponse.AffectedEntity affected = executeDataOperation(
                    factoryId, entityType, entityId, entityIdentifier, updates, operation, userId);

            if (affected == null) {
                return buildFailedResponse(intentConfig, "找不到指定的实体或执行操作失败");
            }

            // 4. 构建成功响应
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("DATA_OP")
                    .sensitivityLevel(intentConfig.getSensitivityLevel())
                    .status("COMPLETED")
                    .message("成功更新了 " + affected.getEntityName())
                    .quotaCost(intentConfig.getQuotaCost())
                    .resultData(Map.of(
                            "entityType", entityType,
                            "entityId", affected.getEntityId(),
                            "updates", updates,
                            "operation", operation
                    ))
                    .affectedEntities(List.of(affected))
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(List.of(
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("VIEW_ENTITY")
                                    .actionName("查看详情")
                                    .description("查看更新后的数据")
                                    .endpoint(buildViewEndpoint(factoryId, entityType, affected.getEntityId()))
                                    .build(),
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("UNDO")
                                    .actionName("撤销修改")
                                    .description("恢复到修改前的状态")
                                    .parameters(Map.of("previousValues", affected.getChanges()))
                                    .build()
                    ))
                    .build();

        } catch (Exception e) {
            log.error("DataOperationIntentHandler执行失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "执行失败: " + e.getMessage());
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("DataOperationIntentHandler.preview: factoryId={}, userInput={}",
                factoryId, request.getUserInput());

        try {
            // 调用AI服务解析用户意图
            Map<String, Object> parsedIntent = callAIParseIntent(factoryId, request);

            if (parsedIntent == null || !Boolean.TRUE.equals(parsedIntent.get("success"))) {
                return buildFailedResponse(intentConfig, "AI解析意图失败");
            }

            String entityType = (String) parsedIntent.get("entityType");
            String entityId = (String) parsedIntent.get("entityId");
            String entityIdentifier = (String) parsedIntent.get("entityIdentifier");
            Map<String, Object> updates = (Map<String, Object>) parsedIntent.get("updates");

            // 查找实体当前值
            Map<String, Object> currentValues = getCurrentValues(factoryId, entityType, entityId, entityIdentifier);

            // 生成确认Token
            String confirmToken = UUID.randomUUID().toString();

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("DATA_OP")
                    .status("PREVIEW")
                    .message("预览修改内容，确认后将更新数据")
                    .resultData(Map.of(
                            "entityType", entityType,
                            "entityId", entityId != null ? entityId : entityIdentifier,
                            "currentValues", currentValues,
                            "newValues", updates
                    ))
                    .confirmableAction(IntentExecuteResponse.ConfirmableAction.builder()
                            .confirmToken(confirmToken)
                            .description("确认修改 " + entityType + " 的数据")
                            .expiresInSeconds(300)
                            .previewData(parsedIntent)
                            .build())
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("DataOperationIntentHandler预览失败: {}", e.getMessage(), e);
            return buildFailedResponse(intentConfig, "预览失败: " + e.getMessage());
        }
    }

    // ==================== 核心操作方法 ====================

    /**
     * 执行数据操作
     */
    private IntentExecuteResponse.AffectedEntity executeDataOperation(
            String factoryId, String entityType, String entityId, String entityIdentifier,
            Map<String, Object> updates, String operation, Long userId) {

        String normalizedType = normalizeEntityType(entityType);

        switch (normalizedType) {
            case "PRODUCT_TYPE":
                return updateProductType(factoryId, entityId, entityIdentifier, updates);
            case "PRODUCTION_PLAN":
                return updateProductionPlan(factoryId, entityId, entityIdentifier, updates);
            case "PRODUCTION_BATCH":
                return updateProductionBatch(factoryId, entityId, entityIdentifier, updates);
            case "MATERIAL_BATCH":
                return updateMaterialBatch(factoryId, entityId, entityIdentifier, updates);
            default:
                log.warn("不支持的实体类型: {}", entityType);
                return null;
        }
    }

    /**
     * 更新产品类型
     */
    private IntentExecuteResponse.AffectedEntity updateProductType(
            String factoryId, String entityId, String identifier, Map<String, Object> updates) {

        Optional<ProductType> optEntity;
        if (entityId != null) {
            optEntity = productTypeRepository.findById(entityId);
        } else {
            // 按产品代码查找
            optEntity = productTypeRepository.findByFactoryIdAndCode(factoryId, identifier);
        }

        if (optEntity.isEmpty()) {
            log.warn("ProductType not found: id={}, identifier={}", entityId, identifier);
            return null;
        }

        ProductType entity = optEntity.get();
        Map<String, Object> oldValues = new HashMap<>();

        // 应用更新
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String field = entry.getKey();
            Object newValue = entry.getValue();
            Object oldValue = getFieldValue(entity, field);
            oldValues.put(field, oldValue);
            setFieldValue(entity, field, newValue);
        }

        productTypeRepository.save(entity);
        log.info("更新ProductType成功: id={}, updates={}", entity.getId(), updates);

        return IntentExecuteResponse.AffectedEntity.builder()
                .entityType("ProductType")
                .entityId(entity.getId())
                .entityName(entity.getName())
                .action("UPDATED")
                .changes(Map.of("oldValues", oldValues, "newValues", updates))
                .build();
    }

    /**
     * 更新生产计划
     */
    private IntentExecuteResponse.AffectedEntity updateProductionPlan(
            String factoryId, String entityId, String identifier, Map<String, Object> updates) {

        Optional<ProductionPlan> optEntity;
        if (entityId != null) {
            optEntity = productionPlanRepository.findById(entityId);
        } else {
            // 按计划编号查找
            optEntity = productionPlanRepository.findByPlanNumber(identifier);
        }

        if (optEntity.isEmpty()) {
            log.warn("ProductionPlan not found: id={}, identifier={}", entityId, identifier);
            return null;
        }

        ProductionPlan entity = optEntity.get();
        Map<String, Object> oldValues = new HashMap<>();

        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String field = entry.getKey();
            Object newValue = entry.getValue();
            Object oldValue = getFieldValue(entity, field);
            oldValues.put(field, oldValue);
            setFieldValue(entity, field, newValue);
        }

        productionPlanRepository.save(entity);
        log.info("更新ProductionPlan成功: id={}, updates={}", entity.getId(), updates);

        return IntentExecuteResponse.AffectedEntity.builder()
                .entityType("ProductionPlan")
                .entityId(entity.getId())
                .entityName(entity.getPlanNumber())
                .action("UPDATED")
                .changes(Map.of("oldValues", oldValues, "newValues", updates))
                .build();
    }

    /**
     * 更新生产批次
     */
    private IntentExecuteResponse.AffectedEntity updateProductionBatch(
            String factoryId, String entityId, String identifier, Map<String, Object> updates) {

        Optional<ProductionBatch> optEntity;
        if (entityId != null) {
            optEntity = productionBatchRepository.findById(Long.valueOf(entityId));
        } else {
            // 按批次号查找
            optEntity = productionBatchRepository.findByBatchNumber(identifier);
        }

        if (optEntity.isEmpty()) {
            log.warn("ProductionBatch not found: id={}, identifier={}", entityId, identifier);
            return null;
        }

        ProductionBatch entity = optEntity.get();
        Map<String, Object> oldValues = new HashMap<>();

        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String field = entry.getKey();
            Object newValue = entry.getValue();
            Object oldValue = getFieldValue(entity, field);
            oldValues.put(field, oldValue);
            setFieldValue(entity, field, newValue);
        }

        productionBatchRepository.save(entity);
        log.info("更新ProductionBatch成功: id={}, updates={}", entity.getId(), updates);

        return IntentExecuteResponse.AffectedEntity.builder()
                .entityType("ProductionBatch")
                .entityId(String.valueOf(entity.getId()))
                .entityName(entity.getBatchNumber())
                .action("UPDATED")
                .changes(Map.of("oldValues", oldValues, "newValues", updates))
                .build();
    }

    /**
     * 更新原材料批次
     */
    private IntentExecuteResponse.AffectedEntity updateMaterialBatch(
            String factoryId, String entityId, String identifier, Map<String, Object> updates) {

        Optional<MaterialBatch> optEntity;
        if (entityId != null) {
            optEntity = materialBatchRepository.findById(entityId);
        } else {
            // 按批次号查找
            optEntity = materialBatchRepository.findByBatchNumber(identifier);
        }

        if (optEntity.isEmpty()) {
            log.warn("MaterialBatch not found: id={}, identifier={}", entityId, identifier);
            return null;
        }

        MaterialBatch entity = optEntity.get();
        Map<String, Object> oldValues = new HashMap<>();

        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String field = entry.getKey();
            Object newValue = entry.getValue();
            Object oldValue = getFieldValue(entity, field);
            oldValues.put(field, oldValue);
            setFieldValue(entity, field, newValue);
        }

        materialBatchRepository.save(entity);
        log.info("更新MaterialBatch成功: id={}, updates={}", entity.getId(), updates);

        return IntentExecuteResponse.AffectedEntity.builder()
                .entityType("MaterialBatch")
                .entityId(entity.getId())
                .entityName(entity.getBatchNumber())
                .action("UPDATED")
                .changes(Map.of("oldValues", oldValues, "newValues", updates))
                .build();
    }

    // ==================== 辅助方法 ====================

    /**
     * 调用AI服务解析用户意图
     */
    private Map<String, Object> callAIParseIntent(String factoryId, IntentExecuteRequest request) {
        try {
            String url = aiServiceUrl + "/api/ai/intent/parse-data-operation";

            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("user_input", request.getUserInput());
            aiRequest.put("factory_id", factoryId);
            aiRequest.put("supported_entities", List.of(
                    "ProductType", "ProductionPlan", "ProcessingBatch", "MaterialBatch"
            ));

            if (request.getContext() != null) {
                aiRequest.put("context", request.getContext());
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
     * 获取实体当前值
     */
    private Map<String, Object> getCurrentValues(String factoryId, String entityType,
                                                   String entityId, String identifier) {
        // 简化实现，返回空Map
        return new HashMap<>();
    }

    /**
     * 标准化实体类型
     */
    private String normalizeEntityType(String entityType) {
        if (entityType == null) return null;

        // 先检查别名
        String aliased = ENTITY_ALIASES.get(entityType);
        if (aliased != null) return aliased;

        // 转大写
        return entityType.toUpperCase().replace(" ", "_");
    }

    /**
     * 构建查看实体的API端点
     */
    private String buildViewEndpoint(String factoryId, String entityType, String entityId) {
        String type = normalizeEntityType(entityType);
        switch (type) {
            case "PRODUCT_TYPE":
                return "/api/mobile/" + factoryId + "/product-types/" + entityId;
            case "PRODUCTION_PLAN":
                return "/api/mobile/" + factoryId + "/production-plans/" + entityId;
            case "PROCESSING_BATCH":
                return "/api/mobile/" + factoryId + "/processing/batches/" + entityId;
            case "MATERIAL_BATCH":
                return "/api/mobile/" + factoryId + "/material-batches/" + entityId;
            default:
                return "/api/mobile/" + factoryId + "/" + entityType.toLowerCase() + "/" + entityId;
        }
    }

    /**
     * 通过反射获取字段值
     */
    private Object getFieldValue(Object obj, String fieldName) {
        try {
            Field field = findField(obj.getClass(), fieldName);
            if (field != null) {
                field.setAccessible(true);
                return field.get(obj);
            }
        } catch (Exception e) {
            log.warn("获取字段值失败: field={}, error={}", fieldName, e.getMessage());
        }
        return null;
    }

    /**
     * 通过反射设置字段值
     */
    private void setFieldValue(Object obj, String fieldName, Object value) {
        try {
            Field field = findField(obj.getClass(), fieldName);
            if (field != null) {
                field.setAccessible(true);
                Object convertedValue = convertValue(value, field.getType());
                field.set(obj, convertedValue);
            }
        } catch (Exception e) {
            log.warn("设置字段值失败: field={}, value={}, error={}", fieldName, value, e.getMessage());
        }
    }

    /**
     * 递归查找字段（包括父类）
     */
    private Field findField(Class<?> clazz, String fieldName) {
        while (clazz != null) {
            try {
                return clazz.getDeclaredField(fieldName);
            } catch (NoSuchFieldException e) {
                clazz = clazz.getSuperclass();
            }
        }
        return null;
    }

    /**
     * 值类型转换
     */
    private Object convertValue(Object value, Class<?> targetType) {
        if (value == null) return null;

        if (targetType.isAssignableFrom(value.getClass())) {
            return value;
        }

        String strValue = String.valueOf(value);

        if (targetType == Integer.class || targetType == int.class) {
            return Integer.parseInt(strValue);
        } else if (targetType == Long.class || targetType == long.class) {
            return Long.parseLong(strValue);
        } else if (targetType == Double.class || targetType == double.class) {
            return Double.parseDouble(strValue);
        } else if (targetType == BigDecimal.class) {
            return new BigDecimal(strValue);
        } else if (targetType == Boolean.class || targetType == boolean.class) {
            return Boolean.parseBoolean(strValue);
        } else if (targetType == LocalDate.class) {
            return LocalDate.parse(strValue);
        } else if (targetType == LocalDateTime.class) {
            return LocalDateTime.parse(strValue, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (targetType == String.class) {
            return strValue;
        }

        return value;
    }

    /**
     * 构建失败响应
     */
    private IntentExecuteResponse buildFailedResponse(AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("DATA_OP")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }
}
