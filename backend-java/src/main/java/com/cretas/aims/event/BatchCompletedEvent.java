package com.cretas.aims.event;

import com.cretas.aims.entity.ProductionBatch;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 生产批次完成事件
 * 当生产批次状态变为 COMPLETED 时触发此事件
 * 用于异步收集训练数据
 */
@Getter
public class BatchCompletedEvent extends ApplicationEvent {

    private final ProductionBatch batch;
    private final String factoryId;
    private final Long batchId;
    private final LocalDateTime completedAt;

    public BatchCompletedEvent(Object source, ProductionBatch batch) {
        super(source);
        this.batch = batch;
        this.factoryId = batch.getFactoryId();
        this.batchId = batch.getId();
        this.completedAt = batch.getEndTime() != null
            ? batch.getEndTime()
            : LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("BatchCompletedEvent[factoryId=%s, batchId=%d, completedAt=%s]",
            factoryId, batchId, completedAt);
    }
}
