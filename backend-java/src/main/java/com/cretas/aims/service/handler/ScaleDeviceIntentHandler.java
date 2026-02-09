package com.cretas.aims.service.handler;

import com.cretas.aims.ai.client.DashScopeVisionClient;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.common.UnifiedDeviceType;
import com.cretas.aims.entity.enums.DeviceCategory;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.util.ErrorSanitizer;
import com.cretas.aims.util.ScaleBrandMatcher;
import com.cretas.aims.util.ScaleBrandMatcher.BrandMatchResult;
import com.cretas.aims.util.ScaleBrandMatcher.ProtocolMatchInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 秤设备管理意图处理器
 *
 * 处理设备相关的意图:
 * - SCALE_ADD_DEVICE: 通过自然语言添加设备
 * - SCALE_ADD_DEVICE_VISION: 通过图片识别添加设备
 * - SCALE_DELETE_DEVICE: 删除设备
 * - SCALE_UPDATE_DEVICE: 更新设备
 * - SCALE_LIST_DEVICES: 列出设备
 * - SCALE_DEVICE_DETAIL: 查看设备详情
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Component
public class ScaleDeviceIntentHandler {

    private final EquipmentRepository equipmentRepository;
    private final ScaleBrandMatcher brandMatcher;
    private final DashScopeVisionClient visionClient;
    private final ObjectMapper objectMapper;

    // 位置匹配模式
    private static final Pattern LOCATION_PATTERN = Pattern.compile(
            "(?:在|放在|位于|安装在)\\s*([\\u4e00-\\u9fa5A-Za-z0-9]+(?:车间|仓库|区|区域|工位))");

    // 串口匹配模式
    private static final Pattern COM_PATTERN = Pattern.compile(
            "(COM\\d+|/dev/tty\\w+)", Pattern.CASE_INSENSITIVE);

    // 波特率匹配模式
    private static final Pattern BAUD_PATTERN = Pattern.compile(
            "(\\d{4,6})(?:\\s*波特|\\s*bps)?", Pattern.CASE_INSENSITIVE);

    // 设备编码匹配模式
    private static final Pattern DEVICE_CODE_PATTERN = Pattern.compile(
            "(SCALE[-_]\\d+)", Pattern.CASE_INSENSITIVE);

    public ScaleDeviceIntentHandler(EquipmentRepository equipmentRepository,
                                     ScaleBrandMatcher brandMatcher,
                                     DashScopeVisionClient visionClient,
                                     ObjectMapper objectMapper) {
        this.equipmentRepository = equipmentRepository;
        this.brandMatcher = brandMatcher;
        this.visionClient = visionClient;
        this.objectMapper = objectMapper;
    }

