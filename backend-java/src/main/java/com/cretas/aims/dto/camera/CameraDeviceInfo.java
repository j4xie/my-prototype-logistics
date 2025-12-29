package com.cretas.aims.dto.camera;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 相机设备信息DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-02-02
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CameraDeviceInfo {
    /**
     * 设备索引
     */
    private Integer index;

    /**
     * 设备类型
     * GIGE, USB, CAMERALINK, CXP, XOF
     */
    private String transportLayerType;

    /**
     * 设备名称（用户自定义名称）
     */
    private String userDefinedName;

    /**
     * 型号名称
     */
    private String modelName;

    /**
     * 序列号
     */
    private String serialNumber;

    /**
     * IP地址（仅GigE设备）
     */
    private String currentIp;

    /**
     * 设备编号（仅USB设备）
     */
    private Integer deviceNumber;

    /**
     * 是否可访问
     */
    private Boolean accessible;
}

