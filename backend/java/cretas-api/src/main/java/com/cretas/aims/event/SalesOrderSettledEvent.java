package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class SalesOrderSettledEvent extends ApplicationEvent {

    private final String factoryId;
    private final String salesOrderId;
    private final BigDecimal totalPaid;
    private final LocalDateTime settledAt;

    public SalesOrderSettledEvent(Object source, String factoryId, String salesOrderId,
                                   BigDecimal totalPaid) {
        super(source);
        this.factoryId = factoryId;
        this.salesOrderId = salesOrderId;
        this.totalPaid = totalPaid;
        this.settledAt = LocalDateTime.now();
    }
}
