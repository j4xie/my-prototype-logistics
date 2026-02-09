package com.cretas.aims.service;

import com.cretas.aims.entity.iot.IotDevice;
import com.cretas.aims.entity.iot.IotDeviceData;
import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * IoT数据服务接口
 * 负责IoT设备数据的采集、存储和处理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
public interface IotDataService {

    // ==================== 设备数据管理 ====================

    /**
     * 保存设备数据
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param dataType  数据类型 (WEIGHT, TEMPERATURE, HUMIDITY, IMAGE, BARCODE)
     * @param data      数据内容 (JSON格式)
     */
    void saveDeviceData(String factoryId, String deviceId, String dataType, JsonNode data);

    /**
     * 获取设备最近的数据记录
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param limit     返回记录数量限制
     * @return 数据记录列表
     */
    List<IotDeviceData> getRecentData(String factoryId, String deviceId, int limit);

    // ==================== 设备状态管理 ====================

    /**
     * 更新设备状态
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param status    设备状态 (ONLINE, OFFLINE, ERROR, MAINTENANCE)
     */
    void updateDeviceStatus(String factoryId, String deviceId, String status);

    /**
     * 更新设备心跳时间
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     */
    void updateDeviceHeartbeat(String factoryId, String deviceId);

    /**
     * 根据设备编码获取设备
     *
     * @param deviceCode 设备编码
     * @return 设备信息
     */
    Optional<IotDevice> getDeviceByCode(String deviceCode);

    // ==================== 设备关联更新 ====================

    /**
     * 更新关联设备的最后称重信息
     *
     * @param deviceCode 设备编码
     * @param weight     重量值
     * @param time       称重时间
     */
    void updateEquipmentLastWeight(String deviceCode, BigDecimal weight, LocalDateTime time);

    // ==================== 阈值告警检查 ====================

    /**
     * 检查温度阈值并触发告警
     * - 冷链阈值: 高于 -18°C 触发告警
     * - 常温阈值: 低于 0°C 或高于 25°C 触发告警
     *
     * @param factoryId   工厂ID
     * @param deviceId    设备ID
     * @param temperature 温度值
     */
    void checkTemperatureThreshold(String factoryId, String deviceId, double temperature);

    /**
     * 检查湿度阈值并触发告警
     * - 阈值: 低于 40% 或高于 70% 触发告警
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param humidity  湿度值
     */
    void checkHumidityThreshold(String factoryId, String deviceId, double humidity);

    // ==================== 告警管理 ====================

    /**
     * 创建设备告警
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param alertType 告警类型 (DEVICE_ERROR, TEMPERATURE_ALERT, HUMIDITY_ALERT, CAMERA_EVENT)
     * @param message   告警消息
     */
    void createDeviceAlert(String factoryId, String deviceId, String alertType, String message);

    /**
     * 检查设备离线状态
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param timeout   超时时长
     */
    void checkDeviceOffline(String factoryId, String deviceId, Duration timeout);
}
