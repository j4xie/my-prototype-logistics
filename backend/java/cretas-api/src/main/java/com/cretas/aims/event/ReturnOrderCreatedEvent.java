package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Round 11 Fix — published by ReturnOrderServiceImpl.createReturnOrder.
 *
 * <p>Drives TriggerChainExecutor for factory-configured trigger chains on the
 * sales_return module (also covers PURCHASE_RETURN via the shared returnType
 * enum). Common customer use cases: "客户投诉自动通知销售主管", "退货超
 * 1000元转财务审批", "自动创建质量分析任务".</p>
 *
 * <p>This is the event hook of the R9 Canvas Integration Template for
 * return_orders. Other hooks (validation + customFields persist) are added
 * to createReturnOrder in the same commit.</p>
 */
@Getter
public class ReturnOrderCreatedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String returnOrderId;
    private final String returnNumber;
    private final String returnType;
    private final String counterpartyId;
    private final String sourceOrderId;
    private final BigDecimal totalAmount;
    private final LocalDateTime createdAt;

    public ReturnOrderCreatedEvent(Object source, String factoryId, String returnOrderId,
                                    String returnNumber, String returnType, String counterpartyId,
                                    String sourceOrderId, BigDecimal totalAmount) {
        super(source);
        this.factoryId = factoryId;
        this.returnOrderId = returnOrderId;
        this.returnNumber = returnNumber;
        this.returnType = returnType;
        this.counterpartyId = counterpartyId;
        this.sourceOrderId = sourceOrderId;
        this.totalAmount = totalAmount;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("ReturnOrderCreatedEvent[factoryId=%s, returnNumber=%s, type=%s, counterpartyId=%s, total=%s]",
                factoryId, returnNumber, returnType, counterpartyId, totalAmount);
    }
}
