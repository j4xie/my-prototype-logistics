package com.cretas.aims.dto.edge;

import lombok.Data;
import java.time.LocalDateTime;

/**
 * 边缘网关上传请求 DTO
 * 用于接收边缘设备（如本地代理）上传的摄像头数据
 */
@Data
public class EdgeUploadRequest {

    /**
     * 边缘网关唯一标识
     */
    private String gatewayId;

    /**
     * 设备ID（对应 isapi_devices 表的 id）
     */
    private String deviceId;

    /**
     * 上传类型: CAPTURE(抓拍), EVENT(告警事件), HEARTBEAT(心跳)
     */
    private UploadType uploadType;

    /**
     * 通道ID（抓拍时使用）
     */
    private Integer channelId;

    /**
     * 图片数据（Base64编码）
     */
    private String pictureBase64;

    /**
     * 图片格式: JPEG, PNG
     */
    private String pictureFormat;

    /**
     * 事件类型（告警时使用）
     */
    private String eventType;

    /**
     * 事件状态: active, inactive
     */
    private String eventState;

    /**
     * 事件描述
     */
    private String eventDescription;

    /**
     * 事件数据（JSON格式）
     */
    private String eventData;

    /**
     * 边缘端采集时间
     */
    private LocalDateTime captureTime;

    /**
     * 边缘端额外元数据（JSON格式）
     */
    private String metadata;

    public enum UploadType {
        CAPTURE,    // 图片抓拍
        EVENT,      // 告警事件
        HEARTBEAT,  // 心跳检测
        VIDEO_CLIP  // 视频片段
    }
}
