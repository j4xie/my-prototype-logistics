package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 销售订单确认事件
 * 当销售订单状态变为已确认时触发，用于驱动供应链协同流程
 */
@Getter
public class SalesOrderConfirmedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String salesOrderId;
    private final LocalDateTime confirmedAt;

    public SalesOrderConfirmedEvent(Object source, String factoryId, String salesOrderId) {
        super(source);
        this.factoryId = factoryId;
        this.salesOrderId = salesOrderId;
        this.confirmedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("SalesOrderConfirmedEvent[factoryId=%s, salesOrderId=%s, confirmedAt=%s]",
                factoryId, salesOrderId, confirmedAt);
    }
}
