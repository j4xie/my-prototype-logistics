package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.material.MaterialBatchDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.service.MaterialBatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
                case "MATERIAL_BATCH_QUERY" -> handleBatchQuery(factoryId, request, intentConfig);
                case "MATERIAL_BATCH_USE" -> handleBatchUse(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_RESERVE" -> handleBatchReserve(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_RELEASE" -> handleBatchRelease(factoryId, request, intentConfig, userId);
                case "MATERIAL_BATCH_CONSUME" -> handleBatchConsume(factoryId, request, intentConfig, userId);
                case "MATERIAL_FIFO_RECOMMEND" -> handleFIFORecommend(factoryId, request, intentConfig);
                case "MATERIAL_EXPIRING_ALERT" -> handleExpiringAlert(factoryId, request, intentConfig);
                case "MATERIAL_LOW_STOCK_ALERT" -> handleLowStockAlert(factoryId, intentConfig);
                case "MATERIAL_EXPIRED_QUERY" -> handleExpiredQuery(factoryId, intentConfig);
                case "MATERIAL_ADJUST_QUANTITY" -> handleAdjustQuantity(factoryId, request, intentConfig, userId);
                default -> {
                    log.warn("未知的MATERIAL意图: {}", intentCode);
                    yield IntentExecuteResponse.builder()
                            .intentRecognized(true)
                            .intentCode(intentCode)
                            .intentName(intentConfig.getIntentName())
                            .intentCategory("MATERIAL")
                            .status("FAILED")
                            .message("暂不支持此原材料操作: " + intentCode)
                            .executedAt(LocalDateTime.now())
                            .build();
                }
            };

        } catch (Exception e) {
            log.error("MaterialIntentHandler执行失败: intentCode={}, error={}", intentCode, e.getMessage(), e);
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentCode)
                    .status("FAILED")
                    .message("执行失败: " + e.getMessage())
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
                        ? "暂无" + warningDays + "天内即将过期的批次"
                        : "警告: " + expiringBatches.size() + "个批次将在" + warningDays + "天内过期")
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
                        ? "所有原材料库存充足"
                        : "警告: " + lowStockWarnings.size() + "种原材料库存偏低")
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
                        ? "暂无已过期批次"
                        : "警告: " + expiredBatches.size() + "个批次已过期，需要处理")
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
}
