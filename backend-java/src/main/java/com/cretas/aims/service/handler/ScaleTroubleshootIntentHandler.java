package com.cretas.aims.service.handler;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;
import com.cretas.aims.entity.config.AIIntentConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 秤故障排查意图处理器
 *
 * 处理故障排查相关的意图:
 * - SCALE_TROUBLESHOOT: 秤故障排查
 * - SCALE_CALIBRATE: 秤校准指导 (可选)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
@Slf4j
@Component
public class ScaleTroubleshootIntentHandler {

    public ScaleTroubleshootIntentHandler() {
        // 无需外部依赖
    }

    /**
     * 处理秤故障排查意图
     *
     * 根据用户描述的故障现象提供排查建议
     */
    public IntentExecuteResponse handleTroubleshoot(String factoryId, IntentExecuteRequest request,
                                                     AIIntentConfig intentConfig) {

        String userInput = request.getUserInput().toLowerCase();

        List<Map<String, String>> troubleshootSteps = new ArrayList<>();
        String diagnosis;

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
        } else if (userInput.contains("精度") || userInput.contains("不准") || userInput.contains("误差")) {
            diagnosis = "称重精度问题";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "检查校准状态",
                    "detail", "确认秤是否已进行标准砝码校准"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "检查环境因素",
                    "detail", "温度、湿度、气流等环境因素可能影响精度"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "检查秤台水平",
                    "detail", "使用水平仪检查秤台是否水平放置"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "执行角差调整",
                    "detail", "对于台秤，可能需要进行四角误差调整"
            ));
        } else if (userInput.contains("零点") || userInput.contains("漂移") || userInput.contains("归零")) {
            diagnosis = "零点漂移问题";
            troubleshootSteps.add(Map.of(
                    "step", "1",
                    "action", "执行零点校准",
                    "detail", "清空秤台后执行零点校准操作"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "2",
                    "action", "检查预热时间",
                    "detail", "电子秤需要充分预热(通常15-30分钟)才能稳定"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "3",
                    "action", "检查传感器",
                    "detail", "传感器蠕变或老化可能导致零点漂移"
            ));
            troubleshootSteps.add(Map.of(
                    "step", "4",
                    "action", "启用自动零点跟踪",
                    "detail", "部分秤支持自动零点跟踪功能，可在设置中开启"
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
     * 处理秤校准指导意图
     *
     * 提供校准步骤和注意事项
     */
    public IntentExecuteResponse handleCalibrate(String factoryId, IntentExecuteRequest request,
                                                  AIIntentConfig intentConfig) {

        String userInput = request.getUserInput().toLowerCase();

        List<Map<String, String>> calibrationSteps = new ArrayList<>();
        String calibrationType;

        // 根据用户输入判断校准类型
        if (userInput.contains("零点") || userInput.contains("归零")) {
            calibrationType = "零点校准";
            calibrationSteps.add(Map.of(
                    "step", "1",
                    "action", "清空秤台",
                    "detail", "确保秤台上没有任何物品"
            ));
            calibrationSteps.add(Map.of(
                    "step", "2",
                    "action", "等待稳定",
                    "detail", "等待显示值稳定(通常2-5秒)"
            ));
            calibrationSteps.add(Map.of(
                    "step", "3",
                    "action", "执行零点校准",
                    "detail", "按秤上的「置零」或「ZERO」按钮"
            ));
            calibrationSteps.add(Map.of(
                    "step", "4",
                    "action", "验证结果",
                    "detail", "确认显示值为0.00"
            ));
        } else if (userInput.contains("量程") || userInput.contains("满量程") || userInput.contains("砝码")) {
            calibrationType = "量程校准";
            calibrationSteps.add(Map.of(
                    "step", "1",
                    "action", "准备标准砝码",
                    "detail", "准备与秤量程相符的标准砝码(建议使用满量程的2/3-满量程的砝码)"
            ));
            calibrationSteps.add(Map.of(
                    "step", "2",
                    "action", "进入校准模式",
                    "detail", "根据秤型号进入校准模式(通常是长按特定按键组合)"
            ));
            calibrationSteps.add(Map.of(
                    "step", "3",
                    "action", "执行零点校准",
                    "detail", "清空秤台，执行零点校准"
            ));
            calibrationSteps.add(Map.of(
                    "step", "4",
                    "action", "放置砝码",
                    "detail", "将标准砝码放置在秤台中央"
            ));
            calibrationSteps.add(Map.of(
                    "step", "5",
                    "action", "输入砝码重量",
                    "detail", "输入砝码的精确重量值"
            ));
            calibrationSteps.add(Map.of(
                    "step", "6",
                    "action", "确认校准",
                    "detail", "确认校准并保存设置"
            ));
            calibrationSteps.add(Map.of(
                    "step", "7",
                    "action", "验证结果",
                    "detail", "使用不同重量的砝码验证校准精度"
            ));
        } else if (userInput.contains("角差") || userInput.contains("四角")) {
            calibrationType = "角差校准";
            calibrationSteps.add(Map.of(
                    "step", "1",
                    "action", "准备测试砝码",
                    "detail", "准备约1/3量程的标准砝码"
            ));
            calibrationSteps.add(Map.of(
                    "step", "2",
                    "action", "测试四角",
                    "detail", "将砝码分别放置在秤台四个角落，记录读数"
            ));
            calibrationSteps.add(Map.of(
                    "step", "3",
                    "action", "分析误差",
                    "detail", "计算各角与中心读数的差值"
            ));
            calibrationSteps.add(Map.of(
                    "step", "4",
                    "action", "调整传感器",
                    "detail", "根据误差调整对应角的传感器灵敏度"
            ));
            calibrationSteps.add(Map.of(
                    "step", "5",
                    "action", "重新测试",
                    "detail", "重复测试直到四角误差在允许范围内"
            ));
        } else {
            calibrationType = "常规校准";
            calibrationSteps.add(Map.of(
                    "step", "1",
                    "action", "预热",
                    "detail", "开机预热15-30分钟"
            ));
            calibrationSteps.add(Map.of(
                    "step", "2",
                    "action", "零点校准",
                    "detail", "清空秤台，执行零点校准"
            ));
            calibrationSteps.add(Map.of(
                    "step", "3",
                    "action", "量程校准",
                    "detail", "使用标准砝码进行量程校准"
            ));
            calibrationSteps.add(Map.of(
                    "step", "4",
                    "action", "线性校准(可选)",
                    "detail", "使用多个重量点进行线性校准"
            ));
            calibrationSteps.add(Map.of(
                    "step", "5",
                    "action", "验证",
                    "detail", "使用已知重量的物品验证校准结果"
            ));
        }

        // 添加通用注意事项
        List<String> cautions = List.of(
                "校准应在稳定的环境条件下进行(温度、湿度稳定)",
                "确保秤台水平放置",
                "使用经过检定的标准砝码",
                "校准后应保存设置并记录校准日期",
                "建议定期(每月或每季度)进行校准检查"
        );

        return IntentExecuteResponse.builder()
                .intentRecognized(true)
                .intentCode(intentConfig.getIntentCode())
                .intentName(intentConfig.getIntentName())
                .intentCategory("SCALE")
                .sensitivityLevel(intentConfig.getSensitivityLevel())
                .status("COMPLETED")
                .message("校准指导: " + calibrationType)
                .quotaCost(intentConfig.getQuotaCost())
                .resultData(Map.of(
                        "calibrationType", calibrationType,
                        "calibrationSteps", calibrationSteps,
                        "cautions", cautions,
                        "userRequest", request.getUserInput()
                ))
                .executedAt(LocalDateTime.now())
                .suggestedActions(List.of(
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("RECORD_CALIBRATION")
                                .actionName("记录校准")
                                .description("记录此次校准操作")
                                .build(),
                        IntentExecuteResponse.SuggestedAction.builder()
                                .actionCode("VIEW_HISTORY")
                                .actionName("校准历史")
                                .description("查看设备校准历史记录")
                                .endpoint("/api/mobile/" + factoryId + "/scales/calibration-history")
                                .build()
                ))
                .build();
    }

    // ==================== 辅助方法 ====================

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
