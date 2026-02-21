package com.cretas.aims.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 收款事件
 * 当收到客户或供应商付款时触发，用于更新财务状态并驱动相关业务流程
 */
@Getter
public class PaymentReceivedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String counterpartyId;
    private final BigDecimal amount;
    private final String paymentMethod;
    private final LocalDateTime receivedAt;

    public PaymentReceivedEvent(Object source, String factoryId, String counterpartyId,
                                 BigDecimal amount, String paymentMethod) {
        super(source);
        this.factoryId = factoryId;
        this.counterpartyId = counterpartyId;
        this.amount = amount;
        this.paymentMethod = paymentMethod;
        this.receivedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format("PaymentReceivedEvent[factoryId=%s, counterpartyId=%s, amount=%s, paymentMethod=%s, receivedAt=%s]",
                factoryId, counterpartyId, amount, paymentMethod, receivedAt);
    }
}
