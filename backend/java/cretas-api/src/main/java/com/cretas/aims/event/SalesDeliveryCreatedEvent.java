package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 销售发货单创建事件 (Round 9 Fix — R8-α Gap #1)
 *
 * <p>Published from SalesServiceImpl.createDeliveryRecord. Drives TriggerChainExecutor
 * to execute factory-configured delivery trigger chains (e.g. 物流通知, WMS 推送,
 * 冷链温度监控启动).</p>
 *
 * <p>Previously the entire delivery path had zero Spring event publication, so
 * factory-configured trigger chains on `delivery` module literally could never fire.
 * This is part of the SalesDelivery Canvas integration template.</p>
 */
@Getter
public class SalesDeliveryCreatedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String deliveryId;
    private final String deliveryNumber;
    private final String customerId;
    private final String salesOrderId;
    private final LocalDate deliveryDate;
    private final BigDecimal totalAmount;
    private final LocalDateTime createdAt;

    public SalesDeliveryCreatedEvent(Object source, String factoryId, String deliveryId,
                                      String deliveryNumber, String customerId, String salesOrderId,
                                      LocalDate deliveryDate, BigDecimal totalAmount) {
        super(source);
        this.factoryId = factoryId;
        this.deliveryId = deliveryId;
        this.deliveryNumber = deliveryNumber;
        this.customerId = customerId;
        this.salesOrderId = salesOrderId;
        this.deliveryDate = deliveryDate;
        this.totalAmount = totalAmount;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("SalesDeliveryCreatedEvent[factoryId=%s, deliveryId=%s, deliveryNumber=%s, totalAmount=%s]",
                factoryId, deliveryId, deliveryNumber, totalAmount);
    }
}
