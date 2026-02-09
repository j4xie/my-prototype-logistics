package com.cretas.aims.repository;

import com.cretas.aims.entity.iot.DeviceStatus;
import com.cretas.aims.entity.iot.DeviceType;
import com.cretas.aims.entity.iot.IotDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * IoT设备数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Repository
public interface IotDeviceRepository extends JpaRepository<IotDevice, String> {

    /**
     * 根据设备编码查找
     */
    Optional<IotDevice> findByDeviceCode(String deviceCode);

    /**
     * 根据工厂ID查找所有设备
     */
    List<IotDevice> findByFactoryId(String factoryId);

    /**
     * 根据设备类型查找
     */
    List<IotDevice> findByFactoryIdAndDeviceType(String factoryId, DeviceType deviceType);

    /**
     * 根据状态查找
     */
    List<IotDevice> findByFactoryIdAndStatus(String factoryId, DeviceStatus status);

    /**
     * 根据关联设备ID查找IoT设备
     */
    Optional<IotDevice> findByEquipmentId(Long equipmentId);

    /**
     * 更新设备状态
     */
    @Modifying
    @Query("UPDATE IotDevice d SET d.status = :status, d.updatedAt = CURRENT_TIMESTAMP WHERE d.id = :deviceId")
    int updateStatus(@Param("deviceId") String deviceId, @Param("status") DeviceStatus status);

    /**
     * 根据设备编码更新状态
     */
    @Modifying
    @Query("UPDATE IotDevice d SET d.status = :status, d.updatedAt = CURRENT_TIMESTAMP WHERE d.deviceCode = :deviceCode")
    int updateStatusByDeviceCode(@Param("deviceCode") String deviceCode, @Param("status") DeviceStatus status);

    /**
     * 更新最后心跳时间
     */
    @Modifying
    @Query("UPDATE IotDevice d SET d.lastHeartbeat = :time, d.status = 'ONLINE', d.updatedAt = CURRENT_TIMESTAMP WHERE d.id = :deviceId")
    int updateLastHeartbeat(@Param("deviceId") String deviceId, @Param("time") LocalDateTime time);

    /**
     * 根据设备编码更新最后心跳时间
     */
    @Modifying
    @Query("UPDATE IotDevice d SET d.lastHeartbeat = :time, d.status = 'ONLINE', d.updatedAt = CURRENT_TIMESTAMP WHERE d.deviceCode = :deviceCode")
    int updateLastHeartbeatByDeviceCode(@Param("deviceCode") String deviceCode, @Param("time") LocalDateTime time);

    /**
     * 更新最后数据接收时间
     */
    @Modifying
    @Query("UPDATE IotDevice d SET d.lastDataTime = :time, d.updatedAt = CURRENT_TIMESTAMP WHERE d.id = :deviceId")
    int updateLastDataTime(@Param("deviceId") String deviceId, @Param("time") LocalDateTime time);

    /**
     * 查找心跳超时的设备
     */
    @Query("SELECT d FROM IotDevice d WHERE d.factoryId = :factoryId AND d.status = 'ONLINE' AND d.lastHeartbeat < :timeout")
    List<IotDevice> findTimeoutDevices(@Param("factoryId") String factoryId, @Param("timeout") LocalDateTime timeout);

    /**
     * 统计工厂设备数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计工厂在线设备数量
     */
    long countByFactoryIdAndStatus(String factoryId, DeviceStatus status);

    /**
     * 检查设备编码是否存在
     */
    boolean existsByDeviceCode(String deviceCode);
}
