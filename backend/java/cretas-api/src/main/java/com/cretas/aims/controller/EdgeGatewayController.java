package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.edge.EdgeUploadRequest;
import com.cretas.aims.dto.edge.EdgeUploadResponse;
import com.cretas.aims.service.edge.EdgeGatewayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 边缘网关 Controller
 * 接收边缘设备（本地代理）上传的摄像头数据
 *
 * 架构说明：
 * - 云端后端无法直接访问本地局域网的摄像头
 * - 需要在本地部署边缘网关（Python脚本/树莓派）
 * - 边缘网关从摄像头获取数据，主动上传到此接口
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Slf4j
@RestController
@RequestMapping("/api/mobile/edge")
@RequiredArgsConstructor
@Tag(name = "边缘网关", description = "接收边缘设备上传的摄像头数据")
public class EdgeGatewayController {

    private final EdgeGatewayService edgeGatewayService;

    /**
     * 边缘数据上传（JSON格式）
     * 支持抓拍图片、告警事件、心跳
     */
    @PostMapping("/upload")
    @Operation(summary = "边缘数据上传", description = "接收边缘网关上传的摄像头数据")
    public ApiResponse<EdgeUploadResponse> upload(@RequestBody EdgeUploadRequest request) {
        try {
            EdgeUploadResponse response = edgeGatewayService.processUpload(request);
            if (response.isSuccess()) {
                return ApiResponse.success(response.getMessage(), response);
            } else {
                return ApiResponse.error(response.getMessage());
            }
        } catch (Exception e) {
            log.error("边缘上传处理失败: {}", e.getMessage(), e);
            return ApiResponse.error("上传处理失败: " + e.getMessage());
        }
    }

    /**
     * 边缘图片上传（Multipart格式）
     * 用于直接上传二进制图片文件
     */
    @PostMapping(value = "/upload/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "边缘图片上传", description = "直接上传图片文件")
    public ApiResponse<EdgeUploadResponse> uploadImage(
            @RequestParam("gatewayId") String gatewayId,
            @RequestParam("deviceId") String deviceId,
            @RequestParam(value = "channelId", defaultValue = "1") Integer channelId,
            @RequestParam("image") MultipartFile image) {
        try {
            // 转换为标准请求
            EdgeUploadRequest request = new EdgeUploadRequest();
            request.setGatewayId(gatewayId);
            request.setDeviceId(deviceId);
            request.setChannelId(channelId);
            request.setUploadType(EdgeUploadRequest.UploadType.CAPTURE);
            request.setPictureBase64(Base64.getEncoder().encodeToString(image.getBytes()));
            request.setPictureFormat(getImageFormat(image.getOriginalFilename()));

            EdgeUploadResponse response = edgeGatewayService.processUpload(request);
            if (response.isSuccess()) {
                return ApiResponse.success(response.getMessage(), response);
            } else {
                return ApiResponse.error(response.getMessage());
            }
        } catch (Exception e) {
            log.error("图片上传处理失败: {}", e.getMessage(), e);
            return ApiResponse.error("图片上传失败: " + e.getMessage());
        }
    }

    /**
     * 边缘心跳
     * 简化的心跳接口
     */
    @PostMapping("/heartbeat")
    @Operation(summary = "边缘心跳", description = "边缘网关心跳检测")
    public ApiResponse<EdgeUploadResponse> heartbeat(
            @RequestParam("gatewayId") String gatewayId,
            @RequestParam("deviceId") String deviceId) {
        EdgeUploadRequest request = new EdgeUploadRequest();
        request.setGatewayId(gatewayId);
        request.setDeviceId(deviceId);
        request.setUploadType(EdgeUploadRequest.UploadType.HEARTBEAT);

        EdgeUploadResponse response = edgeGatewayService.processUpload(request);
        return ApiResponse.success("心跳确认", response);
    }

    /**
     * 获取已注册的边缘网关列表
     */
    @GetMapping("/gateways")
    @Operation(summary = "获取边缘网关列表", description = "查看已注册的边缘网关")
    public ApiResponse<Map<String, EdgeGatewayService.EdgeGatewayInfo>> getGateways() {
        return ApiResponse.success(edgeGatewayService.getRegisteredGateways());
    }

    /**
     * 健康检查（边缘网关可用于测试连通性）
     */
    @GetMapping("/health")
    @Operation(summary = "边缘接口健康检查")
    public ApiResponse<String> health() {
        return ApiResponse.success("边缘网关接口正常", "OK");
    }

    private String getImageFormat(String filename) {
        if (filename == null) return "JPEG";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) return "PNG";
        if (lower.endsWith(".gif")) return "GIF";
        return "JPEG";
    }

    // ==================== 海康摄像头直接推送接口 ====================

