package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class ShipmentCreatedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String shipmentId;
    private final String shipmentNumber;
    private final String customerId;
    private final String orderNumber;
    private final BigDecimal quantity;
    private final BigDecimal totalAmount;
    private final LocalDateTime createdAt;

    public ShipmentCreatedEvent(Object source, String factoryId, String shipmentId,
                                 String shipmentNumber, String customerId, String orderNumber,
                                 BigDecimal quantity, BigDecimal totalAmount) {
        super(source);
        this.factoryId = factoryId;
        this.shipmentId = shipmentId;
        this.shipmentNumber = shipmentNumber;
        this.customerId = customerId;
        this.orderNumber = orderNumber;
        this.quantity = quantity;
        this.totalAmount = totalAmount;
        this.createdAt = LocalDateTime.now();
    }
}
