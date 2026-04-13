package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class BatchMaterialConsumedEvent extends ApplicationEvent {
    private final String factoryId;
    private final String batchId;
    private final BigDecimal consumedQuantity;
    private final String productionPlanId;
    private final LocalDateTime createdAt;

    public BatchMaterialConsumedEvent(Object source, String factoryId, String batchId,
                                       BigDecimal consumedQuantity, String productionPlanId) {
        super(source);
        this.factoryId = factoryId;
        this.batchId = batchId;
        this.consumedQuantity = consumedQuantity;
        this.productionPlanId = productionPlanId;
        this.createdAt = LocalDateTime.now();
    }
}
