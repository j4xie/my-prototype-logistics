package com.cretas.aims.dto.scale;

import com.cretas.aims.entity.FactoryEquipment;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * IoT 秤设备 DTO
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScaleDeviceDTO {

    private Long id;
    private String factoryId;
    private String equipmentCode;
    private String equipmentName;
    private String type;
    private String model;
    private String manufacturer;
    private String status;
    private String location;
    private String serialNumber;

    // IoT 相关字段
    private String iotDeviceCode;
    private String deviceCategory;
    private String scaleProtocolId;
    private String scaleBrandModelId;
    private String mqttTopic;
    private String scaleConnectionParams;

    // 实时数据
    private BigDecimal lastWeightReading;
    private LocalDateTime lastWeightTime;
    private LocalDateTime lastDataReceived;

    // 关联信息 (由 Service 填充)
    private ScaleProtocolDTO protocol;
    private ScaleBrandModelDTO brandModel;

    // ==================== 转换方法 ====================

    public static ScaleDeviceDTO fromEntity(FactoryEquipment entity) {
        if (entity == null) return null;

        return ScaleDeviceDTO.builder()
                .id(entity.getId())
                .factoryId(entity.getFactoryId())
                .equipmentCode(entity.getEquipmentCode())
                .equipmentName(entity.getEquipmentName())
                .type(entity.getType())
                .model(entity.getModel())
                .manufacturer(entity.getManufacturer())
                .status(entity.getStatus())
                .location(entity.getLocation())
                .serialNumber(entity.getSerialNumber())
                .iotDeviceCode(entity.getIotDeviceCode())
                .deviceCategory(entity.getUnifiedDeviceType() != null ? entity.getUnifiedDeviceType().getFrontendValue() : null)
                .scaleProtocolId(entity.getScaleProtocolId())
                .scaleBrandModelId(entity.getScaleBrandModelId())
                .mqttTopic(entity.getMqttTopic())
                .scaleConnectionParams(entity.getScaleConnectionParams())
                .lastWeightReading(entity.getLastWeightReading())
                .lastWeightTime(entity.getLastWeightTime())
                .lastDataReceived(entity.getLastDataReceived())
                .build();
    }

    /**
     * 请求 DTO: 创建秤设备
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRequest {
        private String equipmentName;
        private String equipmentCode;
        private String location;
        private String serialNumber;
        private String scaleBrandModelId;
        private String scaleProtocolId;
        private String iotDeviceCode;
        private String mqttTopic;
        private String scaleConnectionParams;
        private String notes;
    }

    /**
     * 请求 DTO: 更新秤设备
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateRequest {
        private String equipmentName;
        private String location;
        private String serialNumber;
        private String status;
        private String scaleBrandModelId;
        private String scaleProtocolId;
        private String iotDeviceCode;
        private String mqttTopic;
        private String scaleConnectionParams;
        private String notes;
    }

    /**
     * 请求 DTO: 绑定协议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BindProtocolRequest {
        private String protocolId;
        private String connectionParams;
    }

    /**
     * 请求 DTO: 测试数据解析
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestParseRequest {
        private String protocolId;
        private String rawDataHex;
    }

    /**
     * 响应 DTO: 测试解析结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TestParseResponse {
        private boolean success;
        private ScaleDataParseResult parseResult;
        private String errorMessage;
    }
}
