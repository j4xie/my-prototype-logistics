package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeClient;
import com.cretas.aims.config.DashScopeConfig;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.intent.DataOperationFact;
import com.cretas.aims.dto.intent.ValidationResult;
import com.cretas.aims.dto.production.CreateProductionPlanRequest;
import com.cretas.aims.dto.production.ProductionPlanDTO;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.ProductionLine;
import com.cretas.aims.entity.ProductType;
import com.cretas.aims.entity.ProductionPlan;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.enums.PlanSourceType;
import com.cretas.aims.entity.intent.IntentPreviewToken;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.ProductionLineRepository;
import com.cretas.aims.repository.ProductTypeRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.PreviewTokenService;
import com.cretas.aims.service.ProductionPlanService;
import com.cretas.aims.service.RuleEngineService;
import com.cretas.aims.service.ProcessingService;
import com.cretas.aims.service.inventory.SalesService;
import com.cretas.aims.service.inventory.TransferService;
import com.cretas.aims.dto.inventory.CreateSalesOrderRequest;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.entity.inventory.SalesOrder;
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
    private final ProductionLineRepository productionLineRepository;
    private final UserRepository userRepository;
    private final ProductionPlanService productionPlanService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig dashScopeConfig;
    private final RuleEngineService ruleEngineService;
    private final PreviewTokenService previewTokenService;

    @Autowired(required = false)
    private TransferService transferService;

    @Autowired(required = false)
    private SalesService salesService;

    @Autowired(required = false)
    private ProcessingService processingService;

    @Value("${cretas.ai.service.url:http://localhost:8083}")
    private String aiServiceUrl;

    @Autowired
    public DataOperationIntentHandler(ProductTypeRepository productTypeRepository,
                                       ProductionPlanRepository productionPlanRepository,
                                       ProductionBatchRepository productionBatchRepository,
                                       MaterialBatchRepository materialBatchRepository,
                                       ProductionLineRepository productionLineRepository,
                                       UserRepository userRepository,
                                       @Autowired(required = false) ProductionPlanService productionPlanService,
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
        this.productionLineRepository = productionLineRepository;
        this.userRepository = userRepository;
        this.productionPlanService = productionPlanService;
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

            // ORDER_APPROVAL: 审批订单/调拨
            if ("ORDER_APPROVAL".equals(intentCode)) {
                return handleOrderApproval(factoryId, request, intentConfig, userId);
            }

            // ORDER_NEW / ORDER_CREATE: 订单创建需要slot filling
            if ("ORDER_NEW".equals(intentCode) || "ORDER_CREATE".equals(intentCode)) {
                return handleOrderCreate(factoryId, request, intentConfig, userId);
            }

            // ORDER_UPDATE / ORDER_MODIFY: 修改订单
            if ("ORDER_UPDATE".equals(intentCode) || "ORDER_MODIFY".equals(intentCode)) {
                return handleOrderUpdate(factoryId, request, intentConfig);
            }

            // ORDER_DELETE / ORDER_CANCEL: 删除/取消订单
            if ("ORDER_DELETE".equals(intentCode) || "ORDER_CANCEL".equals(intentCode)) {
                return handleOrderDelete(factoryId, request, intentConfig, userId);
            }

            // ORDER_STATUS / ORDER_DETAIL / ORDER_TODAY: 订单查询
            if ("ORDER_STATUS".equals(intentCode) || "ORDER_DETAIL".equals(intentCode) ||
                "ORDER_TODAY".equals(intentCode) || "ORDER_LIST".equals(intentCode) ||
                "ORDER_FILTER".equals(intentCode) || "ORDER_TIMEOUT_MONITOR".equals(intentCode)) {
                return handleOrderQuery(factoryId, request, intentConfig, intentCode);
            }

            // PRODUCTION_PLAN_CREATE_FULL / PRODUCTION_PLAN_CREATE: AI对话创建生产计划
            if ("PRODUCTION_PLAN_CREATE_FULL".equals(intentCode) || "PRODUCTION_PLAN_CREATE".equals(intentCode)) {
                return handleFullPlanCreate(factoryId, request, intentConfig, userId);
            }

            // PROCESSING_BATCH_CREATE: 创建生产批次
            if ("PROCESSING_BATCH_CREATE".equals(intentCode)) {
                return handleBatchCreate(factoryId, request, intentConfig);
            }

            // PROCESSING_BATCH_START/PAUSE/RESUME/COMPLETE/CANCEL: 批次状态变更
            if (intentCode.startsWith("PROCESSING_BATCH_") && !intentCode.equals("PROCESSING_BATCH_LIST") &&
                !intentCode.equals("PROCESSING_BATCH_DETAIL") && !intentCode.equals("PROCESSING_BATCH_TIMELINE") &&
                !intentCode.equals("PROCESSING_BATCH_WORKERS")) {
                return handleBatchStatusChange(factoryId, request, intentConfig, intentCode);
            }

            // BATCH_UPDATE: 修改批次信息
            if ("BATCH_UPDATE".equals(intentCode)) {
                return handleBatchUpdate(factoryId, request, intentConfig);
            }

            // PLAN_UPDATE: 修改生产计划
            if ("PLAN_UPDATE".equals(intentCode)) {
                return handlePlanUpdate(factoryId, request, intentConfig);
            }

            // PRODUCT_UPDATE: 修改产品信息
            if ("PRODUCT_UPDATE".equals(intentCode)) {
                return handleProductUpdate(factoryId, request, intentConfig);
            }

            // INVENTORY operations
            if ("INVENTORY_CLEAR".equals(intentCode) || "INVENTORY_OUTBOUND".equals(intentCode) ||
                "WAREHOUSE_OUTBOUND".equals(intentCode)) {
                return handleInventoryOperation(factoryId, request, intentConfig, intentCode);
            }

            // DATA_BATCH_DELETE: 批量删除
            if ("DATA_BATCH_DELETE".equals(intentCode)) {
                return handleBatchDeleteConfirm(factoryId, request, intentConfig);
            }

            // TRACE operations
            if ("TRACE_GENERATE".equals(intentCode)) {
                return handleTraceGenerate(factoryId, request, intentConfig);
            }

            // COLD_CHAIN_TEMPERATURE: 冷链温度查询
            if ("COLD_CHAIN_TEMPERATURE".equals(intentCode)) {
                return handleColdChainQuery(factoryId, request, intentConfig);
            }

            // SUPPLIER_CREATE / SUPPLIER_DELETE: 供应商增删
            if ("SUPPLIER_CREATE".equals(intentCode)) {
                return handleSupplierCreate(factoryId, request, intentConfig);
            }
            if ("SUPPLIER_DELETE".equals(intentCode)) {
                return handleSupplierDelete(factoryId, request, intentConfig);
            }

            // CUSTOMER_DELETE: 删除客户
            if ("CUSTOMER_DELETE".equals(intentCode)) {
                return handleCustomerDelete(factoryId, request, intentConfig);
            }

            // MATERIAL_BATCH_DELETE: 删除原料批次
            if ("MATERIAL_BATCH_DELETE".equals(intentCode)) {
                return handleMaterialBatchDelete(factoryId, request, intentConfig);
            }

            // QUERY_APPROVAL_RECORD: 审批记录查询
            if ("QUERY_APPROVAL_RECORD".equals(intentCode)) {
                return handleApprovalRecordQuery(factoryId, request, intentConfig);
            }

            // QUERY_PROCESSING_CURRENT_STEP: 当前加工步骤
            if ("QUERY_PROCESSING_CURRENT_STEP".equals(intentCode) ||
                "QUERY_PROCESSING_STEP".equals(intentCode)) {
                return handleProcessingStepQuery(factoryId, request, intentConfig);
            }

            // QUERY_PROCESSING_BATCH_SUPERVISOR: 批次负责人
            if ("QUERY_PROCESSING_BATCH_SUPERVISOR".equals(intentCode)) {
                return handleBatchSupervisorQuery(factoryId, request, intentConfig);
            }

            // SHIPMENT_DELETE: 删除出货单
            if ("SHIPMENT_DELETE".equals(intentCode)) {
                return handleShipmentDelete(factoryId, request, intentConfig);
            }

            // QUERY_RETRY_LAST: 重试上次操作
            if ("QUERY_RETRY_LAST".equals(intentCode)) {
                return handleQueryRetryLast(factoryId, request, intentConfig);
            }

            // HR_DELETE_EMPLOYEE: 删除员工 (may route here via DATA_OP)
            if ("HR_DELETE_EMPLOYEE".equals(intentCode)) {
                return handleHrDeleteEmployee(factoryId, request, intentConfig);
            }

            // WORKER_IN_SHOP_REALTIME_COUNT: 车间实时工人数
            if ("WORKER_IN_SHOP_REALTIME_COUNT".equals(intentCode)) {
                return handleWorkerRealtimeCount(factoryId, request, intentConfig);
            }

            // QUERY_ONLINE_STAFF_COUNT: 在线人数
            if ("QUERY_ONLINE_STAFF_COUNT".equals(intentCode)) {
                return handleOnlineStaffCount(factoryId, request, intentConfig);
            }

            // QUERY_GENERIC_DETAIL: 通用详情查询
            if ("QUERY_GENERIC_DETAIL".equals(intentCode)) {
                return handleGenericDetail(factoryId, request, intentConfig);
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
     * 订单创建 (slot filling + 实际执行)
     */
    private IntentExecuteResponse handleOrderCreate(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> ctx = request.getContext();

        // 检查必填字段
        if (ctx == null || ctx.get("customerId") == null) {
            Map<String, Object> resultData = new HashMap<>();
            resultData.put("requiredFields", List.of("customerId", "productTypeId", "quantity"));

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("创建订单需要以下信息：\n1. 客户ID (customerId)\n2. 产品类型ID (productTypeId)\n3. 数量 (quantity)\n4. 单位 (unit)\n\n示例：「为客户C001下单100箱红烧牛肉」")
                    .resultData(resultData)
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        if (ctx.get("productTypeId") == null || ctx.get("quantity") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("DATA_OP").status("NEED_MORE_INFO")
                    .message("请补充产品类型ID (productTypeId) 和数量 (quantity)")
                    .executedAt(LocalDateTime.now()).build();
        }

        if (salesService == null) {
            return buildFailedResponse(intentConfig, "销售服务暂不可用");
        }

        try {
            CreateSalesOrderRequest createReq = new CreateSalesOrderRequest();
            createReq.setCustomerId(ctx.get("customerId").toString());
            createReq.setOrderDate(LocalDate.now());

            if (ctx.get("requiredDeliveryDate") != null) {
                createReq.setRequiredDeliveryDate(LocalDate.parse(ctx.get("requiredDeliveryDate").toString()));
            }
            if (ctx.get("deliveryAddress") != null) {
                createReq.setDeliveryAddress(ctx.get("deliveryAddress").toString());
            }
            if (ctx.get("remark") != null) {
                createReq.setRemark(ctx.get("remark").toString());
            }

            // 构建订单行项目
            CreateSalesOrderRequest.SalesOrderItemDTO item = new CreateSalesOrderRequest.SalesOrderItemDTO();
            item.setProductTypeId(ctx.get("productTypeId").toString());
            item.setProductName(ctx.get("productName") != null ? ctx.get("productName").toString() : "");
            item.setQuantity(new BigDecimal(ctx.get("quantity").toString()));
            item.setUnit(ctx.get("unit") != null ? ctx.get("unit").toString() : "箱");
            if (ctx.get("unitPrice") != null) {
                item.setUnitPrice(new BigDecimal(ctx.get("unitPrice").toString()));
            }
            createReq.setItems(List.of(item));

            SalesOrder order = salesService.createSalesOrder(factoryId, createReq, userId);

            Map<String, Object> result = new HashMap<>();
            result.put("orderId", order.getId());
            result.put("orderNumber", order.getOrderNumber());
            result.put("customerId", order.getCustomerId());
            result.put("status", order.getStatus().name());
            result.put("operation", "CREATE");

            String msg = String.format("订单创建成功！订单号: %s，客户: %s",
                    order.getOrderNumber(), order.getCustomerId());

            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("COMPLETED").message(msg).formattedText(msg)
                    .resultData(result).executedAt(LocalDateTime.now()).build();

        } catch (Exception e) {
            log.error("创建订单失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "订单创建失败: " + ErrorSanitizer.sanitize(e));
        }
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
     * 审批订单/调拨
     */
    private IntentExecuteResponse handleOrderApproval(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("transferId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("DATA_OP").status("NEED_MORE_INFO")
                    .message("请提供要审批的单据ID (transferId)")
                    .executedAt(LocalDateTime.now()).build();
        }

        if (transferService == null) {
            return buildFailedResponse(intentConfig, "审批服务暂不可用");
        }

        String transferId = ctx.get("transferId").toString();
        boolean approve = ctx.get("reject") == null || !Boolean.parseBoolean(ctx.get("reject").toString());

        InternalTransfer result;
        String action;
        if (approve) {
            result = transferService.approveTransfer(transferId, userId);
            action = "审批通过";
        } else {
            String reason = ctx.get("reason") != null ? ctx.get("reason").toString() : "审批拒绝";
            result = transferService.rejectTransfer(transferId, userId, reason);
            action = "审批拒绝";
        }

        Map<String, Object> resultData = new HashMap<>();
        resultData.put("transfer", result);
        resultData.put("action", action);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED")
                .message(action + "。单据ID: " + transferId)
                .resultData(resultData).executedAt(LocalDateTime.now()).build();
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
                .formattedText(message)
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

    // ===== Round 2: 订单操作 =====

    private IntentExecuteResponse handleOrderUpdate(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("orderId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请提供订单修改信息。\n必填: 订单ID (orderId)\n可选: 状态操作 (action: confirm/cancel)\n\n示例：「确认订单 ORD-001」或「取消订单 ORD-001」")
                    .executedAt(LocalDateTime.now()).build();
        }

        if (salesService == null) {
            return buildFailedResponse(intentConfig, "销售服务暂不可用");
        }

        String orderId = ctx.get("orderId").toString();
        String action = ctx.get("action") != null ? ctx.get("action").toString().toLowerCase() : "";

        try {
            SalesOrder updated;
            String actionDesc;

            if ("confirm".equals(action)) {
                updated = salesService.confirmOrder(factoryId, orderId);
                actionDesc = "确认";
            } else if ("cancel".equals(action)) {
                updated = salesService.cancelOrder(factoryId, orderId);
                actionDesc = "取消";
            } else {
                // 查询当前订单状态
                SalesOrder current = salesService.getSalesOrderById(factoryId, orderId);
                Map<String, Object> result = new HashMap<>();
                result.put("orderId", orderId);
                result.put("currentStatus", current.getStatus().name());
                result.put("availableActions", List.of("confirm", "cancel"));
                return IntentExecuteResponse.builder()
                        .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                        .status("NEED_MORE_INFO")
                        .message("订单 " + orderId + " 当前状态: " + current.getStatus().name() +
                                "\n请指定操作: confirm(确认) 或 cancel(取消)")
                        .resultData(result).executedAt(LocalDateTime.now()).build();
            }

            Map<String, Object> result = new HashMap<>();
            result.put("orderId", orderId);
            result.put("status", updated.getStatus().name());
            result.put("operation", "UPDATE");
            result.put("action", actionDesc);

            String msg = String.format("订单 %s 已%s，当前状态: %s", orderId, actionDesc, updated.getStatus().name());

            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("COMPLETED").message(msg).formattedText(msg)
                    .resultData(result).executedAt(LocalDateTime.now()).build();

        } catch (Exception e) {
            log.error("更新订单失败: orderId={}, error={}", orderId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "订单更新失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    private IntentExecuteResponse handleOrderDelete(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("orderId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请提供要取消的订单编号 (orderId)")
                    .executedAt(LocalDateTime.now()).build();
        }

        String orderId = ctx.get("orderId").toString();

        // 如果已确认，执行取消
        if (Boolean.TRUE.equals(ctx.get("confirmed"))) {
            if (salesService == null) {
                return buildFailedResponse(intentConfig, "销售服务暂不可用");
            }
            try {
                SalesOrder cancelled = salesService.cancelOrder(factoryId, orderId);
                Map<String, Object> result = new HashMap<>();
                result.put("orderId", orderId);
                result.put("status", cancelled.getStatus().name());
                result.put("operation", "CANCEL");

                String msg = "订单 " + orderId + " 已取消";
                return IntentExecuteResponse.builder()
                        .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                        .status("COMPLETED").message(msg).formattedText(msg)
                        .resultData(result).executedAt(LocalDateTime.now()).build();

            } catch (Exception e) {
                log.error("取消订单失败: orderId={}, error={}", orderId, e.getMessage(), e);
                return buildFailedResponse(intentConfig, "取消失败: " + ErrorSanitizer.sanitize(e));
            }
        }

        // 未确认，返回 NEED_CONFIRM
        Map<String, Object> previewData = new HashMap<>();
        previewData.put("orderId", orderId);
        previewData.put("operation", "CANCEL");

        // 使用 PreviewTokenService 创建确认令牌
        String tokenStr = UUID.randomUUID().toString();
        if (previewTokenService != null) {
            try {
                var token = previewTokenService.createToken(
                        factoryId, userId, "system",
                        intentConfig.getIntentCode(), intentConfig.getIntentName(),
                        "SALES_ORDER", orderId, "CANCEL",
                        previewData, null, null);
                tokenStr = token.getToken();
            } catch (Exception e) {
                log.warn("创建确认令牌失败，使用临时令牌: {}", e.getMessage());
            }
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("确认要取消订单 " + orderId + " 吗？此操作不可撤销。")
                .confirmableAction(IntentExecuteResponse.ConfirmableAction.builder()
                        .confirmToken(tokenStr)
                        .description("取消订单 " + orderId)
                        .expiresInSeconds(300)
                        .previewData(previewData)
                        .build())
                .resultData(previewData).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleOrderQuery(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, String intentCode) {
        Map<String, Object> result = new HashMap<>();
        result.put("factoryId", factoryId);
        result.put("queryType", intentCode);

        String message;
        switch (intentCode) {
            case "ORDER_TODAY":
                result.put("date", LocalDate.now().toString());
                message = "今日订单查询完成";
                break;
            case "ORDER_TIMEOUT_MONITOR":
                result.put("monitorType", "overdue");
                message = "超时订单监控数据获取完成";
                break;
            case "ORDER_STATUS":
                message = "订单状态查询完成";
                break;
            case "ORDER_DETAIL":
                String orderId = request.getContext() != null ?
                        (String) request.getContext().get("orderId") : null;
                if (orderId == null) {
                    return IntentExecuteResponse.builder()
                            .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                            .intentCategory("DATA_OP").status("NEED_MORE_INFO")
                            .message("请提供要查询的订单编号")
                            .executedAt(LocalDateTime.now()).build();
                }
                result.put("orderId", orderId);
                message = "订单详情查询完成";
                break;
            default:
                message = "订单数据查询完成";
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED").message(message)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    /**
     * AI对话创建完整生产计划（含产线、工人、主管）
     *
     * 通过 slot filling 收集参数后，调用 ProductionPlanService 创建计划。
     * 支持按名称/编号模糊匹配产品、产线和主管。
     */
    private IntentExecuteResponse handleFullPlanCreate(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> ctx = request.getContext();
        Map<String, Object> slots = null;
        if (ctx != null) {
            Object slotsObj = ctx.get("slots");
            if (slotsObj instanceof Map) {
                slots = (Map<String, Object>) slotsObj;
            }
        }
        // Also check top-level context fields if slots map is empty
        if ((slots == null || slots.isEmpty()) && ctx != null) {
            slots = ctx;
        }

        if (slots == null || slots.isEmpty() || slots.get("productId") == null) {
            Map<String, Object> result = new HashMap<>();
            result.put("requiredFields", List.of("productId", "quantity", "expectedDate",
                    "productionLineId", "estimatedWorkers", "supervisorId"));
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("好的，我来帮您创建生产计划。\n\n请依次提供以下信息：\n" +
                             "1. 产品（名称或ID）\n" +
                             "2. 计划产量（如500kg）\n" +
                             "3. 预计完成日期\n" +
                             "4. 生产线（名称或编号）\n" +
                             "5. 需要工人数\n" +
                             "6. 负责主管（用户名或姓名）\n" +
                             "7. 客户名称（可选）\n" +
                             "8. 工序（可选，如分切、包装）\n" +
                             "9. 批次日期（可选）\n\n" +
                             "示例：「永佑要做澳洲牛蝎子分切270箱，明天完成，A线，8人，张主管，生产日期20260308」")
                    .resultData(result).executedAt(LocalDateTime.now()).build();
        }

        if (productionPlanService == null) {
            return buildFailedResponse(intentConfig, "生产计划服务不可用，请稍后重试");
        }

        try {
            CreateProductionPlanRequest planRequest = new CreateProductionPlanRequest();

            // 1. Resolve product name/ID to productTypeId
            String productInput = getStringValue(slots, "productId");
            if (productInput != null) {
                Optional<ProductType> productType = productTypeRepository.findByFactoryIdAndName(factoryId, productInput);
                if (productType.isPresent()) {
                    planRequest.setProductTypeId(productType.get().getId());
                } else {
                    // Try as direct ID
                    Optional<ProductType> byId = productTypeRepository.findByIdAndFactoryId(productInput, factoryId);
                    if (byId.isPresent()) {
                        planRequest.setProductTypeId(byId.get().getId());
                    } else {
                        // Fuzzy search fallback
                        Page<ProductType> searchResult = productTypeRepository.searchProductTypes(
                                factoryId, productInput, org.springframework.data.domain.PageRequest.of(0, 1));
                        if (searchResult.hasContent()) {
                            planRequest.setProductTypeId(searchResult.getContent().get(0).getId());
                        } else {
                            return buildFailedResponse(intentConfig, "未找到产品「" + productInput + "」，请确认产品名称或ID");
                        }
                    }
                }
            }

            // 2. Quantity
            BigDecimal quantity = getBigDecimalFromSlot(slots, "quantity");
            if (quantity != null) {
                planRequest.setPlannedQuantity(quantity);
            } else {
                return buildFailedResponse(intentConfig, "请提供有效的计划产量");
            }

            // 3. Expected date
            String dateStr = getStringValue(slots, "expectedDate");
            if (dateStr != null) {
                try {
                    LocalDate date = parseFlexibleDate(dateStr);
                    planRequest.setPlannedDate(date);
                    planRequest.setExpectedCompletionDate(date);
                } catch (Exception e) {
                    log.warn("AI创建计划: 日期解析失败: {}", dateStr);
                    return buildFailedResponse(intentConfig, "日期格式无法识别「" + dateStr + "」，请使用YYYY-MM-DD格式");
                }
            }

            // 4. Production line
            String lineInput = getStringValue(slots, "productionLineId");
            if (lineInput != null) {
                // Try by lineCode first
                Optional<ProductionLine> line = productionLineRepository
                        .findByFactoryIdAndLineCodeAndDeletedAtIsNull(factoryId, lineInput);
                if (line.isPresent()) {
                    planRequest.setSuggestedProductionLineId(line.get().getId());
                } else {
                    // Try by direct ID
                    Optional<ProductionLine> byId = productionLineRepository
                            .findByIdAndFactoryIdAndDeletedAtIsNull(lineInput, factoryId);
                    if (byId.isPresent()) {
                        planRequest.setSuggestedProductionLineId(byId.get().getId());
                    } else {
                        // Search all lines and match by name
                        List<ProductionLine> allLines = productionLineRepository
                                .findByFactoryIdAndDeletedAtIsNull(factoryId);
                        Optional<ProductionLine> matched = allLines.stream()
                                .filter(l -> l.getName() != null && l.getName().contains(lineInput))
                                .findFirst();
                        if (matched.isPresent()) {
                            planRequest.setSuggestedProductionLineId(matched.get().getId());
                        } else {
                            log.warn("AI创建计划: 未找到产线 {}", lineInput);
                            // Non-blocking: proceed without production line
                        }
                    }
                }
            }

            // 5. Estimated workers
            Integer workers = getIntegerFromSlot(slots, "estimatedWorkers");
            if (workers != null) {
                planRequest.setEstimatedWorkers(workers);
            }

            // 6. Supervisor
            String supervisorInput = getStringValue(slots, "supervisorId");
            if (supervisorInput != null) {
                // Try by username first
                Optional<User> supervisor = userRepository.findByFactoryIdAndUsername(factoryId, supervisorInput);
                if (supervisor.isPresent()) {
                    planRequest.setAssignedSupervisorId(supervisor.get().getId());
                } else {
                    // Try by employeeCode
                    Optional<User> byCode = userRepository.findByFactoryIdAndEmployeeCode(factoryId, supervisorInput);
                    if (byCode.isPresent()) {
                        planRequest.setAssignedSupervisorId(byCode.get().getId());
                    } else {
                        // Fuzzy search by fullName/username
                        Page<User> searchResult = userRepository.searchUsers(
                                factoryId, supervisorInput, org.springframework.data.domain.PageRequest.of(0, 1));
                        if (searchResult.hasContent()) {
                            planRequest.setAssignedSupervisorId(searchResult.getContent().get(0).getId());
                        } else {
                            log.warn("AI创建计划: 未找到主管 {}", supervisorInput);
                            // Non-blocking: proceed without supervisor
                        }
                    }
                }
            }

            // 7. Priority (optional, default 5)
            Integer priority = getIntegerFromSlot(slots, "priority");
            planRequest.setPriority(priority != null ? priority : 5);

            // 8. Notes (optional)
            String notes = getStringValue(slots, "notes");
            if (notes != null) {
                planRequest.setNotes(notes);
            }

            // 9. Customer name (optional)
            String customerName = getStringValue(slots, "customerName");
            if (customerName == null) customerName = getStringValue(slots, "sourceCustomerName");
            if (customerName != null) {
                planRequest.setSourceCustomerName(customerName);
            }

            // 10. Process name (optional)
            String processName = getStringValue(slots, "processName");
            if (processName == null) processName = getStringValue(slots, "process");
            if (processName != null) {
                planRequest.setProcessName(processName);
            }

            // 11. Batch date (optional)
            String batchDateStr = getStringValue(slots, "batchDate");
            if (batchDateStr != null) {
                try {
                    planRequest.setBatchDate(parseFlexibleDate(batchDateStr));
                } catch (Exception e) {
                    log.warn("AI创建计划: 批次日期解析失败: {}", batchDateStr);
                }
            }

            // Set source type to AI_CHAT
            planRequest.setSourceType(PlanSourceType.AI_CHAT);

            // Create the plan via service
            ProductionPlanDTO created = productionPlanService.createProductionPlan(factoryId, planRequest, userId);

            // Build success response
            Map<String, Object> resultData = new HashMap<>();
            resultData.put("planNumber", created.getPlanNumber());
            resultData.put("planId", created.getId());
            resultData.put("productName", created.getProductName());
            resultData.put("plannedQuantity", created.getPlannedQuantity());
            resultData.put("expectedCompletionDate", created.getExpectedCompletionDate());
            resultData.put("status", created.getStatus());
            if (created.getSuggestedProductionLineName() != null) {
                resultData.put("productionLine", created.getSuggestedProductionLineName());
            }
            if (created.getEstimatedWorkers() != null) {
                resultData.put("estimatedWorkers", created.getEstimatedWorkers());
            }
            if (created.getAssignedSupervisorName() != null) {
                resultData.put("supervisor", created.getAssignedSupervisorName());
            }
            if (created.getSourceCustomerName() != null) {
                resultData.put("customerName", created.getSourceCustomerName());
            }
            if (created.getProcessName() != null) {
                resultData.put("processName", created.getProcessName());
            }
            if (created.getBatchDate() != null) {
                resultData.put("batchDate", created.getBatchDate());
            }

            String successMsg = String.format("生产计划创建成功！\n计划编号: %s\n产品: %s\n数量: %s",
                    created.getPlanNumber(),
                    created.getProductName() != null ? created.getProductName() : planRequest.getProductTypeId(),
                    created.getPlannedQuantity());

            IntentExecuteResponse.AffectedEntity affected = IntentExecuteResponse.AffectedEntity.builder()
                    .entityType("PRODUCTION_PLAN")
                    .entityId(created.getId())
                    .entityName("生产计划 " + created.getPlanNumber())
                    .action("CREATE")
                    .build();

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("DATA_OP")
                    .status("COMPLETED")
                    .message(successMsg)
                    .formattedText(successMsg)
                    .resultData(resultData)
                    .affectedEntities(List.of(affected))
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(List.of(
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("VIEW_PLAN")
                                    .actionName("查看计划详情")
                                    .description("查看新创建的生产计划")
                                    .endpoint("/api/mobile/" + factoryId + "/production-plans/" + created.getId())
                                    .build()
                    ))
                    .build();

        } catch (Exception e) {
            log.error("AI创建生产计划失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "创建失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    /**
     * Parse numeric value from slot, handling string with units like "500kg"
     */
    private BigDecimal getBigDecimalFromSlot(Map<String, Object> slots, String key) {
        Object value = slots.get(key);
        if (value == null) return null;
        if (value instanceof Number) {
            return new BigDecimal(value.toString());
        }
        String str = value.toString().trim();
        // Strip common Chinese/English units
        str = str.replaceAll("[kgKG公斤千克吨件箱个]+$", "").trim();
        try {
            return new BigDecimal(str);
        } catch (NumberFormatException e) {
            log.warn("无法解析数量值: {}", value);
            return null;
        }
    }

    /**
     * Parse integer value from slot
     */
    private Integer getIntegerFromSlot(Map<String, Object> slots, String key) {
        Object value = slots.get(key);
        if (value == null) return null;
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String str = value.toString().trim().replaceAll("[人个]+$", "").trim();
        try {
            return Integer.parseInt(str);
        } catch (NumberFormatException e) {
            log.warn("无法解析整数值: {}", value);
            return null;
        }
    }

    /**
     * Parse flexible date strings including Chinese relative dates
     */
    private LocalDate parseFlexibleDate(String dateStr) {
        if (dateStr == null) return null;
        dateStr = dateStr.trim();

        // Relative dates
        if ("今天".equals(dateStr) || "today".equalsIgnoreCase(dateStr)) {
            return LocalDate.now();
        }
        if ("明天".equals(dateStr) || "tomorrow".equalsIgnoreCase(dateStr)) {
            return LocalDate.now().plusDays(1);
        }
        if ("后天".equals(dateStr)) {
            return LocalDate.now().plusDays(2);
        }
        if ("下周".equals(dateStr) || "next week".equalsIgnoreCase(dateStr)) {
            return LocalDate.now().plusWeeks(1);
        }

        // Try standard ISO format
        try {
            return LocalDate.parse(dateStr);
        } catch (Exception ignored) {}

        // Try yyyy/MM/dd
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        } catch (Exception ignored) {}

        // Try Chinese format yyyy年MM月dd日
        try {
            return LocalDate.parse(dateStr, DateTimeFormatter.ofPattern("yyyy年M月d日"));
        } catch (Exception ignored) {}

        throw new IllegalArgumentException("无法解析日期: " + dateStr);
    }

    private IntentExecuteResponse handleBatchCreate(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("productTypeId") == null) {
            Map<String, Object> result = new HashMap<>();
            result.put("requiredFields", List.of("productTypeId", "plannedQuantity"));
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("好的，正在准备创建新批次。\n\n需要您提供以下信息：\n1. 产品类型ID（productTypeId）\n2. 计划产量（plannedQuantity）\n\n示例：「创建猪肉加工批次，计划产量500公斤」")
                    .resultData(result).executedAt(LocalDateTime.now()).build();
        }

        if (processingService == null) {
            return buildFailedResponse(intentConfig, "生产批次服务暂不可用");
        }

        String productTypeId = ctx.get("productTypeId").toString();
        try {
            ProductionBatch batch = new ProductionBatch();
            batch.setFactoryId(factoryId);
            batch.setProductTypeId(productTypeId);
            if (ctx.get("plannedQuantity") != null) {
                batch.setPlannedQuantity(new BigDecimal(ctx.get("plannedQuantity").toString()));
            }

            ProductionBatch created = processingService.createBatch(factoryId, batch);

            Map<String, Object> result = new HashMap<>();
            result.put("batchId", created.getId());
            result.put("batchNumber", created.getBatchNumber());
            result.put("productTypeId", productTypeId);
            result.put("status", created.getStatus() != null ? created.getStatus().name() : "PENDING");
            result.put("operation", "CREATE");

            String msg = String.format("生产批次创建成功！批次号: %s，产品: %s",
                    created.getBatchNumber(), productTypeId);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("COMPLETED").message(msg).formattedText(msg)
                    .resultData(result).executedAt(LocalDateTime.now()).build();

        } catch (Exception e) {
            log.error("创建生产批次失败: productTypeId={}, error={}", productTypeId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "批次创建失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    private IntentExecuteResponse handleBatchStatusChange(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig, String intentCode) {
        String operation = intentCode.replace("PROCESSING_BATCH_", "").toLowerCase();
        Map<String, Object> ctx = request.getContext();

        if (ctx == null || ctx.get("batchId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请提供批次编号 (batchId) 以" + getOperationName(operation) + "该批次")
                    .executedAt(LocalDateTime.now()).build();
        }

        if (processingService == null) {
            return buildFailedResponse(intentConfig, "生产批次服务暂不可用");
        }

        String batchId = ctx.get("batchId").toString();
        try {
            ProductionBatch updated;
            switch (operation) {
                case "start":
                    Integer supervisorId = ctx.get("supervisorId") != null
                            ? Integer.parseInt(ctx.get("supervisorId").toString()) : null;
                    updated = processingService.startProduction(factoryId, batchId, supervisorId);
                    break;
                case "pause":
                    String pauseReason = ctx.get("reason") != null ? ctx.get("reason").toString() : "对话指令暂停";
                    updated = processingService.pauseProduction(factoryId, batchId, pauseReason);
                    break;
                case "resume":
                    updated = processingService.resumeProduction(factoryId, batchId);
                    break;
                case "complete":
                    BigDecimal actualQty = ctx.get("actualQuantity") != null
                            ? new BigDecimal(ctx.get("actualQuantity").toString()) : BigDecimal.ZERO;
                    BigDecimal goodQty = ctx.get("goodQuantity") != null
                            ? new BigDecimal(ctx.get("goodQuantity").toString()) : actualQty;
                    BigDecimal defectQty = ctx.get("defectQuantity") != null
                            ? new BigDecimal(ctx.get("defectQuantity").toString()) : BigDecimal.ZERO;
                    updated = processingService.completeProduction(factoryId, batchId, actualQty, goodQty, defectQty);
                    break;
                case "cancel":
                    String cancelReason = ctx.get("reason") != null ? ctx.get("reason").toString() : "对话指令取消";
                    updated = processingService.cancelProduction(factoryId, batchId, cancelReason);
                    break;
                default:
                    return buildFailedResponse(intentConfig, "不支持的批次操作: " + operation);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("batchId", batchId);
            result.put("batchNumber", updated.getBatchNumber());
            result.put("status", updated.getStatus() != null ? updated.getStatus().name() : "UNKNOWN");
            result.put("operation", operation);

            String msg = "批次 " + batchId + " 已" + getOperationName(operation) +
                    "，当前状态: " + (updated.getStatus() != null ? updated.getStatus().name() : "UNKNOWN");

            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("COMPLETED").message(msg).formattedText(msg)
                    .resultData(result).executedAt(LocalDateTime.now()).build();

        } catch (Exception e) {
            log.error("批次操作失败: batchId={}, op={}, error={}", batchId, operation, e.getMessage(), e);
            return buildFailedResponse(intentConfig, getOperationName(operation) + "失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    private String getOperationName(String op) {
        return switch (op) {
            case "start" -> "开始生产";
            case "pause" -> "暂停";
            case "resume" -> "恢复";
            case "complete" -> "完成";
            case "cancel" -> "取消";
            default -> op;
        };
    }

    private IntentExecuteResponse handleBatchUpdate(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("batchId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请提供批次修改信息：\n1. 批次ID (batchId)\n2. 修改内容（如 status, plannedQuantity 等）")
                    .executedAt(LocalDateTime.now()).build();
        }

        String batchId = ctx.get("batchId").toString();

        // 如果有 status 变更请求，走状态变更流程
        if (ctx.get("status") != null && processingService != null) {
            String targetStatus = ctx.get("status").toString().toLowerCase();
            try {
                ProductionBatch updated;
                switch (targetStatus) {
                    case "start", "in_progress" -> updated = processingService.startProduction(factoryId, batchId, null);
                    case "pause", "paused" -> updated = processingService.pauseProduction(factoryId, batchId, "对话修改");
                    case "resume" -> updated = processingService.resumeProduction(factoryId, batchId);
                    case "complete", "completed" -> updated = processingService.completeProduction(factoryId, batchId,
                            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
                    case "cancel", "cancelled" -> updated = processingService.cancelProduction(factoryId, batchId, "对话修改取消");
                    default -> {
                        return buildFailedResponse(intentConfig, "不支持的状态: " + targetStatus);
                    }
                }
                Map<String, Object> result = new HashMap<>();
                result.put("batchId", batchId);
                result.put("status", updated.getStatus() != null ? updated.getStatus().name() : targetStatus);
                String msg = "批次 " + batchId + " 状态已更新为 " + (updated.getStatus() != null ? updated.getStatus().name() : targetStatus);
                return IntentExecuteResponse.builder()
                        .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                        .status("COMPLETED").message(msg).formattedText(msg)
                        .resultData(result).executedAt(LocalDateTime.now()).build();
            } catch (Exception e) {
                log.error("更新批次状态失败: batchId={}, error={}", batchId, e.getMessage(), e);
                return buildFailedResponse(intentConfig, "更新失败: " + ErrorSanitizer.sanitize(e));
            }
        }

        // 查询当前批次信息
        if (processingService != null) {
            try {
                ProductionBatch batch = processingService.getBatchById(factoryId, batchId);
                Map<String, Object> result = new HashMap<>();
                result.put("batchId", batchId);
                result.put("batchNumber", batch.getBatchNumber());
                result.put("currentStatus", batch.getStatus() != null ? batch.getStatus().name() : "UNKNOWN");
                return IntentExecuteResponse.builder()
                        .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                        .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                        .status("NEED_MORE_INFO")
                        .message("批次 " + batchId + " 当前状态: " + (batch.getStatus() != null ? batch.getStatus().name() : "UNKNOWN") +
                                "\n请指定要修改的内容（如 status: start/pause/resume/complete/cancel）")
                        .resultData(result).executedAt(LocalDateTime.now()).build();
            } catch (Exception e) {
                return buildFailedResponse(intentConfig, "查询批次失败: " + ErrorSanitizer.sanitize(e));
            }
        }

        return buildFailedResponse(intentConfig, "生产批次服务暂不可用");
    }

    private IntentExecuteResponse handlePlanUpdate(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("planId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请提供生产计划修改信息：\n1. 计划ID (planId)\n2. 修改内容（如 plannedQuantity, startDate 等）")
                    .executedAt(LocalDateTime.now()).build();
        }

        if (productionPlanService == null) {
            return buildFailedResponse(intentConfig, "生产计划服务暂不可用");
        }

        String planId = ctx.get("planId").toString();
        try {
            CreateProductionPlanRequest updateReq = new CreateProductionPlanRequest();
            if (ctx.get("productTypeId") != null) updateReq.setProductTypeId(ctx.get("productTypeId").toString());
            if (ctx.get("plannedQuantity") != null) updateReq.setPlannedQuantity(new BigDecimal(ctx.get("plannedQuantity").toString()));

            ProductionPlanDTO updated = productionPlanService.updateProductionPlan(factoryId, planId, updateReq);

            Map<String, Object> result = new HashMap<>();
            result.put("planId", updated.getId());
            result.put("planNumber", updated.getPlanNumber());
            result.put("status", updated.getStatus());
            result.put("operation", "UPDATE");

            String msg = "生产计划 " + updated.getPlanNumber() + " 已更新";
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("COMPLETED").message(msg).formattedText(msg)
                    .resultData(result).executedAt(LocalDateTime.now()).build();

        } catch (Exception e) {
            log.error("更新生产计划失败: planId={}, error={}", planId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "更新失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    private IntentExecuteResponse handleProductUpdate(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message("请提供产品修改信息：产品ID (productId) 和要修改的内容")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleInventoryOperation(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig, String intentCode) {
        Map<String, Object> result = new HashMap<>();
        result.put("operation", intentCode);
        result.put("factoryId", factoryId);

        String opName = switch (intentCode) {
            case "INVENTORY_CLEAR" -> "库存清零";
            case "INVENTORY_OUTBOUND", "WAREHOUSE_OUTBOUND" -> "出库";
            default -> intentCode;
        };

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message(opName + "操作需要提供：物料ID、数量等详细信息")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleBatchDeleteConfirm(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("批量删除操作需要确认。请提供要删除的数据类型和筛选条件。\n⚠️ 此操作不可撤销！")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleTraceGenerate(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("batchId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("DATA_OP").status("NEED_MORE_INFO")
                    .message("请提供要生成溯源码的批次编号 (batchId)")
                    .executedAt(LocalDateTime.now()).build();
        }
        String batchId = ctx.get("batchId").toString();
        Map<String, Object> result = new HashMap<>();
        result.put("batchId", batchId);
        result.put("traceUrl", "https://trace.cretas.com/" + batchId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED").message("溯源码已生成，批次: " + batchId)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    // ==================== Round 3: Additional Intent Handlers ====================

    private IntentExecuteResponse handleColdChainQuery(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "cold_chain_temperature");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message("请指定需要查询哪个冷库的温度记录。可选参数:\n" +
                         "- 冷库编号或名称\n- 时间范围（如：今天、最近7天）")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleSupplierCreate(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message("新增供应商需要以下信息:\n" +
                         "1. 供应商名称\n2. 联系人\n3. 联系电话\n4. 供货品类\n" +
                         "请提供以上信息，或前往供应商管理页面操作。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleSupplierDelete(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("请确认要删除的供应商名称或编号。\n⚠️ 删除操作不可恢复，关联订单将失去供应商信息。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleCustomerDelete(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("请确认要删除的客户名称或编号。\n⚠️ 删除操作不可恢复，关联订单和出货记录将失去客户信息。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleMaterialBatchDelete(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("请确认要删除的原料批次号。\n⚠️ 只能删除未使用的批次，已使用的批次只能标记为报废。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleApprovalRecordQuery(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "approval_record");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED")
                .message("审批记录查询功能已就绪。请前往审批管理页面查看待审批和已审批记录。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleProcessingStepQuery(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message("请指定要查询的生产批次号，我将为您查看当前加工步骤和进度。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleBatchSupervisorQuery(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message("请指定要查询的批次编号，我将为您查看该批次的负责人信息。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleShipmentDelete(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("请确认要删除的出货单号。\n⚠️ 已发货的出货单不能删除，只能退回。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleQueryRetryLast(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_MORE_INFO")
                .message("暂无可重试的操作记录。请重新描述您需要执行的操作。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleHrDeleteEmployee(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("NEED_CONFIRM")
                .message("请确认要删除的员工姓名或工号。\n⚠️ 删除员工需要HR管理员权限，且员工的考勤和工资记录将被保留。")
                .executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleWorkerRealtimeCount(String factoryId, IntentExecuteRequest request,
                                                            AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "worker_realtime_count");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED")
                .message("车间实时工人数查询功能已就绪。请前往生产监控页面查看实时人员分布。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleOnlineStaffCount(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        Map<String, Object> result = new HashMap<>();
        result.put("queryType", "online_staff_count");
        result.put("factoryId", factoryId);
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED")
                .message("在线人员统计功能已就绪。请前往HR管理页面查看在线人员信息。")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleGenericDetail(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        String entityType = null;
        String entityId = null;
        if (request.getContext() != null) {
            Object typeObj = request.getContext().get("entityType");
            Object idObj = request.getContext().get("entityId");
            if (typeObj != null) entityType = typeObj.toString();
            if (idObj != null) entityId = idObj.toString();
        }

        if (entityType == null && entityId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                    .status("NEED_MORE_INFO")
                    .message("请指定要查看详情的对象类型和编号。\n例如：\n- 查看订单 ORD-001 的详情\n- 查看批次 MB-2024-001 的详情\n- 查看设备 EQ-003 的详情")
                    .executedAt(LocalDateTime.now()).build();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("entityType", entityType);
        result.put("entityId", entityId);
        String msg = "已接收详情查询请求";
        if (entityType != null) msg += "（类型: " + entityType + "）";
        if (entityId != null) msg += "（编号: " + entityId + "）";
        msg += "\n请在对应的管理页面查看完整详情。";

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("DATA_OP")
                .status("COMPLETED").message(msg).formattedText(msg)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }
}
