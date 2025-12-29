package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.User;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.TimeClockRecordRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.TimeClockService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 考勤打卡服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class TimeClockServiceImpl implements TimeClockService {
    private static final Logger log = LoggerFactory.getLogger(TimeClockServiceImpl.class);

    private final TimeClockRecordRepository timeClockRecordRepository;
    private final UserRepository userRepository;

    // Manual constructor (Lombok @RequiredArgsConstructor not working)
    public TimeClockServiceImpl(TimeClockRecordRepository timeClockRecordRepository, UserRepository userRepository) {
        this.timeClockRecordRepository = timeClockRecordRepository;
        this.userRepository = userRepository;
    }

    // 标准上班时间（可以根据工厂设置调整）
    private static final LocalTime STANDARD_START_TIME = LocalTime.of(9, 0); // 9:00
    private static final LocalTime STANDARD_END_TIME = LocalTime.of(18, 0); // 18:00
    
    @Override
    @Transactional
    public TimeClockRecord clockIn(String factoryId, Long userId, String location, String device) {
        log.info("上班打卡: factoryId={}, userId={}, location={}, device={}", factoryId, userId, location, device);

        // 验证用户是否存在
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        // 验证用户是否属于该工厂
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("用户不属于该工厂");
        }
        
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = today.atStartOfDay();  // 当天00:00:00
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();  // 次日00:00:00

        // 查找今日是否已有打卡记录
        Optional<TimeClockRecord> existingRecord = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay);
        
        TimeClockRecord record;
        if (existingRecord.isPresent()) {
            // 如果已有记录，检查是否已经打了下班卡
            record = existingRecord.get();
            // 如果已打过下班卡，可以再次打上班卡（开始新一轮工作）
            // 重置打卡记录，允许再次打卡
            if (record.getClockOutTime() != null) {
                // 已打过下班卡，重置记录，允许再次打卡
                record.setClockInTime(now);
                record.setClockOutTime(null); // 清空下班时间
                record.setBreakStartTime(null); // 清空休息时间
                record.setBreakEndTime(null);
                record.setClockLocation(location);
                record.setClockDevice(device);
                record.setStatus("WORKING");
                // 判断是否迟到
                if (now.toLocalTime().isAfter(STANDARD_START_TIME)) {
                    record.setAttendanceStatus("LATE");
                } else {
                    record.setAttendanceStatus("NORMAL");
                }
            } else if (record.getClockInTime() != null) {
                // 已打过上班卡但未打下班卡，不能再次打上班卡
                throw new BusinessException("您已经打过上班卡了，请先进行下班打卡");
            } else {
                // 记录存在但没有打卡时间，更新上班打卡时间
                record.setClockInTime(now);
                record.setClockLocation(location);
                record.setClockDevice(device);
                record.setStatus("WORKING");
                // 判断是否迟到
                if (now.toLocalTime().isAfter(STANDARD_START_TIME)) {
                    record.setAttendanceStatus("LATE");
                } else {
                    record.setAttendanceStatus("NORMAL");
                }
            }
        } else {
            // 创建新记录
            record = TimeClockRecord.builder()
                    .factoryId(factoryId)
                    .userId(userId)
                    .username(user.getUsername())
                    .clockDate(today)
                    .clockInTime(now)
                    .clockLocation(location)
                    .clockDevice(device)
                    .status("WORKING")
                    .attendanceStatus(now.toLocalTime().isAfter(STANDARD_START_TIME) ? "LATE" : "NORMAL")
                    .build();
        }
        
        record = timeClockRecordRepository.save(record);
        log.info("上班打卡成功: recordId={}, clockInTime={}", record.getId(), record.getClockInTime());
        return record;
    }

    @Override
    @Transactional
    public TimeClockRecord clockIn(String factoryId, Long userId, String location, String device,
                                   Double latitude, Double longitude) {
        log.info("上班打卡(带GPS): factoryId={}, userId={}, lat={}, lng={}", factoryId, userId, latitude, longitude);

        // 验证用户是否存在
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        // 验证用户是否属于该工厂
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("用户不属于该工厂");
        }

        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 查找今日是否已有打卡记录
        Optional<TimeClockRecord> existingRecord = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay);

        TimeClockRecord record;
        if (existingRecord.isPresent()) {
            record = existingRecord.get();
            if (record.getClockOutTime() != null) {
                // 已打过下班卡，重置记录
                record.setClockInTime(now);
                record.setClockOutTime(null);
                record.setBreakStartTime(null);
                record.setBreakEndTime(null);
                record.setClockLocation(location);
                record.setClockDevice(device);
                record.setLatitude(latitude);
                record.setLongitude(longitude);
                record.setStatus("WORKING");
                record.setAttendanceStatus(now.toLocalTime().isAfter(STANDARD_START_TIME) ? "LATE" : "NORMAL");
            } else if (record.getClockInTime() != null) {
                throw new BusinessException("您已经打过上班卡了，请先进行下班打卡");
            } else {
                record.setClockInTime(now);
                record.setClockLocation(location);
                record.setClockDevice(device);
                record.setLatitude(latitude);
                record.setLongitude(longitude);
                record.setStatus("WORKING");
                record.setAttendanceStatus(now.toLocalTime().isAfter(STANDARD_START_TIME) ? "LATE" : "NORMAL");
            }
        } else {
            // 创建新记录（带GPS坐标）
            record = TimeClockRecord.builder()
                    .factoryId(factoryId)
                    .userId(userId)
                    .username(user.getUsername())
                    .clockDate(today)
                    .clockInTime(now)
                    .clockLocation(location)
                    .clockDevice(device)
                    .latitude(latitude)
                    .longitude(longitude)
                    .status("WORKING")
                    .attendanceStatus(now.toLocalTime().isAfter(STANDARD_START_TIME) ? "LATE" : "NORMAL")
                    .build();
        }

        record = timeClockRecordRepository.save(record);
        log.info("上班打卡(带GPS)成功: recordId={}, lat={}, lng={}", record.getId(), latitude, longitude);
        return record;
    }

    @Override
    @Transactional
    public TimeClockRecord clockOut(String factoryId, Long userId) {
        log.info("下班打卡: factoryId={}, userId={}", factoryId, userId);
        
        // 验证用户是否存在
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        // 验证用户是否属于该工厂
        if (!user.getFactoryId().equals(factoryId)) {
            throw new BusinessException("用户不属于该工厂");
        }

        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 查找今日打卡记录
        TimeClockRecord record = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay)
                .orElseThrow(() -> new BusinessException("今天还没有打上班卡，请先进行上班打卡"));
        
        // 检查是否已经打过下班卡
        if (record.getClockOutTime() != null) {
            throw new BusinessException("今天已经打过下班卡了");
        }
        
        // 检查是否打了上班卡
        if (record.getClockInTime() == null) {
            throw new BusinessException("今天还没有打上班卡，请先进行上班打卡");
        }
        
        // 更新下班打卡时间
        record.setClockOutTime(now);
        record.setStatus("OFF_WORK");
        
        // 判断是否早退
        if (now.toLocalTime().isBefore(STANDARD_END_TIME)) {
            if ("LATE".equals(record.getAttendanceStatus())) {
                record.setAttendanceStatus("LATE_AND_EARLY_LEAVE");
            } else {
                record.setAttendanceStatus("EARLY_LEAVE");
            }
        } else if ("NORMAL".equals(record.getAttendanceStatus())) {
            record.setAttendanceStatus("NORMAL");
        }
        
        // 计算工作时长
        record.calculateWorkDuration();
        
        record = timeClockRecordRepository.save(record);
        log.info("下班打卡成功: recordId={}, clockOutTime={}, workDuration={}分钟", 
                record.getId(), record.getClockOutTime(), record.getWorkDurationMinutes());
        return record;
    }

    @Override
    @Transactional
    public TimeClockRecord breakStart(String factoryId, Long userId) {
        log.info("开始休息: factoryId={}, userId={}", factoryId, userId);
        
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 查找今日打卡记录
        TimeClockRecord record = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay)
                .orElseThrow(() -> new BusinessException("今天还没有打上班卡，请先进行上班打卡"));
        
        // 检查是否已经打过上班卡
        if (record.getClockInTime() == null) {
            throw new BusinessException("今天还没有打上班卡，请先进行上班打卡");
        }
        
        // 检查是否已经打过下班卡
        if (record.getClockOutTime() != null) {
            throw new BusinessException("已经下班，无法开始休息");
        }
        
        // 检查是否已经在休息中
        if (record.getBreakStartTime() != null && record.getBreakEndTime() == null) {
            throw new BusinessException("已经在休息中");
        }
        
        record.setBreakStartTime(now);
        record.setStatus("ON_BREAK");
        
        record = timeClockRecordRepository.save(record);
        log.info("开始休息成功: recordId={}, breakStartTime={}", record.getId(), record.getBreakStartTime());
        return record;
    }

    @Override
    @Transactional
    public TimeClockRecord breakEnd(String factoryId, Long userId) {
        log.info("结束休息: factoryId={}, userId={}", factoryId, userId);
        
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        // 查找今日打卡记录
        TimeClockRecord record = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay)
                .orElseThrow(() -> new BusinessException("今天还没有打上班卡，请先进行上班打卡"));
        
        // 检查是否已经开始休息
        if (record.getBreakStartTime() == null) {
            throw new BusinessException("还没有开始休息");
        }
        
        // 检查是否已经结束休息
        if (record.getBreakEndTime() != null) {
            throw new BusinessException("休息已经结束");
        }
        
        record.setBreakEndTime(now);
        record.setStatus("WORKING");
        
        record = timeClockRecordRepository.save(record);
        log.info("结束休息成功: recordId={}, breakEndTime={}", record.getId(), record.getBreakEndTime());
        return record;
    }

    @Override
    public Map<String, Object> getClockStatus(String factoryId, Long userId) {
        log.info("获取打卡状态: factoryId={}, userId={}", factoryId, userId);
        
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        Optional<TimeClockRecord> todayRecord = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay);
        
        Map<String, Object> status = new HashMap<>();
        
        if (todayRecord.isPresent()) {
            TimeClockRecord record = todayRecord.get();
            status.put("canClockIn", record.getClockInTime() == null);
            status.put("canClockOut", record.getClockInTime() != null && record.getClockOutTime() == null);
            status.put("canBreakStart", record.getClockInTime() != null && record.getClockOutTime() == null 
                    && (record.getBreakStartTime() == null || record.getBreakEndTime() != null));
            status.put("canBreakEnd", record.getBreakStartTime() != null && record.getBreakEndTime() == null);
            status.put("lastClockIn", record.getClockInTime() != null ? record.getClockInTime().toString() : null);
            status.put("lastClockOut", record.getClockOutTime() != null ? record.getClockOutTime().toString() : null);
            status.put("status", record.getStatus());
            status.put("attendanceStatus", record.getAttendanceStatus());
            status.put("todayRecord", record);
        } else {
            status.put("canClockIn", true);
            status.put("canClockOut", false);
            status.put("canBreakStart", false);
            status.put("canBreakEnd", false);
            status.put("lastClockIn", null);
            status.put("lastClockOut", null);
            status.put("status", "NOT_CLOCKED");
            status.put("attendanceStatus", null);
            status.put("todayRecord", null);
        }
        
        return status;
    }

    @Override
    public PageResponse<TimeClockRecord> getClockHistory(String factoryId, Long userId,
                                                         LocalDate startDate, LocalDate endDate,
                                                         PageRequest pageRequest) {
        log.info("获取打卡历史: factoryId={}, userId={}, startDate={}, endDate={}, page={}, size={}", 
                factoryId, userId, startDate, endDate, pageRequest.getPage(), pageRequest.getSize());
        
        // 转换LocalDate为LocalDateTime范围
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.plusDays(1).atStartOfDay();

        // 创建分页请求（使用Spring Data的PageRequest，避免与DTO的PageRequest冲突）
        Pageable pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1, // Spring Data的页码从0开始
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "clockInTime")
        );

        Page<TimeClockRecord> page = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, userId, start, end, pageable);
        
        return PageResponse.of(
                page.getContent(),
                pageRequest.getPage(),
                pageRequest.getSize(),
                page.getTotalElements()
        );
    }

    @Override
    public TimeClockRecord getTodayRecord(String factoryId, Long userId) {
        log.info("获取今日打卡记录: factoryId={}, userId={}", factoryId, userId);

        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        return timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDate(factoryId, userId, startOfDay, endOfDay)
                .orElse(null);
    }

    @Override
    @Transactional
    public TimeClockRecord editClockRecord(String factoryId, Long recordId, TimeClockRecord record,
                                          Long editedBy, String reason) {
        log.info("修改打卡记录: factoryId={}, recordId={}, editedBy={}", factoryId, recordId, editedBy);
        
        TimeClockRecord existingRecord = timeClockRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResourceNotFoundException("TimeClockRecord", "id", recordId));
        
        // 验证记录是否属于该工厂
        if (!existingRecord.getFactoryId().equals(factoryId)) {
            throw new BusinessException("记录不属于该工厂");
        }
        
        // 更新记录
        if (record.getClockInTime() != null) {
            existingRecord.setClockInTime(record.getClockInTime());
        }
        if (record.getClockOutTime() != null) {
            existingRecord.setClockOutTime(record.getClockOutTime());
        }
        if (record.getBreakStartTime() != null) {
            existingRecord.setBreakStartTime(record.getBreakStartTime());
        }
        if (record.getBreakEndTime() != null) {
            existingRecord.setBreakEndTime(record.getBreakEndTime());
        }
        if (record.getClockLocation() != null) {
            existingRecord.setClockLocation(record.getClockLocation());
        }
        if (record.getNotes() != null) {
            existingRecord.setNotes(record.getNotes());
        }

        existingRecord.setIsManualEdit(true);
        existingRecord.setEditedBy(editedBy.intValue());
        existingRecord.setEditReason(reason);

        // 重新计算工作时长
        existingRecord.calculateWorkDuration();

        return timeClockRecordRepository.save(existingRecord);
    }

    @Override
    public Map<String, Object> getAttendanceStatistics(String factoryId, Long userId,
                                                        LocalDate startDate, LocalDate endDate) {
        log.info("获取考勤统计: factoryId={}, userId={}, startDate={}, endDate={}",
                factoryId, userId, startDate, endDate);

        // 转换LocalDate为LocalDateTime范围
        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime end = endDate.plusDays(1).atStartOfDay();

        List<TimeClockRecord> records = timeClockRecordRepository
                .findByFactoryIdAndUserIdAndClockDateBetween(factoryId, userId, start, end);
        
        Map<String, Object> statistics = new HashMap<>();
        
        int totalDays = 0;
        int normalDays = 0;
        int lateDays = 0;
        int earlyLeaveDays = 0;
        int absentDays = 0;
        int totalWorkMinutes = 0;
        int totalOvertimeMinutes = 0;
        
        for (TimeClockRecord record : records) {
            totalDays++;
            if ("NORMAL".equals(record.getAttendanceStatus())) {
                normalDays++;
            } else if (record.getAttendanceStatus() != null && record.getAttendanceStatus().contains("LATE")) {
                lateDays++;
            } else if (record.getAttendanceStatus() != null && record.getAttendanceStatus().contains("EARLY_LEAVE")) {
                earlyLeaveDays++;
            }
            
            if (record.getWorkDurationMinutes() != null) {
                totalWorkMinutes += record.getWorkDurationMinutes();
            }
            if (record.getOvertimeMinutes() != null) {
                totalOvertimeMinutes += record.getOvertimeMinutes();
            }
        }
        
        // 计算应出勤天数（工作日）
        long expectedDays = startDate.datesUntil(endDate.plusDays(1))
                .filter(date -> {
                    int dayOfWeek = date.getDayOfWeek().getValue();
                    return dayOfWeek >= 1 && dayOfWeek <= 5; // 周一到周五
                })
                .count();
        
        absentDays = (int) expectedDays - totalDays;
        
        statistics.put("totalDays", totalDays);
        statistics.put("expectedDays", expectedDays);
        statistics.put("normalDays", normalDays);
        statistics.put("lateDays", lateDays);
        statistics.put("earlyLeaveDays", earlyLeaveDays);
        statistics.put("absentDays", absentDays);
        statistics.put("totalWorkMinutes", totalWorkMinutes);
        statistics.put("totalWorkHours", totalWorkMinutes / 60.0);
        statistics.put("totalOvertimeMinutes", totalOvertimeMinutes);
        statistics.put("totalOvertimeHours", totalOvertimeMinutes / 60.0);
        statistics.put("attendanceRate", expectedDays > 0 ? (double) totalDays / expectedDays * 100 : 0);
        
        return statistics;
    }

    @Override
    public Map<String, Object> getDepartmentAttendance(String factoryId, String department, LocalDate date) {
        log.info("获取部门考勤: factoryId={}, department={}, date={}", factoryId, department, date);

        // 转换LocalDate为LocalDateTime范围
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();

        List<TimeClockRecord> records = timeClockRecordRepository
                .findByFactoryIdAndDepartmentAndClockDate(factoryId, department, startOfDay, endOfDay);
        
        Map<String, Object> attendance = new HashMap<>();
        attendance.put("date", date.toString());
        attendance.put("department", department);
        attendance.put("totalEmployees", records.size());
        
        int clockedInCount = 0;
        int clockedOutCount = 0;
        int onBreakCount = 0;
        
        for (TimeClockRecord record : records) {
            if (record.getClockInTime() != null) {
                clockedInCount++;
            }
            if (record.getClockOutTime() != null) {
                clockedOutCount++;
            }
            if ("ON_BREAK".equals(record.getStatus())) {
                onBreakCount++;
            }
        }
        
        attendance.put("clockedInCount", clockedInCount);
        attendance.put("clockedOutCount", clockedOutCount);
        attendance.put("onBreakCount", onBreakCount);
        attendance.put("records", records);
        
        return attendance;
    }

    @Override
    public byte[] exportAttendanceRecords(String factoryId, LocalDate startDate, LocalDate endDate) {
        // TODO: 实现批量导出考勤记录逻辑（使用Apache POI或EasyExcel）
        throw new UnsupportedOperationException("exportAttendanceRecords not implemented yet");
    }
}
