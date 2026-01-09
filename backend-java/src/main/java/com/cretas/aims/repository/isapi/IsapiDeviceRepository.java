package com.cretas.aims.repository.isapi;

import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.entity.isapi.IsapiDevice.DeviceStatus;
import com.cretas.aims.entity.isapi.IsapiDevice.DeviceType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * ISAPI 设备 Repository
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Repository
public interface IsapiDeviceRepository extends JpaRepository<IsapiDevice, String> {

    // ==================== 基础查询 ====================

    /**
     * 根据工厂ID查询所有设备
     */
    List<IsapiDevice> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID分页查询设备
     */
    Page<IsapiDevice> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态查询
     */
    List<IsapiDevice> findByFactoryIdAndStatus(String factoryId, DeviceStatus status);

    /**
     * 根据工厂ID和设备类型查询
     */
    List<IsapiDevice> findByFactoryIdAndDeviceType(String factoryId, DeviceType deviceType);

    /**
     * 根据IP和端口查询 (用于检测重复)
     */
    Optional<IsapiDevice> findByFactoryIdAndIpAddressAndPort(
            String factoryId, String ipAddress, Integer port);

    /**
     * 根据序列号查询
     */
    Optional<IsapiDevice> findBySerialNumber(String serialNumber);

    /**
     * 根据 MAC 地址查询（忽略大小写）
     */
    @Query("SELECT d FROM IsapiDevice d WHERE LOWER(d.macAddress) = LOWER(:macAddress)")
    Optional<IsapiDevice> findByMacAddressIgnoreCase(@Param("macAddress") String macAddress);

    /**
     * 根据 IP 地址查询
     */
    Optional<IsapiDevice> findByIpAddress(String ipAddress);

    // ==================== 状态相关 ====================

    /**
     * 查询所有在线设备
     */
    @Query("SELECT d FROM IsapiDevice d WHERE d.factoryId = :factoryId AND d.status = 'ONLINE'")
    List<IsapiDevice> findOnlineDevices(@Param("factoryId") String factoryId);

    /**
     * 查询所有已订阅告警的设备
     */
    @Query("SELECT d FROM IsapiDevice d WHERE d.factoryId = :factoryId AND d.alertSubscribed = true")
    List<IsapiDevice> findSubscribedDevices(@Param("factoryId") String factoryId);

    /**
     * 查询心跳超时的设备 (用于离线检测)
     */
    @Query("SELECT d FROM IsapiDevice d WHERE d.status = 'ONLINE' " +
            "AND d.lastHeartbeatAt < :threshold")
    List<IsapiDevice> findHeartbeatTimeoutDevices(@Param("threshold") LocalDateTime threshold);

    /**
     * 查询需要重连的设备
     */
    @Query("SELECT d FROM IsapiDevice d WHERE d.status IN ('OFFLINE', 'ERROR') " +
            "AND d.factoryId = :factoryId")
    List<IsapiDevice> findDevicesNeedReconnect(@Param("factoryId") String factoryId);

    // ==================== 批量更新 ====================

    /**
     * 批量更新设备状态
     */
    @Modifying
    @Query("UPDATE IsapiDevice d SET d.status = :status WHERE d.id IN :ids")
    int updateStatusByIds(@Param("ids") List<String> ids, @Param("status") DeviceStatus status);

    /**
     * 更新心跳时间
     */
    @Modifying
    @Query("UPDATE IsapiDevice d SET d.lastHeartbeatAt = :time, d.status = 'ONLINE' WHERE d.id = :id")
    int updateHeartbeat(@Param("id") String id, @Param("time") LocalDateTime time);

    /**
     * 更新订阅状态
     */
    @Modifying
    @Query("UPDATE IsapiDevice d SET d.alertSubscribed = :subscribed WHERE d.id = :id")
    int updateSubscriptionStatus(@Param("id") String id, @Param("subscribed") boolean subscribed);

    /**
     * 标记所有超时设备为离线
     */
    @Modifying
    @Query("UPDATE IsapiDevice d SET d.status = 'OFFLINE', d.lastError = 'Heartbeat timeout' " +
            "WHERE d.status = 'ONLINE' AND d.lastHeartbeatAt < :threshold")
    int markTimeoutDevicesOffline(@Param("threshold") LocalDateTime threshold);

    // ==================== 统计查询 ====================

    /**
     * 统计各状态设备数量
     */
    @Query("SELECT d.status, COUNT(d) FROM IsapiDevice d WHERE d.factoryId = :factoryId GROUP BY d.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    /**
     * 统计各类型设备数量
     */
    @Query("SELECT d.deviceType, COUNT(d) FROM IsapiDevice d WHERE d.factoryId = :factoryId GROUP BY d.deviceType")
    List<Object[]> countByDeviceType(@Param("factoryId") String factoryId);

    /**
     * 统计设备总数
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计在线设备数
     */
    long countByFactoryIdAndStatus(String factoryId, DeviceStatus status);

    // ==================== 部门/设备关联 ====================

    /**
     * 根据部门ID查询设备
     */
    List<IsapiDevice> findByFactoryIdAndDepartmentId(String factoryId, String departmentId);

    /**
     * 根据关联设备ID查询
     */
    List<IsapiDevice> findByEquipmentId(Long equipmentId);

    // ==================== 搜索 ====================

    /**
     * 按名称或IP模糊搜索
     */
    @Query("SELECT d FROM IsapiDevice d WHERE d.factoryId = :factoryId " +
            "AND (d.deviceName LIKE %:keyword% OR d.ipAddress LIKE %:keyword% OR d.serialNumber LIKE %:keyword%)")
    Page<IsapiDevice> searchByKeyword(
            @Param("factoryId") String factoryId,
            @Param("keyword") String keyword,
            Pageable pageable);
}
