package com.cretas.aims.client.isapi;

import com.cretas.aims.dto.isapi.SmartAnalysisDTO;
import com.cretas.aims.dto.isapi.SmartAnalysisDTO.*;
import lombok.extern.slf4j.Slf4j;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * ISAPI XML 解析器
 * 解析海康威视设备返回的 XML 数据
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Slf4j
public class IsapiXmlParser {

    private static final DateTimeFormatter ISAPI_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss[XXX][X]");

    private static final DateTimeFormatter ISAPI_DATE_FORMAT_SIMPLE =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final DocumentBuilderFactory factory;

    public IsapiXmlParser() {
        this.factory = DocumentBuilderFactory.newInstance();
        try {
            // 禁用 DTD 和外部实体以防止 XXE 攻击
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        } catch (Exception e) {
            log.warn("无法设置 XML 安全特性", e);
        }
    }

    /**
     * 解析 XML 字符串为 Document
     */
    public Document parse(String xml) throws Exception {
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new InputSource(new StringReader(xml)));
    }

    /**
     * 解析设备信息
     */
    public Map<String, Object> parseDeviceInfo(String xml) {
        Map<String, Object> result = new HashMap<>();
        try {
            Document doc = parse(xml);
            Element root = doc.getDocumentElement();

            result.put("deviceName", getElementText(root, "deviceName"));
            result.put("deviceID", getElementText(root, "deviceID"));
            result.put("deviceDescription", getElementText(root, "deviceDescription"));
            result.put("deviceLocation", getElementText(root, "deviceLocation"));
            result.put("model", getElementText(root, "model"));
            result.put("serialNumber", getElementText(root, "serialNumber"));
            result.put("macAddress", getElementText(root, "macAddress"));
            result.put("firmwareVersion", getElementText(root, "firmwareVersion"));
            result.put("firmwareReleasedDate", getElementText(root, "firmwareReleasedDate"));
            result.put("encoderVersion", getElementText(root, "encoderVersion"));
            result.put("encoderReleasedDate", getElementText(root, "encoderReleasedDate"));
            result.put("bootVersion", getElementText(root, "bootVersion"));
            result.put("bootReleasedDate", getElementText(root, "bootReleasedDate"));
            result.put("hardwareVersion", getElementText(root, "hardwareVersion"));
            result.put("deviceType", getElementText(root, "deviceType"));
            result.put("telecontrolID", getElementText(root, "telecontrolID"));

        } catch (Exception e) {
            log.error("解析设备信息失败", e);
            result.put("error", e.getMessage());
        }
        return result;
    }

    /**
     * 解析流媒体通道列表
     */
    public List<Map<String, Object>> parseStreamingChannels(String xml) {
        List<Map<String, Object>> channels = new ArrayList<>();
        try {
            Document doc = parse(xml);
            NodeList channelNodes = doc.getElementsByTagName("StreamingChannel");

            for (int i = 0; i < channelNodes.getLength(); i++) {
                Element channelEl = (Element) channelNodes.item(i);
                Map<String, Object> channel = new HashMap<>();

                channel.put("id", getElementText(channelEl, "id"));
                channel.put("channelName", getElementText(channelEl, "channelName"));
                channel.put("enabled", Boolean.parseBoolean(getElementText(channelEl, "enabled")));

                // 解析视频参数
                Element videoEl = getFirstChildElement(channelEl, "Video");
                if (videoEl != null) {
                    channel.put("videoCodecType", getElementText(videoEl, "videoCodecType"));
                    channel.put("videoResolutionWidth", parseInteger(getElementText(videoEl, "videoResolutionWidth")));
                    channel.put("videoResolutionHeight", parseInteger(getElementText(videoEl, "videoResolutionHeight")));
                    channel.put("maxFrameRate", parseInteger(getElementText(videoEl, "maxFrameRate")));
                    channel.put("constantBitRate", parseInteger(getElementText(videoEl, "constantBitRate")));
                }

                channels.add(channel);
            }
        } catch (Exception e) {
            log.error("解析流媒体通道失败", e);
        }
        return channels;
    }

    /**
     * 解析告警事件 (EventNotificationAlert)
     */
    public Map<String, Object> parseEventAlert(String xml) {
        Map<String, Object> event = new HashMap<>();
        try {
            Document doc = parse(xml);
            Element root = doc.getDocumentElement();

            event.put("ipAddress", getElementText(root, "ipAddress"));
            event.put("portNo", parseInteger(getElementText(root, "portNo")));
            event.put("protocol", getElementText(root, "protocol"));
            event.put("macAddress", getElementText(root, "macAddress"));
            event.put("channelID", parseInteger(getElementText(root, "channelID")));
            event.put("dateTime", parseDateTime(getElementText(root, "dateTime")));
            event.put("activePostCount", parseInteger(getElementText(root, "activePostCount")));
            event.put("eventType", getElementText(root, "eventType"));
            event.put("eventState", getElementText(root, "eventState"));
            event.put("eventDescription", getElementText(root, "eventDescription"));

            // 解析检测区域
            Element regionEl = getFirstChildElement(root, "DetectionRegionList");
            if (regionEl != null) {
                event.put("detectionRegion", parseDetectionRegion(regionEl));
            }

            // 判断事件类型
            String eventType = (String) event.get("eventType");
            String eventState = (String) event.get("eventState");

            // 心跳判断: videoloss + inactive
            event.put("isHeartbeat", "videoloss".equalsIgnoreCase(eventType)
                    && "inactive".equalsIgnoreCase(eventState));

        } catch (Exception e) {
            log.error("解析告警事件失败", e);
            event.put("error", e.getMessage());
        }
        return event;
    }

    /**
     * 解析 multipart/mixed 边界内的事件数据
     */
    public List<Map<String, Object>> parseMultipartEvents(String content, String boundary) {
        List<Map<String, Object>> events = new ArrayList<>();

        String[] parts = content.split("--" + boundary);
        for (String part : parts) {
            if (part.trim().isEmpty() || part.equals("--")) {
                continue;
            }

            // 查找 XML 内容
            int xmlStart = part.indexOf("<?xml");
            if (xmlStart == -1) {
                xmlStart = part.indexOf("<EventNotificationAlert");
            }
            if (xmlStart == -1) {
                continue;
            }

            int xmlEnd = part.indexOf("</EventNotificationAlert>");
            if (xmlEnd == -1) {
                continue;
            }

            String xml = part.substring(xmlStart, xmlEnd + "</EventNotificationAlert>".length());
            Map<String, Object> event = parseEventAlert(xml);
            if (!event.isEmpty() && !event.containsKey("error")) {
                events.add(event);
            }
        }

        return events;
    }

    /**
     * 解析检测区域坐标
     */
    private Map<String, Object> parseDetectionRegion(Element regionListEl) {
        Map<String, Object> region = new HashMap<>();
        NodeList regions = regionListEl.getElementsByTagName("DetectionRegionEntry");

        List<Map<String, Object>> entries = new ArrayList<>();
        for (int i = 0; i < regions.getLength(); i++) {
            Element entry = (Element) regions.item(i);
            Map<String, Object> entryMap = new HashMap<>();
            entryMap.put("regionID", getElementText(entry, "regionID"));
            entryMap.put("sensitivityLevel", parseInteger(getElementText(entry, "sensitivityLevel")));

            // 解析坐标点
            Element coordList = getFirstChildElement(entry, "RegionCoordinatesList");
            if (coordList != null) {
                List<Map<String, Integer>> coordinates = new ArrayList<>();
                NodeList coords = coordList.getElementsByTagName("RegionCoordinates");
                for (int j = 0; j < coords.getLength(); j++) {
                    Element coord = (Element) coords.item(j);
                    Map<String, Integer> point = new HashMap<>();
                    point.put("positionX", parseInteger(getElementText(coord, "positionX")));
                    point.put("positionY", parseInteger(getElementText(coord, "positionY")));
                    coordinates.add(point);
                }
                entryMap.put("coordinates", coordinates);
            }

            entries.add(entryMap);
        }
        region.put("entries", entries);

        return region;
    }

    /**
     * 获取元素文本内容
     */
    private String getElementText(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() > 0) {
            Node node = nodes.item(0);
            if (node != null && node.getTextContent() != null) {
                return node.getTextContent().trim();
            }
        }
        return null;
    }

    /**
     * 获取第一个子元素
     */
    private Element getFirstChildElement(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() > 0) {
            return (Element) nodes.item(0);
        }
        return null;
    }

    /**
     * 解析整数
     */
    private Integer parseInteger(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 解析日期时间
     */
    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, ISAPI_DATE_FORMAT);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(value, ISAPI_DATE_FORMAT_SIMPLE);
            } catch (Exception e2) {
                log.debug("无法解析日期: {}", value);
                return null;
            }
        }
    }

    /**
     * 构建设备信息请求 XML
     */
    public static String buildDeviceInfoRequest() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<DeviceInfo xmlns=\"http://www.hikvision.com/ver20/XMLSchema\" version=\"2.0\"/>";
    }

    /**
     * 构建事件订阅请求 XML
     */
    public static String buildSubscribeEventRequest(List<String> eventTypes) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<SubscribeEvent xmlns=\"http://www.hikvision.com/ver20/XMLSchema\" version=\"2.0\">\n");
        sb.append("<eventMode>all</eventMode>\n");

        if (eventTypes != null && !eventTypes.isEmpty()) {
            sb.append("<EventList>\n");
            for (String type : eventTypes) {
                sb.append("<Event>\n");
                sb.append("<type>").append(type).append("</type>\n");
                sb.append("</Event>\n");
            }
            sb.append("</EventList>\n");
        }

        sb.append("</SubscribeEvent>");
        return sb.toString();
    }

    // ==================== 智能分析 XML 解析方法 ====================

    /**
     * 解析智能分析能力
     */
    public SmartCapabilities parseSmartCapabilities(String xml) {
        SmartCapabilities caps = SmartCapabilities.builder()
                .smartSupported(false)
                .lineDetectionSupported(false)
                .fieldDetectionSupported(false)
                .faceDetectionSupported(false)
                .audioDetectionSupported(false)
                .motionDetectionSupported(false)
                .sceneChangeSupported(false)
                .build();

        try {
            Document doc = parse(xml);
            Element root = doc.getDocumentElement();

            // 检查是否支持智能分析
            caps.setSmartSupported(true);

            // 检查具体功能支持
            NodeList supportList = doc.getElementsByTagName("isSupportLineDetection");
            if (supportList.getLength() > 0 && "true".equalsIgnoreCase(supportList.item(0).getTextContent())) {
                caps.setLineDetectionSupported(true);
            }

            supportList = doc.getElementsByTagName("isSupportIntrusion");
            if (supportList.getLength() > 0 && "true".equalsIgnoreCase(supportList.item(0).getTextContent())) {
                caps.setFieldDetectionSupported(true);
            }

            supportList = doc.getElementsByTagName("isSupportFaceDetect");
            if (supportList.getLength() > 0 && "true".equalsIgnoreCase(supportList.item(0).getTextContent())) {
                caps.setFaceDetectionSupported(true);
            }

            supportList = doc.getElementsByTagName("isSupportAudioDetect");
            if (supportList.getLength() > 0 && "true".equalsIgnoreCase(supportList.item(0).getTextContent())) {
                caps.setAudioDetectionSupported(true);
            }

            supportList = doc.getElementsByTagName("isSupportMotionDetect");
            if (supportList.getLength() > 0 && "true".equalsIgnoreCase(supportList.item(0).getTextContent())) {
                caps.setMotionDetectionSupported(true);
            }

            supportList = doc.getElementsByTagName("isSupportSceneChange");
            if (supportList.getLength() > 0 && "true".equalsIgnoreCase(supportList.item(0).getTextContent())) {
                caps.setSceneChangeSupported(true);
            }

            // 解析最大规则数
            String maxLines = getElementText(root, "maxLineItemNum");
            if (maxLines != null) {
                caps.setMaxLineRules(parseInteger(maxLines));
            }

            String maxFields = getElementText(root, "maxFieldItemNum");
            if (maxFields != null) {
                caps.setMaxFieldRules(parseInteger(maxFields));
            }

        } catch (Exception e) {
            log.error("解析智能分析能力失败", e);
        }
        return caps;
    }

    /**
     * 解析越界检测配置
     */
    public SmartAnalysisDTO parseLineDetectionConfig(String xml, int channelId) {
        SmartAnalysisDTO dto = SmartAnalysisDTO.builder()
                .channelId(channelId)
                .enabled(false)
                .detectionType(DetectionType.LINE_DETECTION)
                .rules(new ArrayList<>())
                .build();

        try {
            Document doc = parse(xml);
            Element root = doc.getDocumentElement();

            // 解析启用状态
            String enabled = getElementText(root, "enabled");
            dto.setEnabled("true".equalsIgnoreCase(enabled));

            // 解析规则列表
            NodeList lineItems = doc.getElementsByTagName("LineItem");
            for (int i = 0; i < lineItems.getLength(); i++) {
                Element item = (Element) lineItems.item(i);
                DetectionRule rule = parseLineItem(item);
                if (rule != null) {
                    dto.getRules().add(rule);
                }
            }

        } catch (Exception e) {
            log.error("解析越界检测配置失败", e);
        }
        return dto;
    }

    /**
     * 解析单个越界规则
     */
    private DetectionRule parseLineItem(Element item) {
        try {
            DetectionRule rule = DetectionRule.builder()
                    .id(parseInteger(getElementText(item, "id")))
                    .enabled("true".equalsIgnoreCase(getElementText(item, "enabled")))
                    .sensitivityLevel(parseInteger(getElementText(item, "sensitivityLevel")))
                    .detectionTarget(getElementText(item, "detectionTarget"))
                    .direction(getElementText(item, "direction"))
                    .coordinates(new ArrayList<>())
                    .build();

            // 解析坐标
            NodeList coordsList = item.getElementsByTagName("Coordinates");
            for (int i = 0; i < coordsList.getLength(); i++) {
                Element coord = (Element) coordsList.item(i);
                Coordinate c = Coordinate.builder()
                        .x(parseInteger(getElementText(coord, "positionX")))
                        .y(parseInteger(getElementText(coord, "positionY")))
                        .build();
                rule.getCoordinates().add(c);
            }

            return rule;
        } catch (Exception e) {
            log.error("解析越界规则失败", e);
            return null;
        }
    }

    /**
     * 解析区域入侵配置
     */
    public SmartAnalysisDTO parseFieldDetectionConfig(String xml, int channelId) {
        SmartAnalysisDTO dto = SmartAnalysisDTO.builder()
                .channelId(channelId)
                .enabled(false)
                .detectionType(DetectionType.FIELD_DETECTION)
                .rules(new ArrayList<>())
                .build();

        try {
            Document doc = parse(xml);
            Element root = doc.getDocumentElement();

            String enabled = getElementText(root, "enabled");
            dto.setEnabled("true".equalsIgnoreCase(enabled));

            NodeList fieldItems = doc.getElementsByTagName("FieldDetectionRegion");
            if (fieldItems.getLength() == 0) {
                fieldItems = doc.getElementsByTagName("FieldItem");
            }

            for (int i = 0; i < fieldItems.getLength(); i++) {
                Element item = (Element) fieldItems.item(i);
                DetectionRule rule = parseFieldItem(item);
                if (rule != null) {
                    dto.getRules().add(rule);
                }
            }

        } catch (Exception e) {
            log.error("解析区域入侵配置失败", e);
        }
        return dto;
    }

    /**
     * 解析单个区域入侵规则
     */
    private DetectionRule parseFieldItem(Element item) {
        try {
            DetectionRule rule = DetectionRule.builder()
                    .id(parseInteger(getElementText(item, "id")))
                    .enabled("true".equalsIgnoreCase(getElementText(item, "enabled")))
                    .sensitivityLevel(parseInteger(getElementText(item, "sensitivityLevel")))
                    .detectionTarget(getElementText(item, "detectionTarget"))
                    .timeThreshold(parseInteger(getElementText(item, "timeThreshold")))
                    .coordinates(new ArrayList<>())
                    .build();

            // 解析坐标 (多边形区域)
            NodeList coordsList = item.getElementsByTagName("RegionCoordinates");
            if (coordsList.getLength() == 0) {
                coordsList = item.getElementsByTagName("Coordinates");
            }

            for (int i = 0; i < coordsList.getLength(); i++) {
                Element coord = (Element) coordsList.item(i);
                Coordinate c = Coordinate.builder()
                        .x(parseInteger(getElementText(coord, "positionX")))
                        .y(parseInteger(getElementText(coord, "positionY")))
                        .build();
                rule.getCoordinates().add(c);
            }

            return rule;
        } catch (Exception e) {
            log.error("解析区域入侵规则失败", e);
            return null;
        }
    }

    /**
     * 解析人脸检测配置
     */
    public SmartAnalysisDTO parseFaceDetectionConfig(String xml, int channelId) {
        SmartAnalysisDTO dto = SmartAnalysisDTO.builder()
                .channelId(channelId)
                .enabled(false)
                .detectionType(DetectionType.FACE_DETECTION)
                .rules(new ArrayList<>())
                .build();

        try {
            Document doc = parse(xml);
            Element root = doc.getDocumentElement();

            String enabled = getElementText(root, "enabled");
            dto.setEnabled("true".equalsIgnoreCase(enabled));

            // 人脸检测通常只有一个检测区域
            Integer sensitivity = parseInteger(getElementText(root, "sensitivityLevel"));

            DetectionRule rule = DetectionRule.builder()
                    .id(1)
                    .enabled(dto.getEnabled())
                    .sensitivityLevel(sensitivity != null ? sensitivity : 50)
                    .coordinates(new ArrayList<>())
                    .build();

            // 解析检测区域坐标
            Element regionEl = getFirstChildElement(root, "DetectionRegion");
            if (regionEl != null) {
                NodeList coordsList = regionEl.getElementsByTagName("RegionCoordinates");
                for (int i = 0; i < coordsList.getLength(); i++) {
                    Element coord = (Element) coordsList.item(i);
                    Coordinate c = Coordinate.builder()
                            .x(parseInteger(getElementText(coord, "positionX")))
                            .y(parseInteger(getElementText(coord, "positionY")))
                            .build();
                    rule.getCoordinates().add(c);
                }
            }

            dto.getRules().add(rule);

        } catch (Exception e) {
            log.error("解析人脸检测配置失败", e);
        }
        return dto;
    }

    // ==================== 智能分析 XML 构建方法 ====================

    /**
     * 构建越界检测配置 XML
     */
    public static String buildLineDetectionXml(SmartAnalysisDTO dto) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<LineDetection version=\"2.0\" xmlns=\"http://www.hikvision.com/ver20/XMLSchema\">\n");
        sb.append("  <enabled>").append(dto.getEnabled()).append("</enabled>\n");
        sb.append("  <normalizedScreenSize>\n");
        sb.append("    <normalizedScreenWidth>10000</normalizedScreenWidth>\n");
        sb.append("    <normalizedScreenHeight>10000</normalizedScreenHeight>\n");
        sb.append("  </normalizedScreenSize>\n");

        if (dto.getRules() != null && !dto.getRules().isEmpty()) {
            sb.append("  <LineItemList>\n");
            for (DetectionRule rule : dto.getRules()) {
                sb.append("    <LineItem>\n");
                sb.append("      <id>").append(rule.getId()).append("</id>\n");
                sb.append("      <enabled>").append(rule.getEnabled()).append("</enabled>\n");
                sb.append("      <sensitivityLevel>").append(rule.getSensitivityLevel() != null ? rule.getSensitivityLevel() : 50).append("</sensitivityLevel>\n");
                sb.append("      <detectionTarget>").append(rule.getDetectionTarget() != null ? rule.getDetectionTarget() : "all").append("</detectionTarget>\n");

                if (rule.getCoordinates() != null && !rule.getCoordinates().isEmpty()) {
                    sb.append("      <CoordinatesList>\n");
                    for (Coordinate coord : rule.getCoordinates()) {
                        sb.append("        <Coordinates>\n");
                        sb.append("          <positionX>").append(coord.getX()).append("</positionX>\n");
                        sb.append("          <positionY>").append(coord.getY()).append("</positionY>\n");
                        sb.append("        </Coordinates>\n");
                    }
                    sb.append("      </CoordinatesList>\n");
                }

                sb.append("      <direction>").append(rule.getDirection() != null ? rule.getDirection() : "both").append("</direction>\n");
                sb.append("    </LineItem>\n");
            }
            sb.append("  </LineItemList>\n");
        }

        sb.append("</LineDetection>");
        return sb.toString();
    }

    /**
     * 构建区域入侵检测配置 XML
     */
    public static String buildFieldDetectionXml(SmartAnalysisDTO dto) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<FieldDetection version=\"2.0\" xmlns=\"http://www.hikvision.com/ver20/XMLSchema\">\n");
        sb.append("  <enabled>").append(dto.getEnabled()).append("</enabled>\n");
        sb.append("  <normalizedScreenSize>\n");
        sb.append("    <normalizedScreenWidth>10000</normalizedScreenWidth>\n");
        sb.append("    <normalizedScreenHeight>10000</normalizedScreenHeight>\n");
        sb.append("  </normalizedScreenSize>\n");

        if (dto.getRules() != null && !dto.getRules().isEmpty()) {
            sb.append("  <FieldDetectionRegionList>\n");
            for (DetectionRule rule : dto.getRules()) {
                sb.append("    <FieldDetectionRegion>\n");
                sb.append("      <id>").append(rule.getId()).append("</id>\n");
                sb.append("      <enabled>").append(rule.getEnabled()).append("</enabled>\n");
                sb.append("      <sensitivityLevel>").append(rule.getSensitivityLevel() != null ? rule.getSensitivityLevel() : 50).append("</sensitivityLevel>\n");
                sb.append("      <detectionTarget>").append(rule.getDetectionTarget() != null ? rule.getDetectionTarget() : "all").append("</detectionTarget>\n");

                if (rule.getTimeThreshold() != null) {
                    sb.append("      <timeThreshold>").append(rule.getTimeThreshold()).append("</timeThreshold>\n");
                }

                if (rule.getCoordinates() != null && !rule.getCoordinates().isEmpty()) {
                    sb.append("      <RegionCoordinatesList>\n");
                    for (Coordinate coord : rule.getCoordinates()) {
                        sb.append("        <RegionCoordinates>\n");
                        sb.append("          <positionX>").append(coord.getX()).append("</positionX>\n");
                        sb.append("          <positionY>").append(coord.getY()).append("</positionY>\n");
                        sb.append("        </RegionCoordinates>\n");
                    }
                    sb.append("      </RegionCoordinatesList>\n");
                }

                sb.append("    </FieldDetectionRegion>\n");
            }
            sb.append("  </FieldDetectionRegionList>\n");
        }

        sb.append("</FieldDetection>");
        return sb.toString();
    }

    /**
     * 构建人脸检测配置 XML
     */
    public static String buildFaceDetectionXml(SmartAnalysisDTO dto) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<FaceDetect version=\"2.0\" xmlns=\"http://www.hikvision.com/ver20/XMLSchema\">\n");
        sb.append("  <enabled>").append(dto.getEnabled()).append("</enabled>\n");

        if (dto.getRules() != null && !dto.getRules().isEmpty()) {
            DetectionRule rule = dto.getRules().get(0);
            sb.append("  <sensitivityLevel>").append(rule.getSensitivityLevel() != null ? rule.getSensitivityLevel() : 50).append("</sensitivityLevel>\n");

            if (rule.getCoordinates() != null && !rule.getCoordinates().isEmpty()) {
                sb.append("  <DetectionRegion>\n");
                sb.append("    <RegionCoordinatesList>\n");
                for (Coordinate coord : rule.getCoordinates()) {
                    sb.append("      <RegionCoordinates>\n");
                    sb.append("        <positionX>").append(coord.getX()).append("</positionX>\n");
                    sb.append("        <positionY>").append(coord.getY()).append("</positionY>\n");
                    sb.append("      </RegionCoordinates>\n");
                }
                sb.append("    </RegionCoordinatesList>\n");
                sb.append("  </DetectionRegion>\n");
            }
        }

        sb.append("</FaceDetect>");
        return sb.toString();
    }
}
