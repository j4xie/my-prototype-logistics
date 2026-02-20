package com.cretas.aims.repository.dahua;

import com.cretas.aims.entity.dahua.DahuaDevice;
import com.cretas.aims.entity.dahua.DahuaDevice.DeviceStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Dahua 设备 Repository
 * 管理大华 IPC/NVR/DVR 设备
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Repository
public interface DahuaDeviceRepository extends JpaRepository<DahuaDevice, String> {

    // ==================== 基础查询 ====================

    /**
     * 根据工厂ID查询所有设备
     */
    List<DahuaDevice> findByFactoryId(String factoryId);

    /**
     * 根据工厂ID分页查询设备
     */
    Page<DahuaDevice> findByFactoryId(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和状态查询
     */
    List<DahuaDevice> findByFactoryIdAndStatus(String factoryId, DeviceStatus status);

    /**
     * 根据IP和端口查询 (用于检测重复)
     */
    Optional<DahuaDevice> findByIpAddressAndPort(String ipAddress, Integer port);

    /**
     * 根据工厂ID、IP和端口查询 (用于检测重复)
     */
    Optional<DahuaDevice> findByFactoryIdAndIpAddressAndPort(
            String factoryId, String ipAddress, Integer port);

    /**
     * 根据序列号查询
     */
    Optional<DahuaDevice> findBySerialNumber(String serialNumber);

    /**
     * 根据 MAC 地址查询
     */
    Optional<DahuaDevice> findByMacAddress(String macAddress);

    /**
     * 根据 MAC 地址查询（忽略大小写）
     */
    @Query("SELECT d FROM DahuaDevice d WHERE LOWER(d.macAddress) = LOWER(:macAddress)")
    Optional<DahuaDevice> findByMacAddressIgnoreCase(@Param("macAddress") String macAddress);

    // ==================== 搜索 ====================

    /**
     * 按名称、IP、型号或序列号模糊搜索
     */
    @Query("SELECT d FROM DahuaDevice d WHERE d.factoryId = :factoryId " +
            "AND (d.deviceName LIKE %:keyword% " +
            "OR d.ipAddress LIKE %:keyword% " +
            "OR d.deviceModel LIKE %:keyword% " +
            "OR d.serialNumber LIKE %:keyword%)")
    Page<DahuaDevice> searchByKeyword(
            @Param("factoryId") String factoryId,
            @Param("keyword") String keyword,
            Pageable pageable);

    /**
     * 按名称、IP、型号或序列号模糊搜索（列表形式）
     */
    @Query("SELECT d FROM DahuaDevice d WHERE d.factoryId = :factoryId " +
            "AND (d.deviceName LIKE %:keyword% " +
            "OR d.ipAddress LIKE %:keyword% " +
            "OR d.deviceModel LIKE %:keyword% " +
            "OR d.serialNumber LIKE %:keyword%)")
    List<DahuaDevice> searchByKeyword(
            @Param("factoryId") String factoryId,
            @Param("keyword") String keyword);

    // ==================== 统计查询 ====================

    /**
     * 统计设备总数
     */
    long countByFactoryId(String factoryId);

    /**
     * 统计指定状态的设备数
     */
    long countByFactoryIdAndStatus(String factoryId, DeviceStatus status);

    /**
     * 统计各状态设备数量
     */
    @Query("SELECT d.status, COUNT(d) FROM DahuaDevice d WHERE d.factoryId = :factoryId GROUP BY d.status")
    List<Object[]> countByStatus(@Param("factoryId") String factoryId);
}
