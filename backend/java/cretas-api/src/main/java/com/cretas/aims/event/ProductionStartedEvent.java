package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.time.LocalDateTime;

@Getter
public class ProductionStartedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String planId;
    private final String planNumber;
    private final String productTypeId;
    private final LocalDateTime createdAt;

    public ProductionStartedEvent(Object source, String factoryId, String planId,
                                    String planNumber, String productTypeId) {
        super(source);
        this.factoryId = factoryId;
        this.planId = planId;
        this.planNumber = planNumber;
        this.productTypeId = productTypeId;
        this.createdAt = LocalDateTime.now();
    }
}
