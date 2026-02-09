package com.cretas.aims.ai.client;

import com.cretas.aims.ai.dto.ChatCompletionRequest;
import com.cretas.aims.ai.dto.ChatCompletionResponse;
import com.cretas.aims.ai.dto.ChatMessage;
import com.cretas.aims.config.DashScopeConfig;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import com.cretas.aims.util.ErrorSanitizer;

/**
 * DashScope 视觉模型客户端
 *
 * 用于设备铭牌识别、产品标签识别等图像分析场景
 * 使用 Qwen VL 系列模型
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DashScopeVisionClient {

    private final DashScopeClient dashScopeClient;
    private final DashScopeConfig config;
    private final ObjectMapper objectMapper;

    // ==================== 品牌别名映射 (从 Python 迁移) ====================
    private static final Map<String, List<String>> BRAND_ALIASES = Map.ofEntries(
            Map.entry("KELI", List.of("柯力", "KELI", "KL", "科力", "Keli")),
            Map.entry("YAOHUA", List.of("耀华", "YAOHUA", "YH", "上海耀华")),
            Map.entry("XICE", List.of("矽策", "XICE", "XC", "矽测")),
            Map.entry("METTLER", List.of("梅特勒", "METTLER", "MT", "Mettler Toledo", "托利多")),
            Map.entry("SARTORIUS", List.of("赛多利斯", "SARTORIUS", "Sartorius")),
            Map.entry("TESTO", List.of("德图", "TESTO", "Testo")),
            Map.entry("OHAUS", List.of("奥豪斯", "OHAUS", "Ohaus")),
            Map.entry("AND", List.of("AND", "A&D", "AD", "艾安得")),
            Map.entry("CAS", List.of("CAS", "cas", "凯士"))
    );

    // ==================== 连接类型映射 ====================
    private static final Map<String, List<String>> CONNECTION_TYPES = Map.ofEntries(
            Map.entry("RS232", List.of("RS232", "RS-232", "COM口", "串口", "232")),
            Map.entry("RS485", List.of("RS485", "RS-485", "485")),
            Map.entry("TCP_IP", List.of("以太网", "Ethernet", "TCP/IP", "RJ45", "网口", "IP")),
            Map.entry("MODBUS_RTU", List.of("Modbus RTU", "MODBUS", "ModbusRTU")),
            Map.entry("MODBUS_TCP", List.of("Modbus TCP", "ModbusTCP")),
            Map.entry("WIFI", List.of("WiFi", "WIFI", "无线", "WLAN")),
            Map.entry("BLUETOOTH", List.of("蓝牙", "Bluetooth", "BT")),
            Map.entry("USB", List.of("USB"))
    );

    /**
     * 解析电子秤设备图片
     *
     * @param imageBase64 Base64 编码的图片
     * @param imageType   图片类型: 铭牌, 规格书, 接口图
     * @return 识别结果
     */
    public ScaleRecognitionResult parseScaleImage(String imageBase64, String imageType) {
        if (!config.isAvailable()) {
            return ScaleRecognitionResult.error("DashScope API 未配置");
        }

        try {
            String prompt = buildRecognitionPrompt(imageType);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(config.getVisionModel())
                    .messages(List.of(ChatMessage.userWithImage(prompt, imageBase64)))
                    .maxTokens(1000)
                    .temperature(0.3)  // 低温度提高准确性
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                return ScaleRecognitionResult.error("API 调用失败: " + response.getErrorMessage());
            }

            String content = response.getContent();
            return parseRecognitionResult(content);

        } catch (Exception e) {
            log.error("设备图片识别失败", e);
            return ScaleRecognitionResult.error("识别失败: " + e.getMessage());
        }
    }

    /**
     * 构建识别提示词
     */
    private String buildRecognitionPrompt(String imageType) {
        return String.format("""
                你是一个工业电子秤设备识别专家。请仔细分析这张%s图片，提取以下设备信息：

                请以 JSON 格式返回识别结果，包含以下字段：
                {
                    "brand": "品牌名称（如柯力、耀华、矽策、梅特勒等）",
                    "model": "型号（如 XK3190-A9、ICS689、PT600A 等）",
                    "max_capacity": "最大量程（如 150kg、30t、500g）",
                    "precision": "精度/分度值（如 0.1g、10g、0.05kg）",
                    "connection_type": "连接类型（RS232/RS485/以太网/WiFi/Modbus等）",
                    "serial_number": "序列号（如有）",
                    "raw_text": "图片中识别到的所有相关文字",
                    "notes": "其他相关信息（如电压、功率等）"
                }

                识别要点：
                1. 优先识别铭牌上的品牌 Logo 或文字
                2. 型号通常在品牌下方，格式如 "Model: XXX" 或直接显示型号
                3. 量程和精度通常标注为 "Max: XXX kg" 和 "d=0.1g" 或 "e=10g"
                4. 注意区分相似品牌（如柯力 KELI 和科力）
                5. 如果无法识别某个字段，返回 null

                仅返回 JSON，不要包含其他文字。
                """, imageType);
    }

    /**
     * 解析识别结果
     */
    private ScaleRecognitionResult parseRecognitionResult(String content) {
        try {
            // 提取 JSON 部分
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(content);

            if (!matcher.find()) {
                return ScaleRecognitionResult.builder()
                        .success(false)
                        .message("无法解析识别结果")
                        .rawText(content)
                        .confidence(0.0)
                        .build();
            }

            JsonNode json = objectMapper.readTree(matcher.group());

            // 提取字段
            String brand = getJsonString(json, "brand");
            String model = getJsonString(json, "model");
            String maxCapacity = getJsonString(json, "max_capacity");
            String precision = getJsonString(json, "precision");
            String connectionType = getJsonString(json, "connection_type");
            String serialNumber = getJsonString(json, "serial_number");
            String rawText = getJsonString(json, "raw_text");
            String notes = getJsonString(json, "notes");

            // 标准化品牌和连接类型
            if (brand != null) {
                brand = normalizeBrand(brand);
            }
            if (connectionType != null) {
                connectionType = normalizeConnectionType(connectionType);
            }

            // 计算置信度
            double confidence = calculateConfidence(brand, model, maxCapacity, precision, connectionType, serialNumber);

            return ScaleRecognitionResult.builder()
                    .success(true)
                    .brand(brand)
                    .model(model)
                    .maxCapacity(maxCapacity)
                    .precision(precision)
                    .connectionType(connectionType)
                    .serialNumber(serialNumber)
                    .rawText(rawText)
                    .notes(notes)
                    .confidence(confidence)
                    .message(String.format("成功识别设备信息，置信度 %.0f%%", confidence * 100))
                    .build();

        } catch (JsonProcessingException e) {
            log.error("JSON 解析失败", e);
            return ScaleRecognitionResult.builder()
                    .success(false)
                    .message("JSON 解析失败: " + ErrorSanitizer.sanitize(e))
                    .rawText(content)
                    .confidence(0.0)
                    .build();
        }
    }

    /**
     * 标准化品牌名称
     */
    private String normalizeBrand(String brand) {
        String brandUpper = brand.toUpperCase();
        for (Map.Entry<String, List<String>> entry : BRAND_ALIASES.entrySet()) {
            for (String alias : entry.getValue()) {
                if (brandUpper.contains(alias.toUpperCase()) || alias.toUpperCase().contains(brandUpper)) {
                    return entry.getKey();
                }
            }
        }
        return brand;
    }

    /**
     * 标准化连接类型
     */
    private String normalizeConnectionType(String connType) {
        String connUpper = connType.toUpperCase();
        for (Map.Entry<String, List<String>> entry : CONNECTION_TYPES.entrySet()) {
            for (String alias : entry.getValue()) {
                if (connUpper.contains(alias.toUpperCase())) {
                    return entry.getKey();
                }
            }
        }
        return connType;
    }

    /**
     * 计算识别置信度
     */
    private double calculateConfidence(String... fields) {
        // 必填字段: brand, model, maxCapacity (权重 0.7)
        int requiredCount = 0;
        if (fields[0] != null) requiredCount++;  // brand
        if (fields[1] != null) requiredCount++;  // model
        if (fields[2] != null) requiredCount++;  // maxCapacity
        double requiredScore = (requiredCount / 3.0) * 0.7;

        // 可选字段: precision, connectionType, serialNumber (权重 0.3)
        int optionalCount = 0;
        if (fields[3] != null) optionalCount++;  // precision
        if (fields[4] != null) optionalCount++;  // connectionType
        if (fields[5] != null) optionalCount++;  // serialNumber
        double optionalScore = (optionalCount / 3.0) * 0.3;

        return requiredScore + optionalScore;
    }

    private String getJsonString(JsonNode json, String field) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull()) {
            return null;
        }
        return node.asText();
    }

    /**
     * 检查视觉服务是否可用
     */
    public boolean isAvailable() {
        return config.isAvailable() && config.getVisionModel() != null;
    }

    /**
     * 通用图片分析方法
     *
     * @param imageUrl 图片URL
     * @param prompt   分析提示词
     * @return 分析结果文本
     */
    public String analyzeImage(String imageUrl, String prompt) {
        if (!config.isAvailable()) {
            throw new RuntimeException("DashScope API 未配置");
        }

        try {
            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(config.getVisionModel())
                    .messages(List.of(ChatMessage.userWithImageUrl(prompt, imageUrl)))
                    .maxTokens(2000)
                    .temperature(0.3)
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                throw new RuntimeException("API 调用失败: " + response.getErrorMessage());
            }

            return response.getContent();

        } catch (Exception e) {
            log.error("图片分析失败", e);
            throw new RuntimeException("图片分析失败: " + e.getMessage(), e);
        }
    }

    // ==================== 摄像头告警图片分析 ====================

    /**
     * 分析摄像头告警图片
     *
     * 支持的告警类型:
     * - linedetection: 越界检测 (虚拟警戒线)
     * - fielddetection: 区域入侵检测
     * - facedetection: 人脸检测
     * - VMD: 移动侦测
     *
     * @param imageBase64 Base64 编码的告警图片
     * @param eventType   告警类型 (linedetection, fielddetection, etc.)
     * @param context     附加上下文 (设备名称、位置等)
     * @return 分析结果
     */
    public CameraAlertAnalysisResult analyzeCameraAlert(String imageBase64, String eventType, Map<String, Object> context) {
        if (!config.isAvailable()) {
            return CameraAlertAnalysisResult.error("DashScope API 未配置");
        }

        try {
            String prompt = buildCameraAlertPrompt(eventType, context);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(config.getVisionModel())
                    .messages(List.of(ChatMessage.userWithImage(prompt, imageBase64)))
                    .maxTokens(1500)
                    .temperature(0.3)
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                return CameraAlertAnalysisResult.error("API 调用失败: " + response.getErrorMessage());
            }

            String content = response.getContent();
            return parseCameraAlertResult(content, eventType);

        } catch (Exception e) {
            log.error("摄像头告警图片分析失败", e);
            return CameraAlertAnalysisResult.error("分析失败: " + e.getMessage());
        }
    }

    /**
     * 构建摄像头告警分析提示词
     */
    private String buildCameraAlertPrompt(String eventType, Map<String, Object> context) {
        String eventDescription = getEventTypeDescription(eventType);
        String deviceName = context != null ? (String) context.getOrDefault("deviceName", "监控设备") : "监控设备";
        String location = context != null ? (String) context.getOrDefault("location", "未知位置") : "未知位置";

        return String.format("""
                你是一个食品生产安全监控分析专家。这是来自 %s（位置: %s）的 %s 告警图片。

                请仔细分析这张告警图片，给出以下信息：

                请以 JSON 格式返回分析结果：
                {
                    "detected": true/false,
                    "threat_level": "HIGH/MEDIUM/LOW/NONE",
                    "detected_objects": ["检测到的对象列表，如人员、车辆、动物等"],
                    "object_count": 检测到的对象数量,
                    "scene_description": "场景描述（50字以内）",
                    "risk_assessment": "风险评估（100字以内）",
                    "recommended_actions": ["建议采取的措施列表"],
                    "production_impact": "对生产的潜在影响评估",
                    "hygiene_concern": true/false,
                    "safety_concern": true/false,
                    "additional_notes": "其他观察（如时间、光照条件等）"
                }

                分析要点：
                1. 关注食品生产安全和卫生相关问题
                2. 识别人员是否穿戴工作服、口罩、手套等防护装备
                3. 检查是否有未授权人员或异常行为
                4. 注意生产区域的清洁和整洁程度
                5. 如果是越界/入侵告警，评估对生产区域的影响

                仅返回 JSON，不要包含其他文字。
                """, deviceName, location, eventDescription);
    }

    /**
     * 获取事件类型描述
     */
    private String getEventTypeDescription(String eventType) {
        if (eventType == null) {
            return "监控告警";
        }
        return switch (eventType.toLowerCase()) {
            case "linedetection" -> "越界检测（有人员或物体越过警戒线）";
            case "fielddetection" -> "区域入侵检测（有人员或物体进入禁止区域）";
            case "facedetection" -> "人脸检测";
            case "vmd" -> "移动侦测";
            case "scenechangedetection" -> "场景变化检测";
            case "shelteralarm" -> "遮挡告警";
            default -> eventType + " 告警";
        };
    }

    /**
     * 解析摄像头告警分析结果
     */
    private CameraAlertAnalysisResult parseCameraAlertResult(String content, String eventType) {
        try {
            // 提取 JSON 部分
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(content);

            if (!matcher.find()) {
                return CameraAlertAnalysisResult.builder()
                        .success(false)
                        .message("无法解析分析结果")
                        .rawResponse(content)
                        .build();
            }

            JsonNode json = objectMapper.readTree(matcher.group());

            // 解析检测对象列表
            List<String> detectedObjects = new ArrayList<>();
            if (json.has("detected_objects") && json.get("detected_objects").isArray()) {
                for (JsonNode node : json.get("detected_objects")) {
                    detectedObjects.add(node.asText());
                }
            }

            // 解析建议措施列表
            List<String> recommendedActions = new ArrayList<>();
            if (json.has("recommended_actions") && json.get("recommended_actions").isArray()) {
                for (JsonNode node : json.get("recommended_actions")) {
                    recommendedActions.add(node.asText());
                }
            }

            return CameraAlertAnalysisResult.builder()
                    .success(true)
                    .eventType(eventType)
                    .detected(getJsonBoolean(json, "detected", true))
                    .threatLevel(getJsonString(json, "threat_level"))
                    .detectedObjects(detectedObjects)
                    .objectCount(getJsonInt(json, "object_count", detectedObjects.size()))
                    .sceneDescription(getJsonString(json, "scene_description"))
                    .riskAssessment(getJsonString(json, "risk_assessment"))
                    .recommendedActions(recommendedActions)
                    .productionImpact(getJsonString(json, "production_impact"))
                    .hygieneConcern(getJsonBoolean(json, "hygiene_concern", false))
                    .safetyConcern(getJsonBoolean(json, "safety_concern", false))
                    .additionalNotes(getJsonString(json, "additional_notes"))
                    .message("分析完成")
                    .build();

        } catch (JsonProcessingException e) {
            log.error("JSON 解析失败", e);
            return CameraAlertAnalysisResult.builder()
                    .success(false)
                    .message("JSON 解析失败: " + ErrorSanitizer.sanitize(e))
                    .rawResponse(content)
                    .build();
        }
    }

    private boolean getJsonBoolean(JsonNode json, String field, boolean defaultValue) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull()) {
            return defaultValue;
        }
        return node.asBoolean(defaultValue);
    }

    private int getJsonInt(JsonNode json, String field, int defaultValue) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull()) {
            return defaultValue;
        }
        return node.asInt(defaultValue);
    }

    // ==================== 工位完成手势识别 ====================

    /**
     * 分析工位完成手势/动作
     *
     * 用于检测工人完成产品处理的动作，如：
     * - 放下产品到传送带
     * - 确认手势（举手、点头等）
     * - 离开工位动作
     *
     * @param imageBase64 Base64 编码的图片
     * @param context     上下文信息（工位ID、工人ID等）
     * @return 识别结果
     */
    public CompletionGestureResult analyzeCompletionGesture(String imageBase64, Map<String, Object> context) {
        if (!config.isAvailable()) {
            return CompletionGestureResult.error("DashScope API 未配置");
        }

        try {
            String prompt = buildCompletionGesturePrompt(context);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(config.getVisionModel())
                    .messages(List.of(ChatMessage.userWithImage(prompt, imageBase64)))
                    .maxTokens(800)
                    .temperature(0.2)  // 低温度提高一致性
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                return CompletionGestureResult.error("API 调用失败: " + response.getErrorMessage());
            }

            return parseCompletionGestureResult(response.getContent());

        } catch (Exception e) {
            log.error("完成手势识别失败", e);
            return CompletionGestureResult.error("识别失败: " + e.getMessage());
        }
    }

    /**
     * 构建完成手势识别提示词
     */
    private String buildCompletionGesturePrompt(Map<String, Object> context) {
        String workstationId = context != null ? (String) context.getOrDefault("workstationId", "未知工位") : "未知工位";
        String productType = context != null ? (String) context.getOrDefault("productType", "产品") : "产品";

        return String.format("""
                你是一个生产线动作识别专家。请分析这张来自工位 %s 的图片，判断工人是否完成了 %s 的处理。

                请以 JSON 格式返回识别结果：
                {
                    "completed": true/false,
                    "confidence": 0.0-1.0,
                    "gesture_type": "放下产品/确认手势/离开工位/正在处理/无法判断",
                    "worker_detected": true/false,
                    "product_detected": true/false,
                    "product_position": "在工位上/在传送带上/被拿着/无法判断",
                    "worker_posture": "站立/弯腰/伸手/其他",
                    "scene_description": "简短描述当前场景（30字以内）",
                    "notes": "其他观察"
                }

                判断要点：
                1. "完成" 的标志通常是：工人将产品放到传送带/下一工位、做出确认手势、或转向下一个产品
                2. "未完成" 的标志：工人仍在操作产品、产品仍在手中
                3. 注意区分"暂时放下"和"处理完成放下"
                4. 如果画面模糊或无法判断，confidence 应该低于 0.5

                仅返回 JSON，不要包含其他文字。
                """, workstationId, productType);
    }

    /**
     * 解析完成手势识别结果
     */
    private CompletionGestureResult parseCompletionGestureResult(String content) {
        try {
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(content);

            if (!matcher.find()) {
                return CompletionGestureResult.builder()
                        .success(false)
                        .message("无法解析识别结果")
                        .rawResponse(content)
                        .build();
            }

            JsonNode json = objectMapper.readTree(matcher.group());

            return CompletionGestureResult.builder()
                    .success(true)
                    .completed(getJsonBoolean(json, "completed", false))
                    .confidence(getJsonDouble(json, "confidence", 0.0))
                    .gestureType(getJsonString(json, "gesture_type"))
                    .workerDetected(getJsonBoolean(json, "worker_detected", false))
                    .productDetected(getJsonBoolean(json, "product_detected", false))
                    .productPosition(getJsonString(json, "product_position"))
                    .workerPosture(getJsonString(json, "worker_posture"))
                    .sceneDescription(getJsonString(json, "scene_description"))
                    .notes(getJsonString(json, "notes"))
                    .message("识别完成")
                    .build();

        } catch (JsonProcessingException e) {
            log.error("JSON 解析失败", e);
            return CompletionGestureResult.builder()
                    .success(false)
                    .message("JSON 解析失败: " + ErrorSanitizer.sanitize(e))
                    .rawResponse(content)
                    .build();
        }
    }

    // ==================== 标签 OCR 识别 ====================

    /**
     * 识别产品标签并验证
     *
     * 功能：
     * - OCR 识别标签上的文字
     * - 验证批次号是否匹配
     * - 检测打印质量
     * - 识别条码/二维码
     *
     * @param imageBase64     Base64 编码的标签图片
     * @param expectedBatchId 期望的批次号（用于验证）
     * @param context         上下文信息
     * @return 识别结果
     */
    public LabelRecognitionResult recognizeLabel(String imageBase64, String expectedBatchId, Map<String, Object> context) {
        if (!config.isAvailable()) {
            return LabelRecognitionResult.error("DashScope API 未配置");
        }

        try {
            String prompt = buildLabelRecognitionPrompt(expectedBatchId, context);

            ChatCompletionRequest request = ChatCompletionRequest.builder()
                    .model(config.getVisionModel())
                    .messages(List.of(ChatMessage.userWithImage(prompt, imageBase64)))
                    .maxTokens(1000)
                    .temperature(0.2)
                    .build();

            ChatCompletionResponse response = dashScopeClient.chatCompletion(request);

            if (response.hasError()) {
                return LabelRecognitionResult.error("API 调用失败: " + response.getErrorMessage());
            }

            return parseLabelRecognitionResult(response.getContent(), expectedBatchId);

        } catch (Exception e) {
            log.error("标签识别失败", e);
            return LabelRecognitionResult.error("识别失败: " + e.getMessage());
        }
    }

    /**
     * 构建标签识别提示词
     */
    private String buildLabelRecognitionPrompt(String expectedBatchId, Map<String, Object> context) {
        String productName = context != null ? (String) context.getOrDefault("productName", "产品") : "产品";

        String batchValidation = "";
        if (expectedBatchId != null && !expectedBatchId.isEmpty()) {
            batchValidation = String.format("""

                    重要：请特别验证批次号是否为 "%s"。
                    """, expectedBatchId);
        }

        return String.format("""
                你是一个食品标签识别和质检专家。请仔细分析这张产品标签图片。

                请以 JSON 格式返回识别结果：
                {
                    "readable": true/false,
                    "print_quality": "GOOD/ACCEPTABLE/POOR/UNREADABLE",
                    "recognized_text": {
                        "batch_number": "识别到的批次号",
                        "product_name": "产品名称",
                        "production_date": "生产日期",
                        "expiry_date": "保质期/有效期",
                        "weight": "重量/净含量",
                        "barcode": "条码号（如有）",
                        "qr_content": "二维码内容（如有）",
                        "other_text": "其他重要文字"
                    },
                    "batch_match": true/false/null,
                    "quality_issues": ["问题列表，如模糊、污损、错位等"],
                    "overall_score": 0-100,
                    "recommendation": "PASS/REVIEW/REJECT",
                    "notes": "其他观察"
                }

                质量评估标准：
                - GOOD (90-100分): 清晰可读，无明显问题
                - ACCEPTABLE (70-89分): 基本可读，有轻微问题
                - POOR (40-69分): 难以辨认，有明显问题
                - UNREADABLE (<40分): 无法识别
                %s
                识别要点：
                1. 仔细识别所有文字，特别是批次号
                2. 检查打印是否清晰、对齐
                3. 检查是否有污损、褪色、模糊
                4. 如果有条码/二维码，尝试识别

                仅返回 JSON，不要包含其他文字。
                """, batchValidation);
    }

    /**
     * 解析标签识别结果
     */
    private LabelRecognitionResult parseLabelRecognitionResult(String content, String expectedBatchId) {
        try {
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(content);

            if (!matcher.find()) {
                return LabelRecognitionResult.builder()
                        .success(false)
                        .message("无法解析识别结果")
                        .rawResponse(content)
                        .build();
            }

            JsonNode json = objectMapper.readTree(matcher.group());

            // 解析 recognized_text
            JsonNode textNode = json.get("recognized_text");
            String recognizedBatch = textNode != null ? getJsonString(textNode, "batch_number") : null;
            String productName = textNode != null ? getJsonString(textNode, "product_name") : null;
            String productionDate = textNode != null ? getJsonString(textNode, "production_date") : null;
            String expiryDate = textNode != null ? getJsonString(textNode, "expiry_date") : null;
            String weight = textNode != null ? getJsonString(textNode, "weight") : null;
            String barcode = textNode != null ? getJsonString(textNode, "barcode") : null;
            String qrContent = textNode != null ? getJsonString(textNode, "qr_content") : null;
            String otherText = textNode != null ? getJsonString(textNode, "other_text") : null;

            // 解析 quality_issues
            List<String> qualityIssues = new ArrayList<>();
            if (json.has("quality_issues") && json.get("quality_issues").isArray()) {
                for (JsonNode node : json.get("quality_issues")) {
                    qualityIssues.add(node.asText());
                }
            }

            // 计算批次匹配
            Boolean batchMatch = null;
            if (expectedBatchId != null && recognizedBatch != null) {
                batchMatch = expectedBatchId.equalsIgnoreCase(recognizedBatch.trim());
            }

            return LabelRecognitionResult.builder()
                    .success(true)
                    .readable(getJsonBoolean(json, "readable", false))
                    .printQuality(getJsonString(json, "print_quality"))
                    .recognizedBatchNumber(recognizedBatch)
                    .expectedBatchNumber(expectedBatchId)
                    .batchMatch(batchMatch)
                    .productName(productName)
                    .productionDate(productionDate)
                    .expiryDate(expiryDate)
                    .weight(weight)
                    .barcode(barcode)
                    .qrContent(qrContent)
                    .otherText(otherText)
                    .qualityIssues(qualityIssues)
                    .overallScore(getJsonInt(json, "overall_score", 0))
                    .recommendation(getJsonString(json, "recommendation"))
                    .notes(getJsonString(json, "notes"))
                    .message("识别完成")
                    .build();

        } catch (JsonProcessingException e) {
            log.error("JSON 解析失败", e);
            return LabelRecognitionResult.builder()
                    .success(false)
                    .message("JSON 解析失败: " + ErrorSanitizer.sanitize(e))
                    .rawResponse(content)
                    .build();
        }
    }

    private double getJsonDouble(JsonNode json, String field, double defaultValue) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull()) {
            return defaultValue;
        }
        return node.asDouble(defaultValue);
    }

    // ==================== 识别结果 DTO ====================

    /**
     * 完成手势识别结果
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class CompletionGestureResult {
        private boolean success;
        private boolean completed;           // 是否完成
        private double confidence;           // 置信度 0-1
        private String gestureType;          // 手势类型
        private boolean workerDetected;      // 是否检测到工人
        private boolean productDetected;     // 是否检测到产品
        private String productPosition;      // 产品位置
        private String workerPosture;        // 工人姿态
        private String sceneDescription;     // 场景描述
        private String notes;                // 备注
        private String message;              // 消息
        private String rawResponse;          // 原始响应

        public static CompletionGestureResult error(String message) {
            return CompletionGestureResult.builder()
                    .success(false)
                    .completed(false)
                    .confidence(0.0)
                    .message(message)
                    .build();
        }

        /**
         * 是否可以确认完成（置信度 > 0.7 且 completed = true）
         */
        public boolean canConfirmCompletion() {
            return success && completed && confidence > 0.7;
        }
    }

    /**
     * 标签识别结果
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class LabelRecognitionResult {
        private boolean success;
        private boolean readable;                // 是否可读
        private String printQuality;             // 打印质量 GOOD/ACCEPTABLE/POOR/UNREADABLE
        private String recognizedBatchNumber;    // 识别到的批次号
        private String expectedBatchNumber;      // 期望的批次号
        private Boolean batchMatch;              // 批次是否匹配
        private String productName;              // 产品名称
        private String productionDate;           // 生产日期
        private String expiryDate;               // 保质期
        private String weight;                   // 重量
        private String barcode;                  // 条码
        private String qrContent;                // 二维码内容
        private String otherText;                // 其他文字
        private List<String> qualityIssues;      // 质量问题列表
        private int overallScore;                // 总体评分 0-100
        private String recommendation;           // 建议 PASS/REVIEW/REJECT
        private String notes;                    // 备注
        private String message;                  // 消息
        private String rawResponse;              // 原始响应

        public static LabelRecognitionResult error(String message) {
            return LabelRecognitionResult.builder()
                    .success(false)
                    .readable(false)
                    .message(message)
                    .build();
        }

        /**
         * 是否需要告警（批次不匹配或质量差）
         */
        public boolean requiresAlert() {
            if (!success) return false;
            if (Boolean.FALSE.equals(batchMatch)) return true;
            if ("REJECT".equalsIgnoreCase(recommendation)) return true;
            if ("POOR".equalsIgnoreCase(printQuality) || "UNREADABLE".equalsIgnoreCase(printQuality)) return true;
            return false;
        }

        /**
         * 是否可以通过（批次匹配且质量可接受）
         */
        public boolean canPass() {
            if (!success || !readable) return false;
            if (Boolean.FALSE.equals(batchMatch)) return false;
            if ("REJECT".equalsIgnoreCase(recommendation)) return false;
            return "GOOD".equalsIgnoreCase(printQuality) || "ACCEPTABLE".equalsIgnoreCase(printQuality);
        }
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ScaleRecognitionResult {
        private boolean success;
        private String brand;
        private String model;
        private String maxCapacity;
        private String precision;
        private String connectionType;
        private String serialNumber;
        private String rawText;
        private String notes;
        private double confidence;
        private String message;

        public static ScaleRecognitionResult error(String message) {
            return ScaleRecognitionResult.builder()
                    .success(false)
                    .message(message)
                    .confidence(0.0)
                    .build();
        }
    }

    /**
     * 摄像头告警分析结果
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class CameraAlertAnalysisResult {
        private boolean success;
        private String eventType;
        private boolean detected;
        private String threatLevel;          // HIGH, MEDIUM, LOW, NONE
        private List<String> detectedObjects;
        private int objectCount;
        private String sceneDescription;
        private String riskAssessment;
        private List<String> recommendedActions;
        private String productionImpact;
        private boolean hygieneConcern;
        private boolean safetyConcern;
        private String additionalNotes;
        private String message;
        private String rawResponse;

        public static CameraAlertAnalysisResult error(String message) {
            return CameraAlertAnalysisResult.builder()
                    .success(false)
                    .message(message)
                    .detected(false)
                    .build();
        }

        /**
         * 是否需要立即处理
         */
        public boolean requiresImmediateAction() {
            return "HIGH".equalsIgnoreCase(threatLevel) || safetyConcern || hygieneConcern;
        }

        /**
         * 获取威胁等级数值 (用于排序)
         */
        public int getThreatLevelValue() {
            if (threatLevel == null) return 0;
            return switch (threatLevel.toUpperCase()) {
                case "HIGH" -> 3;
                case "MEDIUM" -> 2;
                case "LOW" -> 1;
                default -> 0;
            };
        }
    }
}
