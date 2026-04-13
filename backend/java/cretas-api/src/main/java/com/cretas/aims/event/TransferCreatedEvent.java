package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Round 11 Fix — published by TransferServiceImpl.createTransfer.
 *
 * <p>Drives TriggerChainExecutor for factory-configured trigger chains on the
 * internal_transfers module. Customer use cases: "跨工厂调拨自动通知对方仓
 * 管", "大额调拨转财务审批", "冷链物资调拨自动创建温度监控任务".</p>
 *
 * <p>Covers both factory-to-factory transfers and within-factory warehouse-to-
 * warehouse transfers (V3 P0-5). Trigger chains can filter by the
 * sourceFactoryId vs. targetFactoryId fields to distinguish.</p>
 */
@Getter
public class TransferCreatedEvent extends ApplicationEvent {

    private final String sourceFactoryId;
    private final String targetFactoryId;
    private final String transferId;
    private final String transferNumber;
    private final String transferType;
    private final String sourceWarehouseId;
    private final String targetWarehouseId;
    private final BigDecimal totalAmount;
    private final LocalDateTime createdAt;

    public TransferCreatedEvent(Object source, String sourceFactoryId, String targetFactoryId,
                                 String transferId, String transferNumber, String transferType,
                                 String sourceWarehouseId, String targetWarehouseId,
                                 BigDecimal totalAmount) {
        super(source);
        this.sourceFactoryId = sourceFactoryId;
        this.targetFactoryId = targetFactoryId;
        this.transferId = transferId;
        this.transferNumber = transferNumber;
        this.transferType = transferType;
        this.sourceWarehouseId = sourceWarehouseId;
        this.targetWarehouseId = targetWarehouseId;
        this.totalAmount = totalAmount;
        this.createdAt = LocalDateTime.now();
    }

    /**
     * Compatibility alias for TriggerChainExecutor which normalizes events via
     * {@code getFactoryId}. Returns the source factory since that's where the
     * trigger chain lives (transfer originator).
     */
    public String getFactoryId() {
        return sourceFactoryId;
    }

    @Override
    public String toString() {
        return String.format("TransferCreatedEvent[source=%s, target=%s, number=%s, type=%s, total=%s]",
                sourceFactoryId, targetFactoryId, transferNumber, transferType, totalAmount);
    }
}
