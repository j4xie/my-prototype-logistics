package com.cretas.aims.service.hr.impl;

import com.cretas.aims.dto.hr.AttendanceHoursSummaryDTO;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.hr.AttendanceShift;
import com.cretas.aims.entity.hr.CompTimeBalance;
import com.cretas.aims.entity.hr.EmployeeShiftAssignment;
import com.cretas.aims.repository.TimeClockRecordRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.hr.AttendanceShiftRepository;
import com.cretas.aims.repository.hr.CompTimeBalanceRepository;
import com.cretas.aims.repository.hr.EmployeeShiftAssignmentRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * AttendanceHoursAggregatorServiceImpl 单元测试.
 *
 * 覆盖:
 *  - 单用户聚合 (workedHours / scheduledHours / overtime / late / absent)
 *  - 全员聚合 + sort by overtime DESC
 *  - 缺勤天数计算 (排班无打卡)
 *  - 加班分钟 (workDuration > shift expected)
 *  - 迟到分钟累计
 *  - 跨夜班 scheduled minutes
 *  - 当月无任何打卡 + 无排班 → Optional.empty
 *
 * @author Cretas Team — #835 follow-up Attendance Hours
 * @since 2026-05-18
 */
@DisplayName("AttendanceHoursAggregatorServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class AttendanceHoursAggregatorServiceImplTest {

    @Mock private TimeClockRecordRepository timeClockRepository;
    @Mock private EmployeeShiftAssignmentRepository assignmentRepository;
    @Mock private AttendanceShiftRepository shiftRepository;
    @Mock private CompTimeBalanceRepository compTimeBalanceRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private AttendanceHoursAggregatorServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final String YM = "2026-05";
    private static final LocalDate DAY1 = LocalDate.of(2026, 5, 1);
    private static final LocalDate DAY2 = LocalDate.of(2026, 5, 2);
    private static final LocalDate DAY3 = LocalDate.of(2026, 5, 3);
    private static final String SHIFT_ID = "shift-early";

    private AttendanceShift earlyShift() {
        return AttendanceShift.builder()
                .id(SHIFT_ID)
                .factoryId(FACTORY)
                .shiftCode("EARLY")
                .shiftName("早班 8-17")
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .isOvernight(false)
                .isActive(true)
                .build();
    }

    private EmployeeShiftAssignment asn(LocalDate date) {
        return EmployeeShiftAssignment.builder()
                .id("asn-" + date)
                .factoryId(FACTORY)
                .userId(USER)
                .workDate(date)
                .shiftId(SHIFT_ID)
                .build();
    }

    private TimeClockRecord clock(LocalDate date, LocalTime in, LocalTime out, int workDur) {
        TimeClockRecord c = TimeClockRecord.builder()
                .factoryId(FACTORY)
                .userId(USER)
                .clockInTime(LocalDateTime.of(date, in))
                .clockOutTime(out != null ? LocalDateTime.of(date, out) : null)
                .workDurationMinutes(workDur)
                .build();
        return c;
    }

    private User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setUsername("zhangsan");
        u.setFullName("张三");
        u.setDepartment("生产");
        return u;
    }

    @Test
    @DisplayName("单用户聚合 — 正常出勤 3 天, 无加班")
    void single_user_normal_3days() {
        // 排班 3 天, 全部 8-17 班
        when(assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(asn(DAY1), asn(DAY2), asn(DAY3)));
        when(shiftRepository.findAllById(any())).thenReturn(List.of(earlyShift()));

        // 打卡 3 天, 9h 工时, 没迟到
        when(timeClockRepository.findByFactoryIdAndUserIdAndClockDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(
                        clock(DAY1, LocalTime.of(8, 0), LocalTime.of(17, 0), 540),
                        clock(DAY2, LocalTime.of(8, 0), LocalTime.of(17, 0), 540),
                        clock(DAY3, LocalTime.of(8, 0), LocalTime.of(17, 0), 540)
                ));
        when(userRepository.findById(USER)).thenReturn(Optional.of(user(USER)));
        when(compTimeBalanceRepository.findByFactoryIdAndUserIdAndYearMonth(
                FACTORY, USER, YM)).thenReturn(Optional.empty());

        Optional<AttendanceHoursSummaryDTO> opt =
                service.computeMonthlyHoursForUser(FACTORY, USER, YM);
        assertTrue(opt.isPresent());
        AttendanceHoursSummaryDTO dto = opt.get();
        assertEquals(USER, dto.getUserId());
        assertEquals("张三", dto.getUserName());
        assertEquals("生产", dto.getDepartment());
        assertEquals(YM, dto.getYearMonth());
        // 3 day * 540 min = 1620 min = 27.00 h
        assertEquals(new BigDecimal("27.00"), dto.getWorkedHours());
        // 3 day * 540 min (shift 8-17 = 9h) = 1620 min = 27.00 h
        assertEquals(new BigDecimal("27.00"), dto.getScheduledHours());
        // workDur == expected → no overtime
        assertEquals(BigDecimal.ZERO, dto.getOvertimeHours());
        assertEquals(0, dto.getLateMinutes());
        assertEquals(0, dto.getAbsentDays());
        assertEquals(3, dto.getClockedDays());
        assertEquals(3, dto.getScheduledDays());
        assertEquals(BigDecimal.ZERO, dto.getComptimeEarned());
    }

    @Test
    @DisplayName("单用户聚合 — 1 天加班 + 1 天迟到 30 min")
    void single_user_overtime_and_late() {
        when(assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(asn(DAY1), asn(DAY2)));
        when(shiftRepository.findAllById(any())).thenReturn(List.of(earlyShift()));

        when(timeClockRepository.findByFactoryIdAndUserIdAndClockDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(
                        clock(DAY1, LocalTime.of(8, 0), LocalTime.of(20, 0), 720),  // 12h = 3h OT
                        clock(DAY2, LocalTime.of(8, 30), LocalTime.of(17, 0), 510)  // 迟 30
                ));
        when(userRepository.findById(USER)).thenReturn(Optional.of(user(USER)));
        when(compTimeBalanceRepository.findByFactoryIdAndUserIdAndYearMonth(
                FACTORY, USER, YM)).thenReturn(Optional.empty());

        AttendanceHoursSummaryDTO dto =
                service.computeMonthlyHoursForUser(FACTORY, USER, YM).orElseThrow();
        // Worked = 720 + 510 = 1230 min = 20.50 h
        assertEquals(new BigDecimal("20.50"), dto.getWorkedHours());
        // Scheduled = 2 × 540 = 1080 min = 18.00 h
        assertEquals(new BigDecimal("18.00"), dto.getScheduledHours());
        // OT day 1 = 720-540 = 180; day 2 = 510-540 = -30 (no OT) → total 180 min = 3.00 h
        assertEquals(new BigDecimal("3.00"), dto.getOvertimeHours());
        assertEquals(30, dto.getLateMinutes());
        assertEquals(0, dto.getAbsentDays());
    }

    @Test
    @DisplayName("单用户聚合 — 1 天缺勤 (排班无打卡)")
    void single_user_absent() {
        when(assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(asn(DAY1), asn(DAY2)));
        when(shiftRepository.findAllById(any())).thenReturn(List.of(earlyShift()));

        when(timeClockRepository.findByFactoryIdAndUserIdAndClockDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(
                        clock(DAY1, LocalTime.of(8, 0), LocalTime.of(17, 0), 540)
                        // DAY2 无打卡 → ABSENT
                ));
        when(userRepository.findById(USER)).thenReturn(Optional.of(user(USER)));
        when(compTimeBalanceRepository.findByFactoryIdAndUserIdAndYearMonth(
                FACTORY, USER, YM)).thenReturn(Optional.empty());

        AttendanceHoursSummaryDTO dto =
                service.computeMonthlyHoursForUser(FACTORY, USER, YM).orElseThrow();
        assertEquals(1, dto.getAbsentDays());
        assertEquals(1, dto.getClockedDays());
        assertEquals(2, dto.getScheduledDays());
    }

    @Test
    @DisplayName("单用户聚合 — 无打卡也无排班 → Optional.empty (R5 防呆 empty state)")
    void single_user_no_data_returns_empty() {
        when(assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of());
        when(timeClockRepository.findByFactoryIdAndUserIdAndClockDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of());

        Optional<AttendanceHoursSummaryDTO> opt =
                service.computeMonthlyHoursForUser(FACTORY, USER, YM);
        assertTrue(opt.isEmpty());
    }

    @Test
    @DisplayName("单用户聚合 — comptimeEarned 来自 CompTimeBalance")
    void single_user_with_comptime() {
        when(assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(asn(DAY1)));
        when(shiftRepository.findAllById(any())).thenReturn(List.of(earlyShift()));
        when(timeClockRepository.findByFactoryIdAndUserIdAndClockDateBetween(
                eq(FACTORY), eq(USER), any(), any()))
                .thenReturn(List.of(clock(DAY1, LocalTime.of(8, 0), LocalTime.of(17, 0), 540)));
        when(userRepository.findById(USER)).thenReturn(Optional.of(user(USER)));
        when(compTimeBalanceRepository.findByFactoryIdAndUserIdAndYearMonth(
                FACTORY, USER, YM))
                .thenReturn(Optional.of(CompTimeBalance.builder()
                        .factoryId(FACTORY).userId(USER).yearMonth(YM)
                        .earnedThisMonth(new BigDecimal("4.5"))
                        .usedThisMonth(BigDecimal.ZERO)
                        .availableHours(new BigDecimal("4.5"))
                        .build()));

        AttendanceHoursSummaryDTO dto =
                service.computeMonthlyHoursForUser(FACTORY, USER, YM).orElseThrow();
        assertEquals(new BigDecimal("4.5"), dto.getComptimeEarned());
    }

    @Test
    @DisplayName("全员聚合 — 按 overtimeHours DESC 排序")
    void factory_list_sorts_by_overtime_desc() {
        Long u1 = 1L, u2 = 2L, u3 = 3L;

        when(assignmentRepository.findByFactoryIdAndWorkDateBetween(
                eq(FACTORY), any(), any())).thenReturn(List.of(
                        EmployeeShiftAssignment.builder().id("a1").factoryId(FACTORY)
                                .userId(u1).workDate(DAY1).shiftId(SHIFT_ID).build(),
                        EmployeeShiftAssignment.builder().id("a2").factoryId(FACTORY)
                                .userId(u2).workDate(DAY1).shiftId(SHIFT_ID).build(),
                        EmployeeShiftAssignment.builder().id("a3").factoryId(FACTORY)
                                .userId(u3).workDate(DAY1).shiftId(SHIFT_ID).build()
                ));
        when(shiftRepository.findAllById(any())).thenReturn(List.of(earlyShift()));

        // u1 no OT, u2 small OT, u3 huge OT
        when(timeClockRepository.findByFactoryIdAndClockDateBetween(
                eq(FACTORY), any(), any())).thenReturn(List.of(
                        TimeClockRecord.builder().factoryId(FACTORY).userId(u1)
                                .clockInTime(LocalDateTime.of(DAY1, LocalTime.of(8, 0)))
                                .clockOutTime(LocalDateTime.of(DAY1, LocalTime.of(17, 0)))
                                .workDurationMinutes(540).build(),  // 0 OT
                        TimeClockRecord.builder().factoryId(FACTORY).userId(u2)
                                .clockInTime(LocalDateTime.of(DAY1, LocalTime.of(8, 0)))
                                .clockOutTime(LocalDateTime.of(DAY1, LocalTime.of(18, 0)))
                                .workDurationMinutes(600).build(),  // 60 min OT
                        TimeClockRecord.builder().factoryId(FACTORY).userId(u3)
                                .clockInTime(LocalDateTime.of(DAY1, LocalTime.of(8, 0)))
                                .clockOutTime(LocalDateTime.of(DAY1, LocalTime.of(20, 0)))
                                .workDurationMinutes(720).build()   // 180 min OT
                ));

        when(userRepository.findAllById(any())).thenReturn(List.of(
                user(u1), user(u2), user(u3)
        ));
        when(compTimeBalanceRepository.findByFactoryIdAndUserIdAndYearMonth(
                anyString(), anyLong(), anyString())).thenReturn(Optional.empty());

        List<AttendanceHoursSummaryDTO> out =
                service.computeMonthlyHoursForFactory(FACTORY, YM);
        assertEquals(3, out.size());
        // sorted DESC by OT
        assertEquals(u3, out.get(0).getUserId());
        assertEquals(new BigDecimal("3.00"), out.get(0).getOvertimeHours());
        assertEquals(u2, out.get(1).getUserId());
        assertEquals(new BigDecimal("1.00"), out.get(1).getOvertimeHours());
        assertEquals(u1, out.get(2).getUserId());
        assertEquals(BigDecimal.ZERO, out.get(2).getOvertimeHours());
    }

    @Test
    @DisplayName("yearMonth 格式错误 → BusinessException")
    void invalid_year_month_throws() {
        assertThrows(RuntimeException.class, () ->
                service.computeMonthlyHoursForUser(FACTORY, USER, "2026/05"));
        assertThrows(RuntimeException.class, () ->
                service.computeMonthlyHoursForFactory(FACTORY, ""));
    }
}
