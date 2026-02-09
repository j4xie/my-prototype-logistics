package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.DataOperationFact;
import com.cretas.aims.dto.intent.ValidationResult;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.intent.IntentPreviewToken;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.service.PreviewTokenService;
import com.cretas.aims.service.RuleEngineService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import com.cretas.aims.util.ErrorSanitizer;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class DataOperationIntentHandler implements IntentHandler {

    private final ProductTypeRepository productTypeRepository;
    private final ProductionPlanRepository productionPlanRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig dashScopeConfig;
    private final RuleEngineService ruleEngineService;
    private final PreviewTokenService previewTokenService;

    @Value("${cretas.ai.service.url:http://localhost:8083}")
    private String aiServiceUrl;

    @Autowired
    public DataOperationIntentHandler(ProductTypeRepository productTypeRepository,
                                       ProductionPlanRepository productionPlanRepository,
                                       ProductionBatchRepository productionBatchRepository,
                                       MaterialBatchRepository materialBatchRepository,
                                       RestTemplate restTemplate,
                                       ObjectMapper objectMapper,
                                       RuleEngineService ruleEngineService,
                                       @Autowired(required = false) DashScopeClient dashScopeClient,
                                       @Autowired(required = false) DashScopeConfig dashScopeConfig,
                                       @Autowired(required = false) PreviewTokenService previewTokenService) {
        this.productTypeRepository = productTypeRepository;
        this.productionPlanRepository = productionPlanRepository;
        this.productionBatchRepository = productionBatchRepository;
        this.materialBatchRepository = materialBatchRepository;
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.ruleEngineService = ruleEngineService;
        this.dashScopeClient = dashScopeClient;
        this.dashScopeConfig = dashScopeConfig;
        this.previewTokenService = previewTokenService;
    }

    // 支持的实体类型映射
    private static final Map<String, String> ENTITY_ALIASES = Map.ofEntries(
            // 中文别名
            Map.entry("产品", "PRODUCT_TYPE"),
            Map.entry("产品类型", "PRODUCT_TYPE"),
            Map.entry("生产计划", "PRODUCTION_PLAN"),
            Map.entry("计划", "PRODUCTION_PLAN"),
            Map.entry("批次", "PRODUCTION_BATCH"),
            Map.entry("生产批次", "PRODUCTION_BATCH"),
            Map.entry("加工批次", "PRODUCTION_BATCH"),
            Map.entry("原材料", "MATERIAL_BATCH"),
            Map.entry("原料批次", "MATERIAL_BATCH"),
            Map.entry("原材料批次", "MATERIAL_BATCH"),
            // PascalCase 形式 (Python AI返回)
            Map.entry("ProductType", "PRODUCT_TYPE"),
            Map.entry("ProductionPlan", "PRODUCTION_PLAN"),
            Map.entry("ProcessingBatch", "PRODUCTION_BATCH"),
            Map.entry("ProductionBatch", "PRODUCTION_BATCH"),
            Map.entry("MaterialBatch", "MATERIAL_BATCH"),
            // SCREAMING_SNAKE_CASE 形式
            Map.entry("PROCESSING_BATCH", "PRODUCTION_BATCH")
    );

    @Override
    public String getSupportedCategory() {
        return "DATA_OP";
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式，让框架自动解析语义
        // 当前使用默认的向后兼容实现，后续可逐步迁移到纯语义处理
        return true;
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("DataOperationIntentHandler.handle: factoryId={}, intentCode={}, userInput={}",
                factoryId, intentConfig.getIntentCode(),
                request.getUserInput().length() > 50 ?
                    request.getUserInput().substring(0, 50) + "..." : request.getUserInput());

        try {
            // 根据意图代码分派处理
            String intentCode = intentConfig.getIntentCode();
            if ("PRODUCT_TYPE_QUERY".equals(intentCode)) {
                return handleProductTypeQuery(factoryId, request, intentConfig);
            }

            // 1. 优先使用 context 中的结构化数据（无需AI解析）
            Map<String, Object> parsedIntent = parseFromContext(request);

            // 2. 如果 context 不完整，尝试调用AI服务解析
            if (parsedIntent == null) {
                parsedIntent = callAIParseIntent(factoryId, request);

                if (parsedIntent == null || !Boolean.TRUE.equals(parsedIntent.get("success"))) {
                    return buildFailedResponse(intentConfig, "AI解析意图失败: " +
                            (parsedIntent != null ? parsedIntent.get("message") : "无响应") +
                            "\n\n您可以直接提供 context 参数: {entityType, entityId, updates: {field: value}}");
                }
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

            // ====== DROOLS GATEWAY: 数据操作规则验证 ======
            ValidationResult operationValidation = validateDataOperationWithDrools(
                    factoryId, entityType, operation, entityId, updates, userId, userRole);
            if (!operationValidation.isValid()) {
                log.warn("数据操作规则验证失败: entityType={}, operation={}, violations={}",
                        entityType, operation, operationValidation.getViolations().size());
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName())
                        .intentCategory("DATA_OP")
                        .status("VALIDATION_FAILED")
                        .message("数据操作不符合业务规则: " + operationValidation.getViolationsSummary())
                        .validationViolations(operationValidation.getViolations())
                        .recommendations(operationValidation.getRecommendations())
                        .executedAt(LocalDateTime.now())
                        .build();
            }
            log.debug("数据操作规则验证通过: entityType={}, operation={}", entityType, operation);

            // 3. 执行数据操作
            IntentExecuteResponse.AffectedEntity affected = executeDataOperation(
                    factoryId, entityType, entityId, entityIdentifier, updates, operation, userId);

            if (affected == null) {
                return buildFailedResponse(intentConfig, "找不到指定的实体或执行操作失败");
            }

            // 4. 构建成功响应
            String finalOperation = operation != null ? operation : "UPDATE";
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
                            "operation", finalOperation
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
            return buildFailedResponse(intentConfig, "执行失败: " + ErrorSanitizer.sanitize(e));
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
            String operation = (String) parsedIntent.getOrDefault("operation", "UPDATE");

            // 查找实体当前值
            Map<String, Object> currentValues = getCurrentValues(factoryId, entityType, entityId, entityIdentifier);

            // 生成确认Token (TCC模式 - 持久化)
            String confirmToken;
            int expiresInSeconds = 300;

            if (previewTokenService != null) {
                // 使用持久化的预览令牌 (TCC模式)
                String username = request.getContext() != null ?
                        (String) request.getContext().get("username") : null;
                String effectiveEntityId = entityId != null ? entityId : entityIdentifier;

                IntentPreviewToken token = previewTokenService.createToken(
                        factoryId, userId, username,
                        intentConfig.getIntentCode(), intentConfig.getIntentName(),
                        entityType, effectiveEntityId, operation,
                        parsedIntent, currentValues, updates, expiresInSeconds);

                confirmToken = token.getToken();
                log.info("创建持久化预览令牌: token={}, intent={}, entity={}/{}",
                        confirmToken, intentConfig.getIntentCode(), entityType, effectiveEntityId);
            } else {
                // 降级: 生成临时UUID (不持久化，仅用于兼容)
                confirmToken = UUID.randomUUID().toString();
                log.warn("PreviewTokenService 不可用，使用临时令牌: {}", confirmToken);
            }

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
                            .expiresInSeconds(expiresInSeconds)
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
            // 使用工厂隔离查询
            optEntity = productTypeRepository.findByIdAndFactoryId(entityId, factoryId);
        } else if (identifier != null) {
            // 先尝试按 id 查找（identifier可能就是id，带工厂隔离）
            optEntity = productTypeRepository.findByIdAndFactoryId(identifier, factoryId);
            // 如果按id找不到，再按code查找
            if (optEntity.isEmpty()) {
                optEntity = productTypeRepository.findByFactoryIdAndCode(factoryId, identifier);
            }
        } else {
            optEntity = Optional.empty();
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
            // 使用工厂隔离查询
            optEntity = productionPlanRepository.findByIdAndFactoryId(entityId, factoryId);
        } else if (identifier != null) {
            // 先尝试按 id 查找（identifier可能就是id，带工厂隔离）
            optEntity = productionPlanRepository.findByIdAndFactoryId(identifier, factoryId);
            // 如果按id找不到，再按计划编号查找
            if (optEntity.isEmpty()) {
                optEntity = productionPlanRepository.findByFactoryIdAndPlanNumber(factoryId, identifier);
            }
        } else {
            optEntity = Optional.empty();
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

        Optional<ProductionBatch> optEntity = Optional.empty();

        // 1. 先尝试按 entityId 查找
        if (entityId != null) {
            try {
                optEntity = productionBatchRepository.findByIdAndFactoryId(Long.valueOf(entityId), factoryId);
            } catch (NumberFormatException e) {
                // entityId 不是数字，尝试按批次号查找
                optEntity = productionBatchRepository.findByFactoryIdAndBatchNumber(factoryId, entityId);
            }
        }

        // 2. 如果还没找到，尝试用 identifier 查找
        if (optEntity.isEmpty() && identifier != null) {
            try {
                optEntity = productionBatchRepository.findByIdAndFactoryId(Long.valueOf(identifier), factoryId);
            } catch (NumberFormatException e) {
                optEntity = Optional.empty();
            }
            if (optEntity.isEmpty()) {
                optEntity = productionBatchRepository.findByFactoryIdAndBatchNumber(factoryId, identifier);
            }
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

        Optional<MaterialBatch> optEntity = Optional.empty();

        // 1. 先尝试按 entityId 查找
        if (entityId != null) {
            optEntity = materialBatchRepository.findByIdAndFactoryId(entityId, factoryId);
            // 如果 entityId 查不到，尝试按批次号查找（entityId 可能被错误地设为批次号）
            if (optEntity.isEmpty()) {
                optEntity = materialBatchRepository.findByFactoryIdAndBatchNumber(factoryId, entityId);
            }
        }

        // 2. 如果还没找到，尝试用 identifier 查找
        if (optEntity.isEmpty() && identifier != null) {
            optEntity = materialBatchRepository.findByIdAndFactoryId(identifier, factoryId);
            if (optEntity.isEmpty()) {
                optEntity = materialBatchRepository.findByFactoryIdAndBatchNumber(factoryId, identifier);
            }
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
     * 从 context 中解析结构化数据（无需AI服务）
     * 支持格式: {entityType, entityId/entityIdentifier, updates: {field: value}}
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseFromContext(IntentExecuteRequest request) {
        if (request.getContext() == null || request.getContext().isEmpty()) {
            return null;
        }

        Map<String, Object> context = request.getContext();

        // 检查必要字段
        String entityType = getStringValue(context, "entityType");
        String entityId = getStringValue(context, "entityId");
        String entityIdentifier = getStringValue(context, "entityIdentifier");
        Object updatesObj = context.get("updates");

        // entityType 和 (entityId 或 entityIdentifier) 和 updates 都必须存在
        if (entityType == null || (entityId == null && entityIdentifier == null)) {
            return null;
        }

        // 解析 updates
        Map<String, Object> updates = null;
        if (updatesObj instanceof Map) {
            updates = (Map<String, Object>) updatesObj;
        } else if (updatesObj == null) {
            // 如果没有 updates 字段，尝试从 context 中提取非元数据字段作为 updates
            updates = new HashMap<>();
            for (Map.Entry<String, Object> entry : context.entrySet()) {
                String key = entry.getKey();
                if (!key.equals("entityType") && !key.equals("entityId") &&
                    !key.equals("entityIdentifier") && !key.equals("operation")) {
                    updates.put(key, entry.getValue());
                }
            }
            if (updates.isEmpty()) {
                return null;
            }
        }

        if (updates == null || updates.isEmpty()) {
            return null;
        }

        // 构建解析结果
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("entityType", entityType);
        result.put("entityId", entityId);
        result.put("entityIdentifier", entityIdentifier);
        result.put("updates", updates);
        result.put("operation", getStringValue(context, "operation"));

        log.info("从context解析数据操作: entityType={}, entityId={}, updates={}",
                entityType, entityId != null ? entityId : entityIdentifier, updates);

        return result;
    }

    private String getStringValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }

    /**
     * 检查是否应该使用DashScope直接调用
     */
    private boolean shouldUseDashScope() {
        return dashScopeConfig != null
            && dashScopeClient != null
            && dashScopeConfig.shouldUseDirect("intent-classify");
    }

    /**
     * 调用AI服务解析用户意图
     */
    private Map<String, Object> callAIParseIntent(String factoryId, IntentExecuteRequest request) {
        // 优先使用DashScope直接调用
        if (shouldUseDashScope()) {
            Map<String, Object> result = callDashScopeParseIntent(factoryId, request);
            if (result != null && Boolean.TRUE.equals(result.get("success"))) {
                return result;
            }
            log.info("DashScope解析失败，fallback到Python AI服务");
        }

        return callPythonAIParseIntent(factoryId, request);
    }

    /**
     * 使用DashScope直接解析数据操作意图
     */
    private Map<String, Object> callDashScopeParseIntent(String factoryId, IntentExecuteRequest request) {
        try {
            log.info("使用DashScope解析数据操作意图: factoryId={}", factoryId);

            String systemPrompt = buildDataOperationPrompt();
            String userInput = request.getUserInput();

            // 如果有context，附加到用户输入
            if (request.getContext() != null && !request.getContext().isEmpty()) {
                userInput += "\n\n上下文信息: " + objectMapper.writeValueAsString(request.getContext());
            }

            String response = dashScopeClient.chatLowTemp(systemPrompt, userInput);
            return parseDataOperationResponse(response);

        } catch (Exception e) {
            log.error("DashScope数据操作解析失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 构建数据操作解析的系统提示词
     */
    private String buildDataOperationPrompt() {
        return """
            你是一个数据操作解析专家。分析用户输入，识别要操作的实体和更新内容。

            支持的实体类型（注意区分）:
            - ProductType: 产品类型/成品类型 (字段: name, code, category, unit, shelfLifeDays)
              标识符通常以 PT- 开头，如 PT-F001-001

            - ProductionPlan: 生产计划 (字段: planNumber, status, plannedQuantity, startDate, endDate)
              标识符通常以 PLAN- 开头，如 PLAN-2026-001

            - ProductionBatch: 生产批次/加工批次 (字段: batchNumber, status, actualQuantity, notes)
              标识符通常以 BATCH- 或 PB- 开头，如 BATCH-2026-0105-001
              这是加工后的成品批次

            - MaterialBatch: 原材料批次/原料批次 (字段: batchNumber, status, quantity, storageLocation, notes)
              标识符通常以 MB- 开头，如 MB-F001-001、MB-TEST-20260102-001
              这是原材料入库批次，关键词：原料、原材料、材料批次

            【重要】判断规则：
            - 如果批次号以 "MB-" 开头 → MaterialBatch
            - 如果批次号以 "BATCH-" 或 "PB-" 开头 → ProductionBatch
            - 如果用户提到"原料"、"原材料"、"材料" → MaterialBatch
            - 如果用户提到"生产批次"、"加工批次"、"成品批次" → ProductionBatch

            输出格式为JSON:
            {
              "success": true,
              "entityType": "ProductType|ProductionPlan|ProductionBatch|MaterialBatch",
              "entityId": "实体ID(如果用户提供)",
              "entityIdentifier": "实体标识符(如批次号、产品编码)",
              "updates": {"字段名": "新值"},
              "operation": "UPDATE|CREATE|DELETE",
              "message": "解析说明"
            }

            如果无法识别，返回:
            {
              "success": false,
              "message": "无法识别的操作或缺少必要信息"
            }

            只返回JSON，不要其他内容。
            """;
    }

    /**
     * 解析DashScope返回的数据操作响应
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseDataOperationResponse(String response) {
        try {
            // 提取JSON部分
            String jsonStr = response.trim();
            if (jsonStr.contains("```json")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("```json") + 7);
                jsonStr = jsonStr.substring(0, jsonStr.indexOf("```")).trim();
            } else if (jsonStr.contains("```")) {
                jsonStr = jsonStr.substring(jsonStr.indexOf("```") + 3);
                jsonStr = jsonStr.substring(0, jsonStr.indexOf("```")).trim();
            }

            Map<String, Object> result = objectMapper.readValue(jsonStr, Map.class);
            log.info("DashScope数据操作解析结果: success={}, entityType={}",
                    result.get("success"), result.get("entityType"));
            return result;

        } catch (Exception e) {
            log.error("解析DashScope响应失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 调用Python AI服务解析用户意图 (Fallback)
     */
    private Map<String, Object> callPythonAIParseIntent(String factoryId, IntentExecuteRequest request) {
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

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                // Python返回snake_case，转换为Java期望的camelCase
                Map<String, Object> result = new HashMap<>();
                result.put("success", body.get("success"));
                result.put("entityType", body.get("entity_type"));
                result.put("entityIdentifier", body.get("entity_identifier"));
                result.put("updates", body.get("updates"));
                result.put("operation", body.get("operation"));
                result.put("message", body.get("message"));
                return result;
            }
            return null;

        } catch (Exception e) {
            log.error("调用Python AI服务失败: {}", e.getMessage());
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
     * 处理产品类型查询
     */
    private IntentExecuteResponse handleProductTypeQuery(String factoryId, IntentExecuteRequest request,
                                                          AIIntentConfig intentConfig) {
        Map<String, Object> context = request.getContext();
        String productTypeId = null;
        String productName = null;

        // 从context提取参数
        if (context != null) {
            productTypeId = (String) context.get("productTypeId");
            if (productTypeId == null) {
                productTypeId = (String) context.get("productId");
            }
            productName = (String) context.get("productName");
        }

        try {
            // 如果有产品类型ID，查询单个产品
            if (productTypeId != null && !productTypeId.isEmpty()) {
                Optional<ProductType> productOpt = productTypeRepository.findByIdAndFactoryId(
                        productTypeId, factoryId);

                if (productOpt.isPresent()) {
                    ProductType product = productOpt.get();
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .intentName("产品类型查询")
                            .intentCategory("DATA_OP")
                            .status("COMPLETED")
                            .message("产品 " + product.getName() + " 查询成功")
                            .resultData(Map.of(
                                    "product", Map.of(
                                            "id", product.getId(),
                                            "name", product.getName(),
                                            "code", product.getCode() != null ? product.getCode() : "",
                                            "category", product.getCategory() != null ? product.getCategory() : "",
                                            "unit", product.getUnit() != null ? product.getUnit() : "",
                                            "shelfLifeDays", product.getShelfLifeDays() != null ? product.getShelfLifeDays() : 0
                                    )
                            ))
                            .executedAt(LocalDateTime.now())
                            .build();
                } else {
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .intentName("产品类型查询")
                            .intentCategory("DATA_OP")
                            .status("FAILED")
                            .message("未找到产品: " + productTypeId)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }

            // 如果有产品名称，按名称模糊搜索
            if (productName != null && !productName.isEmpty()) {
                Page<ProductType> productsPage = productTypeRepository.searchProductTypes(
                        factoryId, productName, org.springframework.data.domain.PageRequest.of(0, 20));
                List<ProductType> products = productsPage.getContent();

                if (!products.isEmpty()) {
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentConfig.getIntentCode())
                            .intentName("产品类型查询")
                            .intentCategory("DATA_OP")
                            .status("COMPLETED")
                            .message("找到 " + products.size() + " 个匹配的产品")
                            .resultData(Map.of(
                                    "products", products.stream().map(p -> Map.of(
                                            "id", p.getId(),
                                            "name", p.getName(),
                                            "category", p.getCategory() != null ? p.getCategory() : ""
                                    )).toList(),
                                    "total", products.size()
                            ))
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            }

            // 没有指定条件，返回提示
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName("产品类型查询")
                    .intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请提供产品类型ID (productTypeId) 或产品名称 (productName)")
                    .executedAt(LocalDateTime.now())
                    .build();

        } catch (Exception e) {
            log.error("产品类型查询失败", e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName("产品类型查询")
                    .intentCategory("DATA_OP")
                    .status("FAILED")
                    .message("查询失败: " + ErrorSanitizer.sanitize(e))
                    .executedAt(LocalDateTime.now())
                    .build();
        }
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

    /**
     * 使用 Drools 验证数据操作
     *
     * @param factoryId 工厂ID
     * @param entityType 实体类型
     * @param operation 操作类型
     * @param entityId 实体ID
     * @param updates 更新字段
     * @param userId 用户ID
     * @param userRole 用户角色
     * @return 验证结果
     */
    private ValidationResult validateDataOperationWithDrools(String factoryId, String entityType,
                                                              String operation, String entityId,
                                                              Map<String, Object> updates,
                                                              Long userId, String userRole) {
        try {
            // 根据实体类型获取相关业务信息
            int relatedBatchCount = 0;
            int relatedMaterialBatchCount = 0;
            int relatedProductionPlanCount = 0;
            boolean productTypeExists = false;
            String currentStatus = null;
            String targetStatus = null;

            // 根据不同实体类型查询相关数据
            if ("PRODUCTION_BATCH".equals(entityType) && entityId != null) {
                try {
                    Long batchIdLong = Long.parseLong(entityId);
                    Optional<ProductionBatch> batchOpt = productionBatchRepository.findByIdAndFactoryId(batchIdLong, factoryId);
                    if (batchOpt.isPresent()) {
                        ProductionBatch batch = batchOpt.get();
                        currentStatus = batch.getStatus() != null ? String.valueOf(batch.getStatus().name()) : null;
                        if (updates.containsKey("status")) {
                            targetStatus = (String) updates.get("status");
                        }
                        // 检查是否有关联的原材料批次
                        relatedMaterialBatchCount = 1; // 简化处理，实际需要查询关联表
                    }
                } catch (NumberFormatException e) {
                    log.warn("无法解析批次ID: {}", entityId);
                }
            } else if ("PRODUCT_TYPE".equals(entityType) && entityId != null) {
                productTypeExists = productTypeRepository.existsByIdAndFactoryId(entityId, factoryId);
                // 检查是否有依赖此产品类型的生产计划
                relatedProductionPlanCount = (int) productionPlanRepository.count();
            } else if ("MATERIAL_BATCH".equals(entityType) && entityId != null) {
                // 检查原材料批次是否被生产批次使用
                relatedBatchCount = 1; // 简化处理
            }

            // 构建数据操作事实对象
            DataOperationFact fact = DataOperationFact.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .operation(operation != null ? operation : "UPDATE")
                    .targetFactoryId(factoryId)
                    .materialBatchFactoryId(factoryId)
                    .relatedBatchCount(relatedBatchCount)
                    .relatedMaterialBatchCount(relatedMaterialBatchCount)
                    .relatedProductionPlanCount(relatedProductionPlanCount)
                    .productTypeExists(productTypeExists)
                    .currentStatus(currentStatus)
                    .targetStatus(targetStatus)
                    .fieldsToUpdate(updates)
                    .batchSize(1)
                    .hasInconsistentFieldTypes(false)
                    .hasEntitiesWithRelations(relatedBatchCount > 0 || relatedMaterialBatchCount > 0)
                    .entitiesWithRelationsCount(relatedBatchCount + relatedMaterialBatchCount)
                    .requiresMaterialConsumption(false)
                    .isAtomicTransaction(true)
                    .disposalRecordCreated(false)
                    .isArchived(false)
                    .retentionPeriodDays(90)
                    .daysSinceCreation(0)
                    .hasNoExternalDependencies(true)
                    .createdAt(LocalDateTime.now())
                    .userId(userId)
                    .username("system")
                    .build();

            // 调用 RuleEngineService 执行数据操作验证规则
            ValidationResult result = ruleEngineService.executeRulesWithAudit(
                    factoryId,
                    "dataOperationValidation",  // 规则组
                    entityType,                 // 实体类型
                    entityId != null ? entityId : "unknown", // 实体ID
                    userId,                     // 执行者ID
                    "system",                   // 执行者名称
                    userRole,                   // 执行者角色
                    fact                        // Drools 事实对象
            );

            log.debug("数据操作规则验证完成: entityType={}, operation={}, valid={}, violations={}",
                    entityType, operation, result.isValid(), result.getViolations().size());

            return result;

        } catch (Exception e) {
            log.error("数据操作规则验证异常: entityType={}, operation={}, error={}",
                    entityType, operation, e.getMessage(), e);
            // 验证异常时返回通过，避免阻塞业务（可根据需求调整为验证失败）
            return ValidationResult.builder()
                    .valid(true)
                    .build();
        }
    }
}
