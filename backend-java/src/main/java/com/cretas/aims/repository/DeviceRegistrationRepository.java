package com.cretas.aims.repository;

import com.cretas.aims.entity.DeviceRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 设备注册数据访问层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Repository
public interface DeviceRegistrationRepository extends JpaRepository<DeviceRegistration, Long> {

    /**
     * 根据设备ID和工厂ID查找设备
     */
    Optional<DeviceRegistration> findByDeviceIdAndFactoryId(String deviceId, String factoryId);

    /**
     * 根据Push Token查找设备
     */
    Optional<DeviceRegistration> findByPushToken(String pushToken);

    /**
     * 查找用户的所有设备
     */
    List<DeviceRegistration> findByUserId(Long userId);

    /**
     * 查找用户在指定工厂的所有设备
     */
    List<DeviceRegistration> findByUserIdAndFactoryId(Long userId, String factoryId);

    /**
     * 查找工厂的所有已启用设备
     */
    List<DeviceRegistration> findByFactoryIdAndIsEnabledTrue(String factoryId);

    /**
     * 查找用户的所有已启用设备
     */
    List<DeviceRegistration> findByUserIdAndIsEnabledTrue(Long userId);

    /**
     * 删除指定设备
     */
    @Modifying
    @Query("DELETE FROM DeviceRegistration d WHERE d.deviceId = :deviceId AND d.factoryId = :factoryId")
    void deleteByDeviceIdAndFactoryId(@Param("deviceId") String deviceId, @Param("factoryId") String factoryId);

    /**
     * 删除用户的所有设备
     */
    @Modifying
    @Query("DELETE FROM DeviceRegistration d WHERE d.userId = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    /**
     * 查找长时间未活跃的设备（超过指定天数）
     */
    @Query("SELECT d FROM DeviceRegistration d WHERE d.lastActiveAt < :cutoffDate")
    List<DeviceRegistration> findInactiveDevices(@Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * 删除长时间未活跃的设备
     */
    @Modifying
    @Query("DELETE FROM DeviceRegistration d WHERE d.lastActiveAt < :cutoffDate")
    int deleteInactiveDevices(@Param("cutoffDate") LocalDateTime cutoffDate);

    /**
     * 更新设备的最后活跃时间
     */
    @Modifying
    @Query("UPDATE DeviceRegistration d SET d.lastActiveAt = :lastActiveAt WHERE d.id = :id")
    void updateLastActiveAt(@Param("id") Long id, @Param("lastActiveAt") LocalDateTime lastActiveAt);

    /**
     * 统计工厂的设备数量
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计用户的设备数量
     */
    long countByUserId(Long userId);

    /**
     * 统计工厂的已启用设备数量
     */
    long countByFactoryIdAndIsEnabledTrue(String factoryId);

    /**
     * 检查设备是否存在
     */
    boolean existsByDeviceIdAndFactoryId(String deviceId, String factoryId);

    /**
     * 检查Push Token是否存在
     */
    boolean existsByPushToken(String pushToken);
}
