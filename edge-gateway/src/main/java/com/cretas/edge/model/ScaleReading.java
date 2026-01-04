package com.cretas.edge.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 称重数据模型
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScaleReading {

    /**
     * 读数唯一ID
     */
    private String readingId;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 设备ID (秤的标识)
     */
    private String deviceId;

    /**
     * 串口名称 (如 COM1, /dev/ttyUSB0)
     */
    private String portName;

    /**
     * 秤的品牌/型号
     */
    private String scaleBrand;

    /**
     * 重量值 (单位: 克)
     */
    private BigDecimal weightGrams;

    /**
     * 原始重量值 (协议原始数据)
     */
    private BigDecimal rawWeight;

    /**
     * 重量单位 (g, kg, lb)
     */
    private String weightUnit;

    /**
     * 是否稳定读数
     */
    private boolean stable;

    /**
     * 是否零点
     */
    private boolean zero;

    /**
     * 是否超载
     */
    private boolean overload;

    /**
     * 读数状态 (NORMAL, ERROR, TIMEOUT)
     */
    private ReadingStatus status;

    /**
     * 错误信息 (如果有)
     */
    private String errorMessage;

    /**
     * 原始数据 (十六进制字符串)
     */
    private String rawDataHex;

    /**
     * 采集时间戳
     */
    private LocalDateTime timestamp;

    /**
     * 上报时间戳
     */
    private LocalDateTime uploadedAt;

    /**
     * 读数状态枚举
     */
    public enum ReadingStatus {
        NORMAL,      // 正常读数
        UNSTABLE,    // 不稳定
        ERROR,       // 读取错误
        TIMEOUT,     // 超时
        OVERLOAD,    // 超载
        UNDERLOAD    // 欠载
    }

    /**
     * 创建正常读数
     */
    public static ScaleReading normalReading(String deviceId, BigDecimal weightGrams) {
        return ScaleReading.builder()
                .deviceId(deviceId)
                .weightGrams(weightGrams)
                .stable(true)
                .status(ReadingStatus.NORMAL)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建错误读数
     */
    public static ScaleReading errorReading(String deviceId, String errorMessage) {
        return ScaleReading.builder()
                .deviceId(deviceId)
                .status(ReadingStatus.ERROR)
                .errorMessage(errorMessage)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
