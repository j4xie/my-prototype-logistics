package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Round 10 Fix — published by MaterialBatchServiceImpl.createMaterialBatch.
 *
 * <p>Drives TriggerChainExecutor for factory-configured trigger chains on the
 * material_batch module. Covers all batch creation sources (purchase receive,
 * 生产退料, 销售退货, 盘盈入库, 赠品入库, 手工调整) — previously only the
 * purchase-receive path had an upstream MaterialReceivedEvent (from
 * PurchaseServiceImpl), so other sources were invisible to trigger chains.</p>
 *
 * <p>This is the 3rd hook of the R9 Canvas Integration Template for
 * material_batch. Hooks 1-2 (validation + customFields persist) were added
 * in R9 commit 5e752ed94.</p>
 */
@Getter
public class MaterialBatchCreatedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String batchId;
    private final String batchNumber;
    private final String materialTypeId;
    private final BigDecimal receiptQuantity;
    private final String sourceDocType;
    private final String sourceDocId;
    private final LocalDateTime createdAt;

    public MaterialBatchCreatedEvent(Object source, String factoryId, String batchId,
                                      String batchNumber, String materialTypeId,
                                      BigDecimal receiptQuantity, String sourceDocType,
                                      String sourceDocId) {
        super(source);
        this.factoryId = factoryId;
        this.batchId = batchId;
        this.batchNumber = batchNumber;
        this.materialTypeId = materialTypeId;
        this.receiptQuantity = receiptQuantity;
        this.sourceDocType = sourceDocType;
        this.sourceDocId = sourceDocId;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("MaterialBatchCreatedEvent[factoryId=%s, batchId=%s, batchNumber=%s, qty=%s, sourceDocType=%s]",
                factoryId, batchId, batchNumber, receiptQuantity, sourceDocType);
    }
}
