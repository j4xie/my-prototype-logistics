package com.cretas.aims.event;

import com.cretas.aims.entity.hr.enums.CompensationType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 加班审批通过事件.
 *
 * <p>由 {@code OvertimeRequestServiceImpl.doApprove} 发布, 用于下游 listener:
 * <ul>
 *   <li>CompTime listener: compensationType=COMPTIME 时入账 ledger (EARN)</li>
 *   <li>Payroll listener (future): compensationType=CASH 时累计加班工资</li>
 * </ul>
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@Getter
public class OvertimeApprovedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String overtimeRequestId;
    private final Long userId;
    private final CompensationType compensationType;
    private final BigDecimal hours;
    private final LocalDateTime startTime;
    private final Long approverId;
    private final LocalDateTime approvedAt;

    public OvertimeApprovedEvent(Object source, String factoryId, String overtimeRequestId,
                                 Long userId, CompensationType compensationType,
                                 BigDecimal hours, LocalDateTime startTime, Long approverId) {
        super(source);
        this.factoryId = factoryId;
        this.overtimeRequestId = overtimeRequestId;
        this.userId = userId;
        this.compensationType = compensationType;
        this.hours = hours;
        this.startTime = startTime;
        this.approverId = approverId;
        this.approvedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format(
                "OvertimeApprovedEvent[factory=%s, id=%s, user=%s, comp=%s, hours=%s]",
                factoryId, overtimeRequestId, userId, compensationType, hours);
    }
}
