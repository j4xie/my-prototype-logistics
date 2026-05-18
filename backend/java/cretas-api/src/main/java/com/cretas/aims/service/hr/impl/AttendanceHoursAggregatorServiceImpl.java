package com.cretas.aims.service.hr.impl;

import com.cretas.aims.dto.hr.AttendanceHoursSummaryDTO;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.hr.AttendanceShift;
import com.cretas.aims.entity.hr.CompTimeBalance;
import com.cretas.aims.entity.hr.EmployeeShiftAssignment;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.TimeClockRecordRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.hr.AttendanceShiftRepository;
import com.cretas.aims.repository.hr.CompTimeBalanceRepository;
import com.cretas.aims.repository.hr.EmployeeShiftAssignmentRepository;
import com.cretas.aims.service.hr.AttendanceHoursAggregatorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 月度工时统计聚合实现 (#835 follow-up — 工时统计).
 *
 * <p>算法 (compute single-user 或 全员):
 * <ol>
 *   <li>加载月度所有 EmployeeShiftAssignment (即 scheduled days)</li>
 *   <li>预加载 shift 字典 — 用于算 scheduledHours / overtime delta</li>
 *   <li>加载月度所有 TimeClockRecord</li>
 *   <li>每个员工: 累计 workDurationMinutes / 排班 expected min / 迟到 min / OT min / absent days</li>
 *   <li>合并 CompTimeBalance 当月 earnedThisMonth</li>
 *   <li>预加载 User 拿姓名 + 部门 (R2 防呆)</li>
 * </ol>
 *
 * <p>NOTE: 跨夜班 (shift.isOvernight=true) 的 scheduled minutes 用
 * (24 * 60 - startToEnd) 修正.
 *
 * @author Cretas Team — #835 follow-up Attendance Hours
 * @since 2026-05-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceHoursAggregatorServiceImpl implements AttendanceHoursAggregatorService {

    private final TimeClockRecordRepository timeClockRepository;
    private final EmployeeShiftAssignmentRepository assignmentRepository;
    private final AttendanceShiftRepository shiftRepository;
    private final CompTimeBalanceRepository compTimeBalanceRepository;
    private final UserRepository userRepository;

    private static final BigDecimal MINUTES_PER_HOUR = new BigDecimal("60");

    @Override
    @Transactional(readOnly = true)
    public Optional<AttendanceHoursSummaryDTO> computeMonthlyHoursForUser(
            String factoryId, Long userId, String yearMonth) {
        if (factoryId == null || userId == null) {
            throw new BusinessException("factoryId / userId 必填");
        }
        YearMonth ym = parseYearMonth(yearMonth);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        LocalDate today = LocalDate.now();
        if (end.isAfter(today)) end = today;
        if (start.isAfter(end)) {
            // 未来月份 — 返回空 summary (R5 防呆触发 empty state)
            return Optional.empty();
        }

        // 1. 排班 + shift 字典
        List<EmployeeShiftAssignment> assignments =
                assignmentRepository.findByFactoryIdAndUserIdAndWorkDateBetween(
                        factoryId, userId, start, end);
        Map<String, AttendanceShift> shiftMap = loadShiftMap(assignments);

        // 2. 打卡记录
        LocalDateTime rangeStart = start.atStartOfDay();
        LocalDateTime rangeEnd = end.plusDays(1).atStartOfDay();
        List<TimeClockRecord> clocks =
                timeClockRepository.findByFactoryIdAndUserIdAndClockDateBetween(
                        factoryId, userId, rangeStart, rangeEnd);

        if (assignments.isEmpty() && clocks.isEmpty()) {
            return Optional.empty();
        }

        // 3. User 上下文
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            log.warn("User {} not found in factory {}", userId, factoryId);
            return Optional.empty();
        }
        User user = userOpt.get();

        // 4. CompTime 当月
        BigDecimal comptimeEarned = compTimeBalanceRepository
                .findByFactoryIdAndUserIdAndYearMonth(factoryId, userId, ym.toString())
                .map(CompTimeBalance::getEarnedThisMonth)
                .orElse(BigDecimal.ZERO);

        AttendanceHoursSummaryDTO dto = aggregateForUser(
                factoryId, user, ym.toString(), assignments, clocks, shiftMap, comptimeEarned);
        return Optional.of(dto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceHoursSummaryDTO> computeMonthlyHoursForFactory(
            String factoryId, String yearMonth) {
        if (factoryId == null) {
            throw new BusinessException("factoryId 必填");
        }
        YearMonth ym = parseYearMonth(yearMonth);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        LocalDate today = LocalDate.now();
        if (end.isAfter(today)) end = today;
        if (start.isAfter(end)) {
            return List.of();
        }

        // 1. 排班 + shift 字典
        List<EmployeeShiftAssignment> allAssignments =
                assignmentRepository.findByFactoryIdAndWorkDateBetween(factoryId, start, end);
        Map<String, AttendanceShift> shiftMap = loadShiftMap(allAssignments);

        // 2. 打卡 (整厂)
        LocalDateTime rangeStart = start.atStartOfDay();
        LocalDateTime rangeEnd = end.plusDays(1).atStartOfDay();
        List<TimeClockRecord> allClocks =
                timeClockRepository.findByFactoryIdAndClockDateBetween(
                        factoryId, rangeStart, rangeEnd);

        // 收集所有出现的 userIds (排班 ∪ 打卡)
        Set<Long> userIds = new HashSet<>();
        for (EmployeeShiftAssignment a : allAssignments) userIds.add(a.getUserId());
        for (TimeClockRecord c : allClocks) userIds.add(c.getUserId());
        if (userIds.isEmpty()) return List.of();

        // 3. User 字典 (R2 防呆)
        Map<Long, User> userMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        // 4. CompTime balances (当月)
        Map<Long, BigDecimal> comptimeMap = new HashMap<>();
        for (Long uid : userIds) {
            compTimeBalanceRepository
                    .findByFactoryIdAndUserIdAndYearMonth(factoryId, uid, ym.toString())
                    .ifPresent(b -> comptimeMap.put(uid, b.getEarnedThisMonth()));
        }

        // 5. 按 userId 分组
        Map<Long, List<EmployeeShiftAssignment>> asnByUser =
                allAssignments.stream().collect(Collectors.groupingBy(EmployeeShiftAssignment::getUserId));
        Map<Long, List<TimeClockRecord>> clockByUser =
                allClocks.stream().collect(Collectors.groupingBy(TimeClockRecord::getUserId));

        List<AttendanceHoursSummaryDTO> out = new ArrayList<>(userIds.size());
        for (Long uid : userIds) {
            User u = userMap.get(uid);
            if (u == null) {
                log.warn("User {} not found while aggregating factory {} {}", uid, factoryId, yearMonth);
                continue;
            }
            AttendanceHoursSummaryDTO dto = aggregateForUser(
                    factoryId, u, ym.toString(),
                    asnByUser.getOrDefault(uid, List.of()),
                    clockByUser.getOrDefault(uid, List.of()),
                    shiftMap,
                    comptimeMap.getOrDefault(uid, BigDecimal.ZERO));
            out.add(dto);
        }

        // 6. 默认按加班工时 DESC, 同则按缺勤天数 DESC, 让 Widget 直接 top N
        out.sort(Comparator.comparing(AttendanceHoursSummaryDTO::getOvertimeHours, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(AttendanceHoursSummaryDTO::getAbsentDays, Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    // ---------- helpers ----------

    private AttendanceHoursSummaryDTO aggregateForUser(String factoryId,
                                                       User user,
                                                       String yearMonth,
                                                       List<EmployeeShiftAssignment> assignments,
                                                       List<TimeClockRecord> clocks,
                                                       Map<String, AttendanceShift> shiftMap,
                                                       BigDecimal comptimeEarned) {
        // 索引: workDate → clock
        Map<LocalDate, TimeClockRecord> clockByDate = new HashMap<>();
        for (TimeClockRecord c : clocks) {
            LocalDate d = c.getClockInTime() != null ? c.getClockInTime().toLocalDate() : null;
            if (d == null) continue;
            clockByDate.putIfAbsent(d, c);
        }

        long workedMinutes = 0L;
        long scheduledMinutes = 0L;
        long overtimeMinutes = 0L;
        long lateMinutes = 0L;
        int absentDays = 0;

        // 已排班且应到 — 用于绝大部分计算
        for (EmployeeShiftAssignment asn : assignments) {
            AttendanceShift shift = shiftMap.get(asn.getShiftId());
            if (shift == null) continue;
            int expectedMin = computeShiftMinutes(shift);
            scheduledMinutes += expectedMin;

            TimeClockRecord clock = clockByDate.get(asn.getWorkDate());
            if (clock == null || clock.getClockInTime() == null) {
                absentDays++;
                continue;
            }
            if (clock.getWorkDurationMinutes() != null) {
                workedMinutes += clock.getWorkDurationMinutes();
                int ot = clock.getWorkDurationMinutes() - expectedMin;
                if (ot > 0) overtimeMinutes += ot;
            }
            // 迟到分钟数
            LocalTime actualIn = clock.getClockInTime().toLocalTime();
            LocalTime expectedIn = shift.getStartTime();
            long late = Duration.between(expectedIn, actualIn).toMinutes();
            if (late > 0) lateMinutes += late;
        }

        // 有打卡但当天无排班 — 仍算入 worked / overtime (按 8h 标准)
        Set<LocalDate> scheduledDates = assignments.stream()
                .map(EmployeeShiftAssignment::getWorkDate)
                .collect(Collectors.toSet());
        int standardMin = 8 * 60;
        for (Map.Entry<LocalDate, TimeClockRecord> e : clockByDate.entrySet()) {
            if (scheduledDates.contains(e.getKey())) continue;
            TimeClockRecord clock = e.getValue();
            if (clock.getWorkDurationMinutes() == null) continue;
            workedMinutes += clock.getWorkDurationMinutes();
            int ot = clock.getWorkDurationMinutes() - standardMin;
            if (ot > 0) overtimeMinutes += ot;
        }

        int clockedDays = clockByDate.size();
        int scheduledDays = assignments.size();

        return AttendanceHoursSummaryDTO.builder()
                .userId(user.getId())
                .userName(coalesceName(user))
                .department(user.getDepartment())
                .yearMonth(yearMonth)
                .workedHours(minutesToHours(workedMinutes))
                .scheduledHours(minutesToHours(scheduledMinutes))
                .overtimeHours(minutesToHours(overtimeMinutes))
                .lateMinutes((int) lateMinutes)
                .absentDays(absentDays)
                .comptimeEarned(comptimeEarned != null ? comptimeEarned : BigDecimal.ZERO)
                .clockedDays(clockedDays)
                .scheduledDays(scheduledDays)
                .build();
    }

    private Map<String, AttendanceShift> loadShiftMap(List<EmployeeShiftAssignment> assignments) {
        Set<String> shiftIds = assignments.stream()
                .map(EmployeeShiftAssignment::getShiftId)
                .collect(Collectors.toSet());
        if (shiftIds.isEmpty()) return Map.of();
        return shiftRepository.findAllById(shiftIds).stream()
                .collect(Collectors.toMap(AttendanceShift::getId, s -> s, (a, b) -> a));
    }

    /** 计算 shift 应到分钟数 (含 overnight 修正). */
    private int computeShiftMinutes(AttendanceShift shift) {
        if (shift.getStartTime() == null || shift.getEndTime() == null) return 0;
        int min = (int) Duration.between(shift.getStartTime(), shift.getEndTime()).toMinutes();
        if (Boolean.TRUE.equals(shift.getIsOvernight()) && min <= 0) {
            min += 24 * 60;
        } else if (min < 0) {
            min += 24 * 60;
        }
        return Math.max(0, min);
    }

    private BigDecimal minutesToHours(long min) {
        if (min <= 0) return BigDecimal.ZERO;
        return new BigDecimal(min).divide(MINUTES_PER_HOUR, 2, RoundingMode.HALF_UP);
    }

    private String coalesceName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) return user.getFullName();
        if (user.getUsername() != null && !user.getUsername().isBlank()) return user.getUsername();
        return "user#" + user.getId();
    }

    private YearMonth parseYearMonth(String yearMonth) {
        if (yearMonth == null || yearMonth.isBlank()) {
            throw new BusinessException("yearMonth 必填 (格式 YYYY-MM)");
        }
        try {
            return YearMonth.parse(yearMonth);
        } catch (Exception e) {
            throw new BusinessException("yearMonth 格式必须 YYYY-MM, 当前=" + yearMonth);
        }
    }
}
