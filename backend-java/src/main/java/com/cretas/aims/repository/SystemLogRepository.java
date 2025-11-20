package com.cretas.aims.repository;

import com.cretas.aims.entity.SystemLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
/**
 * 系统日志数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {
    /**
     * 根据工厂ID分页查找日志
     */
    Page<SystemLog> findByFactoryId(String factoryId, Pageable pageable);
     /**
     * 根据工厂ID和日志类型分页查找
      */
    Page<SystemLog> findByFactoryIdAndLogType(String factoryId, String logType, Pageable pageable);
     /**
     * 根据工厂ID和日志级别分页查找
      */
    Page<SystemLog> findByFactoryIdAndLogLevel(String factoryId, String logLevel, Pageable pageable);
     /**
     * 根据工厂ID和时间范围分页查找
      */
    Page<SystemLog> findByFactoryIdAndCreatedAtBetween(String factoryId,
                                                       LocalDateTime startTime,
                                                       LocalDateTime endTime,
                                                       Pageable pageable);
     /**
     * 删除指定日期之前的日志
      */
    @Modifying
    @Query("DELETE FROM SystemLog s WHERE s.createdAt < :beforeDate")
    int deleteLogsBeforeDate(@Param("beforeDate") LocalDateTime beforeDate);
     /**
     * 删除指定工厂和日期之前的日志
      */
    @Query("DELETE FROM SystemLog s WHERE s.factoryId = :factoryId AND s.createdAt < :beforeDate")
    int deleteFactoryLogsBeforeDate(@Param("factoryId") String factoryId,
                                    @Param("beforeDate") LocalDateTime beforeDate);
}
