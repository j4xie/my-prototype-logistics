package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.entity.hr.AttendanceException;
import com.cretas.aims.entity.hr.AttendanceShift;
import com.cretas.aims.entity.hr.EmployeeShiftAssignment;
import com.cretas.aims.entity.hr.enums.AttendanceExceptionStatus;
import com.cretas.aims.entity.hr.enums.AttendanceExceptionType;
import com.cretas.aims.entity.hr.enums.ShiftAssignmentStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.TimeClockRecordRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.repository.hr.AttendanceExceptionRepository;
import com.cretas.aims.repository.hr.AttendanceShiftRepository;
import com.cretas.aims.repository.hr.EmployeeShiftAssignmentRepository;
import com.cretas.aims.service.hr.AttendanceExceptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 考勤异常服务实现.
 *
 * <p>核心算法 detectExceptions:
 * <ol>
 *   <li>加载月度所有 EmployeeShiftAssignment</li>
 *   <li>对每个 (user, date), 查 TimeClockRecord</li>
 *   <li>无打卡 → ABSENT</li>
 *   <li>有打卡: 比对 clockInTime vs shift.startTime → LATE (容忍 0 min); clockOutTime vs shift.endTime → EARLY_LEAVE</li>
 *   <li>幂等 check (R4): 同 user-date-type 已存在则 skip</li>
 *   <li>构造 description 含 employee 全名 + date + shift 名 (R2 防呆)</li>
 * </ol>
 *
 * @author Cretas Team — P1 #41 H-ATT-FULL MVP
 * @since 2026-05-17
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceExceptionServiceImpl implements AttendanceExceptionService {

    private final AttendanceExceptionRepository exceptionRepository;
    private final EmployeeShiftAssignmentRepository assignmentRepository;
    private final AttendanceShiftRepository shiftRepository;
    private final TimeClockRecordRepository timeClockRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public Map<String, Object> detectExceptions(String factoryId, String yearMonth) {
        if (factoryId == null || yearMonth == null || yearMonth.isBlank()) {
            throw new BusinessException("factoryId / yearMonth 必填");
        }
        YearMonth ym;
        try {
            ym = YearMonth.parse(yearMonth);
        } catch (Exception e) {
            throw new BusinessException("yearMonth 格式必须 YYYY-MM, 当前=" + yearMonth);
        }
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        LocalDate today = LocalDate.now();
        if (end.isAfter(today)) {
            end = today;
        }
        if (start.isAfter(end)) {
            // 未来月份 — nothing to scan
            return Map.of("scanned", 0, "created", 0, "skipped", 0,
                    "message", "未来月份无可扫描数据");
        }

        // 1. 加载月度所有排班
        List<EmployeeShiftAssignment> assignments =
                assignmentRepository.findByFactoryIdAndWorkDateBetween(factoryId, start, end);

        // 2. 预加载 shift 字典
        Set<String> shiftIds = assignments.stream()
                .map(EmployeeShiftAssignment::getShiftId)
                .collect(Collectors.toSet());
        Map<String, AttendanceShift> shiftMap = shiftIds.isEmpty()
                ? Map.of()
                : shiftRepository.findAllById(shiftIds).stream()
                    .collect(Collectors.toMap(AttendanceShift::getId, s -> s));

        // 3. 预加载 user 字典 (R2 防呆: description 含全名)
        Set<Long> userIds = assignments.stream()
                .map(EmployeeShiftAssignment::getUserId)
                .collect(Collectors.toSet());
        Map<Long, User> userMap = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

        // 4. 预加载月度所有打卡 (range)
        LocalDateTime rangeStart = start.atStartOfDay();
        LocalDateTime rangeEnd = end.plusDays(1).atStartOfDay();
        List<TimeClockRecord> clocks = timeClockRepository.findByFactoryIdAndClockDateBetween(
                factoryId, rangeStart, rangeEnd);
        // index: (userId, clockDate) → TimeClockRecord (取首条)
        Map<String, TimeClockRecord> clockMap = new HashMap<>();
        for (TimeClockRecord c : clocks) {
            LocalDate cd = c.getClockInTime() != null ? c.getClockInTime().toLocalDate() : null;
            if (cd == null) continue;
            String key = c.getUserId() + "|" + cd;
            // 同日多条取最早入/最晚出, 简化: 留第一条 (与 ClockInTool 业务一致, 一天一行)
            clockMap.putIfAbsent(key, c);
        }

        // 5. 预加载已有异常 (幂等 — R4 防呆)
        List<AttendanceException> existing =
                exceptionRepository.findExistingInRange(factoryId, start, end);
        Set<String> existingKeys = existing.stream()
                .map(e -> e.getUserId() + "|" + e.getWorkDate() + "|" + e.getExceptionType().name())
                .collect(Collectors.toSet());

        int created = 0;
        int skipped = 0;
        List<AttendanceException> toSave = new ArrayList<>();
        Set<String> assignmentStatusUpdates = new HashSet<>();
        Map<String, ShiftAssignmentStatus> assignmentNewStatus = new HashMap<>();

        for (EmployeeShiftAssignment asn : assignments) {
            AttendanceShift shift = shiftMap.get(asn.getShiftId());
            if (shift == null) {
                log.warn("Shift not found for assignment {} shiftId={}", asn.getId(), asn.getShiftId());
                continue;
            }
            User user = userMap.get(asn.getUserId());
            String userName = user != null
                    ? (user.getFullName() != null && !user.getFullName().isBlank()
                        ? user.getFullName() : user.getUsername())
                    : ("user#" + asn.getUserId());

            String clockKey = asn.getUserId() + "|" + asn.getWorkDate();
            TimeClockRecord clock = clockMap.get(clockKey);

            List<AttendanceException> candidates = new ArrayList<>();

            if (clock == null || clock.getClockInTime() == null) {
                // ABSENT
                candidates.add(buildException(factoryId, asn, AttendanceExceptionType.ABSENT,
                        String.format("%s 于 %s 缺勤 (排班: %s, 应 %s-%s)",
                                userName, asn.getWorkDate(), shift.getShiftName(),
                                shift.getStartTime(), shift.getEndTime()),
                        null));
                assignmentNewStatus.merge(asn.getId(), ShiftAssignmentStatus.MISSED,
                        (oldV, newV) -> oldV);
            } else {
                LocalTime actualIn = clock.getClockInTime().toLocalTime();
                LocalTime expectedIn = shift.getStartTime();
                long lateMin = Duration.between(expectedIn, actualIn).toMinutes();
                if (lateMin > 0) {
                    candidates.add(buildException(factoryId, asn, AttendanceExceptionType.LATE,
                            String.format("%s 于 %s 迟到 %d 分钟 (排班: %s, 应 %s, 实际 %s)",
                                    userName, asn.getWorkDate(), lateMin,
                                    shift.getShiftName(), expectedIn, actualIn),
                            (int) lateMin));
                }
                if (clock.getClockOutTime() != null) {
                    LocalTime actualOut = clock.getClockOutTime().toLocalTime();
                    LocalTime expectedOut = shift.getEndTime();
                    long earlyMin = Duration.between(actualOut, expectedOut).toMinutes();
                    if (earlyMin > 0 && !Boolean.TRUE.equals(shift.getIsOvernight())) {
                        // 跨夜班 expectedOut < actualOut 不算早退, 暂跳过
                        candidates.add(buildException(factoryId, asn, AttendanceExceptionType.EARLY_LEAVE,
                                String.format("%s 于 %s 早退 %d 分钟 (排班: %s, 应 %s, 实际 %s)",
                                        userName, asn.getWorkDate(), earlyMin,
                                        shift.getShiftName(), expectedOut, actualOut),
                                (int) earlyMin));
                    }
                }
                // OT_OVERSCHEDULED: workDurationMinutes > shift expected by >60min
                if (clock.getWorkDurationMinutes() != null) {
                    int expectedMin = (int) Duration.between(shift.getStartTime(),
                            shift.getEndTime().equals(shift.getStartTime())
                                ? shift.getEndTime() : shift.getEndTime()).toMinutes();
                    if (expectedMin < 0) expectedMin += 24 * 60; // overnight
                    int ot = clock.getWorkDurationMinutes() - expectedMin;
                    if (ot > 60) {
                        candidates.add(buildException(factoryId, asn,
                                AttendanceExceptionType.OT_OVERSCHEDULED,
                                String.format("%s 于 %s 超工时 %d 分钟 (排班: %s, 计划 %d 分钟, 实际 %d 分钟)",
                                        userName, asn.getWorkDate(), ot,
                                        shift.getShiftName(), expectedMin, clock.getWorkDurationMinutes()),
                                ot));
                    }
                }
                if (!candidates.isEmpty()) {
                    assignmentNewStatus.merge(asn.getId(), ShiftAssignmentStatus.EXCEPTION,
                            (oldV, newV) -> oldV);
                } else {
                    assignmentNewStatus.merge(asn.getId(), ShiftAssignmentStatus.CLOCKED,
                            (oldV, newV) -> oldV);
                }
            }

            // 幂等 filter + accumulate
            for (AttendanceException ex : candidates) {
                String key = ex.getUserId() + "|" + ex.getWorkDate() + "|" + ex.getExceptionType().name();
                if (existingKeys.contains(key)) {
                    skipped++;
                } else {
                    toSave.add(ex);
                    existingKeys.add(key); // guard against in-batch dup
                    created++;
                }
            }
        }

        if (!toSave.isEmpty()) {
            exceptionRepository.saveAll(toSave);
        }

        // 6. 更新 assignment 状态
        for (EmployeeShiftAssignment asn : assignments) {
            ShiftAssignmentStatus newStatus = assignmentNewStatus.get(asn.getId());
            if (newStatus != null && newStatus != asn.getStatus()) {
                asn.setStatus(newStatus);
                assignmentStatusUpdates.add(asn.getId());
            }
        }
        // saveAll on assignments触发 dirty checking (因 @Transactional)
        // — Hibernate 会自动 flush 改动的字段, 无需显式 save

        Map<String, Object> result = new HashMap<>();
        result.put("scanned", assignments.size());
        result.put("created", created);
        result.put("skipped", skipped);
        result.put("yearMonth", yearMonth);
        result.put("rangeStart", start.toString());
        result.put("rangeEnd", end.toString());
        log.info("detectExceptions factoryId={} ym={} scanned={} created={} skipped={}",
                factoryId, yearMonth, assignments.size(), created, skipped);
        return result;
    }

    private AttendanceException buildException(String factoryId,
                                                EmployeeShiftAssignment asn,
                                                AttendanceExceptionType type,
                                                String description,
                                                Integer deltaMinutes) {
        return AttendanceException.builder()
                .factoryId(factoryId)
                .userId(asn.getUserId())
                .workDate(asn.getWorkDate())
                .shiftAssignmentId(asn.getId())
                .exceptionType(type)
                .status(AttendanceExceptionStatus.PENDING)
                .description(description)
                .deltaMinutes(deltaMinutes)
                .build();
    }

    @Override
    @Transactional
    public AttendanceException approve(String factoryId, Long processorId, String id, String notes) {
        AttendanceException ex = load(factoryId, id);
        if (ex.getStatus() != AttendanceExceptionStatus.PENDING) {
            throw new BusinessException("仅 PENDING 状态可批准, 当前=" + ex.getStatus());
        }
        ex.setStatus(AttendanceExceptionStatus.APPROVED);
        ex.setProcessedBy(processorId);
        ex.setProcessedAt(LocalDateTime.now());
        if (notes != null && !notes.isBlank()) ex.setNotes(notes);
        log.info("AttendanceException {} APPROVED by {}", id, processorId);
        return exceptionRepository.save(ex);
    }

    @Override
    @Transactional
    public AttendanceException reject(String factoryId, Long processorId, String id, String notes) {
        AttendanceException ex = load(factoryId, id);
        if (ex.getStatus() != AttendanceExceptionStatus.PENDING) {
            throw new BusinessException("仅 PENDING 状态可驳回, 当前=" + ex.getStatus());
        }
        if (notes == null || notes.isBlank()) {
            throw new BusinessException("驳回必须填写原因");
        }
        ex.setStatus(AttendanceExceptionStatus.REJECTED);
        ex.setProcessedBy(processorId);
        ex.setProcessedAt(LocalDateTime.now());
        ex.setNotes(notes);
        log.info("AttendanceException {} REJECTED by {}", id, processorId);
        return exceptionRepository.save(ex);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AttendanceException> getById(String factoryId, String id) {
        return exceptionRepository.findByIdAndFactoryId(id, factoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AttendanceException> list(String factoryId,
                                          AttendanceExceptionStatus status,
                                          LocalDate startDate,
                                          LocalDate endDate,
                                          Pageable pageable) {
        return exceptionRepository.search(factoryId, status, startDate, endDate, pageable);
    }

    private AttendanceException load(String factoryId, String id) {
        return exceptionRepository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("AttendanceException not found: " + id));
    }
}
