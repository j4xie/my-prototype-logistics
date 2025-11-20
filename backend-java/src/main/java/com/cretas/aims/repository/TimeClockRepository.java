package com.cretas.aims.repository;

import com.cretas.aims.entity.TimeClockRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 考勤打卡记录数据访问接口
 */
@Repository
public interface TimeClockRepository extends JpaRepository<TimeClockRecord, Long> {

    /**
     * 查询指定用户今日的打卡记录
     * 按上班打卡时间倒序排列，取最新的一条
     *
     * @param userId 用户ID
     * @param factoryId 工厂ID
     * @param startOfDay 今日开始时间（00:00:00）
     * @param endOfDay 今日结束时间（23:59:59）
     * @return 今日最新的打卡记录
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.userId = :userId " +
           "AND t.factoryId = :factoryId " +
           "AND t.clockInTime >= :startOfDay " +
           "AND t.clockInTime <= :endOfDay " +
           "ORDER BY t.clockInTime DESC")
    Optional<TimeClockRecord> findTodayRecord(
        @Param("userId") Long userId,
        @Param("factoryId") String factoryId,
        @Param("startOfDay") LocalDateTime startOfDay,
        @Param("endOfDay") LocalDateTime endOfDay
    );

    /**
     * 查询指定用户在指定日期范围内的打卡记录
     *
     * @param userId 用户ID
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 打卡记录列表
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.userId = :userId " +
           "AND t.factoryId = :factoryId " +
           "AND t.clockInTime >= :startDate " +
           "AND t.clockInTime <= :endDate " +
           "ORDER BY t.clockInTime DESC")
    List<TimeClockRecord> findRecordsByDateRange(
        @Param("userId") Long userId,
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 查询指定用户最新的一条打卡记录（用于判断打卡状态）
     *
     * @param userId 用户ID
     * @param factoryId 工厂ID
     * @return 最新的打卡记录
     */
    Optional<TimeClockRecord> findFirstByUserIdAndFactoryIdOrderByClockInTimeDesc(
        Long userId,
        String factoryId
    );

    /**
     * 查询部门今日考勤情况
     *
     * @param factoryId 工厂ID
     * @param startOfDay 今日开始时间
     * @param endOfDay 今日结束时间
     * @return 今日部门打卡记录列表
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId " +
           "AND t.clockInTime >= :startOfDay " +
           "AND t.clockInTime <= :endOfDay " +
           "ORDER BY t.clockInTime DESC")
    List<TimeClockRecord> findDepartmentTodayRecords(
        @Param("factoryId") String factoryId,
        @Param("startOfDay") LocalDateTime startOfDay,
        @Param("endOfDay") LocalDateTime endOfDay
    );

    /**
     * 统计用户在指定日期范围内的出勤天数
     *
     * @param userId 用户ID
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate 结束日期
     * @return 出勤天数
     */
    @Query("SELECT COUNT(DISTINCT DATE(t.clockInTime)) FROM TimeClockRecord t " +
           "WHERE t.userId = :userId " +
           "AND t.factoryId = :factoryId " +
           "AND t.clockInTime >= :startDate " +
           "AND t.clockInTime <= :endDate")
    Long countAttendanceDays(
        @Param("userId") Long userId,
        @Param("factoryId") String factoryId,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );

    /**
     * 查询部门指定日期的考勤情况
     *
     * @param factoryId 工厂ID
     * @param startOfDay 开始时间
     * @param endOfDay 结束时间
     * @return 部门打卡记录列表
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId " +
           "AND t.clockInTime >= :startOfDay " +
           "AND t.clockInTime <= :endOfDay " +
           "ORDER BY t.clockInTime DESC")
    List<TimeClockRecord> findDepartmentRecordsByDate(
        @Param("factoryId") String factoryId,
        @Param("startOfDay") LocalDateTime startOfDay,
        @Param("endOfDay") LocalDateTime endOfDay
    );
}
