package com.cretas.aims.dto.hr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 月度工时统计 DTO (#835 follow-up — 工时统计).
 *
 * <p>聚合源:
 * <ul>
 *   <li>workedHours / overtimeHours / lateMinutes — 来自 TimeClockRecord</li>
 *   <li>scheduledHours / absentDays — 来自 EmployeeShiftAssignment + AttendanceShift</li>
 *   <li>comptimeEarned — 与 OT 审批联动 (此 DTO 仅口径展示, 实际余额走 CompTimeService)</li>
 * </ul>
 *
 * <p>R2 防呆: rows 必含 userId + userName + department + yearMonth 上下文.
 *
 * @author Cretas Team — #835 follow-up Attendance Hours
 * @since 2026-05-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceHoursSummaryDTO {

    /** 员工 ID. */
    private Long userId;

    /** 员工姓名 (R2 防呆: 表格必有名字, 不只 ID). */
    private String userName;

    /** 部门 (R2 防呆 + 部门过滤). */
    private String department;

    /** 月份 YYYY-MM. */
    private String yearMonth;

    /** 本月实际工时 (h, 来自 TimeClockRecord.workDurationMinutes 累计 / 60). */
    private BigDecimal workedHours;

    /** 本月排班应到工时 (h, 来自 EmployeeShiftAssignment × AttendanceShift). */
    private BigDecimal scheduledHours;

    /** 本月加班工时 (h, workDurationMinutes - shift expected 每日累计 / 60). */
    private BigDecimal overtimeHours;

    /** 本月迟到分钟数累计 (min, 来自 TimeClockRecord.clockInTime > shift.startTime). */
    private Integer lateMinutes;

    /** 本月缺勤天数 (有排班 无打卡). */
    private Integer absentDays;

    /** 本月已结调休积分 (h, 不可负, 由 OT 审批入账, 此处为口径展示). */
    private BigDecimal comptimeEarned;

    /** 本月已打卡天数. */
    private Integer clockedDays;

    /** 本月排班天数 (含 ABSENT). */
    private Integer scheduledDays;
}
