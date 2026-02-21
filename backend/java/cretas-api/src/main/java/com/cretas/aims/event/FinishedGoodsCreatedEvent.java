package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 成品创建事件
 * 当生产完成并创建成品批次入库时触发，用于关联销售订单并驱动出库流程
 */
@Getter
public class FinishedGoodsCreatedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String sourceOrderId;
    private final String productTypeId;
    private final BigDecimal quantity;
    private final String batchId;
    private final LocalDateTime createdAt;

    public FinishedGoodsCreatedEvent(Object source, String factoryId, String sourceOrderId,
                                      String productTypeId, BigDecimal quantity, String batchId) {
        super(source);
        this.factoryId = factoryId;
        this.sourceOrderId = sourceOrderId;
        this.productTypeId = productTypeId;
        this.quantity = quantity;
        this.batchId = batchId;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("FinishedGoodsCreatedEvent[factoryId=%s, sourceOrderId=%s, productTypeId=%s, quantity=%s, batchId=%s, createdAt=%s]",
                factoryId, sourceOrderId, productTypeId, quantity, batchId, createdAt);
    }
}
