package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.time.LocalDateTime;

/**
 * 销售订单财务审核通过事件
 * 当销售订单通过财务审核后触发，用于驱动供应链协同流程（库存检查+生产计划+采购建议）
 * 替代原先的 SalesOrderConfirmedEvent 作为供应链联动的触发点
 */
@Getter
public class SalesOrderFinanceApprovedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String salesOrderId;
    private final Long approvedBy;
    private final LocalDateTime approvedAt;

    public SalesOrderFinanceApprovedEvent(Object source, String factoryId, String salesOrderId, Long approvedBy) {
        super(source);
        this.factoryId = factoryId;
        this.salesOrderId = salesOrderId;
        this.approvedBy = approvedBy;
        this.approvedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("SalesOrderFinanceApprovedEvent[factoryId=%s, salesOrderId=%s, approvedBy=%d, approvedAt=%s]",
                factoryId, salesOrderId, approvedBy, approvedAt);
    }
}
