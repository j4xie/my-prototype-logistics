package com.cretas.aims.service.isapi;

import com.cretas.aims.client.isapi.IsapiClient;
import com.cretas.aims.config.IsapiConfig;
import com.cretas.aims.dto.isapi.RecordingSearchRequest;
import com.cretas.aims.dto.isapi.RecordingSearchResponse;
import com.cretas.aims.dto.isapi.RecordingSearchResponse.RecordingItem;
import com.cretas.aims.entity.isapi.IsapiDevice;
import com.cretas.aims.repository.isapi.IsapiDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * NVR 录像检索服务 (Phase 3)
 *
 * 功能：
 * - 检索 NVR/IPC 历史录像
 * - 生成 RTSP 回放地址
 * - 支持按时间段、通道、录像类型搜索
 *
 * @author Cretas Team
 * @since 2026-01-30
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IsapiRecordingService {

    private final IsapiClient isapiClient;
    private final IsapiDeviceRepository deviceRepository;

    private static final DateTimeFormatter ISAPI_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");

    /**
     * 搜索录像
     *
     * @param request 搜索请求
     * @return 录像列表
     */
    public RecordingSearchResponse searchRecordings(RecordingSearchRequest request) {
        log.info("开始搜索录像: deviceId={}, startTime={}, endTime={}",
                request.getDeviceId(), request.getStartTime(), request.getEndTime());

        try {
            // 获取设备
            Optional<IsapiDevice> deviceOpt = deviceRepository.findById(request.getDeviceId());
            if (deviceOpt.isEmpty()) {
                return RecordingSearchResponse.builder()
                        .success(false)
                        .message("设备不存在: " + request.getDeviceId())
                        .build();
            }

            IsapiDevice device = deviceOpt.get();

            // 构建搜索 XML
            String searchXml = buildSearchXml(request);
            log.debug("录像搜索 XML: {}", searchXml);

            // 执行搜索
            String url = device.getBaseUrl() + IsapiConfig.Endpoints.CONTENT_MGMT_SEARCH;
            String responseXml = isapiClient.executePost(device, url, searchXml);
            log.debug("录像搜索响应: {}", responseXml);

            // 解析响应
            RecordingSearchResponse response = parseSearchResponse(responseXml, device);
            response.setDeviceId(request.getDeviceId());
            response.setSearchStartTime(request.getStartTime());
            response.setSearchEndTime(request.getEndTime());

            log.info("录像搜索完成: 找到 {} 条记录", response.getNumOfMatches());
            return response;

        } catch (Exception e) {
            log.error("录像搜索失败: {}", e.getMessage(), e);
            return RecordingSearchResponse.builder()
                    .success(false)
                    .message("搜索失败: " + e.getMessage())
                    .deviceId(request.getDeviceId())
                    .build();
        }
    }

    /**
     * 获取录像回放 RTSP URL
     *
     * @param deviceId  设备ID
     * @param channelId 通道ID
     * @param startTime 开始时间
     * @param endTime   结束时间
     * @return RTSP URL
     */
    public String getPlaybackUrl(String deviceId, int channelId,
                                  LocalDateTime startTime, LocalDateTime endTime) {
        try {
            Optional<IsapiDevice> deviceOpt = deviceRepository.findById(deviceId);
            if (deviceOpt.isEmpty()) {
                throw new IllegalArgumentException("设备不存在: " + deviceId);
            }

            IsapiDevice device = deviceOpt.get();
            String password = isapiClient.decryptPassword(device.getPasswordEncrypted());

            // 构建 RTSP 回放 URL
            // 格式: rtsp://user:pass@ip:554/Streaming/tracks/channelId?starttime=xxx&endtime=xxx
            String startTimeStr = startTime.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            String endTimeStr = endTime.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));

            return String.format(
                    "rtsp://%s:%s@%s:554/Streaming/tracks/%d01?starttime=%s&endtime=%s",
                    device.getUsername(),
                    password,
                    device.getIpAddress(),
                    channelId,
                    startTimeStr,
                    endTimeStr
            );

        } catch (Exception e) {
            log.error("获取回放 URL 失败: {}", e.getMessage(), e);
            throw new RuntimeException("获取回放 URL 失败: " + e.getMessage(), e);
        }
    }

    /**
     * 获取录像回放 RTSP URL（不带认证信息，用于前端显示）
     */
    public String getPlaybackUrlWithoutAuth(String deviceId, int channelId,
                                             LocalDateTime startTime, LocalDateTime endTime) {
        try {
            Optional<IsapiDevice> deviceOpt = deviceRepository.findById(deviceId);
            if (deviceOpt.isEmpty()) {
                throw new IllegalArgumentException("设备不存在: " + deviceId);
            }

            IsapiDevice device = deviceOpt.get();

            String startTimeStr = startTime.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            String endTimeStr = endTime.format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));

            return String.format(
                    "rtsp://%s:554/Streaming/tracks/%d01?starttime=%s&endtime=%s",
                    device.getIpAddress(),
                    channelId,
                    startTimeStr,
                    endTimeStr
            );

        } catch (Exception e) {
            log.error("获取回放 URL 失败: {}", e.getMessage(), e);
            throw new RuntimeException("获取回放 URL 失败: " + e.getMessage(), e);
        }
    }

    /**
     * 构建 ISAPI 搜索 XML
     */
    private String buildSearchXml(RecordingSearchRequest request) {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n");
        xml.append("<CMSearchDescription>\n");
        xml.append("  <searchID>search-").append(System.currentTimeMillis()).append("</searchID>\n");
        xml.append("  <trackIDList>\n");

        // 指定通道
        if (request.getChannelIds() != null && !request.getChannelIds().isEmpty()) {
            for (Integer channelId : request.getChannelIds()) {
                xml.append("    <trackID>").append(channelId).append("01</trackID>\n");
            }
        } else {
            // 默认搜索第一个通道
            xml.append("    <trackID>101</trackID>\n");
        }

        xml.append("  </trackIDList>\n");
        xml.append("  <timeSpanList>\n");
        xml.append("    <timeSpan>\n");
        xml.append("      <startTime>").append(request.getStartTime().format(ISAPI_DATE_FORMAT)).append("</startTime>\n");
        xml.append("      <endTime>").append(request.getEndTime().format(ISAPI_DATE_FORMAT)).append("</endTime>\n");
        xml.append("    </timeSpan>\n");
        xml.append("  </timeSpanList>\n");
        xml.append("  <maxResults>").append(request.getMaxResults()).append("</maxResults>\n");
        xml.append("  <searchResultPostion>").append(request.getSearchOffset()).append("</searchResultPostion>\n");

        // 录像类型
        if (!"ALL".equals(request.getRecordType())) {
            xml.append("  <metadataList>\n");
            xml.append("    <metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor>\n");
            xml.append("  </metadataList>\n");
        }

        xml.append("</CMSearchDescription>");

        return xml.toString();
    }

    /**
     * 解析 ISAPI 搜索响应
     */
    private RecordingSearchResponse parseSearchResponse(String xml, IsapiDevice device) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            doc.getDocumentElement().normalize();

            RecordingSearchResponse response = new RecordingSearchResponse();
            response.setSuccess(true);

            // 解析响应状态
            NodeList statusList = doc.getElementsByTagName("responseStatus");
            if (statusList.getLength() > 0) {
                String status = statusList.item(0).getTextContent();
                if (!"true".equalsIgnoreCase(status) && !"OK".equalsIgnoreCase(status)) {
                    response.setSuccess(false);
                    response.setMessage("搜索失败: " + status);
                    return response;
                }
            }

            // 解析总数
            NodeList numList = doc.getElementsByTagName("numOfMatches");
            if (numList.getLength() > 0) {
                response.setNumOfMatches(Integer.parseInt(numList.item(0).getTextContent()));
            }

            NodeList totalList = doc.getElementsByTagName("totalMatches");
            if (totalList.getLength() > 0) {
                response.setTotalMatches(Integer.parseInt(totalList.item(0).getTextContent()));
            }

            // 解析录像列表
            List<RecordingItem> recordings = new ArrayList<>();
            NodeList matchList = doc.getElementsByTagName("searchMatchItem");

            for (int i = 0; i < matchList.getLength(); i++) {
                Element matchElement = (Element) matchList.item(i);
                RecordingItem item = parseRecordingItem(matchElement, device);
                if (item != null) {
                    recordings.add(item);
                }
            }

            response.setRecordings(recordings);
            response.setMoreRecords(response.getTotalMatches() > response.getNumOfMatches());
            response.setMessage("搜索成功");

            return response;

        } catch (Exception e) {
            log.error("解析录像搜索响应失败: {}", e.getMessage(), e);
            return RecordingSearchResponse.builder()
                    .success(false)
                    .message("解析响应失败: " + e.getMessage())
                    .build();
        }
    }

    /**
     * 解析单条录像记录
     */
    private RecordingItem parseRecordingItem(Element element, IsapiDevice device) {
        try {
            RecordingItem item = new RecordingItem();

            // 解析 trackID
            NodeList trackList = element.getElementsByTagName("trackID");
            if (trackList.getLength() > 0) {
                String trackId = trackList.item(0).getTextContent();
                // trackID 格式通常是 "101", "201" 等，前面数字是通道
                item.setChannelId(Integer.parseInt(trackId.substring(0, trackId.length() - 2)));
            }

            // 解析时间
            NodeList timeSpanList = element.getElementsByTagName("timeSpan");
            if (timeSpanList.getLength() > 0) {
                Element timeSpan = (Element) timeSpanList.item(0);

                NodeList startList = timeSpan.getElementsByTagName("startTime");
                if (startList.getLength() > 0) {
                    item.setStartTime(parseIsapiDateTime(startList.item(0).getTextContent()));
                }

                NodeList endList = timeSpan.getElementsByTagName("endTime");
                if (endList.getLength() > 0) {
                    item.setEndTime(parseIsapiDateTime(endList.item(0).getTextContent()));
                }
            }

            // 计算时长
            if (item.getStartTime() != null && item.getEndTime() != null) {
                item.setDurationSeconds(
                        java.time.Duration.between(item.getStartTime(), item.getEndTime()).getSeconds()
                );
            }

            // 解析媒体信息
            NodeList mediaUriList = element.getElementsByTagName("mediaSegmentDescriptor");
            if (mediaUriList.getLength() > 0) {
                Element mediaDesc = (Element) mediaUriList.item(0);

                NodeList playbackUriList = mediaDesc.getElementsByTagName("playbackURI");
                if (playbackUriList.getLength() > 0) {
                    item.setPlaybackUrl(playbackUriList.item(0).getTextContent());
                }

                NodeList sizeList = mediaDesc.getElementsByTagName("contentLength");
                if (sizeList.getLength() > 0) {
                    long size = Long.parseLong(sizeList.item(0).getTextContent());
                    item.setFileSize(size);
                    item.setFileSizeFormatted(formatFileSize(size));
                }
            }

            // 解析录像类型
            NodeList metaList = element.getElementsByTagName("metadataMatches");
            if (metaList.getLength() > 0) {
                item.setRecordType(metaList.item(0).getTextContent());
            } else {
                item.setRecordType("NORMAL");
            }

            // 如果没有 playbackUrl，自动生成
            if (item.getPlaybackUrl() == null && item.getStartTime() != null && item.getEndTime() != null) {
                item.setPlaybackUrl(getPlaybackUrlWithoutAuth(
                        device.getId(),
                        item.getChannelId(),
                        item.getStartTime(),
                        item.getEndTime()
                ));
            }

            // 生成唯一ID
            item.setRecordingId(String.format("%s-%d-%s",
                    device.getId(),
                    item.getChannelId(),
                    item.getStartTime() != null ?
                            item.getStartTime().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) : "unknown"
            ));

            return item;

        } catch (Exception e) {
            log.warn("解析录像记录失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 解析 ISAPI 日期时间格式
     */
    private LocalDateTime parseIsapiDateTime(String dateStr) {
        try {
            // 尝试多种格式
            String[] formats = {
                    "yyyy-MM-dd'T'HH:mm:ss'Z'",
                    "yyyy-MM-dd'T'HH:mm:ss",
                    "yyyy-MM-dd HH:mm:ss"
            };

            for (String format : formats) {
                try {
                    return LocalDateTime.parse(dateStr, DateTimeFormatter.ofPattern(format));
                } catch (Exception ignored) {
                }
            }

            log.warn("无法解析日期: {}", dateStr);
            return null;

        } catch (Exception e) {
            log.warn("解析日期失败: {} - {}", dateStr, e.getMessage());
            return null;
        }
    }

    /**
     * 格式化文件大小
     */
    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }
}
