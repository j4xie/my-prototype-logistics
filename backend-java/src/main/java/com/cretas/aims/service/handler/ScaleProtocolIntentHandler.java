package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.dto.scale.ProtocolMatchResult;
import com.cretas.aims.dto.scale.ScaleDataParseResult;
import com.cretas.aims.dto.scale.ScaleProtocolDTO;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.entity.scale.ScaleBrandModel;
import com.cretas.aims.repository.ScaleBrandModelRepository;
import com.cretas.aims.service.ScaleProtocolAdapterService;
import com.cretas.aims.util.ScaleBrandMatcher;
import com.cretas.aims.util.ScaleBrandMatcher.BrandMatchResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.stream.Collectors;

/**
 * 秤协议管理意图处理器
 *
 * 处理协议相关的意图:
 * - SCALE_ADD_MODEL: 添加秤型号
 * - SCALE_PROTOCOL_DETECT: 协议自动识别
 * - SCALE_LIST_PROTOCOLS: 列出可用协议
 * - SCALE_TEST_PARSE: 测试数据解析
 * - SCALE_CONFIG_GENERATE: AI生成秤配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Component
public class ScaleProtocolIntentHandler {

    private final ScaleProtocolAdapterService scaleProtocolAdapterService;
    private final ScaleBrandModelRepository scaleBrandModelRepository;
    private final ScaleBrandMatcher brandMatcher;
    private final ObjectMapper objectMapper;

    public ScaleProtocolIntentHandler(ScaleProtocolAdapterService scaleProtocolAdapterService,
                                       ScaleBrandModelRepository scaleBrandModelRepository,
                                       ScaleBrandMatcher brandMatcher,
                                       ObjectMapper objectMapper) {
        this.scaleProtocolAdapterService = scaleProtocolAdapterService;
        this.scaleBrandModelRepository = scaleBrandModelRepository;
        this.brandMatcher = brandMatcher;
        this.objectMapper = objectMapper;
    }

    /**
     * 处理添加秤型号意图
     */
    public IntentExecuteResponse handleAddModel(String factoryId, IntentExecuteRequest request,
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
                .scaleType(brandMatcher.parseScaleType(userInput))
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
    public IntentExecuteResponse handleProtocolDetect(String factoryId, IntentExecuteRequest request,
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
            Matcher matcher = ScaleBrandMatcher.HEX_PATTERN.matcher(userInput);
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
     * 处理列出可用协议意图
     */
    public IntentExecuteResponse handleListProtocols(String factoryId, IntentExecuteRequest request,
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
            message.append("\n[").append(entry.getKey()).append("]\n");
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
    public IntentExecuteResponse handleTestParse(String factoryId, IntentExecuteRequest request,
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
            Matcher matcher = ScaleBrandMatcher.HEX_PATTERN.matcher(userInput);
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

    /**
     * 处理AI生成秤配置意图
     */
    public IntentExecuteResponse handleConfigGenerate(String factoryId, IntentExecuteRequest request,
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
