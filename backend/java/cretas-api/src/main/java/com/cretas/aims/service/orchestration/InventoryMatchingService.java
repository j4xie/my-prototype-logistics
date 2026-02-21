package com.cretas.aims.service.orchestration;

import com.cretas.aims.dto.orchestration.LineItemMatch;
import com.cretas.aims.dto.orchestration.StockCheckResult;
import com.cretas.aims.entity.inventory.FinishedGoodsBatch;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.FinishedGoodsBatchRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 销售订单 → 成品库存 匹配与预留服务
 *
 * <p>职责：
 * <ol>
 *   <li>检查销售订单每个行项目的成品库存可用量（{@link #checkAvailability}）</li>
 *   <li>按 FEFO 策略（先到期先出）对指定产品类型的成品批次执行库存预留（{@link #reserveStock}）</li>
 * </ol>
 *
 * @author Cretas Team
 * @since 2026-02-19
 */
@Service
@RequiredArgsConstructor
public class InventoryMatchingService {

    private static final Logger log = LoggerFactory.getLogger(InventoryMatchingService.class);

    private final SalesOrderRepository salesOrderRepository;
    private final FinishedGoodsBatchRepository finishedGoodsBatchRepository;

    /**
     * 检查已确认销售订单的成品库存可用性。
     * 对每个行项目，比较待发货数量与当前可用库存的差值。
     *
     * @param factoryId    工厂 ID
     * @param salesOrderId 销售订单 ID
     * @return 包含每个行项目库存匹配情况及整单是否可满足的检查结果
     * @throws BusinessException 若销售订单不存在
     */
    @Transactional(readOnly = true)
    public StockCheckResult checkAvailability(String factoryId, String salesOrderId) {
        SalesOrder so = salesOrderRepository.findById(salesOrderId)
                .orElseThrow(() -> new BusinessException("销售订单不存在: " + salesOrderId));

        List<LineItemMatch> matches = new ArrayList<>();
        boolean allSatisfied = true;

        for (SalesOrderItem item : so.getItems()) {
            BigDecimal pending = item.getPendingQuantity();
            if (pending.compareTo(BigDecimal.ZERO) <= 0) {
                // 该行项目已全部交货，跳过
                continue;
            }

            BigDecimal available = finishedGoodsBatchRepository
                    .sumAvailableQuantityByProductType(factoryId, item.getProductTypeId());

            // 缺口 = max(待发 - 可用, 0)；若可用充足则缺口为负（富余），isFullySatisfied() 返回 true
            BigDecimal shortfall = pending.subtract(available).max(BigDecimal.ZERO);

            LineItemMatch match = new LineItemMatch();
            match.setProductTypeId(item.getProductTypeId());
            match.setProductTypeName(item.getProductName());
            match.setRequiredQuantity(pending);
            match.setAvailableQuantity(available);
            match.setShortfallQuantity(shortfall);
            matches.add(match);

            if (!match.isFullySatisfied()) {
                allSatisfied = false;
            }
        }

        StockCheckResult result = new StockCheckResult();
        result.setSalesOrderId(salesOrderId);
        result.setLineItems(matches);
        result.setAllSatisfied(allSatisfied);

        log.info("库存检查完成: SO={}, 全部满足={}, 行项目={}", salesOrderId, allSatisfied, matches.size());
        return result;
    }

    /**
     * 按 FEFO（先到期先出）策略对指定产品类型的成品批次执行库存预留。
     *
     * <p>从到期日最早的批次开始依次预留，直至满足所需数量或批次耗尽。
     * 若可用总量不足，记录 WARN 日志但不抛出异常（调用方可根据 {@link #checkAvailability} 结果决策）。
     *
     * @param factoryId     工厂 ID
     * @param productTypeId 产品类型 ID
     * @param quantity      需要预留的数量
     */
    @Transactional
    public void reserveStock(String factoryId, String productTypeId, BigDecimal quantity) {
        List<FinishedGoodsBatch> batches = finishedGoodsBatchRepository
                .findAvailableBatches(factoryId, productTypeId);

        BigDecimal remaining = quantity;
        for (FinishedGoodsBatch batch : batches) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }

            BigDecimal available = batch.getAvailableQuantity();
            BigDecimal reserve = remaining.min(available);

            BigDecimal currentReserved = batch.getReservedQuantity() != null
                    ? batch.getReservedQuantity()
                    : BigDecimal.ZERO;
            batch.setReservedQuantity(currentReserved.add(reserve));
            finishedGoodsBatchRepository.save(batch);
            remaining = remaining.subtract(reserve);

            log.debug("预留库存: batch={}, reserve={}, remaining={}",
                    batch.getBatchNumber(), reserve, remaining);
        }

        if (remaining.compareTo(BigDecimal.ZERO) > 0) {
            log.warn("库存预留不完全: productType={}, 仍需={}", productTypeId, remaining);
        }
    }
}
