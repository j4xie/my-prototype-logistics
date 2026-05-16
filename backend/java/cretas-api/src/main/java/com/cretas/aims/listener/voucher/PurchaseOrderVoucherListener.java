package com.cretas.aims.listener.voucher;

import com.cretas.aims.entity.enums.VoucherFlag;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.event.PurchaseReceiveCreatedEvent;
import com.cretas.aims.repository.inventory.PurchaseOrderRepository;
import com.cretas.aims.service.voucher.VoucherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * PurchaseReceive 创建时 → 自动生成 PURCHASE_PAYMENT 凭证 (在 PurchaseOrder 上).
 * Idempotent: 同一 PO 多次 receive 只生成 1 张凭证 (uk_voucher_source_business 约束).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PurchaseOrderVoucherListener {

    private final PurchaseOrderRepository purchaseOrderRepo;
    private final VoucherService voucherService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onPurchaseReceiveCreated(PurchaseReceiveCreatedEvent event) {
        String orderId = event.getPurchaseOrderId();
        if (orderId == null) {
            log.debug("Receive event without purchaseOrderId, skip voucher hook");
            return;
        }
        try {
            handleVoucherGeneration(event.getFactoryId(), orderId);
        } catch (Exception e) {
            log.error("PurchaseOrder voucher hook failed: orderId={}", orderId, e);
        }
    }

    private void handleVoucherGeneration(String factoryId, String orderId) {
        PurchaseOrder po = purchaseOrderRepo.findById(orderId).orElse(null);
        if (po == null) {
            log.warn("PO not found after receive event: {}", orderId);
            return;
        }
        if (po.getVflag() != VoucherFlag.UNCREATED) {
            log.debug("PO {} vflag={}, skip", orderId, po.getVflag());
            return;
        }
        po.setVflag(VoucherFlag.PENDING);
        purchaseOrderRepo.save(po);
        try {
            voucherService.createFromBusiness(factoryId, "PURCHASE_ORDER", orderId);
            po.setVflag(VoucherFlag.CREATED);
        } catch (Exception e) {
            po.setVflag(VoucherFlag.FAILED);
            log.error("Voucher generation failed for PO {}", orderId, e);
        }
        purchaseOrderRepo.save(po);
    }
}