    /**
     * 处理添加秤设备意图 (自然语言描述)
     *
     * 用户可以说: "添加一台柯力D2008电子秤放在包装车间，串口是COM3，波特率9600"
     */
    public IntentExecuteResponse handleAddDevice(String factoryId, IntentExecuteRequest request,
                                                  AIIntentConfig intentConfig, Long userId) {

        String userInput = request.getUserInput();
        Map<String, Object> context = request.getContext();

        // 1. 解析设备信息
        String equipmentName = null;
        String equipmentCode = null;
        String location = null;
        String brandCode = null;
        String brandName = null;
        String modelCode = null;
        String serialPort = null;
        Integer baudRate = null;
        String protocolId = null;

        // 从 context 中获取
        if (context != null) {
            equipmentName = getStringValue(context, "equipmentName");
            equipmentCode = getStringValue(context, "equipmentCode");
            location = getStringValue(context, "location");
            brandCode = getStringValue(context, "brandCode");
            brandName = getStringValue(context, "brandName");
            modelCode = getStringValue(context, "modelCode");
            serialPort = getStringValue(context, "serialPort");
            protocolId = getStringValue(context, "protocolId");
            Object baudRateObj = context.get("baudRate");
            if (baudRateObj instanceof Number) {
                baudRate = ((Number) baudRateObj).intValue();
            }
        }

        // 从用户输入中解析品牌
        if (brandCode == null && brandName == null) {
            BrandMatchResult brandMatch = brandMatcher.matchBrandFromInput(userInput);
            if (brandMatch.isMatched()) {
                brandCode = brandMatch.getBrandCode();
                brandName = brandMatch.getBrandName();
            }
        }

        // 从用户输入中解析型号
        if (modelCode == null) {
            modelCode = brandMatcher.parseModelCode(userInput);
        }

        // 解析位置
        if (location == null) {
            Matcher matcher = LOCATION_PATTERN.matcher(userInput);
            if (matcher.find()) {
                location = matcher.group(1);
            }
        }

        // 解析串口
        if (serialPort == null) {
            Matcher matcher = COM_PATTERN.matcher(userInput);
            if (matcher.find()) {
                serialPort = matcher.group(1).toUpperCase();
            }
        }

        // 解析波特率
        if (baudRate == null) {
            Matcher matcher = BAUD_PATTERN.matcher(userInput);
            if (matcher.find()) {
                int rate = Integer.parseInt(matcher.group(1));
                if (rate == 9600 || rate == 19200 || rate == 38400 || rate == 115200) {
                    baudRate = rate;
                }
            }
        }

        // 2. 验证必需信息
        if (brandCode == null) {
            return buildFailedResponse(intentConfig,
                    "无法识别设备品牌。支持的品牌：柯力、耀华、矽策、英展、梅特勒、托利多等。\n" +
                            "示例：添加一台柯力电子秤放在包装车间");
        }

        // 3. 自动生成设备编码
        if (equipmentCode == null) {
            long count = equipmentRepository.countByFactoryId(factoryId);
            equipmentCode = "SCALE-" + String.format("%04d", count + 1);
        }

        // 4. 自动生成设备名称
        if (equipmentName == null) {
            equipmentName = brandName + (modelCode != null ? " " + modelCode : "") + " 电子秤";
            if (location != null) {
                equipmentName = location + equipmentName;
            }
        }

        // 5. 查找匹配的品牌型号
        String brandModelId = null;
        Optional<ScaleBrandModel> brandModelOpt = brandMatcher.findBrandModel(brandCode, modelCode);
        if (brandModelOpt.isPresent()) {
            brandModelId = brandModelOpt.get().getId();
        }

        // 5.1 智能协议匹配
        ProtocolMatchInfo protocolMatch = null;
        if (protocolId == null) {
            String defaultProtocolId = brandModelOpt.map(ScaleBrandModel::getDefaultProtocolId).orElse(null);
            protocolMatch = brandMatcher.findBestMatchingProtocol(factoryId, brandCode, modelCode, defaultProtocolId);
            if (protocolMatch != null) {
                protocolId = protocolMatch.getProtocolId();
                log.info("智能协议匹配成功: protocolCode={}, matchType={}, verified={}",
                        protocolMatch.getProtocolCode(), protocolMatch.getMatchType(), protocolMatch.isVerified());
            }
        }

        // 6. 创建设备
        FactoryEquipment equipment = new FactoryEquipment();
        equipment.setFactoryId(factoryId);
        equipment.setEquipmentCode(equipmentCode);
        equipment.setCode(equipmentCode);
        equipment.setEquipmentName(equipmentName);
        equipment.setType("scale");
        equipment.setDeviceCategory(DeviceCategory.IOT_SCALE);
        equipment.setLocation(location);
        equipment.setStatus("idle");
        equipment.setManufacturer(brandName != null ? brandName : brandCode);
        equipment.setModel(modelCode);
        equipment.setScaleBrandModelId(brandModelId);
        equipment.setScaleProtocolId(protocolId);
        equipment.setIotDeviceCode("SCALE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        equipment.setCreatedBy(userId != null ? userId : 1L);

        // 设置连接参数
        if (serialPort != null || baudRate != null) {
            Map<String, Object> connectionParams = new LinkedHashMap<>();
            if (serialPort != null) connectionParams.put("port", serialPort);
            if (baudRate != null) connectionParams.put("baudRate", baudRate);
            connectionParams.put("dataBits", 8);
            connectionParams.put("stopBits", 1);
            connectionParams.put("parity", "NONE");
            try {
                equipment.setScaleConnectionParams(objectMapper.writeValueAsString(connectionParams));
            } catch (Exception e) {
                log.warn("序列化连接参数失败: {}", e.getMessage());
            }
        }

        equipment = equipmentRepository.save(equipment);
        log.info("通过自然语言添加秤设备成功: id={}, code={}, name={}",
                equipment.getId(), equipmentCode, equipmentName);

        // 7. 构建响应
        Map<String, Object> resultData = new LinkedHashMap<>();
        resultData.put("deviceId", equipment.getId());
        resultData.put("equipmentCode", equipmentCode);
        resultData.put("equipmentName", equipmentName);
        resultData.put("brand", brandName);
        resultData.put("model", modelCode);
        resultData.put("location", location);
        resultData.put("iotDeviceCode", equipment.getIotDeviceCode());
        if (serialPort != null) resultData.put("serialPort", serialPort);
        if (baudRate != null) resultData.put("baudRate", baudRate);

        // 添加协议匹配信息到结果
        if (protocolMatch != null) {
            resultData.put("protocolId", protocolMatch.getProtocolId());
            resultData.put("protocolCode", protocolMatch.getProtocolCode());
            resultData.put("protocolName", protocolMatch.getProtocolName());
            resultData.put("protocolMatchType", protocolMatch.getMatchType());
            resultData.put("protocolVerified", protocolMatch.isVerified());
        }

        String message = String.format("成功添加设备: %s\n编码: %s", equipmentName, equipmentCode);
        if (location != null) message += "\n位置: " + location;
        if (brandModelOpt.isPresent()) {
            message += "\n已关联品牌型号: " + brandModelOpt.get().getModelName();
        }
        // 添加协议匹配信息到消息
        if (protocolMatch != null) {
            message += String.format("\n已绑定协议: %s (%s%s)",
                    protocolMatch.getProtocolName(),
                    protocolMatch.getMatchTypeDescription(),
                    protocolMatch.isVerified() ? ", 已验证" : "");
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(message)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(resultData)
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("FactoryEquipment")
                                .entityId(String.valueOf(equipment.getId()))
                                .entityName(equipmentName)
                                .action("CREATED")
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_DEVICE")
                                .actionName("查看设备")
                                .description("查看设备详情")
                                .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + equipment.getId())
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("BIND_PROTOCOL")
                                .actionName("绑定协议")
                                .description("为设备绑定通信协议")
                                .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + equipment.getId() + "/bind-protocol")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("TEST_CONNECTION")
                                .actionName("测试连接")
                                .description("测试设备通信连接")
                                .build()
                ))
                .build();
    }

    /**
     * 处理通过图片识别添加秤设备意图
     *
     * 用户上传设备铭牌照片或规格书，AI 自动提取设备信息
     * 使用 Qwen VL 视觉模型进行识别
     */
    public IntentExecuteResponse handleAddDeviceVision(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig, Long userId) {

        Map<String, Object> context = request.getContext();

        // 检查是否有图片数据
        String imageBase64 = null;
        String imageUrl = null;

        if (context != null) {
            imageBase64 = getStringValue(context, "imageBase64");
            imageUrl = getStringValue(context, "imageUrl");
        }

        if (imageBase64 == null && imageUrl == null) {
            return buildFailedResponse(intentConfig,
                    "请提供设备图片。您可以：\n" +
                            "1. 拍摄设备铭牌照片\n" +
                            "2. 上传设备规格书/说明书截图\n\n" +
                            "提供方式：context: {imageBase64: \"BASE64编码的图片\"}");
        }

        log.info("图片识别添加设备: factoryId={}, hasBase64={}, hasUrl={}",
                factoryId, imageBase64 != null, imageUrl != null);

        try {
            // 1. 检查视觉服务是否可用
            if (!visionClient.isAvailable()) {
                return buildFailedResponse(intentConfig,
                        "图片识别服务未配置，请联系管理员检查 DashScope API 配置");
            }

            // 2. 调用 Java 视觉客户端进行图片识别
            String imageToProcess = imageBase64;
            if (imageToProcess == null && imageUrl != null) {
                return buildFailedResponse(intentConfig,
                        "目前仅支持 Base64 编码的图片，请使用 context.imageBase64 传递图片数据");
            }

            log.debug("调用 DashScopeVisionClient 进行设备铭牌识别");
            DashScopeVisionClient.ScaleRecognitionResult visionResult =
                    visionClient.parseScaleImage(imageToProcess, "铭牌");

            if (!visionResult.isSuccess()) {
                log.error("图片识别失败: {}", visionResult.getMessage());
                return buildFailedResponse(intentConfig,
                        "图片识别失败: " + (visionResult.getMessage() != null
                                ? visionResult.getMessage() : "无法解析图片内容"));
            }

            // 3. 提取识别结果
            String brand = visionResult.getBrand();
            String model = visionResult.getModel();
            String maxCapacity = visionResult.getMaxCapacity();
            String precision = visionResult.getPrecision();
            String connectionType = visionResult.getConnectionType();
            String serialNumber = visionResult.getSerialNumber();
            String rawText = visionResult.getRawText();
            Double confidence = visionResult.getConfidence();

            // 检查是否识别到有效信息
            if (brand == null && model == null && maxCapacity == null) {
                return buildFailedResponse(intentConfig,
                        "未能从图片中识别出设备信息。请确保图片清晰，包含设备铭牌或规格信息。\n" +
                                "识别到的原始文字: " + (rawText != null ? rawText : "无"));
            }

            log.info("图片识别结果: brand={}, model={}, maxCapacity={}, confidence={}",
                    brand, model, maxCapacity, confidence);

            // 4. 标准化品牌名称
            BrandMatchResult normalizedBrand = brandMatcher.normalizeBrand(brand);
            String brandCode = normalizedBrand.getBrandCode();
            String brandName = normalizedBrand.getBrandName();

            // 5. 自动生成设备编码
            long count = equipmentRepository.countByFactoryId(factoryId);
            String equipmentCode = "SCALE-" + String.format("%04d", count + 1);

            // 6. 生成设备名称
            String equipmentName = (brandName != null ? brandName : "电子秤") +
                    (model != null ? " " + model : "");

            // 7. 查找匹配的品牌型号
            String brandModelId = null;
            String defaultProtocolId = null;
            if (brandCode != null && model != null) {
                Optional<ScaleBrandModel> brandModelOpt = brandMatcher.findBrandModel(brandCode, model);
                if (brandModelOpt.isPresent()) {
                    brandModelId = brandModelOpt.get().getId();
                    defaultProtocolId = brandModelOpt.get().getDefaultProtocolId();
                }
            }

            // 7.1 智能协议匹配
            ProtocolMatchInfo protocolMatch = null;
            String protocolId = null;
            if (brandCode != null) {
                protocolMatch = brandMatcher.findBestMatchingProtocol(factoryId, brandCode, model, defaultProtocolId);
                if (protocolMatch != null) {
                    protocolId = protocolMatch.getProtocolId();
                    log.info("图片识别 - 智能协议匹配成功: protocolCode={}, matchType={}, verified={}",
                            protocolMatch.getProtocolCode(), protocolMatch.getMatchType(), protocolMatch.isVerified());
                }
            }

            // 8. 创建设备实体
            FactoryEquipment equipment = new FactoryEquipment();
            equipment.setFactoryId(factoryId);
            equipment.setEquipmentCode(equipmentCode);
            equipment.setCode(equipmentCode);
            equipment.setEquipmentName(equipmentName);
            equipment.setType("scale");
            equipment.setDeviceCategory(DeviceCategory.IOT_SCALE);
            equipment.setStatus("idle");
            equipment.setManufacturer(brandName);
            equipment.setModel(model);
            equipment.setSerialNumber(serialNumber);
            equipment.setScaleBrandModelId(brandModelId);
            equipment.setScaleProtocolId(protocolId);
            equipment.setIotDeviceCode("SCALE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            equipment.setCreatedBy(userId != null ? userId : 1L);

            // 设置连接参数
            if (connectionType != null) {
                Map<String, Object> connectionParams = new LinkedHashMap<>();
                connectionParams.put("connectionType", connectionType);
                if (connectionType.contains("232") || connectionType.contains("485")) {
                    connectionParams.put("baudRate", 9600);
                    connectionParams.put("dataBits", 8);
                    connectionParams.put("stopBits", 1);
                    connectionParams.put("parity", "NONE");
                }
                equipment.setScaleConnectionParams(objectMapper.writeValueAsString(connectionParams));
            }

            // 设置规格参数
            if (maxCapacity != null || precision != null) {
                Map<String, Object> specs = new LinkedHashMap<>();
                if (maxCapacity != null) specs.put("maxCapacity", maxCapacity);
                if (precision != null) specs.put("precision", precision);
                equipment.setNotes("规格: " + objectMapper.writeValueAsString(specs));
            }

            equipment = equipmentRepository.save(equipment);
            log.info("通过图片识别添加秤设备成功: id={}, code={}, name={}",
                    equipment.getId(), equipmentCode, equipmentName);

            // 9. 构建响应
            Map<String, Object> resultData = new LinkedHashMap<>();
            resultData.put("deviceId", equipment.getId());
            resultData.put("equipmentCode", equipmentCode);
            resultData.put("equipmentName", equipmentName);
            resultData.put("recognizedInfo", Map.of(
                    "brand", brand != null ? brand : "-",
                    "model", model != null ? model : "-",
                    "maxCapacity", maxCapacity != null ? maxCapacity : "-",
                    "precision", precision != null ? precision : "-",
                    "connectionType", connectionType != null ? connectionType : "-",
                    "serialNumber", serialNumber != null ? serialNumber : "-"
            ));
            resultData.put("recognitionConfidence", confidence);
            resultData.put("rawText", rawText);
            resultData.put("iotDeviceCode", equipment.getIotDeviceCode());

            // 添加协议匹配信息到结果
            if (protocolMatch != null) {
                resultData.put("protocolId", protocolMatch.getProtocolId());
                resultData.put("protocolCode", protocolMatch.getProtocolCode());
                resultData.put("protocolName", protocolMatch.getProtocolName());
                resultData.put("protocolMatchType", protocolMatch.getMatchType());
                resultData.put("protocolVerified", protocolMatch.isVerified());
            }

            StringBuilder message = new StringBuilder();
            message.append("成功通过图片识别添加设备!\n\n");
            message.append("设备名称: ").append(equipmentName).append("\n");
            message.append("设备编码: ").append(equipmentCode).append("\n");
            if (brand != null) message.append("品牌: ").append(brand).append("\n");
            if (model != null) message.append("型号: ").append(model).append("\n");
            if (maxCapacity != null) message.append("量程: ").append(maxCapacity).append("\n");
            if (precision != null) message.append("精度: ").append(precision).append("\n");
            // 添加协议匹配信息到消息
            if (protocolMatch != null) {
                message.append("\n已绑定协议: ").append(protocolMatch.getProtocolName())
                        .append(" (").append(protocolMatch.getMatchTypeDescription())
                        .append(protocolMatch.isVerified() ? ", 已验证" : "").append(")\n");
            }
            if (confidence != null) {
                message.append("\n识别置信度: ").append(String.format("%.0f%%", confidence * 100));
            }

            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SCALE")
                    .sensitivityLevel(intentConfig.getSensitivityLevel())
                    .status("COMPLETED")
                    .message(message.toString())
                    .quotaCost(intentConfig.getQuotaCost())
                    .resultData(resultData)
                    .affectedEntities(List.of(
                            IntentExecuteResponse.AffectedEntity.builder()
                                    .entityType("FactoryEquipment")
                                    .entityId(String.valueOf(equipment.getId()))
                                    .entityName(equipmentName)
                                    .action("CREATED")
                                    .build()
                    ))
                    .executedAt(LocalDateTime.now())
                    .suggestedActions(List.of(
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("VIEW_DEVICE")
                                    .actionName("查看设备")
                                    .description("查看新添加的设备详情")
                                    .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + equipment.getId())
                                    .build(),
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("BIND_PROTOCOL")
                                    .actionName("绑定协议")
                                    .description("为设备配置通信协议")
                                    .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + equipment.getId() + "/bind-protocol")
                                    .build(),
                            IntentExecuteResponse.SuggestedAction.builder()
                                    .actionCode("EDIT_DEVICE")
                                    .actionName("编辑设备")
                                    .description("修改识别结果或补充信息")
                                    .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + equipment.getId() + "/edit")
                                    .build()
                    ))
                    .build();

        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("AI 服务连接失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig,
                    "图片识别服务暂时不可用 (连接超时)。\n" +
                            "请稍后重试或使用文字描述添加设备：\n" +
                            "例如：\"添加一台柯力D2008电子秤放在包装车间\"");

        } catch (Exception e) {
            log.error("图片识别添加设备失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return buildFailedResponse(intentConfig,
                    "图片识别失败: " + ErrorSanitizer.sanitize(e) + "\n" +
                            "请确保图片清晰或使用文字描述添加设备");
        }
    }

    /**
     * 处理列出秤设备意图
     */
    public IntentExecuteResponse handleListDevices(String factoryId, IntentExecuteRequest request,
                                                    AIIntentConfig intentConfig) {

        String userInput = request.getUserInput();
        Map<String, Object> context = request.getContext();

        // 获取筛选条件
        String statusParam = null;
        String keywordParam = null;

        if (context != null) {
            statusParam = getStringValue(context, "status");
            keywordParam = getStringValue(context, "keyword");
        }

        // 从用户输入解析状态筛选
        if (statusParam == null) {
            if (userInput.contains("离线") || userInput.contains("掉线")) {
                statusParam = "offline";
            } else if (userInput.contains("故障") || userInput.contains("错误")) {
                statusParam = "error";
            } else if (userInput.contains("运行") || userInput.contains("工作中")) {
                statusParam = "active";
            } else if (userInput.contains("空闲")) {
                statusParam = "idle";
            }
        }

        // 最终变量供lambda使用
        final String statusFilter = statusParam;
        final String keywordFilter = keywordParam;

        // 查询设备列表
        List<FactoryEquipment> devices = equipmentRepository.findByFactoryId(factoryId);

        // 过滤 IoT 秤设备
        List<FactoryEquipment> scaleDevices = devices.stream()
                .filter(e -> e.getUnifiedDeviceType() == UnifiedDeviceType.SCALE)
                .filter(e -> statusFilter == null || e.getStatus().equalsIgnoreCase(statusFilter))
                .filter(e -> keywordFilter == null ||
                        e.getEquipmentName().toLowerCase().contains(keywordFilter.toLowerCase()) ||
                        e.getEquipmentCode().toLowerCase().contains(keywordFilter.toLowerCase()))
                .collect(Collectors.toList());

        // 构建设备摘要列表
        List<Map<String, Object>> deviceSummaries = scaleDevices.stream()
                .map(device -> {
                    Map<String, Object> summary = new LinkedHashMap<>();
                    summary.put("id", device.getId());
                    summary.put("code", device.getEquipmentCode());
                    summary.put("name", device.getEquipmentName());
                    summary.put("status", device.getStatus());
                    summary.put("location", device.getLocation());
                    summary.put("iotCode", device.getIotDeviceCode());
                    return summary;
                })
                .collect(Collectors.toList());

        // 统计状态分布
        Map<String, Long> statusCount = scaleDevices.stream()
                .collect(Collectors.groupingBy(
                        e -> e.getStatus() != null ? e.getStatus() : "unknown",
                        Collectors.counting()));

        // 格式化消息
        StringBuilder message = new StringBuilder();
        message.append("共有 ").append(scaleDevices.size()).append(" 台 IoT 电子秤设备");
        if (statusFilter != null) {
            message.append(" (筛选: ").append(statusFilter).append(")");
        }
        message.append("\n\n");

        // 按状态分组显示
        for (Map.Entry<String, Long> entry : statusCount.entrySet()) {
            message.append("- ").append(ScaleBrandMatcher.getStatusLabel(entry.getKey()))
                    .append(": ").append(entry.getValue()).append(" 台\n");
        }

        if (!scaleDevices.isEmpty()) {
            message.append("\n最近设备:\n");
            scaleDevices.stream().limit(5).forEach(device -> {
                message.append("  - ").append(device.getEquipmentName())
                        .append(" [").append(device.getEquipmentCode()).append("] ")
                        .append(ScaleBrandMatcher.getStatusLabel(device.getStatus())).append("\n");
            });
            if (scaleDevices.size() > 5) {
                message.append("  ... 还有 ").append(scaleDevices.size() - 5).append(" 台设备\n");
            }
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(message.toString())
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "devices", deviceSummaries,
                        "totalCount", scaleDevices.size(),
                        "statusDistribution", statusCount,
                        "filter", Map.of(
                                "status", statusFilter != null ? statusFilter : "all",
                                "keyword", keywordFilter != null ? keywordFilter : ""
                        )
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("ADD_DEVICE")
                                .actionName("添加设备")
                                .description("添加新的 IoT 电子秤设备")
                                .endpoint("/api/mobile/" + factoryId + "/scale-devices")
                                .build()
                ))
                .build();
    }

    /**
     * 处理查看秤设备详情意图
     */
    public IntentExecuteResponse handleDeviceDetail(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {

        Map<String, Object> context = request.getContext();
        String userInput = request.getUserInput();

        // 获取设备标识
        Long deviceId = null;
        String deviceCode = null;
        String deviceName = null;

        if (context != null) {
            Object idObj = context.get("deviceId");
            if (idObj instanceof Number) {
                deviceId = ((Number) idObj).longValue();
            }
            deviceCode = getStringValue(context, "deviceCode");
            deviceName = getStringValue(context, "deviceName");
        }

        // 从用户输入解析设备编码
        if (deviceCode == null) {
            Matcher matcher = DEVICE_CODE_PATTERN.matcher(userInput);
            if (matcher.find()) {
                deviceCode = matcher.group(1).toUpperCase();
            }
        }

        if (deviceId == null && deviceCode == null && deviceName == null) {
            return buildFailedResponse(intentConfig,
                    "请指定要查看的设备。例如：\n" +
                            "- 查看 SCALE-0001 详情\n" +
                            "- context: {deviceId: 123}");
        }

        // 查找设备
        Optional<FactoryEquipment> deviceOpt = Optional.empty();

        if (deviceId != null) {
            deviceOpt = equipmentRepository.findByIdAndFactoryId(deviceId, factoryId);
        } else if (deviceCode != null) {
            String finalDeviceCode = deviceCode;
            List<FactoryEquipment> devices = equipmentRepository.findByFactoryId(factoryId);
            deviceOpt = devices.stream()
                    .filter(e -> e.getUnifiedDeviceType() == UnifiedDeviceType.SCALE)
                    .filter(e -> e.getEquipmentCode().equalsIgnoreCase(finalDeviceCode))
                    .findFirst();
        }

        if (deviceOpt.isEmpty()) {
            return buildFailedResponse(intentConfig, "未找到指定的设备");
        }

        FactoryEquipment device = deviceOpt.get();

        // 构建详情
        Map<String, Object> deviceDetail = new LinkedHashMap<>();
        deviceDetail.put("id", device.getId());
        deviceDetail.put("code", device.getEquipmentCode());
        deviceDetail.put("name", device.getEquipmentName());
        deviceDetail.put("status", device.getStatus());
        deviceDetail.put("location", device.getLocation());
        deviceDetail.put("manufacturer", device.getManufacturer());
        deviceDetail.put("model", device.getModel());
        deviceDetail.put("serialNumber", device.getSerialNumber());
        deviceDetail.put("iotDeviceCode", device.getIotDeviceCode());
        deviceDetail.put("mqttTopic", device.getMqttTopic());
        deviceDetail.put("brandModelId", device.getScaleBrandModelId());
        deviceDetail.put("protocolId", device.getScaleProtocolId());
        deviceDetail.put("connectionParams", device.getScaleConnectionParams());
        deviceDetail.put("lastReading", device.getLastWeightReading());
        deviceDetail.put("lastReadingTime", device.getLastWeightTime());

        // 格式化消息
        StringBuilder message = new StringBuilder();
        message.append("设备详情: ").append(device.getEquipmentName()).append("\n\n");
        message.append("编码: ").append(device.getEquipmentCode()).append("\n");
        message.append("状态: ").append(ScaleBrandMatcher.getStatusLabel(device.getStatus())).append("\n");
        if (device.getLocation() != null) {
            message.append("位置: ").append(device.getLocation()).append("\n");
        }
        if (device.getManufacturer() != null) {
            message.append("品牌: ").append(device.getManufacturer()).append("\n");
        }
        if (device.getModel() != null) {
            message.append("型号: ").append(device.getModel()).append("\n");
        }
        if (device.getIotDeviceCode() != null) {
            message.append("IoT编码: ").append(device.getIotDeviceCode()).append("\n");
        }
        if (device.getLastWeightReading() != null) {
            message.append("最后读数: ").append(device.getLastWeightReading()).append(" kg\n");
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message(message.toString())
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of("device", deviceDetail))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("UPDATE_DEVICE")
                                .actionName("修改设备")
                                .description("修改设备配置")
                                .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + device.getId())
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("BIND_PROTOCOL")
                                .actionName("绑定协议")
                                .description("为设备绑定通信协议")
                                .endpoint("/api/mobile/" + factoryId + "/scale-devices/" + device.getId() + "/bind-protocol")
                                .build()
                ))
                .build();
    }

    /**
     * 处理更新秤设备意图
     */
    public IntentExecuteResponse handleUpdateDevice(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {

        Map<String, Object> context = request.getContext();
        String userInput = request.getUserInput();

        if (context == null) {
            return buildFailedResponse(intentConfig,
                    "请提供要更新的设备信息。例如：\n" +
                            "context: {\n" +
                            "  deviceId: 123,\n" +
                            "  updates: { location: \"新位置\", status: \"active\" }\n" +
                            "}");
        }

        // 获取设备ID
        Long deviceId = null;
        Object idObj = context.get("deviceId");
        if (idObj instanceof Number) {
            deviceId = ((Number) idObj).longValue();
        }

        if (deviceId == null) {
            return buildFailedResponse(intentConfig, "请提供 deviceId");
        }

        // 查找设备
        Optional<FactoryEquipment> deviceOpt = equipmentRepository.findByIdAndFactoryId(deviceId, factoryId);
        if (deviceOpt.isEmpty()) {
            return buildFailedResponse(intentConfig, "未找到指定的设备");
        }

        FactoryEquipment device = deviceOpt.get();
        if (device.getUnifiedDeviceType() != UnifiedDeviceType.SCALE) {
            return buildFailedResponse(intentConfig, "该设备不是 IoT 电子秤");
        }

        // 获取更新内容
        @SuppressWarnings("unchecked")
        Map<String, Object> updates = (Map<String, Object>) context.get("updates");
        if (updates == null || updates.isEmpty()) {
            return buildFailedResponse(intentConfig, "请提供 updates 字段指定要更新的内容");
        }

        // 应用更新
        List<String> updatedFields = new ArrayList<>();

        if (updates.containsKey("equipmentName")) {
            device.setEquipmentName(updates.get("equipmentName").toString());
            updatedFields.add("设备名称");
        }
        if (updates.containsKey("location")) {
            device.setLocation(updates.get("location").toString());
            updatedFields.add("位置");
        }
        if (updates.containsKey("status")) {
            device.setStatus(updates.get("status").toString());
            updatedFields.add("状态");
        }
        if (updates.containsKey("protocolId")) {
            device.setScaleProtocolId(updates.get("protocolId").toString());
            updatedFields.add("协议");
        }
        if (updates.containsKey("mqttTopic")) {
            device.setMqttTopic(updates.get("mqttTopic").toString());
            updatedFields.add("MQTT Topic");
        }
        if (updates.containsKey("notes")) {
            device.setNotes(updates.get("notes").toString());
            updatedFields.add("备注");
        }

        if (updatedFields.isEmpty()) {
            return buildFailedResponse(intentConfig, "没有识别到有效的更新字段");
        }

        equipmentRepository.save(device);
        log.info("通过意图更新秤设备: id={}, updatedFields={}", deviceId, updatedFields);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("设备更新成功!\n更新字段: " + String.join(", ", updatedFields))
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "deviceId", deviceId,
                        "updatedFields", updatedFields
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("FactoryEquipment")
                                .entityId(String.valueOf(deviceId))
                                .entityName(device.getEquipmentName())
                                .action("UPDATED")
                                .changes(Map.of("updatedFields", updatedFields))
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 处理删除秤设备意图
     */
    public IntentExecuteResponse handleDeleteDevice(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig, Long userId) {

        Map<String, Object> context = request.getContext();

        if (context == null) {
            return buildFailedResponse(intentConfig,
                    "请提供要删除的设备ID。例如：\n" +
                            "context: { deviceId: 123 }");
        }

        // 获取设备ID
        Long deviceId = null;
        Object idObj = context.get("deviceId");
        if (idObj instanceof Number) {
            deviceId = ((Number) idObj).longValue();
        }

        if (deviceId == null) {
            return buildFailedResponse(intentConfig, "请提供 deviceId");
        }

        // 查找设备
        Optional<FactoryEquipment> deviceOpt = equipmentRepository.findByIdAndFactoryId(deviceId, factoryId);
        if (deviceOpt.isEmpty()) {
            return buildFailedResponse(intentConfig, "未找到指定的设备");
        }

        FactoryEquipment device = deviceOpt.get();
        if (device.getUnifiedDeviceType() != UnifiedDeviceType.SCALE) {
            return buildFailedResponse(intentConfig, "该设备不是 IoT 电子秤");
        }

        // 检查是否有使用记录
        if (equipmentRepository.hasUsageRecords(deviceId)) {
            return buildFailedResponse(intentConfig,
                    "设备存在使用记录，无法删除。\n" +
                            "建议将设备状态改为「停用」而不是删除。");
        }

        String deletedName = device.getEquipmentName();
        String deletedCode = device.getEquipmentCode();

        equipmentRepository.delete(device);
        log.info("通过意图删除秤设备: id={}, code={}", deviceId, deletedCode);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("设备已删除: " + deletedName + " [" + deletedCode + "]")
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "deletedDeviceId", deviceId,
                        "deletedDeviceName", deletedName,
                        "deletedDeviceCode", deletedCode
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("FactoryEquipment")
                                .entityId(String.valueOf(deviceId))
                                .entityName(deletedName)
                                .action("DELETED")
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== 辅助方法 ====================

    private String getStringValue(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }

    private IntentExecuteResponse buildFailedResponse(AIIntentConfig intentConfig, String message) {
        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .status("FAILED")
                .message(message)
                .executedAt(LocalDateTime.now())
                .build();
    }
}
