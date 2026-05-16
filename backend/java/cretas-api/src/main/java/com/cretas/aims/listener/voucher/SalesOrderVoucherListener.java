package com.cretas.aims.listener.voucher;

import com.cretas.aims.entity.enums.VoucherFlag;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.event.SalesOrderConfirmedEvent;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.voucher.VoucherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * SalesOrder 审批 confirmed → 自动生成 SALES_RECEIPT 凭证.
 * AFTER_COMMIT 保证业务 tx 已提交后再触发, 避免读到未提交数据.
 * @Async 保证不阻塞业务 tx 主线.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SalesOrderVoucherListener {

    private final SalesOrderRepository salesOrderRepo;
    private final VoucherService voucherService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onSalesOrderConfirmed(SalesOrderConfirmedEvent event) {
        try {
            handleVoucherGeneration(event.getFactoryId(), event.getSalesOrderId());
        } catch (Exception e) {
            log.error("SalesOrder voucher hook failed: orderId={}", event.getSalesOrderId(), e);
        }
    }

    private void handleVoucherGeneration(String factoryId, String salesOrderId) {
        SalesOrder so = salesOrderRepo.findById(salesOrderId).orElse(null);
        if (so == null) {
            log.warn("SO not found after confirmed event: {}", salesOrderId);
            return;
        }
        if (so.getVflag() != VoucherFlag.UNCREATED) {
            log.debug("SO {} vflag={}, skip voucher generation", salesOrderId, so.getVflag());
            return;
        }
        so.setVflag(VoucherFlag.PENDING);
        salesOrderRepo.save(so);
        try {
            voucherService.createFromBusiness(factoryId, "SALES_ORDER", salesOrderId);
            so.setVflag(VoucherFlag.CREATED);
        } catch (Exception e) {
            so.setVflag(VoucherFlag.FAILED);
            log.error("Voucher generation failed for SO {}", salesOrderId, e);
        }
        salesOrderRepo.save(so);
    }
}
