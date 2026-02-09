package com.cretas.aims.repository;

import com.cretas.aims.entity.iot.IotDeviceData;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * IoT设备数据记录访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Repository
public interface IotDeviceDataRepository extends JpaRepository<IotDeviceData, Long> {

    /**
     * 查询设备最近N条数据
     */
    List<IotDeviceData> findTop10ByDeviceCodeOrderByReceivedAtDesc(String deviceCode);

    /**
     * 根据设备ID查询最近的数据（分页）
     */
    List<IotDeviceData> findByDeviceIdOrderByReceivedAtDesc(String deviceId, Pageable pageable);

    /**
     * 根据设备编码查询最近的数据（分页）
     */
    List<IotDeviceData> findByDeviceCodeOrderByReceivedAtDesc(String deviceCode, Pageable pageable);

    /**
     * 按数据类型查询
     */
    List<IotDeviceData> findByDeviceCodeAndDataTypeOrderByReceivedAtDesc(String deviceCode, String dataType);

    /**
     * 查询工厂的所有未处理数据
     */
    List<IotDeviceData> findByFactoryIdAndProcessedFalse(String factoryId);

    /**
     * 查询未处理的数据（分页）
     */
    List<IotDeviceData> findByProcessedFalseOrderByReceivedAtAsc(Pageable pageable);

    /**
     * 按时间范围查询
     */
    @Query("SELECT d FROM IotDeviceData d WHERE d.factoryId = :factoryId AND d.receivedAt BETWEEN :start AND :end")
    List<IotDeviceData> findByTimeRange(@Param("factoryId") String factoryId,
                                         @Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end);

    /**
     * 查询指定时间范围内的数据（按设备）
     */
    @Query("SELECT d FROM IotDeviceData d WHERE d.deviceId = :deviceId AND d.collectedAt BETWEEN :startTime AND :endTime ORDER BY d.collectedAt DESC")
    List<IotDeviceData> findByDeviceIdAndTimeRange(
            @Param("deviceId") String deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 标记数据为已处理
     */
    @Modifying
    @Query("UPDATE IotDeviceData d SET d.processed = true WHERE d.id = :id")
    int markAsProcessed(@Param("id") Long id);

    /**
     * 统计设备数据数量
     */
    long countByDeviceId(String deviceId);

    /**
     * 统计工厂数据数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 删除指定时间之前已处理的数据（用于数据归档）
     */
    @Modifying
    @Query("DELETE FROM IotDeviceData d WHERE d.receivedAt < :beforeTime AND d.processed = true")
    int deleteProcessedDataBefore(@Param("beforeTime") LocalDateTime beforeTime);
}
