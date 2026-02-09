package com.cretas.aims.repository.isapi;

import com.cretas.aims.entity.isapi.IsapiEventLog;
import com.cretas.aims.entity.isapi.IsapiEventLog.EventState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * ISAPI 事件日志 Repository
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Repository
public interface IsapiEventLogRepository extends JpaRepository<IsapiEventLog, Long> {

    // ==================== 基础查询 ====================

    /**
     * 根据工厂ID分页查询事件
     */
    Page<IsapiEventLog> findByFactoryIdOrderByEventTimeDesc(String factoryId, Pageable pageable);

    /**
     * 根据设备ID查询事件
     */
    Page<IsapiEventLog> findByDeviceIdOrderByEventTimeDesc(String deviceId, Pageable pageable);

    /**
     * 根据工厂ID和设备ID查询
     */
    Page<IsapiEventLog> findByFactoryIdAndDeviceIdOrderByEventTimeDesc(
            String factoryId, String deviceId, Pageable pageable);

    /**
     * 根据事件类型查询
     */
    Page<IsapiEventLog> findByFactoryIdAndEventTypeOrderByEventTimeDesc(
            String factoryId, String eventType, Pageable pageable);

    // ==================== 时间范围查询 ====================

    /**
     * 根据时间范围查询
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.eventTime BETWEEN :startTime AND :endTime ORDER BY e.eventTime DESC")
    Page<IsapiEventLog> findByTimeRange(
            @Param("factoryId") String factoryId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    /**
     * 查询最近N条事件
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findRecentEvents(@Param("factoryId") String factoryId, Pageable pageable);

    /**
     * 查询最近的告警事件 (排除心跳)
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.eventState = 'ACTIVE' " +
            "AND NOT (e.eventType = 'videoloss') " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findRecentAlerts(@Param("factoryId") String factoryId, Pageable pageable);

    // ==================== 处理状态 ====================

    /**
     * 查询未处理的事件
     */
    Page<IsapiEventLog> findByFactoryIdAndProcessedFalseOrderByEventTimeDesc(
            String factoryId, Pageable pageable);

    /**
     * 查询需要处理的告警 (ACTIVE 且未处理)
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.eventState = 'ACTIVE' AND e.processed = false " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findUnprocessedAlerts(@Param("factoryId") String factoryId);

    /**
     * 批量标记为已处理
     */
    @Modifying
    @Query("UPDATE IsapiEventLog e SET e.processed = true, e.processedAt = :time, " +
            "e.processedBy = :processedBy WHERE e.id IN :ids")
    int markAsProcessed(
            @Param("ids") List<Long> ids,
            @Param("time") LocalDateTime time,
            @Param("processedBy") String processedBy);

    // ==================== 统计查询 ====================

    /**
     * 统计各事件类型数量
     */
    @Query("SELECT e.eventType, COUNT(e) FROM IsapiEventLog e " +
            "WHERE e.factoryId = :factoryId AND e.eventTime >= :since " +
            "GROUP BY e.eventType ORDER BY COUNT(e) DESC")
    List<Object[]> countByEventType(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);

    /**
     * 统计各设备事件数量
     */
    @Query("SELECT e.deviceId, COUNT(e) FROM IsapiEventLog e " +
            "WHERE e.factoryId = :factoryId AND e.eventTime >= :since " +
            "GROUP BY e.deviceId ORDER BY COUNT(e) DESC")
    List<Object[]> countByDevice(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);

    /**
     * 按小时统计事件数量 (用于趋势图)
     * PostgreSQL 兼容：使用 to_char 替代 DATE_FORMAT
     */
    @Query(value = "SELECT to_char(event_time, 'YYYY-MM-DD HH24:00:00') as hour, COUNT(*) as count " +
            "FROM isapi_event_logs " +
            "WHERE factory_id = :factoryId AND event_time >= :since " +
            "GROUP BY to_char(event_time, 'YYYY-MM-DD HH24:00:00') " +
            "ORDER BY hour", nativeQuery = true)
    List<Object[]> countByHour(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);

