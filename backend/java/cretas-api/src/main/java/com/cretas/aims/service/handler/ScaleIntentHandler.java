package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.util.ErrorSanitizer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * 秤意图处理器 - 主路由器
 *
 * 作为 SCALE 分类的主入口，委托给专门的子处理器:
 * - ScaleDeviceIntentHandler: 设备管理 (添加/删除/更新/查询设备)
 * - ScaleProtocolIntentHandler: 协议管理 (型号/协议检测/配置)
 * - ScaleTroubleshootIntentHandler: 故障排查和校准
 *
 * 重构说明:
 * 原 ScaleIntentHandler 有 1975 行，包含 12 个意图处理方法。
 * 重构后拆分为 3 个专门的处理器，每个约 300-500 行，更易于维护。
 *
 * @author Cretas Team
 * @version 2.0.0 (重构版本)
 * @since 2026-01-04
 */
@Slf4j
@Component
public class ScaleIntentHandler implements IntentHandler {

    private final ScaleDeviceIntentHandler deviceHandler;
    private final ScaleProtocolIntentHandler protocolHandler;
    private final ScaleTroubleshootIntentHandler troubleshootHandler;

    public ScaleIntentHandler(ScaleDeviceIntentHandler deviceHandler,
                               ScaleProtocolIntentHandler protocolHandler,
                               ScaleTroubleshootIntentHandler troubleshootHandler) {
        this.deviceHandler = deviceHandler;
        this.protocolHandler = protocolHandler;
        this.troubleshootHandler = troubleshootHandler;
    }

    @Override
    public String getSupportedCategory() {
        return "SCALE";
    }

    @Override
    public boolean supportsSemanticsMode() {
        // 启用语义模式，让框架自动解析语义
        return true;
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

            // 根据意图代码路由到对应的子处理器
            return switch (intentCode) {
                // 设备管理意图 -> ScaleDeviceIntentHandler
                case "SCALE_ADD_DEVICE" ->
                        deviceHandler.handleAddDevice(factoryId, request, intentConfig, userId);
                case "SCALE_ADD_DEVICE_VISION" ->
                        deviceHandler.handleAddDeviceVision(factoryId, request, intentConfig, userId);
                case "SCALE_LIST_DEVICES" ->
                        deviceHandler.handleListDevices(factoryId, request, intentConfig);
                case "SCALE_DEVICE_DETAIL" ->
                        deviceHandler.handleDeviceDetail(factoryId, request, intentConfig);
                case "SCALE_UPDATE_DEVICE" ->
                        deviceHandler.handleUpdateDevice(factoryId, request, intentConfig, userId);
                case "SCALE_DELETE_DEVICE" ->
                        deviceHandler.handleDeleteDevice(factoryId, request, intentConfig, userId);

                // 协议管理意图 -> ScaleProtocolIntentHandler
                case "SCALE_ADD_MODEL" ->
                        protocolHandler.handleAddModel(factoryId, request, intentConfig, userId);
                case "SCALE_PROTOCOL_DETECT" ->
                        protocolHandler.handleProtocolDetect(factoryId, request, intentConfig);
                case "SCALE_LIST_PROTOCOLS" ->
                        protocolHandler.handleListProtocols(factoryId, request, intentConfig);
                case "SCALE_TEST_PARSE" ->
                        protocolHandler.handleTestParse(factoryId, request, intentConfig);
                case "SCALE_CONFIG_GENERATE" ->
                        protocolHandler.handleConfigGenerate(factoryId, request, intentConfig);

                // 故障排查意图 -> ScaleTroubleshootIntentHandler
                case "SCALE_TROUBLESHOOT" ->
                        troubleshootHandler.handleTroubleshoot(factoryId, request, intentConfig);
                case "SCALE_CALIBRATE" ->
                        troubleshootHandler.handleCalibrate(factoryId, request, intentConfig);

                default -> buildFailedResponse(intentConfig, "不支持的意图代码: " + intentCode);
            };

        } catch (Exception e) {
            log.error("ScaleIntentHandler执行失败: factoryId={}, error={}", factoryId, e.getMessage(), e);
            return buildFailedResponse(intentConfig, "执行失败: " + ErrorSanitizer.sanitize(e));
        }
    }

    @Override
    public IntentExecuteResponse preview(String factoryId, IntentExecuteRequest request,
                                         AIIntentConfig intentConfig, Long userId, String userRole) {

        log.info("ScaleIntentHandler.preview: factoryId={}, intentCode={}", factoryId, intentConfig.getIntentCode());

        // 对于秤相关操作，预览模式返回将要执行的操作描述
        String intentCode = intentConfig.getIntentCode();
        String previewMessage = getPreviewMessage(intentCode);

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

    /**
     * 获取预览消息
     */
    private String getPreviewMessage(String intentCode) {
        return switch (intentCode) {
            // 设备管理
            case "SCALE_ADD_DEVICE" -> "将根据描述添加新的电子秤设备";
            case "SCALE_ADD_DEVICE_VISION" -> "将识别图片中的设备信息并添加";
            case "SCALE_LIST_DEVICES" -> "将列出工厂的秤设备列表";
            case "SCALE_DEVICE_DETAIL" -> "将显示指定秤设备的详情";
            case "SCALE_UPDATE_DEVICE" -> "将更新秤设备的配置信息";
            case "SCALE_DELETE_DEVICE" -> "将删除指定的秤设备";

            // 协议管理
            case "SCALE_ADD_MODEL" -> "将添加新的秤型号配置";
            case "SCALE_PROTOCOL_DETECT" -> "将对提供的数据进行协议自动识别";
            case "SCALE_LIST_PROTOCOLS" -> "将列出工厂可用的协议列表";
            case "SCALE_TEST_PARSE" -> "将测试解析提供的数据";
            case "SCALE_CONFIG_GENERATE" -> "将根据描述生成秤协议配置";

            // 故障排查
            case "SCALE_TROUBLESHOOT" -> "将分析故障并提供排查建议";
            case "SCALE_CALIBRATE" -> "将提供秤校准指导";

            default -> "未知的操作";
        };
    }

    /**
     * 构建失败响应
     */
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