    /**
     * 海康摄像头事件推送接口
     * 摄像头通过 HTTP 监听直接推送 XML 格式的事件
     *
     * 配置方式：在摄像头 Web 界面配置 HTTP 监听地址为此接口
     * URL: http://服务器IP:10010/api/mobile/edge/events
     */
    @PostMapping(value = "/events", consumes = {MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE, MediaType.ALL_VALUE})
    @Operation(summary = "海康事件推送", description = "接收海康摄像头直接推送的事件（XML格式）")
    public String receiveHikvisionEvent(
            @RequestBody String xmlBody,
            @RequestHeader(value = "Content-Type", required = false) String contentType) {

        log.info("收到海康摄像头推送事件, Content-Type: {}", contentType);
        log.debug("事件原始数据: {}", xmlBody);

        try {
            // 解析 XML 事件
            HikvisionEventInfo eventInfo = parseHikvisionEvent(xmlBody);

            if (eventInfo == null) {
                log.warn("无法解析事件数据");
                return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString></ResponseStatus>";
            }

            log.info("解析事件: type={}, mac={}, channel={}, time={}",
                    eventInfo.eventType, eventInfo.macAddress, eventInfo.channelId, eventInfo.dateTime);

            // 构建上传请求
            EdgeUploadRequest request = new EdgeUploadRequest();
            request.setGatewayId("hikvision-direct-" + (eventInfo.macAddress != null ? eventInfo.macAddress : "unknown"));
            request.setUploadType(EdgeUploadRequest.UploadType.EVENT);
            request.setEventType(eventInfo.eventType);
            request.setEventState(eventInfo.eventState);
            request.setChannelId(eventInfo.channelId);
            request.setCaptureTime(eventInfo.dateTime);
            request.setEventData(xmlBody);

            // 如果有图片数据
            if (eventInfo.pictureBase64 != null) {
                request.setPictureBase64(eventInfo.pictureBase64);
                request.setUploadType(EdgeUploadRequest.UploadType.CAPTURE);
            }

            // 根据 MAC 地址或 IP 查找设备
            String deviceId = findDeviceByMacOrIp(eventInfo.macAddress, eventInfo.ipAddress);
            if (deviceId != null) {
                request.setDeviceId(deviceId);
                edgeGatewayService.processUpload(request);
            } else {
                log.warn("未找到匹配的设备: mac={}, ip={}", eventInfo.macAddress, eventInfo.ipAddress);
                // 即使没找到设备也记录日志
                logUnknownDeviceEvent(eventInfo, xmlBody);
            }

            // 返回成功响应（海康要求的格式）
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ResponseStatus><statusCode>1</statusCode><statusString>OK</statusString></ResponseStatus>";

        } catch (Exception e) {
            log.error("处理海康事件失败: {}", e.getMessage(), e);
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><ResponseStatus><statusCode>0</statusCode><statusString>Error</statusString></ResponseStatus>";
        }
    }

    /**
     * 解析海康 XML 事件
     */
    private HikvisionEventInfo parseHikvisionEvent(String xml) {
        HikvisionEventInfo info = new HikvisionEventInfo();

        try {
            // 提取事件类型
            info.eventType = extractXmlValue(xml, "eventType");
            if (info.eventType == null) {
                info.eventType = extractXmlValue(xml, "EventNotificationAlert");
            }

            // 提取事件状态
            info.eventState = extractXmlValue(xml, "eventState");
            if (info.eventState == null) {
                info.eventState = "active";
            }

            // 提取 MAC 地址
            info.macAddress = extractXmlValue(xml, "macAddress");

            // 提取 IP 地址
            info.ipAddress = extractXmlValue(xml, "ipAddress");

            // 提取通道 ID
            String channelStr = extractXmlValue(xml, "channelID");
            if (channelStr == null) {
                channelStr = extractXmlValue(xml, "dynChannelID");
            }
            info.channelId = channelStr != null ? Integer.parseInt(channelStr) : 1;

            // 提取时间
            String dateTimeStr = extractXmlValue(xml, "dateTime");
            if (dateTimeStr != null) {
                try {
                    // 海康时间格式: 2026-01-08T21:30:00+08:00 或 2026-01-08T21:30:00Z
                    dateTimeStr = dateTimeStr.replaceAll("\\+.*$", "").replace("Z", "");
                    info.dateTime = LocalDateTime.parse(dateTimeStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                } catch (Exception e) {
                    info.dateTime = LocalDateTime.now();
                }
            } else {
                info.dateTime = LocalDateTime.now();
            }

            // 提取图片数据（如果有）
            String pictureData = extractXmlValue(xml, "picturesNumber");
            if (pictureData != null && Integer.parseInt(pictureData) > 0) {
                // 图片可能在另一个请求中，或者 base64 编码在 xml 中
                info.pictureBase64 = extractXmlValue(xml, "picture");
            }

            return info;

        } catch (Exception e) {
            log.error("解析海康事件 XML 失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 从 XML 中提取值
     */
    private String extractXmlValue(String xml, String tagName) {
        Pattern pattern = Pattern.compile("<" + tagName + ">([^<]*)</" + tagName + ">", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(xml);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        return null;
    }

    /**
     * 根据 MAC 地址或 IP 查找设备
     */
    private String findDeviceByMacOrIp(String macAddress, String ipAddress) {
        // 这里需要实现根据 MAC 或 IP 查找设备的逻辑
        // 暂时返回 null，后续通过 service 实现
        return edgeGatewayService.findDeviceIdByMacOrIp(macAddress, ipAddress);
    }

    /**
     * 记录未知设备的事件
     */
    private void logUnknownDeviceEvent(HikvisionEventInfo eventInfo, String xmlBody) {
        log.info("记录未知设备事件: mac={}, ip={}, type={}",
                eventInfo.macAddress, eventInfo.ipAddress, eventInfo.eventType);
        // TODO: 可以存储到数据库，供后续设备匹配使用
    }

    /**
     * 海康事件信息
     */
    private static class HikvisionEventInfo {
        String eventType;
        String eventState;
        String macAddress;
        String ipAddress;
        Integer channelId;
        LocalDateTime dateTime;
        String pictureBase64;
    }
}
