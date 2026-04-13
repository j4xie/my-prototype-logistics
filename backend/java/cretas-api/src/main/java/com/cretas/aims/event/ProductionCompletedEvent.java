package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class ProductionCompletedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String planId;
    private final String planNumber;
    private final String productTypeId;
    private final BigDecimal actualQuantity;
    private final LocalDateTime createdAt;

    public ProductionCompletedEvent(Object source, String factoryId, String planId,
                                      String planNumber, String productTypeId,
                                      BigDecimal actualQuantity) {
        super(source);
        this.factoryId = factoryId;
        this.planId = planId;
        this.planNumber = planNumber;
        this.productTypeId = productTypeId;
        this.actualQuantity = actualQuantity;
        this.createdAt = LocalDateTime.now();
    }
}
