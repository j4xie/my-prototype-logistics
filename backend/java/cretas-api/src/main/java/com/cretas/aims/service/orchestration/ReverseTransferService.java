package com.cretas.aims.service.orchestration;

import com.cretas.aims.dto.inventory.CreateTransferRequest;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.RawMaterialType;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.event.ProductionCompletedEvent;
import com.cretas.aims.repository.MaterialBatchRepository;
import com.cretas.aims.repository.RawMaterialTypeRepository;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.service.factory.WarehouseResolver;
import com.cretas.aims.service.inventory.TransferService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * D1 反向调拨自动触发服务 (PR #309 A3=A, 2026-05-10 spec).
 *
 * <p>监听 {@link ProductionCompletedEvent} (生产计划整体完成) → 自动创建一张草稿态
 * BRANCH_TO_HQ 内部调拨单, 把车间仓 (WH-WKS) 的余料 + 该 plan 的成品聚合回总仓 (WH-LOG)。
 * 用户在调拨列表 review 后手动提交进入审批流, 系统不自动 submit.
 *
 * <p>设计要点:
 * <ul>
 *   <li><b>触发时机</b>: 生产计划状态 PENDING → COMPLETED 时由
 *       {@link SupplyChainOrchestrator#updateProductionPlanProgress} 发布事件。
 *       Plan-level (非 batch-level) 防止重复草稿。</li>
 *   <li><b>聚合策略</b>: 余料按 materialTypeId 合并 (一种原料多个 batch → 一行 item, quantity 累加),
 *       成品按 productTypeId 合并 (同 plan 多个 FG batch → 一行 item)。</li>
 *   <li><b>0 余料场景</b>: 如果 WH-WKS 没余料但有成品 → 仍创建调拨单 (item 列表非空)。
 *       如果 WH-WKS 既无余料也无成品 → 跳过, 记 INFO 日志 (无内容可调)。</li>
 *   <li><b>异常隔离</b>: 调拨创建失败仅记录 error, 不抛异常, 不回滚生产完成。</li>
 *   <li><b>幂等性</b>: ProductionPlan COMPLETED 状态只设置一次 (incompleteBatches==0 检查), 所以
 *       事件只会发一次。事件处理本身不做去重 (上游不重发)。</li>
 * </ul>
 *
 * @see ProductionCompletedEvent
 * @see TransferService#createTransfer
 * @since 2026-05-11 PR #309 A3=A
 */
@Service
public class ReverseTransferService {

    private static final Logger log = LoggerFactory.getLogger(ReverseTransferService.class);

    private final MaterialBatchRepository materialBatchRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;
    private final RawMaterialTypeRepository rawMaterialTypeRepository;
    private final WarehouseResolver warehouseResolver;
    private final TransferService transferService;

    /** 反向调拨 system-user ID 占位 — DRAFT 阶段不需要真实用户, 调拨单 review/submit 阶段才需要。 */
    private static final Long SYSTEM_USER_ID = 0L;

    @Autowired
    public ReverseTransferService(MaterialBatchRepository materialBatchRepository,
                                  FinishedGoodsBatchRepository finishedGoodsBatchRepository,
                                  RawMaterialTypeRepository rawMaterialTypeRepository,
                                  WarehouseResolver warehouseResolver,
                                  TransferService transferService) {
        this.materialBatchRepository = materialBatchRepository;
        this.finishedGoodsBatchRepository = finishedGoodsBatchRepository;
        this.rawMaterialTypeRepository = rawMaterialTypeRepository;
        this.warehouseResolver = warehouseResolver;
        this.transferService = transferService;
    }

    /**
     * 监听生产计划完成事件, 创建 DRAFT BRANCH_TO_HQ 调拨单。
     *
     * <p>异常隔离: 任何步骤失败 → log.error + 静默吞掉。生产完成主流程不能被反向调拨失败阻塞。
     */
    @EventListener
    @Transactional
    public void onProductionCompleted(ProductionCompletedEvent event) {
        String factoryId = event.getFactoryId();
        String planId = event.getPlanId();
        log.info("═══ D1 反向调拨触发 ═══ factoryId={}, planId={}, planNumber={}",
                factoryId, planId, event.getPlanNumber());

        try {
            createReverseTransferDraft(event);
        } catch (Exception e) {
            // 异常隔离: 反向调拨创建失败不影响生产完成主流程
            log.error("D1 反向调拨创建失败 (不影响生产完成): factoryId={}, planId={}, err={}",
                    factoryId, planId, e.getMessage(), e);
        }
    }

    /**
     * 创建反向调拨草稿单的主逻辑。
     *
     * <p>步骤:
     * <ol>
     *   <li>解析 WH-WKS / WH-LOG id</li>
     *   <li>查询 WH-WKS 内所有剩余原料 (按 materialTypeId 聚合)</li>
     *   <li>查询该 plan 在 WH-WKS 内的所有成品批次 (按 productTypeId 聚合)</li>
     *   <li>如果 items 非空 → 调用 TransferService.createTransfer 创建 DRAFT 单</li>
     * </ol>
     */
    private void createReverseTransferDraft(ProductionCompletedEvent event) {
        String factoryId = event.getFactoryId();
        String planId = event.getPlanId();

        // Step 1: 解析两个仓库 id
        String wksWarehouseId = warehouseResolver.resolveWorkshopId(factoryId);
        String logWarehouseId = warehouseResolver.resolveLogisticsId(factoryId);

        // Step 2: 聚合 WH-WKS 内剩余原料
        List<CreateTransferRequest.TransferItemDTO> items = new ArrayList<>();
        List<MaterialBatch> remainingMaterials = materialBatchRepository
                .findAllAvailableInWarehouse(factoryId, wksWarehouseId);
        Map<String, BigDecimal> materialQtyByType = aggregateMaterialsByType(remainingMaterials);
        for (Map.Entry<String, BigDecimal> entry : materialQtyByType.entrySet()) {
            String materialTypeId = entry.getKey();
            BigDecimal totalQty = entry.getValue();
            if (totalQty.compareTo(BigDecimal.ZERO) <= 0) continue;
            RawMaterialType rawType = rawMaterialTypeRepository.findById(materialTypeId).orElse(null);
            items.add(buildMaterialItem(materialTypeId, totalQty,
                    rawType != null ? rawType.getName() : "未知物料",
                    rawType != null && rawType.getUnit() != null ? rawType.getUnit() : "kg"));
        }

        // Step 3: 聚合该 plan 在 WH-WKS 的成品批次
        List<FinishedGoodsBatch> finishedGoods = finishedGoodsBatchRepository
                .findAvailableByPlanAndWarehouse(factoryId, planId, wksWarehouseId);
        Map<String, FGAggregate> fgByType = aggregateFinishedGoodsByType(finishedGoods);
        for (FGAggregate agg : fgByType.values()) {
            if (agg.totalQty.compareTo(BigDecimal.ZERO) <= 0) continue;
            items.add(buildFinishedGoodsItem(agg));
        }

        // Step 4: 若无 items → 跳过 (无内容可调)
        if (items.isEmpty()) {
            log.info("D1 反向调拨: WH-WKS 无余料且无成品, 跳过创建草稿 — factoryId={}, planId={}",
                    factoryId, planId);
            return;
        }

        // Step 5: 调用 TransferService 创建 DRAFT 单
        CreateTransferRequest request = new CreateTransferRequest();
        request.setTransferType("BRANCH_TO_HQ");
        // 工厂内跨仓调拨: source / target factory 都是当前工厂, 区别在仓库
        request.setTargetFactoryId(factoryId);
        request.setSourceWarehouseId(wksWarehouseId);
        request.setTargetWarehouseId(logWarehouseId);
        request.setTransferDate(LocalDate.now());
        request.setExpectedArrivalDate(LocalDate.now());
        request.setRemark(String.format("[D1 自动] 生产计划 %s 完成, 自动调回总仓 (余料 %d 种, 成品 %d 种). PR #309 A3=A.",
                event.getPlanNumber() != null ? event.getPlanNumber() : planId,
                materialQtyByType.size(),
                fgByType.size()));
        request.setItems(items);

        var transfer = transferService.createTransfer(factoryId, request, SYSTEM_USER_ID);
        log.info("D1 反向调拨草稿创建成功: transferId={}, transferNumber={}, items={}, planId={}",
                transfer.getId(), transfer.getTransferNumber(), items.size(), planId);
    }

    /** 按 materialTypeId 聚合 (合并多 batch 到一行 item)。 */
    private Map<String, BigDecimal> aggregateMaterialsByType(List<MaterialBatch> batches) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        for (MaterialBatch b : batches) {
            String typeId = b.getMaterialTypeId();
            if (typeId == null) continue;
            // MaterialBatch: getRemainingQuantity() = receiptQuantity - usedQuantity - reservedQuantity
            BigDecimal avail = b.getRemainingQuantity();
            if (avail == null || avail.compareTo(BigDecimal.ZERO) <= 0) continue;
            result.merge(typeId, avail, BigDecimal::add);
        }
        return result;
    }

    /** 按 productTypeId 聚合 (保留 productName + unit, 数量累加)。 */
    private Map<String, FGAggregate> aggregateFinishedGoodsByType(List<FinishedGoodsBatch> batches) {
        Map<String, FGAggregate> result = new LinkedHashMap<>();
        for (FinishedGoodsBatch b : batches) {
            String typeId = b.getProductTypeId();
            if (typeId == null) continue;
            BigDecimal avail = b.getAvailableQuantity();
            if (avail == null || avail.compareTo(BigDecimal.ZERO) <= 0) continue;
            FGAggregate agg = result.computeIfAbsent(typeId, k -> new FGAggregate());
            agg.productTypeId = typeId;
            // 保留首个非 null name/unit/unitPrice 作为代表 (同 productType 应该相同, 取首个 OK)
            if (agg.productName == null && b.getProductName() != null) {
                agg.productName = b.getProductName();
            }
            if (agg.unit == null && b.getUnit() != null) {
                agg.unit = b.getUnit();
            }
            if (agg.unitPrice == null && b.getUnitPrice() != null) {
                agg.unitPrice = b.getUnitPrice();
            }
            agg.totalQty = agg.totalQty.add(avail);
        }
        return result;
    }

    private CreateTransferRequest.TransferItemDTO buildMaterialItem(String materialTypeId,
                                                                     BigDecimal totalQty,
                                                                     String materialName,
                                                                     String unit) {
        CreateTransferRequest.TransferItemDTO item = new CreateTransferRequest.TransferItemDTO();
        item.setItemType("RAW_MATERIAL");
        item.setMaterialTypeId(materialTypeId);
        item.setItemName(materialName);
        item.setQuantity(totalQty);
        item.setUnit(unit);
        item.setRemark("[D1 自动] 报工后 WH-WKS 余料");
        return item;
    }

    private CreateTransferRequest.TransferItemDTO buildFinishedGoodsItem(FGAggregate agg) {
        CreateTransferRequest.TransferItemDTO item = new CreateTransferRequest.TransferItemDTO();
        item.setItemType("FINISHED_GOODS");
        item.setProductTypeId(agg.productTypeId);
        item.setItemName(agg.productName != null ? agg.productName : "未知产品");
        item.setQuantity(agg.totalQty);
        item.setUnit(agg.unit != null ? agg.unit : "kg");
        item.setUnitPrice(agg.unitPrice);
        item.setRemark("[D1 自动] 生产计划成品");
        return item;
    }

    /** 成品聚合中间结构 (按 productTypeId 累加, 保留 name/unit/unitPrice 元数据)。 */
    private static class FGAggregate {
        String productTypeId;
        String productName;
        String unit;
        BigDecimal unitPrice;
        BigDecimal totalQty = BigDecimal.ZERO;
    }
}
