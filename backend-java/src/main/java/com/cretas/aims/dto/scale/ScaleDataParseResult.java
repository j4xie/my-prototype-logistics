package com.cretas.aims.dto.scale;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 秤数据解析结果DTO
 * 通用的称重数据解析结果格式
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScaleDataParseResult {

    /**
     * 解析是否成功
     */
    private Boolean success;

    /**
     * 称重值
     */
    private BigDecimal weight;

    /**
     * 单位 (kg, g, lb 等)
     */
    private String unit;

    /**
     * 是否稳定
     */
    private Boolean stable;

    /**
     * 去皮重量
     */
    private BigDecimal tareWeight;

    /**
     * 毛重
     */
    private BigDecimal grossWeight;

    /**
     * 净重
     */
    private BigDecimal netWeight;

    /**
     * 数据采集时间
     */
    private LocalDateTime timestamp;

    /**
     * 使用的协议ID
     */
    private String protocolId;

    /**
     * 使用的协议编码
     */
    private String protocolCode;

    /**
     * 使用的协议名称
     */
    private String protocolName;

    /**
     * 原始数据 (16进制字符串)
     */
    private String rawDataHex;

    /**
     * 错误信息 (如果解析失败)
     */
    private String errorMessage;

    /**
     * 错误代码
     */
    private String errorCode;

    /**
     * 扩展字段 (用于特殊协议的额外数据)
     */
    private Map<String, Object> extendedFields;

    /**
     * 校验和是否通过
     */
    private Boolean checksumValid;

    /**
     * 帧长度
     */
    private Integer frameLength;

    // ==================== 静态工厂方法 ====================

    /**
     * 创建成功结果
     */
    public static ScaleDataParseResult success(BigDecimal weight, String unit, boolean stable) {
        return ScaleDataParseResult.builder()
                .success(true)
                .weight(weight)
                .unit(unit)
                .stable(stable)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建成功结果 (带协议信息)
     */
    public static ScaleDataParseResult success(BigDecimal weight, String unit, boolean stable,
                                                String protocolId, String protocolCode) {
        return ScaleDataParseResult.builder()
                .success(true)
                .weight(weight)
                .unit(unit)
                .stable(stable)
                .protocolId(protocolId)
                .protocolCode(protocolCode)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建失败结果
     */
    public static ScaleDataParseResult failure(String errorCode, String errorMessage) {
        return ScaleDataParseResult.builder()
                .success(false)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建失败结果 (带原始数据)
     */
    public static ScaleDataParseResult failure(String errorCode, String errorMessage, String rawDataHex) {
        return ScaleDataParseResult.builder()
                .success(false)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .rawDataHex(rawDataHex)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * 创建错误结果 (failure的别名)
     */
    public static ScaleDataParseResult error(String errorCode, String errorMessage) {
        return failure(errorCode, errorMessage);
    }

    /**
     * 创建错误结果 (带原始数据)
     */
    public static ScaleDataParseResult error(String errorCode, String errorMessage, String rawDataHex) {
        return failure(errorCode, errorMessage, rawDataHex);
    }

    // ==================== 实例方法 ====================

    /**
     * 检查解析是否成功
     */
    public boolean isSuccess() {
        return Boolean.TRUE.equals(this.success);
    }

    /**
     * 检查解析是否失败
     */
    public boolean isFailed() {
        return !isSuccess();
    }

    /**
     * 检查是否稳定
     */
    public boolean isStable() {
        return Boolean.TRUE.equals(this.stable);
    }

    // ==================== 错误代码常量 ====================

    public static final String ERROR_INVALID_FRAME_LENGTH = "INVALID_FRAME_LENGTH";
    public static final String ERROR_CHECKSUM_FAILED = "CHECKSUM_FAILED";
    public static final String ERROR_PARSE_FAILED = "PARSE_FAILED";
    public static final String ERROR_PROTOCOL_NOT_FOUND = "PROTOCOL_NOT_FOUND";
    public static final String ERROR_UNSUPPORTED_PROTOCOL = "UNSUPPORTED_PROTOCOL";
    public static final String ERROR_INVALID_DATA_FORMAT = "INVALID_DATA_FORMAT";
}
