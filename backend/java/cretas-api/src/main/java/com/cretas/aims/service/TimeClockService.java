package com.cretas.aims.service;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.TimeClockRecord;
import java.time.LocalDate;
import java.util.Map;
/**
 * 考勤打卡服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface TimeClockService {
    /**
     * 上班打卡（基本版本）
     */
    TimeClockRecord clockIn(String factoryId, Long userId, String location, String device);

    /**
     * 上班打卡（带GPS坐标）
     */
    TimeClockRecord clockIn(String factoryId, Long userId, String location, String device,
                            Double latitude, Double longitude);
     /**
     * 下班打卡
      */
    TimeClockRecord clockOut(String factoryId, Long userId);
     /**
     * 开始休息
      */
    TimeClockRecord breakStart(String factoryId, Long userId);
     /**
     * 结束休息
      */
    TimeClockRecord breakEnd(String factoryId, Long userId);
     /**
     * 获取打卡状态
      */
    Map<String, Object> getClockStatus(String factoryId, Long userId);
     /**
     * 获取打卡历史
      */
    PageResponse<TimeClockRecord> getClockHistory(String factoryId, Long userId,
                                                  LocalDate startDate, LocalDate endDate,
                                                  PageRequest pageRequest);
     /**
     * 获取今日打卡记录
      */
    TimeClockRecord getTodayRecord(String factoryId, Long userId);
     /**
     * 手动修改打卡记录
      */
    TimeClockRecord editClockRecord(String factoryId, Long recordId, TimeClockRecord record,
                                    Long editedBy, String reason);
     /**
     * 获取考勤统计
      */
    Map<String, Object> getAttendanceStatistics(String factoryId, Long userId,
                                                 LocalDate startDate, LocalDate endDate);
     /**
     * 获取部门考勤统计
      */
    Map<String, Object> getDepartmentAttendance(String factoryId, String department, LocalDate date);
     /**
     * 批量导出考勤记录
      */
    byte[] exportAttendanceRecords(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 【管理员】获取工厂所有员工的打卡历史（分页）
     */
    PageResponse<TimeClockRecord> getAllEmployeesClockHistory(String factoryId,
                                                               LocalDate startDate, LocalDate endDate,
                                                               PageRequest pageRequest);

    /**
     * 【管理员】获取工厂所有员工的考勤统计
     */
    Map<String, Object> getAllEmployeesAttendanceStatistics(String factoryId,
                                                             LocalDate startDate, LocalDate endDate);
}
