package com.cretas.aims.repository.dahua;

import com.cretas.aims.entity.dahua.DahuaDeviceChannel;
import com.cretas.aims.entity.dahua.DahuaDeviceChannel.ChannelStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Dahua 设备通道 Repository
 * 用于管理大华 NVR 多通道
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Repository
public interface DahuaDeviceChannelRepository extends JpaRepository<DahuaDeviceChannel, String> {

    /**
     * 根据设备ID查询所有通道
     */
    List<DahuaDeviceChannel> findByDeviceId(String deviceId);

    /**
     * 根据设备ID查询所有通道（按通道ID排序）
     */
    List<DahuaDeviceChannel> findByDeviceIdOrderByChannelId(String deviceId);

    /**
     * 根据工厂ID查询所有通道
     */
    List<DahuaDeviceChannel> findByFactoryId(String factoryId);

    /**
     * 根据设备ID和通道ID查询
     */
    Optional<DahuaDeviceChannel> findByDeviceIdAndChannelId(String deviceId, Integer channelId);

    /**
     * 根据设备ID删除所有通道
     */
    void deleteByDeviceId(String deviceId);

    /**
     * 统计设备的通道数量
     */
    long countByDeviceId(String deviceId);

    /**
     * 查询在线通道
     */
    @Query("SELECT c FROM DahuaDeviceChannel c WHERE c.deviceId = :deviceId AND c.status = 'ONLINE'")
    List<DahuaDeviceChannel> findOnlineChannels(@Param("deviceId") String deviceId);

    /**
     * 更新通道状态
     */
    @Modifying
    @Query("UPDATE DahuaDeviceChannel c SET c.status = :status WHERE c.deviceId = :deviceId")
    int updateStatusByDeviceId(@Param("deviceId") String deviceId, @Param("status") ChannelStatus status);
}
