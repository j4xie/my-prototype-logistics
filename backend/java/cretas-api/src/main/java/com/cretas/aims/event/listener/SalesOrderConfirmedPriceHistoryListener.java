package com.cretas.aims.event.listener;

import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.event.SalesOrderConfirmedEvent;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.CustomerPriceMemoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Sprint 4 W2 S-PRICE-1 — SO 确认 → 写入客户记忆价 listener.
 *
 * 触发: SalesOrderConfirmedEvent (publish 自 SalesServiceImpl.confirmOrder).
 *
 * 设计选择:
 * - REQUIRES_NEW 事务: 隔离记忆价写入失败 — 不影响 SO 确认本身 (e.g. unique 冲突, DB hiccup).
 * - 同步执行 (非 @Async): SO confirm 这条业务路径已经 sync, 加 async 反而增加复杂度,
 *   且记忆价是后续 SO Item prefill 依赖, 不希望延迟可见.
 * - R4 dedup 由 service 层负责 (findByFactoryIdAndCustomerIdAndProductTypeIdAndSourceSalesOrderId).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SalesOrderConfirmedPriceHistoryListener {

    private final SalesOrderRepository salesOrderRepository;
    private final CustomerPriceMemoryService priceMemoryService;

    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onSalesOrderConfirmed(SalesOrderConfirmedEvent event) {
        try {
            Optional<SalesOrder> orderOpt = salesOrderRepository.findById(event.getSalesOrderId());
            if (orderOpt.isEmpty()) {
                log.warn("S-PRICE-1 listener: SO {} not found, skip", event.getSalesOrderId());
                return;
            }
            int written = priceMemoryService.recordFromSalesOrder(orderOpt.get());
            if (written > 0) {
                log.info("S-PRICE-1 listener: wrote {} price-history rows for SO {}",
                        written, event.getSalesOrderId());
            }
        } catch (Exception e) {
            // 隔离失败 — 不让记忆价 issue 回滚 SO 确认事务
            log.error("S-PRICE-1 listener: recordFromSalesOrder failed for SO {} — skipping (SO confirm unaffected)",
                    event.getSalesOrderId(), e);
        }
    }
}
