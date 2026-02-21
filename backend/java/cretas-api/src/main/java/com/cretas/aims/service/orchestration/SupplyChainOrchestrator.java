package com.cretas.aims.service.orchestration;

import com.cretas.aims.dto.orchestration.*;
import com.cretas.aims.entity.*;
import com.cretas.aims.entity.enums.*;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.event.*;
import com.cretas.aims.repository.ProductionBatchRepository;
import com.cretas.aims.repository.ProductionPlanRepository;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * 供应链联动编排服务
 *
 * <p>监听 Spring ApplicationEvent，驱动跨模块的供应链自动化流程：
 * <ul>
 *   <li>正向链：SO确认 → 库存检查 → 生产计划 → BOM展开 → 采购建议</li>
 *   <li>反向链：报工完成 → 成品入库 → 生产计划更新 → SO通知</li>
 *   <li>物料链：原辅料入库 → 重新检查待匹配PP的物料充足性</li>
 * </ul>
 *
 * <p>所有监听方法均包含异常隔离：联动失败不影响触发方的主流程。
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Service
@RequiredArgsConstructor
public class SupplyChainOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(SupplyChainOrchestrator.class);

    private final InventoryMatchingService inventoryMatchingService;
    private final BomExpansionService bomExpansionService;
    private final ProcurementSuggestionService procurementSuggestionService;
    private final ProductionPlanRepository productionPlanRepository;
    private final ProductionBatchRepository productionBatchRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;
    private final ApplicationEventPublisher applicationEventPublisher;

    // ═══════════ 正向链：SO → 库存 → 生产 → 采购 ═══════════

    /**
     * 节点②: SO确认后 → 检查成品库存 → 满足则预留，不足则创建PP
     *
     * <p>收到 {@link SalesOrderConfirmedEvent} 后：
     * <ol>
     *   <li>逐行检查订单商品在成品库中的可用量</li>
     *   <li>库存充足 → {@code reserveStock} 预留</li>
     *   <li>库存不足 → {@code createProductionPlanFromSO} 创建PENDING状态的PP草稿，并触发BOM展开</li>
     * </ol>
     */
    @EventListener
    @Transactional
    public void onSalesOrderConfirmed(SalesOrderConfirmedEvent event) {
        log.info("═══ 供应链联动: SO确认 ═══ factoryId={}, SO={}", event.getFactoryId(), event.getSalesOrderId());

        try {
            StockCheckResult result = inventoryMatchingService.checkAvailability(
                    event.getFactoryId(), event.getSalesOrderId());

            for (LineItemMatch match : result.getLineItems()) {
                if (match.isFullySatisfied()) {
                    // ③a 库存满足 → 预留
                    inventoryMatchingService.reserveStock(
                            event.getFactoryId(), match.getProductTypeId(), match.getRequiredQuantity());
                    log.info("库存满足并预留: product={}, qty={}", match.getProductTypeId(), match.getRequiredQuantity());
                } else {
                    // ③b 库存不足 → 创建生产计划草稿
                    createProductionPlanFromSO(
                            event.getFactoryId(), event.getSalesOrderId(),
                            match.getProductTypeId(), match.getProductTypeName(), match.getShortfallQuantity());
                }
            }
        } catch (Exception e) {
            log.error("SO确认联动失败(不影响订单状态): SO={}", event.getSalesOrderId(), e);
        }
    }

    /**
     * 节点⑤d: 原辅料入库 → 检查待匹配PP的原料是否到齐
     *
     * <p>收到 {@link MaterialReceivedEvent} 后，遍历所有 PENDING 且未完全匹配的PP，
     * 重新做BOM物料可用性校验；如果全部到位则将 {@code isFullyMatched} 置为 true，
     * 通知调度员可以开始排产。
     */
    @EventListener
    @Transactional
    public void onMaterialReceived(MaterialReceivedEvent event) {
        log.info("═══ 供应链联动: 物料入库 ═══ factoryId={}, material={}, qty={}",
                event.getFactoryId(), event.getMaterialTypeId(), event.getReceivedQuantity());

        try {
            // 查找所有未完全匹配的 PENDING 生产计划
            List<ProductionPlan> waitingPlans = productionPlanRepository
                    .findByFactoryIdAndStatus(event.getFactoryId(), ProductionPlanStatus.PENDING);

            for (ProductionPlan plan : waitingPlans) {
                if (Boolean.TRUE.equals(plan.getIsFullyMatched())) continue;

                boolean allReady = bomExpansionService.recheckAvailability(plan);
                if (allReady) {
                    plan.setIsFullyMatched(true);
                    productionPlanRepository.save(plan);
                    log.info("原料到齐: PP={}, 可以开始生产", plan.getPlanNumber());
                }
            }
        } catch (Exception e) {
            log.error("物料入库联动失败(不影响收货): material={}", event.getMaterialTypeId(), e);
        }
    }

    // ═══════════ 反向链：报工 → 成品 → SO → 出库 ═══════════

    /**
     * 节点⑦: 生产批次完成 → 自动创建成品批次 + 更新PP进度 + 通知SO
     *
     * <p>收到 {@link BatchCompletedEvent} 后：
     * <ol>
     *   <li>良品数量 &gt; 0 → 创建 {@link FinishedGoodsBatch} 入库</li>
     *   <li>关联PP存在 → 累加 actualQuantity，检查PP下所有PB是否完成</li>
     *   <li>PP来自SO → 发布 {@link FinishedGoodsCreatedEvent} 通知出库模块</li>
     * </ol>
     */
    @EventListener
    @Transactional
    public void onBatchCompleted(BatchCompletedEvent event) {
        ProductionBatch batch = event.getBatch();
        log.info("═══ 供应链联动: 批次完成 ═══ factoryId={}, batchId={}, goodQty={}",
                batch.getFactoryId(), batch.getId(), batch.getGoodQuantity());

        try {
            // ⑦a 自动创建成品批次
            if (batch.getGoodQuantity() != null && batch.getGoodQuantity().compareTo(BigDecimal.ZERO) > 0) {
                FinishedGoodsBatch fg = createFinishedGoodsFromBatch(batch);
                if (fg != null) {
                    log.info("自动创建成品: batchNumber={}, qty={}", fg.getBatchNumber(), fg.getProducedQuantity());
                }
            }

            // ⑦b 更新关联的 ProductionPlan
            if (batch.getProductionPlanId() != null) {
                updateProductionPlanProgress(batch);
            }
        } catch (Exception e) {
            log.error("批次完成联动失败(不影响报工): batchId={}", batch.getId(), e);
        }
    }

    /**
     * 节点⑩: 收到回款 → 检查是否有等待发货的SO
     *
     * <p>Phase C 占位：回款门控出库逻辑将在此处实现。
     */
    @EventListener
    @Transactional
    public void onPaymentReceived(PaymentReceivedEvent event) {
        log.info("═══ 供应链联动: 回款 ═══ factoryId={}, counterparty={}, amount={}",
                event.getFactoryId(), event.getCounterpartyId(), event.getAmount());
        // TODO: Phase C — 回款门控出库
        // salesService.checkPaymentGateForPendingDeliveries(event.getFactoryId(), event.getCounterpartyId());
    }

    // ═══════════ 内部方法 ═══════════

    /**
     * 根据SO缺口创建 PENDING 状态的生产计划草稿，并触发 BOM 展开与采购建议生成。
     *
     * @param factoryId         工厂ID
     * @param salesOrderId      销售订单ID
     * @param productTypeId     产品类型ID
     * @param productTypeName   产品类型名称（用于冗余记录）
     * @param shortfallQuantity 库存缺口数量
     */
    private void createProductionPlanFromSO(String factoryId, String salesOrderId,
                                            String productTypeId, String productTypeName,
                                            BigDecimal shortfallQuantity) {
        // 创建PP草稿（PENDING状态，需调度员确认后排产）
        ProductionPlan plan = new ProductionPlan();
        plan.setId(UUID.randomUUID().toString());
        plan.setFactoryId(factoryId);
        plan.setPlanNumber(generatePlanNumber(factoryId));
        plan.setProductTypeId(productTypeId);
        plan.setPlannedQuantity(shortfallQuantity);
        plan.setSourceType(PlanSourceType.CUSTOMER_ORDER);
        plan.setSourceOrderId(salesOrderId);
        plan.setStatus(ProductionPlanStatus.PENDING);
        plan.setIsFullyMatched(false);
        // ProductionPlan 无 productName 字段；productTypeName 冗余记录在 sourceCustomerName 旁
        // 如业务需要，可将 productTypeName 写入 notes 字段
        plan.setNotes("自动创建：来自销售订单 " + salesOrderId + "，产品 " + productTypeName);
        // createdBy 需要系统用户ID；此处使用占位值 0L（系统自动创建）
        plan.setCreatedBy(0L);

        ProductionPlan saved = productionPlanRepository.save(plan);
        log.info("自动创建生产计划: PP={}, product={}, qty={}, sourceOrder={}",
                saved.getPlanNumber(), productTypeId, shortfallQuantity, salesOrderId);

        // ④ BOM展开 + ⑤ 原辅料检查
        try {
            List<MaterialRequirement> requirements = bomExpansionService.expandBOM(
                    factoryId, productTypeId, shortfallQuantity);
            MaterialCheckResult materialResult = bomExpansionService.checkMaterialAvailability(
                    factoryId, requirements);

            if (materialResult.isAllSatisfied()) {
                saved.setIsFullyMatched(true);
                productionPlanRepository.save(saved);
                log.info("原辅料充足: PP={}", saved.getPlanNumber());
            } else {
                // ⑤b 生成采购建议
                procurementSuggestionService.generateSuggestions(
                        factoryId, saved.getId(), materialResult.getShortfalls());
                log.info("原辅料不足，已生成采购建议: PP={}, 缺口种类={}",
                        saved.getPlanNumber(), materialResult.getShortfalls().size());
            }
        } catch (Exception e) {
            log.error("BOM展开/采购建议生成失败(不影响PP创建): PP={}", saved.getPlanNumber(), e);
        }
    }

    /**
     * 根据完成的生产批次创建成品批次入库记录。
     *
     * @param batch 已完成的生产批次
     * @return 持久化后的 {@link FinishedGoodsBatch}
     */
    private FinishedGoodsBatch createFinishedGoodsFromBatch(ProductionBatch batch) {
        // 幂等性：同一 batch 不重复创建成品
        String fgBatchNumber = generateFGBatchNumber(batch);
        if (finishedGoodsBatchRepository.findByFactoryIdAndBatchNumber(batch.getFactoryId(), fgBatchNumber).isPresent()) {
            log.warn("成品批次已存在，跳过: batchNumber={}", fgBatchNumber);
            return null;
        }

        FinishedGoodsBatch fg = new FinishedGoodsBatch();
        fg.setFactoryId(batch.getFactoryId());
        fg.setProductTypeId(batch.getProductTypeId());
        fg.setProductName(batch.getProductName());
        fg.setProducedQuantity(batch.getGoodQuantity());
        fg.setBatchNumber(fgBatchNumber);
        fg.setProductionDate(LocalDate.now());
        fg.setExpireDate(LocalDate.now().plusDays(180));
        fg.setStorageLocation("默认仓位");
        fg.setCreatedBy(0L);
        fg.setStatus("AVAILABLE");
        fg.setUnit(batch.getUnit() != null ? batch.getUnit() : "kg");
        if (batch.getProductionPlanId() != null) {
            fg.setProductionPlanId(batch.getProductionPlanId().toString());
        }
        return finishedGoodsBatchRepository.save(fg);
    }

    /**
     * 累加生产批次的良品产量到关联PP，并在PP下所有PB都完成后将PP状态更新为COMPLETED。
     * 如果PP来自客户订单，则发布 {@link FinishedGoodsCreatedEvent}。
     *
     * @param batch 已完成的生产批次
     */
    private void updateProductionPlanProgress(ProductionBatch batch) {
        String planId = batch.getProductionPlanId().toString();
        ProductionPlan plan = productionPlanRepository.findById(planId).orElse(null);
        if (plan == null) {
            log.warn("批次关联的PP不存在: planId={}, batchId={}", planId, batch.getId());
            return;
        }

        // 累加实际产量
        BigDecimal totalActual = plan.getActualQuantity() != null ? plan.getActualQuantity() : BigDecimal.ZERO;
        plan.setActualQuantity(totalActual.add(
                batch.getGoodQuantity() != null ? batch.getGoodQuantity() : BigDecimal.ZERO));

        // 检查该PP下是否还有未完成的PB
        long incompleteBatches = productionBatchRepository
                .countByProductionPlanIdAndStatusNot(batch.getProductionPlanId(), ProductionBatchStatus.COMPLETED);

        if (incompleteBatches == 0) {
            plan.setStatus(ProductionPlanStatus.COMPLETED);
            plan.setEndTime(java.time.LocalDateTime.now());
            log.info("生产计划全部完成: PP={}, actualQty={}", plan.getPlanNumber(), plan.getActualQuantity());
        }

        productionPlanRepository.save(plan);

        // 如果PP来自SO → 发布 FinishedGoodsCreatedEvent 通知出库/发货模块
        if (plan.getSourceOrderId() != null && PlanSourceType.CUSTOMER_ORDER == plan.getSourceType()) {
            applicationEventPublisher.publishEvent(new FinishedGoodsCreatedEvent(
                    this,
                    batch.getFactoryId(),
                    plan.getSourceOrderId(),
                    batch.getProductTypeId(),
                    batch.getGoodQuantity(),
                    null  // batchId: 由下游模块通过sourceOrderId查询
            ));
        }
    }

    /**
     * 生成PP编号，格式: {@code PP-AUTO-yyyyMMdd-XXXX}
     *
     * @param factoryId 工厂ID
     * @return 唯一的PP编号
     */
    private String generatePlanNumber(String factoryId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = productionPlanRepository.countByFactoryId(factoryId);
        return String.format("PP-AUTO-%s-%04d", dateStr, (count % 10000) + 1);
    }

    /**
     * 生成成品批次编号，格式: {@code FG-AUTO-yyyyMMdd-{batchId}}
     *
     * @param batch 来源生产批次
     * @return 唯一的成品批次编号
     */
    private String generateFGBatchNumber(ProductionBatch batch) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        return String.format("FG-AUTO-%s-%s", dateStr, batch.getId());
    }
}
