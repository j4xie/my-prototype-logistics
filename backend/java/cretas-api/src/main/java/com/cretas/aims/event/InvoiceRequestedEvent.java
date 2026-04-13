package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class InvoiceRequestedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String invoiceId;
    private final String salesOrderId;
    private final BigDecimal amount;
    private final LocalDateTime createdAt;

    public InvoiceRequestedEvent(Object source, String factoryId, String invoiceId,
                                   String salesOrderId, BigDecimal amount) {
        super(source);
        this.factoryId = factoryId;
        this.invoiceId = invoiceId;
        this.salesOrderId = salesOrderId;
        this.amount = amount;
        this.createdAt = LocalDateTime.now();
    }
}
