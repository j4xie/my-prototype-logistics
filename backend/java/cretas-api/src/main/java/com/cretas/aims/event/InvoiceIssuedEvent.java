package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class InvoiceIssuedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String invoiceId;
    private final String salesOrderId;
    private final BigDecimal totalAmount;
    private final LocalDateTime issuedAt;

    public InvoiceIssuedEvent(Object source, String factoryId, String invoiceId,
                               String salesOrderId, BigDecimal totalAmount) {
        super(source);
        this.factoryId = factoryId;
        this.invoiceId = invoiceId;
        this.salesOrderId = salesOrderId;
        this.totalAmount = totalAmount;
        this.issuedAt = LocalDateTime.now();
    }
}