    /**
     * 统计今日事件数
     */
    @Query("SELECT COUNT(e) FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.eventTime >= :todayStart AND e.eventState = 'ACTIVE'")
    long countTodayAlerts(@Param("factoryId") String factoryId, @Param("todayStart") LocalDateTime todayStart);

    /**
     * 统计未处理事件数
     */
    long countByFactoryIdAndProcessedFalse(String factoryId);

    // ==================== 清理 ====================

    /**
     * 删除指定日期之前的事件 (用于数据清理)
     */
    @Modifying
    @Query("DELETE FROM IsapiEventLog e WHERE e.eventTime < :before")
    int deleteEventsBefore(@Param("before") LocalDateTime before);

    /**
     * 删除指定设备的所有事件
     */
    @Modifying
    void deleteByDeviceId(String deviceId);

    // ==================== 设备心跳相关 ====================

    /**
     * 查询设备最后的心跳事件
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.deviceId = :deviceId " +
            "AND e.eventType = 'videoloss' AND e.eventState = 'INACTIVE' " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findLastHeartbeat(@Param("deviceId") String deviceId, Pageable pageable);

    // ==================== AI 分析相关查询 ====================

    /**
     * 查询需要立即处理的告警 (AI 标记为高风险)
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiRequiresAction = true AND e.processed = false " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findHighRiskAlerts(@Param("factoryId") String factoryId);

    /**
     * 分页查询需要立即处理的告警
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiRequiresAction = true AND e.processed = false " +
            "ORDER BY e.eventTime DESC")
    Page<IsapiEventLog> findHighRiskAlerts(@Param("factoryId") String factoryId, Pageable pageable);

    /**
     * 根据 AI 威胁等级查询
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiThreatLevel = :threatLevel ORDER BY e.eventTime DESC")
    Page<IsapiEventLog> findByAiThreatLevel(
            @Param("factoryId") String factoryId,
            @Param("threatLevel") String threatLevel,
            Pageable pageable);

    /**
     * 查询已分析但尚未处理的事件
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiAnalyzed = true AND e.processed = false " +
            "ORDER BY e.eventTime DESC")
    Page<IsapiEventLog> findAnalyzedUnprocessed(@Param("factoryId") String factoryId, Pageable pageable);

    /**
     * 查询待 AI 分析的事件 (有图片但未分析)
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.pictureData IS NOT NULL AND e.aiAnalyzed = false " +
            "AND e.eventState = 'ACTIVE' ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findPendingAnalysis(@Param("factoryId") String factoryId);

    /**
     * 查询有卫生隐患的事件
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiHygieneConcern = true AND e.processed = false " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findHygieneConcerns(@Param("factoryId") String factoryId);

    /**
     * 查询有安全隐患的事件
     */
    @Query("SELECT e FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiSafetyConcern = true AND e.processed = false " +
            "ORDER BY e.eventTime DESC")
    List<IsapiEventLog> findSafetyConcerns(@Param("factoryId") String factoryId);

    /**
     * 统计 AI 分析结果
     */
    @Query("SELECT e.aiThreatLevel, COUNT(e) FROM IsapiEventLog e " +
            "WHERE e.factoryId = :factoryId AND e.aiAnalyzed = true " +
            "AND e.eventTime >= :since GROUP BY e.aiThreatLevel")
    List<Object[]> countByAiThreatLevel(
            @Param("factoryId") String factoryId,
            @Param("since") LocalDateTime since);

    /**
     * 统计高风险事件数
     */
    @Query("SELECT COUNT(e) FROM IsapiEventLog e WHERE e.factoryId = :factoryId " +
            "AND e.aiRequiresAction = true AND e.processed = false")
    long countHighRiskUnprocessed(@Param("factoryId") String factoryId);
}
