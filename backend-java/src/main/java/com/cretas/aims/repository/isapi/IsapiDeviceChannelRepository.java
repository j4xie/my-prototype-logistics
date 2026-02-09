package com.cretas.aims.repository.isapi;

import com.cretas.aims.entity.isapi.IsapiDeviceChannel;
import com.cretas.aims.entity.isapi.IsapiDeviceChannel.ChannelStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * ISAPI 设备通道 Repository
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Repository
public interface IsapiDeviceChannelRepository extends JpaRepository<IsapiDeviceChannel, String> {

    /**
     * 根据设备ID查询所有通道
     */
    List<IsapiDeviceChannel> findByDevice_IdOrderByChannelId(String deviceId);

    /**
     * 根据设备ID和通道ID查询
     */
    Optional<IsapiDeviceChannel> findByDevice_IdAndChannelId(String deviceId, Integer channelId);

    /**
     * 根据工厂ID查询所有通道
     */
    List<IsapiDeviceChannel> findByFactoryId(String factoryId);

    /**
     * 根据设备ID删除所有通道
     */
    void deleteByDevice_Id(String deviceId);

    /**
     * 统计设备的通道数量
     */
    long countByDevice_Id(String deviceId);

    /**
     * 查询在线通道
     */
    @Query("SELECT c FROM IsapiDeviceChannel c WHERE c.device.id = :deviceId AND c.status = 'ONLINE'")
    List<IsapiDeviceChannel> findOnlineChannels(@Param("deviceId") String deviceId);

    /**
     * 更新通道状态
     */
    @Modifying
    @Query("UPDATE IsapiDeviceChannel c SET c.status = :status WHERE c.device.id = :deviceId")
    int updateStatusByDeviceId(@Param("deviceId") String deviceId, @Param("status") ChannelStatus status);
}
