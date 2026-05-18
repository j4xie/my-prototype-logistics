package com.cretas.aims.service.hr;

import com.cretas.aims.dto.hr.AttendanceHoursSummaryDTO;

import java.util.List;
import java.util.Optional;

/**
 * 月度工时统计聚合服务 (#835 follow-up — 工时统计).
 *
 * <p>只读聚合 — 从 TimeClockRecord + EmployeeShiftAssignment + AttendanceShift +
 * CompTimeBalance 计算单员工 / 工厂全员的月度工时摘要.
 *
 * <p>不修改任何数据 — 纯查询 + 内存聚合.
 *
 * @author Cretas Team — #835 follow-up Attendance Hours
 * @since 2026-05-18
 */
public interface AttendanceHoursAggregatorService {

    /**
     * 单员工某月工时摘要.
     *
     * @param factoryId 工厂 ID
     * @param userId 员工 ID
     * @param yearMonth 'YYYY-MM' 格式
     * @return Optional.empty 若员工该月无任何打卡 + 无排班 (用于触发 R5 防呆 empty state)
     */
    Optional<AttendanceHoursSummaryDTO> computeMonthlyHoursForUser(
            String factoryId, Long userId, String yearMonth);

    /**
     * 工厂某月全员工时摘要.
     *
     * <p>默认 sorted by overtimeHours DESC (前端可前端再排, 但 backend 先按 OT 排
     * 让 Widget 直接拿 top N).
     *
     * @param factoryId 工厂 ID
     * @param yearMonth 'YYYY-MM' 格式
     * @return 全员摘要 (即使无打卡也含排班员工; 完全无关联员工不返)
     */
    List<AttendanceHoursSummaryDTO> computeMonthlyHoursForFactory(
            String factoryId, String yearMonth);
}
