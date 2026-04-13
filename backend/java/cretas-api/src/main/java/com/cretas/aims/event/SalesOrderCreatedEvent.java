package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 销售订单创建事件 (Round 4 Fix P1-14)
 *
 * 订单创建成功时触发，驱动 TriggerChainExecutor 执行配置的触发链。
 * 使用场景：
 *   - 草原鲜牧: 订单创建时快照当日市场价 → HTTP Tool 调用外部价格 API
 *   - 定制订单自动分配生产排程
 *   - 订单创建通知销售主管
 */
@Getter
public class SalesOrderCreatedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String orderId;
    private final String customerId;
    private final BigDecimal totalAmount;
    private final LocalDateTime createdAt;

    public SalesOrderCreatedEvent(Object source, String factoryId, String orderId,
                                   String customerId, BigDecimal totalAmount) {
        super(source);
        this.factoryId = factoryId;
        this.orderId = orderId;
        this.customerId = customerId;
        this.totalAmount = totalAmount;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("SalesOrderCreatedEvent[factoryId=%s, orderId=%s, customerId=%s, totalAmount=%s]",
                factoryId, orderId, customerId, totalAmount);
    }
}
