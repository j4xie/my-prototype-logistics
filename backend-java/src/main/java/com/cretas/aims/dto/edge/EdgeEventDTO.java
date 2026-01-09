package com.cretas.aims.dto.edge;

import lombok.Data;
import java.time.LocalDateTime;

/**
 * 边缘设备事件 DTO
 * 用于接收摄像头通过 HTTP 监听推送的事件
 */
@Data
public class EdgeEventDTO {

    /**
     * 设备序列号
     */
    private String deviceSerial;

    /**
     * 设备 IP 地址
     */
    private String ipAddress;

    /**
     * 事件类型: motion_detection, line_crossing, intrusion, etc.
     */
    private String eventType;

    /**
     * 事件状态: start, stop
     */
    private String eventState;

    /**
     * 通道 ID
     */
    private Integer channelId;

    /**
     * 事件时间
     */
    private LocalDateTime eventTime;

    /**
     * 图片 Base64 编码（如果有）
     */
    private String pictureBase64;

    /**
     * 图片 URL（如果有）
     */
    private String pictureUrl;

    /**
     * 原始 XML 数据（海康推送的原始数据）
     */
    private String rawXml;

    /**
     * 附加信息
     */
    private String additionalInfo;
}
