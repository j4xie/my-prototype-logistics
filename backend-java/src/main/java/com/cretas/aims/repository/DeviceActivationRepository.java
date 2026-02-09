package com.cretas.aims.repository;

import com.cretas.aims.entity.DeviceActivation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 设备激活数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Repository
public interface DeviceActivationRepository extends JpaRepository<DeviceActivation, Integer> {

    /**
     * 根据激活码查找
     */
    Optional<DeviceActivation> findByActivationCode(String activationCode);

    /**
     * 根据工厂ID和设备ID查找
     */
    Optional<DeviceActivation> findByFactoryIdAndDeviceId(String factoryId, String deviceId);

    /**
     * 根据工厂ID查找所有激活记录
     */
    Page<DeviceActivation> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态查找
     */
    Page<DeviceActivation> findByFactoryIdAndStatus(String factoryId, String status, Pageable pageable);

    /**
     * 根据工厂ID和设备类型查找
     */
    List<DeviceActivation> findByFactoryIdAndDeviceType(String factoryId, String deviceType);

    /**
     * 检查激活码是否存在
     */
    boolean existsByActivationCode(String activationCode);

    /**
     * 检查设备是否已激活
     */
    boolean existsByFactoryIdAndDeviceIdAndStatus(String factoryId, String deviceId, String status);

    /**
     * 统计工厂的激活设备数
     */
    long countByFactoryIdAndStatus(String factoryId, String status);

    /**
     * 获取过期的激活记录
     */
    @Query("SELECT d FROM DeviceActivation d WHERE d.expiresAt < :now AND d.status = 'ACTIVATED'")
    List<DeviceActivation> findExpiredActivations(@Param("now") LocalDateTime now);

    /**
     * 获取指定时间范围内的激活记录
     */
    @Query("SELECT d FROM DeviceActivation d WHERE d.factoryId = :factoryId " +
           "AND d.activatedAt BETWEEN :startTime AND :endTime")
    List<DeviceActivation> findActivationsByDateRange(@Param("factoryId") String factoryId,
                                                      @Param("startTime") LocalDateTime startTime,
                                                      @Param("endTime") LocalDateTime endTime);

    /**
     * 统计各状态的激活码数量
     */
    @Query("SELECT d.status, COUNT(d) FROM DeviceActivation d " +
           "WHERE d.factoryId = :factoryId GROUP BY d.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);

    /**
     * 统计各设备类型的数量
     */
    @Query("SELECT d.deviceType, COUNT(d) FROM DeviceActivation d " +
           "WHERE d.factoryId = :factoryId AND d.status = 'ACTIVATED' " +
           "GROUP BY d.deviceType")
    List<Object[]> countByDeviceType(@Param("factoryId") String factoryId);

    /**
     * 获取最近激活的设备
     */
    @Query("SELECT d FROM DeviceActivation d WHERE d.factoryId = :factoryId " +
           "AND d.status = 'ACTIVATED' ORDER BY d.activatedAt DESC")
    List<DeviceActivation> findRecentActivations(@Param("factoryId") String factoryId, Pageable pageable);

    /**
     * 更新最后活跃时间
     */
    @Modifying
    @Transactional
    @Query("UPDATE DeviceActivation d SET d.lastActiveAt = :now " +
           "WHERE d.deviceId = :deviceId AND d.factoryId = :factoryId")
    void updateLastActiveTime(@Param("factoryId") String factoryId,
                             @Param("deviceId") String deviceId,
                             @Param("now") LocalDateTime now);

    /**
     * 获取非活跃设备（指定天数内未活跃）
     */
    @Query("SELECT d FROM DeviceActivation d WHERE d.factoryId = :factoryId " +
           "AND d.status = 'ACTIVATED' AND d.lastActiveAt < :cutoffTime")
    List<DeviceActivation> findInactiveDevices(@Param("factoryId") String factoryId,
                                               @Param("cutoffTime") LocalDateTime cutoffTime);

    /**
     * 批量更新状态
     */
    @Modifying
    @Transactional
    @Query("UPDATE DeviceActivation d SET d.status = :status " +
           "WHERE d.factoryId = :factoryId AND d.id IN :ids")
    void updateStatusBatch(@Param("factoryId") String factoryId,
                          @Param("ids") List<Integer> ids,
                          @Param("status") String status);
}
