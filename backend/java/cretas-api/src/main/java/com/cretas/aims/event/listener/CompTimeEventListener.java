package com.cretas.aims.event.listener;

import com.cretas.aims.entity.hr.enums.CompTimeSourceType;
import com.cretas.aims.entity.hr.enums.CompensationType;
import com.cretas.aims.entity.hr.enums.LeaveType;
import com.cretas.aims.event.LeaveApprovedEvent;
import com.cretas.aims.event.OvertimeApprovedEvent;
import com.cretas.aims.service.hr.CompTimeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 调休账户 listener — 监听 OT/Leave 审批通过事件, 自动入账 ledger.
 *
 * <p>设计选择:
 * <ul>
 *   <li>{@code REQUIRES_NEW} 事务: 隔离 ledger 写入失败 — 不影响原 OT/Leave 审批本身.
 *       即使 ledger 写挂 (e.g. DB hiccup), 原 LeaveBalance 仍由 service 层维护.</li>
 *   <li>同步执行: ledger 是后续余额查询 / 报表依赖, 不希望延迟可见.</li>
 *   <li>幂等性: service 内做 {@code findBySourceTypeAndSourceRefId} 检测;
 *       即使 event 被重放 (transaction outbox 重发或 Spring 多次触发), 也只入账一次.</li>
 *   <li>过滤无关事件: OT compensationType=CASH 或 LeaveType≠COMPTIME 时直接跳过.</li>
 * </ul>
 *
 * @author Cretas Team — #835 follow-up CompTime Balance
 * @since 2026-05-18
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CompTimeEventListener {

    private final CompTimeService compTimeService;

    /** OT 审批通过 → COMPTIME 入账 (EARN). */
    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onOvertimeApproved(OvertimeApprovedEvent event) {
        if (event.getCompensationType() != CompensationType.COMPTIME) {
            // CASH 类型由 Payroll 处理, 不入调休账
            return;
        }
        try {
            String note = String.format("加班 %sh 转调休 (单号=%s)",
                    event.getHours(), event.getOvertimeRequestId());
            LocalDateTime srcTime = event.getStartTime() != null
                    ? event.getStartTime() : event.getApprovedAt();
            compTimeService.addEarn(
                    event.getFactoryId(),
                    event.getUserId(),
                    event.getHours(),
                    CompTimeSourceType.OT_APPROVED,
                    event.getOvertimeRequestId(),
                    srcTime,
                    note,
                    event.getApproverId());
        } catch (Exception e) {
            log.error("CompTime listener: addEarn failed for OT {} — skip (LeaveBalance unaffected)",
                    event.getOvertimeRequestId(), e);
        }
    }

    /** Leave 审批通过 → COMPTIME 出账 (USE). */
    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onLeaveApproved(LeaveApprovedEvent event) {
        if (event.getLeaveType() != LeaveType.COMPTIME) {
            // 非调休假 (病假 / 年假 等) 不入调休账
            return;
        }
        try {
            String note = String.format("调休假 %sh (单号=%s)",
                    event.getDurationHours(), event.getLeaveRequestId());
            LocalDateTime srcTime = event.getStartDate() != null
                    ? event.getStartDate().atStartOfDay() : event.getApprovedAt();
            compTimeService.addUse(
                    event.getFactoryId(),
                    event.getUserId(),
                    event.getDurationHours(),
                    CompTimeSourceType.LEAVE_APPROVED,
                    event.getLeaveRequestId(),
                    srcTime,
                    note,
                    event.getApproverId());
        } catch (Exception e) {
            log.error("CompTime listener: addUse failed for Leave {} — skip (LeaveBalance unaffected)",
                    event.getLeaveRequestId(), e);
        }
    }
}
