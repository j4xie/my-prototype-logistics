package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.scale.ProtocolMatchResult;
import com.cretas.aims.dto.scale.ScaleBrandModelDTO;
import com.cretas.aims.dto.scale.ScaleDataParseResult;
import com.cretas.aims.dto.scale.ScaleProtocolDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.repository.ScaleProtocolConfigRepository;
import com.cretas.aims.service.ScaleProtocolAdapterService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 秤意图处理器
 *
 * 处理 SCALE 分类的意图:
 * - SCALE_ADD_MODEL: 添加秤型号
 * - SCALE_PROTOCOL_DETECT: 协议自动识别
 * - SCALE_CONFIG_GENERATE: AI生成秤配置
 * - SCALE_TROUBLESHOOT: 秤故障排查
 * - SCALE_LIST_PROTOCOLS: 列出可用协议
 * - SCALE_TEST_PARSE: 测试数据解析
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScaleIntentHandler implements IntentHandler {

    private final ScaleProtocolAdapterService scaleProtocolAdapterService;
    private final ScaleBrandModelRepository scaleBrandModelRepository;
    private final ScaleProtocolConfigRepository scaleProtocolConfigRepository;
    private final ObjectMapper objectMapper;

    // 品牌别名映射
    private static final Map<String, String> BRAND_ALIASES = Map.ofEntries(
            Map.entry("柯力", "KELI"),
            Map.entry("耀华", "YAOHUA"),
            Map.entry("矽策", "XICE"),
            Map.entry("英展", "YIZHENG"),
            Map.entry("梅特勒", "METTLER"),
            Map.entry("托利多", "TOLEDO"),
            Map.entry("赛多利斯", "SARTORIUS"),
            Map.entry("奥豪斯", "OHAUS")
    );

    // 16进制数据匹配模式
    private static final Pattern HEX_PATTERN = Pattern.compile("([0-9A-Fa-f]{2}\\s*)+");
    private static final Pattern WEIGHT_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*(kg|g|t|吨|公斤|克)?", Pattern.CASE_INSENSITIVE);

    @Override
    public String getSupportedCategory() {
        return "SCALE";
    }

    @Override
    public IntentExecuteResponse handle(String factoryId, IntentExecuteRequest request,
                                        AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("ScaleIntentHandler.handle: factoryId={}, intentCode={}, userInput={}",
                factoryId, intentConfig.getIntentCode(),
                request.getUserInput().length() > 50 ?
                        request.getUserInput().substring(0, 50) + "..." : request.getUserInput());

        try {
            String intentCode = intentConfig.getIntentCode();

            switch (intentCode) {
                case "SCALE_ADD_MODEL":
                    return handleAddModel(factoryId, request, intentConfig, userId);
                case "SCALE_PROTOCOL_DETECT":
                    return handleProtocolDetect(factoryId, request, intentConfig);
                case "SCALE_CONFIG_GENERATE":
                    return handleConfigGenerate(factoryId, request, intentConfig);
                case "SCALE_TROUBLESHOOT":
                    return handleTroubleshoot(factoryId, request, intentConfig);
                case "SCALE_LIST_PROTOCOLS":
                    return handleListProtocols(factoryId, request, intentConfig);
                case "SCALE_TEST_PARSE":
                    return handleTestParse(factoryId, request, intentConfig);
                default:
                    return buildFailedResponse(intentConfig, "不支持的意图代码: " + intentCode);
            }

        } catch (Exception e) {
            log.error("ScaleIntentHandler执行失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "执行失败: " + e.getMessage());
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("ScaleIntentHandler.preview: factoryId={}, intentCode={}", factoryId, intentConfig.getIntentCode());

        // 对于秤相关操作，预览模式返回将要执行的操作描述
        String intentCode = intentConfig.getIntentCode();
        String previewMessage;

        switch (intentCode) {
            case "SCALE_ADD_MODEL":
                previewMessage = "将添加新的秤型号配置";
                break;
            case "SCALE_PROTOCOL_DETECT":
                previewMessage = "将对提供的数据进行协议自动识别";
                break;
            case "SCALE_CONFIG_GENERATE":
                previewMessage = "将根据描述生成秤协议配置";
                break;
            case "SCALE_TROUBLESHOOT":
                previewMessage = "将分析故障并提供排查建议";
                break;
            case "SCALE_LIST_PROTOCOLS":
                previewMessage = "将列出工厂可用的协议列表";
                break;
            case "SCALE_TEST_PARSE":
                previewMessage = "将测试解析提供的数据";
                break;
            default:
                previewMessage = "未知的操作";
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .status("PREVIEW")
                .message(previewMessage)
                .resultData(Map.of(
                        "userInput", request.getUserInput(),
                        "operation", intentCode
                ))
                .confirmableAction(IntentExecuteResponse.ConfirmableAction.builder()
                        .confirmToken(UUID.randomUUID().toString())
                        .description(previewMessage)
                        .expiresInSeconds(300)
                        .build())
                .executedAt(LocalDateTime.now())
                .build();
    }

    // ==================== 意图处理方法 ====================

    /**
     * 处理添加秤型号意图
     */
    private IntentExecuteResponse handleAddModel(String factoryId, IntentExecuteRequest request,
                                                  AIIntentConfig intentConfig, Long userId) {

        String userInput = request.getUserInput();
        Map<String, Object> context = request.getContext();

        // 1. 解析品牌和型号信息
        String brandCode = null;
        String brandName = null;
        String modelCode = null;
        String modelName = null;

        // 优先从 context 中获取
        if (context != null) {
            brandCode = getStringValue(context, "brandCode");
            brandName = getStringValue(context, "brandName");
            modelCode = getStringValue(context, "modelCode");
            modelName = getStringValue(context, "modelName");
        }

        // 从用户输入中解析品牌
        if (brandCode == null && brandName == null) {
            for (Map.Entry<String, String> entry : BRAND_ALIASES.entrySet()) {
                if (userInput.contains(entry.getKey())) {
                    brandName = entry.getKey();
                    brandCode = entry.getValue();
                    break;
                }
            }
        }

        // 从用户输入中解析型号 (简单的模式匹配)
        if (modelCode == null) {
            Pattern modelPattern = Pattern.compile("([A-Za-z]+\\d+[A-Za-z0-9-]*)");
            Matcher matcher = modelPattern.matcher(userInput);
            if (matcher.find()) {
                modelCode = matcher.group(1);
            }
        }

        if (brandCode == null || modelCode == null) {
            return buildFailedResponse(intentConfig,
                    "无法识别品牌或型号信息。请提供更具体的信息，例如：\n" +
                    "- 添加柯力D2008电子秤\n" +
                    "- 注册耀华XK3190仪表\n" +
                    "或提供 context: {brandCode, brandName, modelCode, modelName}");
        }

        // 2. 检查是否已存在
        Optional<ScaleBrandModel> existing = scaleBrandModelRepository
                .findByBrandCodeAndModelCode(brandCode, modelCode);
        if (existing.isPresent()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SCALE")
                    .status("COMPLETED")
                    .message("该型号已存在: " + brandName + " " + modelCode)
                    .resultData(Map.of(
                            "existingModel", existing.get(),
                            "alreadyExists", true
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 创建新的品牌型号
        ScaleBrandModel newModel = ScaleBrandModel.builder()
                .id(UUID.randomUUID().toString())
                .brandCode(brandCode)
                .brandName(brandName != null ? brandName : brandCode)
                .modelCode(modelCode)
                .modelName(modelName != null ? modelName : brandName + " " + modelCode)
                .scaleType(parseScaleType(userInput))
                .hasSerialPort(true)
                .isVerified(false)
                .isRecommended(false)
                .sortOrder(100)
                .build();

        scaleBrandModelRepository.save(newModel);
        log.info("添加秤型号成功: brandCode={}, modelCode={}", brandCode, modelCode);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("成功添加秤型号: " + newModel.getModelName())
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "modelId", newModel.getId(),
                        "brandCode", brandCode,
                        "modelCode", modelCode,
                        "modelName", newModel.getModelName()
                ))
                .affectedEntities(List.of(
                        IntentExecuteResponse.AffectedEntity.builder()
                                .entityType("ScaleBrandModel")
                                .entityId(newModel.getId())
                                .entityName(newModel.getModelName())
                                .action("CREATED")
                                .build()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("CONFIGURE_PROTOCOL")
                                .actionName("配置协议")
                                .description("为新型号配置通信协议")
                                .endpoint("/api/mobile/" + factoryId + "/scales/brand-models/" + newModel.getId() + "/protocols")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_MODEL")
                                .actionName("查看型号")
                                .description("查看型号详情")
                                .endpoint("/api/mobile/" + factoryId + "/scales/brand-models/" + newModel.getId())
                                .build()
                ))
                .build();
    }

    /**
     * 处理协议自动识别意图
     */
    private IntentExecuteResponse handleProtocolDetect(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {

        String userInput = request.getUserInput();
        Map<String, Object> context = request.getContext();

        // 1. 提取16进制数据
        String hexData = null;

        // 从 context 中获取
        if (context != null) {
            hexData = getStringValue(context, "sampleData");
            if (hexData == null) {
                hexData = getStringValue(context, "hexData");
            }
        }

        // 从用户输入中提取
        if (hexData == null) {
            Matcher matcher = HEX_PATTERN.matcher(userInput);
            if (matcher.find()) {
                hexData = matcher.group().replaceAll("\\s+", "");
            }
        }

        if (hexData == null || hexData.isEmpty()) {
            return buildFailedResponse(intentConfig,
                    "未找到有效的16进制数据。请提供样本数据，例如：\n" +
                    "- 识别协议: 02 30 30 2E 30 30 6B 67 03\n" +
                    "- 或提供 context: {sampleData: \"020030302E30306B6703\"}");
        }

        // 2. 调用协议识别服务
        List<ProtocolMatchResult> matchResults;
        try {
            matchResults = scaleProtocolAdapterService.autoDetectProtocolHex(hexData);
        } catch (Exception e) {
            log.error("协议识别失败: {}", e.getMessage());
            return buildFailedResponse(intentConfig, "协议识别失败: " + e.getMessage());
        }

        if (matchResults == null || matchResults.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SCALE")
                    .status("COMPLETED")
                    .message("未能识别到匹配的协议。数据格式可能是自定义协议，建议手动配置。")
                    .resultData(Map.of(
                            "inputData", hexData,
                            "matchResults", List.of(),
                            "suggestion", "请尝试手动配置协议，或提供更多样本数据"
                    ))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 3. 构建响应
        ProtocolMatchResult bestMatch = matchResults.get(0);

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("识别到 " + matchResults.size() + " 个可能的协议，最佳匹配: " + bestMatch.getProtocolName())
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "inputData", hexData,
                        "bestMatch", bestMatch,
                        "allMatches", matchResults,
                        "confidence", bestMatch.getConfidence()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("USE_PROTOCOL")
                                .actionName("使用此协议")
                                .description("使用识别到的协议: " + bestMatch.getProtocolName())
                                .parameters(Map.of("protocolId", bestMatch.getProtocolId()))
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("TEST_PARSE")
                                .actionName("测试解析")
                                .description("使用此协议测试解析数据")
                                .parameters(Map.of(
                                        "protocolId", bestMatch.getProtocolId(),
                                        "testData", hexData
                                ))
                                .build()
                ))
                .build();
    }

    /**
     * 处理AI生成秤配置意图
     */
    private IntentExecuteResponse handleConfigGenerate(String factoryId, IntentExecuteRequest request,
                                                        AIIntentConfig intentConfig) {

        String userInput = request.getUserInput();
        Map<String, Object> context = request.getContext();

        // 解析用户需求
        boolean hasStartEnd = userInput.contains("起始") || userInput.contains("结束") ||
                              userInput.contains("帧头") || userInput.contains("帧尾") ||
                              userInput.contains("STX") || userInput.contains("ETX");
        boolean isAscii = userInput.contains("ASCII") || userInput.contains("文本") || userInput.contains("字符");
        boolean isBinary = userInput.contains("二进制") || userInput.contains("HEX") || userInput.contains("16进制");

        // 生成配置建议
        Map<String, Object> frameFormat = new LinkedHashMap<>();

        if (hasStartEnd) {
            frameFormat.put("startByte", "0x02");
            frameFormat.put("endByte", "0x03");
        }

        if (isAscii || (!isBinary && !userInput.contains("连续"))) {
            frameFormat.put("encoding", "ASCII");
            frameFormat.put("weightStart", 1);
            frameFormat.put("weightLength", 7);
            frameFormat.put("unitStart", 8);
            frameFormat.put("unitLength", 2);
        } else {
            frameFormat.put("encoding", "BINARY");
            frameFormat.put("weightBytes", List.of(1, 2, 3, 4));
            frameFormat.put("weightMultiplier", 0.01);
        }

        // 检查是否提到稳定标志
        if (userInput.contains("稳定") || userInput.contains("stable")) {
            frameFormat.put("stableByteIndex", 0);
            frameFormat.put("stableBitMask", "0x20");
        }

        // 生成完整配置
        Map<String, Object> generatedConfig = new LinkedHashMap<>();
        generatedConfig.put("protocolName", "自定义协议_" + System.currentTimeMillis());
        generatedConfig.put("protocolCode", "CUSTOM_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        generatedConfig.put("frameFormat", frameFormat);
        generatedConfig.put("baudRate", 9600);
        generatedConfig.put("dataBits", 8);
        generatedConfig.put("stopBits", 1);
        generatedConfig.put("parity", "NONE");

        String configJson;
        try {
            configJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(generatedConfig);
        } catch (Exception e) {
            configJson = generatedConfig.toString();
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("已根据您的描述生成秤协议配置建议")
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "generatedConfig", generatedConfig,
                        "configJson", configJson,
                        "notes", List.of(
                                "这是基于您描述生成的初始配置",
                                "请根据实际设备手册调整参数",
                                "建议使用测试数据验证配置正确性"
                        )
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("SAVE_PROTOCOL")
                                .actionName("保存协议")
                                .description("将此配置保存为新协议")
                                .endpoint("/api/mobile/" + factoryId + "/scales/protocols")
                                .parameters(Map.of("config", generatedConfig))
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("TEST_CONFIG")
                                .actionName("测试配置")
                                .description("使用测试数据验证此配置")
                                .build()
                ))
                .build();
    }

    /**
     * 处理秤故障排查意图
     */
    private IntentExecuteResponse handleTroubleshoot(String factoryId, IntentExecuteRequest request,
                                                      AIIntentConfig intentConfig) {

        String userInput = request.getUserInput().toLowerCase();

        List<Map<String, String>> troubleshootSteps = new ArrayList<>();
        String diagnosis = "";

        // 根据故障现象提供排查建议
        if (userInput.contains("无数据") || userInput.contains("没有数据") || userInput.contains("收不到")) {
            diagnosis = "数据通信异常";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "检查物理连接",
                    "detail", "确认串口线连接牢固，检查接口是否松动或损坏"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "验证串口设置",
                    "detail", "确认波特率、数据位、停止位、校验位设置与秤一致"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "检查秤设置",
                    "detail", "确认秤已开启串口输出功能，检查输出模式是否正确"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "使用串口调试工具",
                    "detail", "使用 SSCOM 等工具直接读取串口数据，排除软件问题"
            ));
        } else if (userInput.contains("乱码") || userInput.contains("数据错误") || userInput.contains("解析失败")) {
            diagnosis = "数据解析异常";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "检查协议配置",
                    "detail", "确认选择的协议与秤实际使用的协议一致"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "验证波特率",
                    "detail", "波特率不匹配是乱码最常见的原因，尝试 9600/19200/38400"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "检查编码格式",
                    "detail", "确认数据是 ASCII 还是二进制格式"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "使用协议识别",
                    "detail", "使用 AI 协议识别功能自动检测正确的协议"
            ));
        } else if (userInput.contains("不稳定") || userInput.contains("跳动") || userInput.contains("波动")) {
            diagnosis = "称重数据不稳定";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "检查秤台",
                    "detail", "确保秤台放置水平，无震动干扰"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "检查传感器",
                    "detail", "检查传感器是否损坏或老化"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "调整滤波参数",
                    "detail", "在秤仪表上调整数字滤波强度"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "软件过滤",
                    "detail", "在应用层增加稳定性判断，只采集稳定标志为真的数据"
            ));
        } else if (userInput.contains("超时") || userInput.contains("断连") || userInput.contains("连接中断")) {
            diagnosis = "连接超时";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "检查供电",
                    "detail", "确认秤和转换器供电稳定"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "检查线缆长度",
                    "detail", "RS232线缆过长会导致信号衰减，建议不超过15米"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "检查转换器",
                    "detail", "如使用 USB-串口转换器，检查驱动和硬件是否正常"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "增加重试机制",
                    "detail", "在软件层面增加自动重连和错误恢复机制"
            ));
        } else {
            diagnosis = "通用故障排查";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "检查硬件连接",
                    "detail", "确认所有物理连接正常"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "验证配置参数",
                    "detail", "检查协议、波特率等配置是否正确"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "查看错误日志",
                    "detail", "检查系统日志获取更详细的错误信息"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "联系技术支持",
                    "detail", "如问题持续，请联系设备厂商或技术支持"
            ));
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("故障诊断: " + diagnosis)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "diagnosis", diagnosis,
                        "troubleshootSteps", troubleshootSteps,
                        "userSymptom", request.getUserInput()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("DETECT_PROTOCOL")
                                .actionName("识别协议")
                                .description("使用 AI 自动识别协议")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_LOGS")
                                .actionName("查看日志")
                                .description("查看设备通信日志")
                                .endpoint("/api/mobile/" + factoryId + "/scales/logs")
                                .build()
                ))
                .build();
    }

    /**
     * 处理列出可用协议意图
     */
    private IntentExecuteResponse handleListProtocols(String factoryId, IntentExecuteRequest request,
                                                       AIIntentConfig intentConfig) {

        // 获取工厂可用的协议列表
        List<ScaleProtocolDTO> protocols = scaleProtocolAdapterService.getAvailableProtocols(factoryId);

        if (protocols == null || protocols.isEmpty()) {
            return IntentExecuteResponse.builder()
                    .intentRecognized(true)
                    .intentCode(intentConfig.getIntentCode())
                    .intentName(intentConfig.getIntentName())
                    .intentCategory("SCALE")
                    .status("COMPLETED")
                    .message("当前没有可用的协议配置")
                    .resultData(Map.of("protocols", List.of()))
                    .executedAt(LocalDateTime.now())
                    .build();
        }

        // 按类型分组
        Map<String, List<ScaleProtocolDTO>> groupedProtocols = protocols.stream()
                .collect(Collectors.groupingBy(p ->
                        p.getIsBuiltin() != null && p.getIsBuiltin() ? "内置协议" : "自定义协议"));

        // 格式化输出
        StringBuilder message = new StringBuilder();
        message.append("共有 ").append(protocols.size()).append(" 个可用协议:\n");

        for (Map.Entry<String, List<ScaleProtocolDTO>> entry : groupedProtocols.entrySet()) {
            message.append("\n【").append(entry.getKey()).append("】\n");
            for (ScaleProtocolDTO protocol : entry.getValue()) {
                message.append("  - ").append(protocol.getProtocolName())
                       .append(" (").append(protocol.getProtocolCode()).append(")\n");
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
                        "protocols", protocols,
                        "totalCount", protocols.size(),
                        "groupedProtocols", groupedProtocols
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("ADD_PROTOCOL")
                                .actionName("添加协议")
                                .description("添加新的自定义协议")
                                .endpoint("/api/mobile/" + factoryId + "/scales/protocols")
                                .build()
                ))
                .build();
    }

    /**
     * 处理测试数据解析意图
     */
    private IntentExecuteResponse handleTestParse(String factoryId, IntentExecuteRequest request,
                                                   AIIntentConfig intentConfig) {

        Map<String, Object> context = request.getContext();
        String userInput = request.getUserInput();

        // 1. 获取协议ID和测试数据
        String protocolId = null;
        String testDataHex = null;

        if (context != null) {
            protocolId = getStringValue(context, "protocolId");
            if (protocolId == null) {
                protocolId = getStringValue(context, "protocolCode");
            }
            testDataHex = getStringValue(context, "testData");
            if (testDataHex == null) {
                testDataHex = getStringValue(context, "hexData");
            }
        }

        // 从用户输入中提取16进制数据
        if (testDataHex == null) {
            Matcher matcher = HEX_PATTERN.matcher(userInput);
            if (matcher.find()) {
                testDataHex = matcher.group().replaceAll("\\s+", "");
            }
        }

        if (testDataHex == null || testDataHex.isEmpty()) {
            return buildFailedResponse(intentConfig,
                    "请提供测试数据。例如：\n" +
                    "- 测试解析: 02 30 30 2E 35 30 6B 67 03\n" +
                    "- 或提供 context: {protocolId: \"xxx\", testData: \"020030302E35306B6703\"}");
        }

        // 2. 如果没有指定协议，先自动识别
        if (protocolId == null) {
            List<ProtocolMatchResult> matches = scaleProtocolAdapterService.autoDetectProtocolHex(testDataHex);
            if (matches != null && !matches.isEmpty()) {
                protocolId = matches.get(0).getProtocolId();
            } else {
                return buildFailedResponse(intentConfig,
                        "未能自动识别协议，请指定协议ID。\n" +
                        "context: {protocolId: \"协议ID\", testData: \"16进制数据\"}");
            }
        }

        // 3. 执行解析
        ScaleDataParseResult parseResult;
        try {
            parseResult = scaleProtocolAdapterService.dryRunParse(protocolId, testDataHex);
        } catch (Exception e) {
            return buildFailedResponse(intentConfig, "解析失败: " + e.getMessage());
        }

        if (parseResult == null) {
            return buildFailedResponse(intentConfig, "解析返回空结果，请检查协议配置");
        }

        // 4. 构建响应
        String resultMessage;
        if (parseResult.isSuccess()) {
            resultMessage = String.format("解析成功! 重量: %.2f %s%s",
                    parseResult.getWeight(),
                    parseResult.getUnit() != null ? parseResult.getUnit() : "kg",
                    parseResult.isStable() ? " (稳定)" : " (不稳定)");
        } else {
            resultMessage = "解析失败: " + (parseResult.getErrorMessage() != null ?
                    parseResult.getErrorMessage() : "未知错误");
        }

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status(parseResult.isSuccess() ? "COMPLETED" : "FAILED")
                .message(resultMessage)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "parseResult", parseResult,
                        "inputData", testDataHex,
                        "protocolId", protocolId
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(parseResult.isSuccess() ? List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("SAVE_TEST_CASE")
                                .actionName("保存为测试用例")
                                .description("将此测试数据保存为协议测试用例")
                                .parameters(Map.of(
                                        "protocolId", protocolId,
                                        "testData", testDataHex,
                                        "expectedWeight", parseResult.getWeight()
                                ))
                                .build()
                ) : List.of())
                .build();
    }

    // ==================== 辅助方法 ====================

    private String getStringValue(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }

    private ScaleBrandModel.ScaleType parseScaleType(String input) {
        if (input.contains("地磅") || input.contains("汽车衡")) {
            return ScaleBrandModel.ScaleType.FLOOR;
        } else if (input.contains("台秤") || input.contains("电子台秤")) {
            return ScaleBrandModel.ScaleType.PLATFORM;
        } else {
            return ScaleBrandModel.ScaleType.DESKTOP;
        }
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
