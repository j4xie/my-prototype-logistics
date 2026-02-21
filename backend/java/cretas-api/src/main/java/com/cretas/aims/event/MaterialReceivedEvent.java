package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 物料收货事件
 * 当采购订单物料入库完成时触发，用于更新库存并驱动后续生产准备流程
 */
@Getter
public class MaterialReceivedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String purchaseOrderId;
    private final String materialTypeId;
    private final BigDecimal receivedQuantity;
    private final LocalDateTime receivedAt;

    public MaterialReceivedEvent(Object source, String factoryId, String purchaseOrderId,
                                  String materialTypeId, BigDecimal receivedQuantity) {
        super(source);
        this.factoryId = factoryId;
        this.purchaseOrderId = purchaseOrderId;
        this.materialTypeId = materialTypeId;
        this.receivedQuantity = receivedQuantity;
        this.receivedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("MaterialReceivedEvent[factoryId=%s, purchaseOrderId=%s, materialTypeId=%s, receivedQuantity=%s, receivedAt=%s]",
                factoryId, purchaseOrderId, materialTypeId, receivedQuantity, receivedAt);
    }
}
