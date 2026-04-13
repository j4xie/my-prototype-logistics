package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Round 11 Fix — published by PurchaseServiceImpl.createReceiveRecord.
 *
 * <p>Drives TriggerChainExecutor for factory-configured trigger chains on the
 * purchase_receipt module. Fires on DRAFT-state creation — distinct from the
 * existing MaterialReceivedEvent which only fires on CONFIRMED state from
 * confirmReceive. Factories that want to react at draft time (e.g., "通知
 * 质检员开始抽样", "自动创建 QC 任务") previously had no hook.</p>
 *
 * <p>This is the event hook of the R9 Canvas Integration Template for
 * purchase_receipt. Other hooks (validation + customFields persist) are
 * added to createReceiveRecord in the same commit.</p>
 */
@Getter
public class PurchaseReceiveCreatedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String receiveRecordId;
    private final String receiveNumber;
    private final String supplierId;
    private final String purchaseOrderId;
    private final BigDecimal totalAmount;
    private final LocalDateTime createdAt;

    public PurchaseReceiveCreatedEvent(Object source, String factoryId, String receiveRecordId,
                                        String receiveNumber, String supplierId,
                                        String purchaseOrderId, BigDecimal totalAmount) {
        super(source);
        this.factoryId = factoryId;
        this.receiveRecordId = receiveRecordId;
        this.receiveNumber = receiveNumber;
        this.supplierId = supplierId;
        this.purchaseOrderId = purchaseOrderId;
        this.totalAmount = totalAmount;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("PurchaseReceiveCreatedEvent[factoryId=%s, receiveNumber=%s, supplierId=%s, totalAmount=%s]",
                factoryId, receiveNumber, supplierId, totalAmount);
    }
}
