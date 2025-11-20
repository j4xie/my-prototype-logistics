package com.cretas.aims.repository;

import com.cretas.aims.entity.TimeClockRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 考勤打卡记录数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface TimeClockRecordRepository extends JpaRepository<TimeClockRecord, Long> {
    
    /**
     * 根据工厂ID和用户ID查找今日打卡记录
     * 使用LocalDateTime范围查询替代DATE()函数，解决LocalDate类型不兼容问题
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId AND t.userId = :userId " +
           "AND t.clockInTime >= :startOfDay AND t.clockInTime < :endOfDay")
    Optional<TimeClockRecord> findByFactoryIdAndUserIdAndClockDate(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    /**
     * 根据工厂ID和用户ID查找打卡记录列表
     */
    List<TimeClockRecord> findByFactoryIdAndUserIdOrderByClockInTimeDesc(String factoryId, Long userId);
    
    /**
     * 根据工厂ID和用户ID以及日期范围查找打卡记录
     * 使用LocalDateTime范围查询替代DATE()函数
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId AND t.userId = :userId " +
           "AND t.clockInTime >= :start AND t.clockInTime < :end ORDER BY t.clockInTime DESC")
    List<TimeClockRecord> findByFactoryIdAndUserIdAndClockDateBetween(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    /**
     * 根据工厂ID和用户ID以及日期范围查找打卡记录（分页）
     * 使用LocalDateTime范围查询替代DATE()函数
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId AND t.userId = :userId " +
           "AND t.clockInTime >= :start AND t.clockInTime < :end ORDER BY t.clockInTime DESC")
    Page<TimeClockRecord> findByFactoryIdAndUserIdAndClockDateBetween(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable
    );

    /**
     * 根据工厂ID和日期查找打卡记录
     * 使用LocalDateTime范围查询替代DATE()函数
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId " +
           "AND t.clockInTime >= :startOfDay AND t.clockInTime < :endOfDay")
    List<TimeClockRecord> findByFactoryIdAndClockDate(
            @Param("factoryId") String factoryId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    /**
     * 根据工厂ID和部门查找打卡记录
     * 使用LocalDateTime范围查询替代DATE()函数
     */
    @Query("SELECT t FROM TimeClockRecord t JOIN User u ON t.userId = u.id " +
           "WHERE t.factoryId = :factoryId AND u.department = :department " +
           "AND t.clockInTime >= :startOfDay AND t.clockInTime < :endOfDay")
    List<TimeClockRecord> findByFactoryIdAndDepartmentAndClockDate(
            @Param("factoryId") String factoryId,
            @Param("department") String department,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    /**
     * 查找用户最后一次打卡记录
     */
    @Query("SELECT t FROM TimeClockRecord t WHERE t.factoryId = :factoryId AND t.userId = :userId " +
           "ORDER BY t.clockInTime DESC")
    List<TimeClockRecord> findLatestByFactoryIdAndUserId(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            Pageable pageable
    );
}

