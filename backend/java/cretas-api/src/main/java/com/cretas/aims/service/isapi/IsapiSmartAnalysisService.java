package com.cretas.aims.service.isapi;

import com.cretas.aims.client.isapi.IsapiClient;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO.SmartCapabilities;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;

/**
 * ISAPI 智能分析配置服务
 * 管理海康威视摄像头的智能分析规则配置
 *
 * 支持功能:
 * - 越界检测 (LineDetection)
 * - 区域入侵检测 (FieldDetection)
 * - 人脸检测 (FaceDetection)
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IsapiSmartAnalysisService {

    private final IsapiDeviceRepository deviceRepository;
    private final IsapiClient isapiClient;

    // ==================== 智能分析能力查询 ====================

    /**
     * 获取设备智能分析能力
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @return 智能分析能力信息
     */
    public SmartCapabilities getSmartCapabilities(String factoryId, String deviceId) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            SmartCapabilities caps = isapiClient.getSmartCapabilities(device);
            log.info("获取设备智能分析能力成功: {} - smart={}, line={}, field={}, face={}",
                    device.getDeviceName(),
                    caps.getSmartSupported(),
                    caps.getLineDetectionSupported(),
                    caps.getFieldDetectionSupported(),
                    caps.getFaceDetectionSupported());
            return caps;
        } catch (IOException e) {
            log.error("获取智能分析能力失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("获取智能分析能力失败: " + e.getMessage(), e);
        }
    }

    // ==================== 越界检测配置 ====================

    /**
     * 获取越界检测配置
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param channelId 通道ID (1-based)
     * @return 越界检测配置
     */
    public SmartAnalysisDTO getLineDetectionConfig(String factoryId, String deviceId, int channelId) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            SmartAnalysisDTO config = isapiClient.getLineDetection(device, channelId);
            log.info("获取越界检测配置: {} 通道{} - enabled={}, rules={}",
                    device.getDeviceName(), channelId, config.getEnabled(),
                    config.getRules() != null ? config.getRules().size() : 0);
            return config;
        } catch (IOException e) {
            log.error("获取越界检测配置失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("获取越界检测配置失败: " + e.getMessage(), e);
        }
    }

    /**
     * 保存越界检测配置
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param channelId 通道ID (1-based)
     * @param config    配置内容
     */
    public void saveLineDetectionConfig(String factoryId, String deviceId, int channelId, SmartAnalysisDTO config) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            // 确保配置类型正确
            config.setChannelId(channelId);
            config.setDetectionType(SmartAnalysisDTO.DetectionType.LINE_DETECTION);

            isapiClient.setLineDetection(device, channelId, config);
            log.info("保存越界检测配置成功: {} 通道{} - enabled={}, rules={}",
                    device.getDeviceName(), channelId, config.getEnabled(),
                    config.getRules() != null ? config.getRules().size() : 0);
        } catch (IOException e) {
            log.error("保存越界检测配置失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("保存越界检测配置失败: " + e.getMessage(), e);
        }
    }

    // ==================== 区域入侵检测配置 ====================

    /**
     * 获取区域入侵检测配置
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param channelId 通道ID (1-based)
     * @return 区域入侵检测配置
     */
    public SmartAnalysisDTO getFieldDetectionConfig(String factoryId, String deviceId, int channelId) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            SmartAnalysisDTO config = isapiClient.getFieldDetection(device, channelId);
            log.info("获取区域入侵配置: {} 通道{} - enabled={}, rules={}",
                    device.getDeviceName(), channelId, config.getEnabled(),
                    config.getRules() != null ? config.getRules().size() : 0);
            return config;
        } catch (IOException e) {
            log.error("获取区域入侵配置失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("获取区域入侵配置失败: " + e.getMessage(), e);
        }
    }

    /**
     * 保存区域入侵检测配置
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param channelId 通道ID (1-based)
     * @param config    配置内容
     */
    public void saveFieldDetectionConfig(String factoryId, String deviceId, int channelId, SmartAnalysisDTO config) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            config.setChannelId(channelId);
            config.setDetectionType(SmartAnalysisDTO.DetectionType.FIELD_DETECTION);

            isapiClient.setFieldDetection(device, channelId, config);
            log.info("保存区域入侵配置成功: {} 通道{} - enabled={}, rules={}",
                    device.getDeviceName(), channelId, config.getEnabled(),
                    config.getRules() != null ? config.getRules().size() : 0);
        } catch (IOException e) {
            log.error("保存区域入侵配置失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("保存区域入侵配置失败: " + e.getMessage(), e);
        }
    }

    // ==================== 人脸检测配置 ====================

    /**
     * 获取人脸检测配置
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param channelId 通道ID (1-based)
     * @return 人脸检测配置
     */
    public SmartAnalysisDTO getFaceDetectionConfig(String factoryId, String deviceId, int channelId) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            SmartAnalysisDTO config = isapiClient.getFaceDetection(device, channelId);
            log.info("获取人脸检测配置: {} 通道{} - enabled={}",
                    device.getDeviceName(), channelId, config.getEnabled());
            return config;
        } catch (IOException e) {
            log.error("获取人脸检测配置失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("获取人脸检测配置失败: " + e.getMessage(), e);
        }
    }

    /**
     * 保存人脸检测配置
     *
     * @param factoryId 工厂ID
     * @param deviceId  设备ID
     * @param channelId 通道ID (1-based)
     * @param config    配置内容
     */
    public void saveFaceDetectionConfig(String factoryId, String deviceId, int channelId, SmartAnalysisDTO config) {
        IsapiDevice device = getDevice(factoryId, deviceId);
        try {
            config.setChannelId(channelId);
            config.setDetectionType(SmartAnalysisDTO.DetectionType.FACE_DETECTION);

            isapiClient.setFaceDetection(device, channelId, config);
            log.info("保存人脸检测配置成功: {} 通道{} - enabled={}",
                    device.getDeviceName(), channelId, config.getEnabled());
        } catch (IOException e) {
            log.error("保存人脸检测配置失败: {} - {}", device.getDeviceName(), e.getMessage());
            throw new RuntimeException("保存人脸检测配置失败: " + e.getMessage(), e);
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 获取设备实体，验证工厂归属
     */
    private IsapiDevice getDevice(String factoryId, String deviceId) {
        IsapiDevice device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new IllegalArgumentException("设备不存在: " + deviceId));

        // 验证工厂归属
        if (!factoryId.equals(device.getFactoryId())) {
            throw new IllegalArgumentException("设备不属于当前工厂");
        }

        return device;
    }
}
