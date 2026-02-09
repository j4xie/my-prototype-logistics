package com.cretas.aims.dto.scale;

import lombok.*;
import java.time.LocalDateTime;

/**
 * 原始秤数据帧 DTO
 * 用于 Drools 规则引擎输入
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RawScaleFrame {

    /**
     * 协议编码
     */
    private String protocolCode;

    /**
     * 原始字节数据
     */
    private byte[] rawBytes;

    /**
     * 原始数据 (16进制字符串)
     */
    private String rawHex;

    /**
     * 数据长度
     */
    private int dataLength;

    /**
     * 接收时间
     */
    private LocalDateTime receivedAt;

    /**
     * 设备ID
     */
    private String deviceId;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 边缘网关ID
     */
    private String gatewayId;

    // ==================== 工厂方法 ====================

    public static RawScaleFrame fromBytes(String protocolCode, byte[] data) {
        return RawScaleFrame.builder()
                .protocolCode(protocolCode)
                .rawBytes(data)
                .rawHex(bytesToHex(data))
                .dataLength(data.length)
                .receivedAt(LocalDateTime.now())
                .build();
    }

    public static RawScaleFrame fromHex(String protocolCode, String hexString) {
        byte[] bytes = hexToBytes(hexString);
        return RawScaleFrame.builder()
                .protocolCode(protocolCode)
                .rawBytes(bytes)
                .rawHex(hexString.toUpperCase())
                .dataLength(bytes.length)
                .receivedAt(LocalDateTime.now())
                .build();
    }

    // ==================== 工具方法 ====================

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    private static byte[] hexToBytes(String hex) {
        hex = hex.replaceAll("\\s", "");
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
