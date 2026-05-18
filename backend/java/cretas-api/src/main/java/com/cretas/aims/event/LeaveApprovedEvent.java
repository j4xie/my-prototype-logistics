package com.cretas.aims.event;

import com.cretas.aims.entity.hr.enums.LeaveType;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 请假审批通过事件.
 *
 * <p>由 {@code LeaveRequestServiceImpl.doApprove} 发布, 用于下游 listener:
 * <ul>
 *   <li>CompTime listener: leaveType=COMPTIME 时出账 ledger (USE)</li>
 * </ul>
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@Getter
public class LeaveApprovedEvent extends ApplicationEvent {

    private final String factoryId;
    private final String leaveRequestId;
    private final Long userId;
    private final LeaveType leaveType;
    private final BigDecimal durationHours;
    private final LocalDate startDate;
    private final Long approverId;
    private final LocalDateTime approvedAt;

    public LeaveApprovedEvent(Object source, String factoryId, String leaveRequestId,
                              Long userId, LeaveType leaveType,
                              BigDecimal durationHours, LocalDate startDate, Long approverId) {
        super(source);
        this.factoryId = factoryId;
        this.leaveRequestId = leaveRequestId;
        this.userId = userId;
        this.leaveType = leaveType;
        this.durationHours = durationHours;
        this.startDate = startDate;
        this.approverId = approverId;
        this.approvedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return String.format(
                "LeaveApprovedEvent[factory=%s, id=%s, user=%s, type=%s, hours=%s]",
                factoryId, leaveRequestId, userId, leaveType, durationHours);
    }
}
