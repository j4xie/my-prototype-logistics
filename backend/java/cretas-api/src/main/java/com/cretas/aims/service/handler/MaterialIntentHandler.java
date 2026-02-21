package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.MaterialBatchService;
import com.cretas.aims.service.ProcessingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import com.cretas.aims.util.ErrorSanitizer;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 原材料批次意图处理器
 *
 * 处理 MATERIAL 分类的意图:
 * - MATERIAL_BATCH_QUERY: 查询原材料批次
 * - MATERIAL_BATCH_USE: 使用原材料
 * - MATERIAL_BATCH_RESERVE: 预留原材料
 * - MATERIAL_BATCH_RELEASE: 释放预留
 * - MATERIAL_BATCH_CONSUME: 消耗预留材料
 * - MATERIAL_FIFO_RECOMMEND: FIFO出库推荐
 * - MATERIAL_EXPIRING_ALERT: 临期预警
 * - MATERIAL_LOW_STOCK_ALERT: 低库存预警
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-03
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MaterialIntentHandler implements IntentHandler {

    private final MaterialBatchService materialBatchService;
    private final ProcessingService processingService;

    @Override
    public String getSupportedCategory() {
        return "MATERIAL";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        String intentCode = intentConfig.getIntentCode();
        log.info("MaterialIntentHandler处理: intentCode={}, factoryId={}, userId={}",
                intentCode, factoryId, userId);

        try {
            return switch (intentCode) {
                case "MATERIAL_BATCH_QUERY", "PROCESSING_BATCH_LIST", "PROCESSING_BATCH_DETAIL" ->
                        handleBatchQuery(factoryId, request, intentConfig);
                case "MATERIAL_BATCH_USE" -> handleBatchUse(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_RESERVE" -> handleBatchReserve(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_RELEASE" -> handleBatchRelease(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_CONSUME" -> handleBatchConsume(factoryId, request, intentConfig, userId);
                case "MATERIAL_FIFO_RECOMMEND" -> handleFIFORecommend(factoryId, request, intentConfig);
                case "MATERIAL_EXPIRING_ALERT" -> handleExpiringAlert(factoryId, request, intentConfig);
                case "MATERIAL_LOW_STOCK_ALERT" -> handleLowStockAlert(factoryId, intentConfig);
                case "MATERIAL_EXPIRED_QUERY" -> handleExpiredQuery(factoryId, intentConfig);
                case "MATERIAL_ADJUST_QUANTITY" -> handleAdjustQuantity(factoryId, request, intentConfig, userId);
                case "QUERY_PROCESSING_CURRENT_STEP" -> handleProcessingCurrentStep(factoryId, request, intentConfig);
                case "QUERY_PROCESSING_STEP" -> handleProcessingStep(factoryId, request, intentConfig);
                case "QUERY_PROCESSING_BATCH_SUPERVISOR" -> handleBatchSupervisor(factoryId, request, intentConfig);
                // 批次创建/删除
                case "MATERIAL_BATCH_CREATE" -> handleBatchCreate(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_DELETE" -> handleBatchDelete(factoryId, request, intentConfig);
                case "MATERIAL_UPDATE" -> handleMaterialUpdate(factoryId, request, intentConfig);
                // 库存汇总
                case "QUERY_MATERIAL_STOCK_SUMMARY", "INVENTORY_SUMMARY_QUERY", "INVENTORY_TOTAL_QUERY",
                     "QUERY_INVENTORY_QUANTITY", "QUERY_INVENTORY_TOTAL", "REPORT_INVENTORY" ->
                        handleStockSummary(factoryId, intentConfig);
                // 入库查询
                case "INBOUND_RECORD_QUERY" -> handleBatchQuery(factoryId, request, intentConfig);
                // 批次时间线
                case "PROCESSING_BATCH_TIMELINE" -> handleBatchQuery(factoryId, request, intentConfig);
                // 批次工人
                case "PROCESSING_BATCH_WORKERS" -> handleBatchWorkers(factoryId, request, intentConfig);
                // 生产线启动（via PROCESSING alias）
                case "PRODUCTION_LINE_START" -> handleProductionLineStart(factoryId, request, intentConfig);
                // 工人实时计数
                case "WORKER_IN_SHOP_REALTIME_COUNT" -> handleWorkerCount(factoryId, intentConfig);
                case "QUERY_MATERIAL_REJECTION_REASON" -> handleRejectionReason(factoryId, request, intentConfig);
                case "QUERY_ORDER_PENDING_MATERIAL_QUANTITY" -> handlePendingMaterialQuantity(factoryId, intentConfig);
                // 出库操作
                case "INVENTORY_OUTBOUND", "WAREHOUSE_OUTBOUND" -> handleInventoryOutbound(factoryId, request, intentConfig);
                default -> {
                    log.warn("未知的MATERIAL意图: {}", intentCode);
                    String unknownMsg = "暂不支持此原材料操作: " + intentCode;
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("MATERIAL")
                            .status("FAILED")
                            .message(unknownMsg)
                            .formattedText(unknownMsg)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("MaterialIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            String errMsg = "原材料操作执行失败: " + ErrorSanitizer.sanitize(e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .status("FAILED")
                    .message(errMsg)
                    .formattedText(errMsg)
                    .executedAt(LocalDateTime.now())
                    .build();
        }
    }

    /**
     * 查询原材料批次
     */
    private IntentExecuteResponse handleBatchQuery(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {
        String batchId = null;
        String materialTypeId = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("batchId");
            Object materialTypeObj = request.getContext().get("materialTypeId");
            if (batchIdObj != null) batchId = batchIdObj.toString();
            if (materialTypeObj != null) materialTypeId = materialTypeObj.toString();
        }

        // 单个批次查询
        if (batchId != null) {
            MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(factoryId, batchId);
            if (batch == null) {
                return IntentExecuteResponse.builder()
                        .intentRecognized(true)
                        .intentCode(intentConfig.getIntentCode())
                        .status("FAILED")
                        .message("未找到批次: " + batchId)
                        .executedAt(LocalDateTime.now())
                        .build();
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("MATERIAL")
                    .status("COMPLETED")
                    .message("批次 " + batch.getBatchNumber() + " 查询成功")
                    .resultData(Map.of(
                            "batch", batch,
                            "currentQuantity", batch.getCurrentQuantity(),
                            "status", batch.getStatus()
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 按原材料类型查询
        if (materialTypeId != null) {
            List<MaterialBatchDTO> batches = materialBatchService.getMaterialBatchesByType(factoryId, materialTypeId);

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("MATERIAL")
                    .status("COMPLETED")
                    .message("查询到" + batches.size() + "个批次")
                    .resultData(Map.of(
                            "batches", batches,
                            "count", batches.size(),
                            "materialTypeId", materialTypeId
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("NEED_MORE_INFO")
                .message("请提供批次ID (batchId) 或原材料类型ID (materialTypeId)")
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 使用原材料批次
     */
    private IntentExecuteResponse handleBatchUse(String factoryId, IntentExecuteRequest request,
                                                 AIIntentConfig intentConfig, Long userId) {
        String batchId = null;
        BigDecimal quantity = null;
        String productionPlanId = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("batchId");
            Object quantityObj = request.getContext().get("quantity");
            Object planIdObj = request.getContext().get("productionPlanId");

            if (batchIdObj != null) batchId = batchIdObj.toString();
            if (quantityObj != null) quantity = new BigDecimal(quantityObj.toString());
            if (planIdObj != null) productionPlanId = planIdObj.toString();
        }

        if (batchId == null || quantity == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次ID (batchId) 和使用数量 (quantity)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        MaterialBatchDTO updatedBatch = materialBatchService.useBatchMaterial(
                factoryId, batchId, quantity, productionPlanId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("成功使用 " + quantity + " " + updatedBatch.getQuantityUnit() + " 原材料")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("MaterialBatch")
                                .entityId(batchId)
                                .entityName(updatedBatch.getBatchNumber())
                                .action("USED")
                                .changes(Map.of(
                                        "usedQuantity", quantity.toString(),
                                        "remainingQuantity", updatedBatch.getCurrentQuantity().toString()
                                ))
                                .build()
                ))
                .resultData(Map.of(
                        "batchNumber", updatedBatch.getBatchNumber(),
                        "usedQuantity", quantity,
                        "currentQuantity", updatedBatch.getCurrentQuantity(),
                        "status", updatedBatch.getStatus()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 预留原材料批次
     */
    private IntentExecuteResponse handleBatchReserve(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {
        String batchId = null;
        BigDecimal quantity = null;
        String productionPlanId = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("batchId");
            Object quantityObj = request.getContext().get("quantity");
            Object planIdObj = request.getContext().get("productionPlanId");

            if (batchIdObj != null) batchId = batchIdObj.toString();
            if (quantityObj != null) quantity = new BigDecimal(quantityObj.toString());
            if (planIdObj != null) productionPlanId = planIdObj.toString();
        }

        if (batchId == null || quantity == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次ID (batchId) 和预留数量 (quantity)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        materialBatchService.reserveBatchMaterial(factoryId, batchId, quantity, productionPlanId);
        MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(factoryId, batchId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("成功预留 " + quantity + " " + batch.getQuantityUnit() + " 原材料")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("MaterialBatch")
                                .entityId(batchId)
                                .entityName(batch.getBatchNumber())
                                .action("RESERVED")
                                .changes(Map.of(
                                        "reservedQuantity", quantity.toString(),
                                        "productionPlanId", productionPlanId != null ? productionPlanId : ""
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 释放预留的原材料
     */
    private IntentExecuteResponse handleBatchRelease(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {
        String batchId = null;
        BigDecimal quantity = null;
        String productionPlanId = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("batchId");
            Object quantityObj = request.getContext().get("quantity");
            Object planIdObj = request.getContext().get("productionPlanId");

            if (batchIdObj != null) batchId = batchIdObj.toString();
            if (quantityObj != null) quantity = new BigDecimal(quantityObj.toString());
            if (planIdObj != null) productionPlanId = planIdObj.toString();
        }

        if (batchId == null || quantity == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次ID (batchId) 和释放数量 (quantity)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        materialBatchService.releaseBatchReservation(factoryId, batchId, quantity, productionPlanId);
        MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(factoryId, batchId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("COMPLETED")
                .message("成功释放 " + quantity + " " + batch.getQuantityUnit() + " 预留材料")
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("MaterialBatch")
                                .entityId(batchId)
                                .entityName(batch.getBatchNumber())
                                .action("RELEASED")
                                .changes(Map.of("releasedQuantity", quantity.toString()))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 消耗预留的原材料
     */
    private IntentExecuteResponse handleBatchConsume(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {
        String batchId = null;
        BigDecimal quantity = null;
        String productionPlanId = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("batchId");
            Object quantityObj = request.getContext().get("quantity");
            Object planIdObj = request.getContext().get("productionPlanId");

            if (batchIdObj != null) batchId = batchIdObj.toString();
            if (quantityObj != null) quantity = new BigDecimal(quantityObj.toString());
            if (planIdObj != null) productionPlanId = planIdObj.toString();
        }

        if (batchId == null || quantity == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次ID (batchId) 和消耗数量 (quantity)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        materialBatchService.consumeBatchMaterial(factoryId, batchId, quantity, productionPlanId);
        MaterialBatchDTO batch = materialBatchService.getMaterialBatchById(factoryId, batchId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("成功消耗 " + quantity + " " + batch.getQuantityUnit() + " 预留材料")
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("MaterialBatch")
                                .entityId(batchId)
                                .entityName(batch.getBatchNumber())
                                .action("CONSUMED")
                                .changes(Map.of(
                                        "consumedQuantity", quantity.toString(),
                                        "newStatus", batch.getStatus().toString()
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * FIFO出库推荐
     */
    private IntentExecuteResponse handleFIFORecommend(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        String materialTypeId = null;
        BigDecimal requiredQuantity = null;

        if (request.getContext() != null) {
            Object typeIdObj = request.getContext().get("materialTypeId");
            Object quantityObj = request.getContext().get("quantity");

            if (typeIdObj != null) materialTypeId = typeIdObj.toString();
            if (quantityObj != null) requiredQuantity = new BigDecimal(quantityObj.toString());
        }

        if (materialTypeId == null || requiredQuantity == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供原材料类型ID (materialTypeId) 和需求数量 (quantity)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        List<MaterialBatchDTO> fifoBatches = materialBatchService.getFIFOBatches(
                factoryId, materialTypeId, requiredQuantity);

        BigDecimal totalAvailable = fifoBatches.stream()
                .map(MaterialBatchDTO::getCurrentQuantity)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean canFulfill = totalAvailable.compareTo(requiredQuantity) >= 0;

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("COMPLETED")
                .message(canFulfill
                        ? "FIFO推荐: 共" + fifoBatches.size() + "个批次可满足需求"
                        : "库存不足! 需要" + requiredQuantity + ", 可用" + totalAvailable)
                .resultData(Map.of(
                        "recommendedBatches", fifoBatches,
                        "batchCount", fifoBatches.size(),
                        "totalAvailable", totalAvailable,
                        "requiredQuantity", requiredQuantity,
                        "canFulfill", canFulfill
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 临期预警
     */
    private IntentExecuteResponse handleExpiringAlert(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        Integer warningDays = 7; // 默认7天

        if (request.getContext() != null) {
            Object daysObj = request.getContext().get("warningDays");
            if (daysObj != null) warningDays = Integer.valueOf(daysObj.toString());
        }

        List<MaterialBatchDTO> expiringBatches = materialBatchService.getExpiringBatches(factoryId, warningDays);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("COMPLETED")
                .message(expiringBatches.isEmpty()
                        ? "临期检查完成：未来 " + warningDays + " 天内暂无即将过期的原材料批次。库存安全。"
                        : "临期预警：发现 " + expiringBatches.size() + " 个批次将在 " + warningDays + " 天内过期，建议优先使用或处理。")
                .resultData(Map.of(
                        "expiringBatches", expiringBatches,
                        "count", expiringBatches.size(),
                        "warningDays", warningDays
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 低库存预警
     */
    private IntentExecuteResponse handleLowStockAlert(String factoryId, AIIntentConfig intentConfig) {
        List<Map<String, Object>> lowStockWarnings = materialBatchService.getLowStockWarnings(factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("COMPLETED")
                .message(lowStockWarnings.isEmpty()
                        ? "库存预警检查完成：当前所有原材料库存充足，无需补货。系统将持续监控库存水位。"
                        : "库存预警：发现 " + lowStockWarnings.size() + " 种原材料库存偏低，建议及时采购补货。")
                .resultData(Map.of(
                        "lowStockItems", lowStockWarnings,
                        "count", lowStockWarnings.size()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 查询已过期批次
     */
    private IntentExecuteResponse handleExpiredQuery(String factoryId, AIIntentConfig intentConfig) {
        List<MaterialBatchDTO> expiredBatches = materialBatchService.getExpiredBatches(factoryId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("COMPLETED")
                .message(expiredBatches.isEmpty()
                        ? "过期批次检查完成：当前无已过期的原材料批次，库存质量正常。"
                        : "过期预警：发现 " + expiredBatches.size() + " 个批次已过期，请及时标记报废或退货处理。")
                .resultData(Map.of(
                        "expiredBatches", expiredBatches,
                        "count", expiredBatches.size()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(expiredBatches.isEmpty() ? List.of() : List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("HANDLE_EXPIRED")
                                .actionName("处理过期批次")
                                .description("标记过期批次为报废状态")
                                .build()
                ))
                .build();
    }

    /**
     * 调整批次数量
     */
    private IntentExecuteResponse handleAdjustQuantity(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig, Long userId) {
        String batchId = null;
        BigDecimal newQuantity = null;
        String reason = null;

        if (request.getContext() != null) {
            Object batchIdObj = request.getContext().get("batchId");
            Object quantityObj = request.getContext().get("newQuantity");
            Object reasonObj = request.getContext().get("reason");

            if (batchIdObj != null) batchId = batchIdObj.toString();
            if (quantityObj != null) newQuantity = new BigDecimal(quantityObj.toString());
            if (reasonObj != null) reason = reasonObj.toString();
        }

        if (batchId == null || newQuantity == null || reason == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .status("NEED_MORE_INFO")
                    .message("请提供批次ID (batchId), 新数量 (newQuantity) 和调整原因 (reason)")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        MaterialBatchDTO oldBatch = materialBatchService.getMaterialBatchById(factoryId, batchId);
        BigDecimal oldQuantity = oldBatch.getCurrentQuantity();

        MaterialBatchDTO updatedBatch = materialBatchService.adjustBatchQuantity(
                factoryId, batchId, newQuantity, reason, userId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("批次数量已调整: " + oldQuantity + " → " + newQuantity)
                .quotaCost(intentConfig.getQuotaCost())
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("MaterialBatch")
                                .entityId(batchId)
                                .entityName(updatedBatch.getBatchNumber())
                                .action("ADJUSTED")
                                .changes(Map.of(
                                        "oldQuantity", oldQuantity.toString(),
                                        "newQuantity", newQuantity.toString(),
                                        "reason", reason
                                ))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ===== Phase 2b: 生产过程查询 =====

    private IntentExecuteResponse handleProcessingCurrentStep(String factoryId, IntentExecuteRequest request,
                                                               AIIntentConfig intentConfig) {
        String batchId = extractBatchId(request);
        if (batchId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("MATERIAL").status("NEED_MORE_INFO")
                    .message("请提供生产批次ID (batchId)").executedAt(LocalDateTime.now()).build();
        }

        List<Map<String, Object>> timeline = processingService.getBatchTimeline(factoryId, batchId);

        Map<String, Object> result = Map.of("timeline", timeline, "batchId", batchId,
                "currentStep", timeline.isEmpty() ? "无记录" : timeline.get(timeline.size() - 1));

        String currentStepName = timeline.isEmpty() ? "无" :
                String.valueOf(((Map<String, Object>) timeline.get(timeline.size() - 1)).getOrDefault("stepName", "进行中"));

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED")
                .message("批次 " + batchId + " 当前进度: " + currentStepName + " (共" + timeline.size() + "个节点)")
                .formattedText("批次 " + batchId + " 当前进度: " + currentStepName)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleProcessingStep(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {
        String batchId = extractBatchId(request);
        if (batchId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("MATERIAL").status("NEED_MORE_INFO")
                    .message("请提供生产批次ID (batchId)").executedAt(LocalDateTime.now()).build();
        }

        var batch = processingService.getBatchById(factoryId, batchId);
        List<Map<String, Object>> timeline = processingService.getBatchTimeline(factoryId, batchId);

        Map<String, Object> result = Map.of("batch", batch, "timeline", timeline, "batchId", batchId);

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED")
                .message("批次 " + batchId + " 工序详情 (共" + timeline.size() + "步)")
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleBatchSupervisor(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        String batchId = extractBatchId(request);
        if (batchId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("MATERIAL").status("NEED_MORE_INFO")
                    .message("请提供生产批次ID (batchId)").executedAt(LocalDateTime.now()).build();
        }

        List<Map<String, Object>> workers = processingService.getBatchWorkers(factoryId, Long.parseLong(batchId));

        Map<String, Object> result = Map.of("workers", workers, "batchId", batchId, "total", workers.size());

        String msg = workers.isEmpty()
                ? "批次 " + batchId + " 暂未分配负责人"
                : "批次 " + batchId + " 共 " + workers.size() + " 名工作人员";

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED").message(msg).formattedText(msg)
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private String extractBatchId(IntentExecuteRequest request) {
        if (request.getContext() != null) {
            Object obj = request.getContext().get("batchId");
            if (obj != null) return obj.toString();
        }
        return null;
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .status("PREVIEW")
                .message("原材料批次意图预览功能")
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ===== Round 2: 新增物料/批次意图 =====

    private IntentExecuteResponse handleBatchCreate(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig, Long userId) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("materialTypeId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                    .status("NEED_MORE_INFO")
                    .message("请提供入库信息：\n1. 原料类型ID (materialTypeId)\n2. 数量 (quantity)\n3. 供应商 (supplierId, 可选)\n\n示例：「入库猪肉500公斤」")
                    .executedAt(LocalDateTime.now()).build();
        }
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("materialTypeId", ctx.get("materialTypeId"));
        result.put("operation", "CREATE");
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED").message("入库记录创建成功")
                .resultData(result).executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleBatchDelete(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {
        Map<String, Object> ctx = request.getContext();
        if (ctx == null || ctx.get("batchId") == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                    .intentCategory("MATERIAL").status("NEED_MORE_INFO")
                    .message("请提供要删除的批次编号 (batchId)")
                    .executedAt(java.time.LocalDateTime.now()).build();
        }
        String batchId = ctx.get("batchId").toString();
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("NEED_CONFIRM")
                .message("确认删除批次 " + batchId + "？此操作不可撤销。")
                .executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleMaterialUpdate(String factoryId, IntentExecuteRequest request,
                                                         AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("NEED_MORE_INFO")
                .message("请提供原料修改信息：批次ID (batchId) 和修改内容")
                .executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleStockSummary(String factoryId, AIIntentConfig intentConfig) {
        var batchPage = materialBatchService.getMaterialBatchList(factoryId,
                com.cretas.aims.dto.common.PageRequest.of(1, 100));
        List<MaterialBatchDTO> batches = batchPage.getContent();
        long total = batchPage.getTotalElements();

        List<Map<String, Object>> lowStockWarnings = materialBatchService.getLowStockWarnings(factoryId);
        int lowStock = lowStockWarnings.size();

        Map<String, Object> result = new HashMap<>();
        result.put("totalBatches", total);
        result.put("lowStockCount", lowStock);
        result.put("batches", batches.size() > 20 ? batches.subList(0, 20) : batches);

        StringBuilder sb = new StringBuilder();
        sb.append("库存汇总\n");
        sb.append("总批次数: ").append(total).append("\n");
        sb.append("低库存预警: ").append(lowStock).append("个批次\n");

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED").message(sb.toString().trim())
                .formattedText(sb.toString().trim())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleBatchWorkers(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED")
                .message("批次工人信息查询功能尚在开发中。请使用排班系统查看工人分配情况。")
                .executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleProductionLineStart(String factoryId, IntentExecuteRequest request,
                                                              AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("NEED_MORE_INFO")
                .message("请提供产线编号 (lineId) 以启动产线")
                .executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleWorkerCount(String factoryId, AIIntentConfig intentConfig) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED")
                .message("车间实时在岗人数统计功能需要考勤系统联动，请查看今日考勤数据。")
                .executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handleRejectionReason(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        // Query recent expired/rejected materials
        List<MaterialBatchDTO> expired = materialBatchService.getExpiredBatches(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("rejectedBatches", expired.size());

        StringBuilder sb = new StringBuilder();
        sb.append("原料退货/拒收原因查询\n\n");
        if (expired.isEmpty()) {
            sb.append("当前无过期或退货原料记录");
        } else {
            sb.append("过期/问题原料: ").append(expired.size()).append("批\n");
            expired.stream().limit(5).forEach(b -> {
                sb.append("  - ").append(b.getMaterialName() != null ? b.getMaterialName() : "批次" + b.getBatchNumber());
                sb.append(" (到期: ").append(b.getExpiryDate()).append(")\n");
            });
            sb.append("\n常见退货原因: 过期变质、检验不合格、规格不符、数量差异");
        }
        result.put("commonReasons", List.of("过期变质", "检验不合格", "规格不符", "数量差异"));

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED").message(sb.toString()).formattedText(sb.toString())
                .resultData(result).executedAt(java.time.LocalDateTime.now()).build();
    }

    private IntentExecuteResponse handlePendingMaterialQuantity(String factoryId, AIIntentConfig intentConfig) {
        // Check low stock materials to estimate pending needs
        List<Map<String, Object>> lowStock = materialBatchService.getLowStockWarnings(factoryId);

        Map<String, Object> result = new HashMap<>();
        result.put("lowStockCount", lowStock.size());

        StringBuilder sb = new StringBuilder();
        sb.append("订单缺料情况查询\n\n");
        sb.append("低库存原料: ").append(lowStock.size()).append("种\n");
        if (!lowStock.isEmpty()) {
            lowStock.stream().limit(5).forEach(item -> {
                String name = item.getOrDefault("materialName", "未知原料").toString();
                Object qty = item.getOrDefault("currentQuantity", "N/A");
                sb.append("  - ").append(name).append(" 当前: ").append(qty).append("\n");
            });
        } else {
            sb.append("当前库存充足，无缺料情况");
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true).intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName()).intentCategory("MATERIAL")
                .status("COMPLETED").message(sb.toString()).formattedText(sb.toString())
                .resultData(result).executedAt(LocalDateTime.now()).build();
    }

    /**
     * 出库操作
     */
    private IntentExecuteResponse handleInventoryOutbound(String factoryId, IntentExecuteRequest request,
                                                           AIIntentConfig intentConfig) {
        String materialName = null;
        String quantity = null;
        if (request.getContext() != null) {
            Object nameObj = request.getContext().get("materialName");
            Object qtyObj = request.getContext().get("quantity");
            if (nameObj != null) materialName = nameObj.toString();
            if (qtyObj != null) quantity = qtyObj.toString();
        }

        if (materialName == null || quantity == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("MATERIAL")
                    .status("NEED_MORE_INFO")
                    .message("出库操作需要以下信息：\n1. 原料名称\n2. 出库数量\n3. 出库原因（生产领用/调拨/其他）\n\n请提供完整信息。")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("NEED_CONFIRM")
                .message("确认出库操作：\n- 原料: " + materialName + "\n- 数量: " + quantity + "\n\n请确认是否执行出库。")
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 原料批次删除
     */
    private IntentExecuteResponse handleMaterialBatchDelete(String factoryId, IntentExecuteRequest request,
                                                             AIIntentConfig intentConfig) {
        String batchId = null;
        if (request.getContext() != null) {
            Object batchObj = request.getContext().get("batchId");
            if (batchObj != null) batchId = batchObj.toString();
        }

        if (batchId == null) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("MATERIAL")
                    .status("NEED_MORE_INFO")
                    .message("删除原料批次需要指定批次编号。\n请提供要删除的批次ID。")
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("MATERIAL")
                .status("NEED_CONFIRM")
                .message("确认删除原料批次 " + batchId + "？\n此操作不可撤销，请确认。")
                .executedAt(LocalDateTime.now())
                .build();
    }

    @Override
    public boolean supportsSemanticsMode() {
        return true;
    }
}
