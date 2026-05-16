package com.cretas.aims.listener.voucher;

import com.cretas.aims.entity.enums.VoucherFlag;
import com.cretas.aims.entity.inventory.ReturnOrder;
import com.cretas.aims.event.ReturnOrderCreatedEvent;
import com.cretas.aims.repository.inventory.ReturnOrderRepository;
import com.cretas.aims.service.voucher.VoucherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * ReturnOrder 创建时 → 自动生成 RETURN 凭证 (反向冲销原销售).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReturnOrderVoucherListener {

    private final ReturnOrderRepository returnOrderRepo;
    private final VoucherService voucherService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onReturnOrderCreated(ReturnOrderCreatedEvent event) {
        try {
            handleVoucherGeneration(event.getFactoryId(), event.getReturnOrderId());
        } catch (Exception e) {
            log.error("ReturnOrder voucher hook failed: orderId={}", event.getReturnOrderId(), e);
        }
    }

    private void handleVoucherGeneration(String factoryId, String returnOrderId) {
        ReturnOrder r = returnOrderRepo.findById(returnOrderId).orElse(null);
        if (r == null) {
            log.warn("ReturnOrder not found after created event: {}", returnOrderId);
            return;
        }
        if (r.getVflag() != VoucherFlag.UNCREATED) {
            log.debug("RO {} vflag={}, skip", returnOrderId, r.getVflag());
            return;
        }
        r.setVflag(VoucherFlag.PENDING);
        returnOrderRepo.save(r);
        try {
            voucherService.createFromBusiness(factoryId, "RETURN_ORDER", returnOrderId);
            r.setVflag(VoucherFlag.CREATED);
        } catch (Exception e) {
            r.setVflag(VoucherFlag.FAILED);
            log.error("Voucher generation failed for RO {}", returnOrderId, e);
        }
        returnOrderRepo.save(r);
    }
}
