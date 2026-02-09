package com.cretas.aims.dto.scale;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 模拟器状态 DTO
 * 表示虚拟秤模拟器的当前运行状态
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulatorStatus {

    /**
     * 模拟器唯一标识
     */
    private String simulatorId;

    /**
     * 模拟器名称
     */
    private String simulatorName;

    /**
     * 使用的协议ID
     */
    private String protocolId;

    /**
     * 协议名称
     */
    private String protocolName;

    /**
     * 运行状态
     */
    private Status status;

    /**
     * 启动时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startTime;

    /**
     * 最后一次发送的重量值
     */
    private BigDecimal lastWeightValue;

    /**
     * 最后一次发送的单位
     */
    private String lastUnit;

    /**
     * 最后一次发送是否为稳定状态
     */
    private Boolean lastStable;

    /**
     * 最后发送时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastSendTime;

    /**
     * 已发送的总帧数
     */
    private Long totalFramesSent;

    /**
     * 配置信息
     */
    private VirtualScaleConfig config;

    /**
     * 错误信息 (仅状态为ERROR时有值)
     */
    private String errorMessage;

    /**
     * 运行状态枚举
     */
    public enum Status {
        /**
         * 运行中
         */
        RUNNING,

        /**
         * 已停止
         */
        STOPPED,

        /**
         * 暂停中
         */
        PAUSED,

        /**
         * 错误状态
         */
        ERROR
    }

    /**
     * 创建运行中状态
     */
    public static SimulatorStatus running(String simulatorId, String simulatorName,
                                          String protocolId, String protocolName,
                                          VirtualScaleConfig config) {
        return SimulatorStatus.builder()
                .simulatorId(simulatorId)
                .simulatorName(simulatorName)
                .protocolId(protocolId)
                .protocolName(protocolName)
                .status(Status.RUNNING)
                .startTime(LocalDateTime.now())
                .totalFramesSent(0L)
                .config(config)
                .build();
    }

    /**
     * 创建错误状态
     */
    public static SimulatorStatus error(String simulatorId, String simulatorName, String errorMessage) {
        return SimulatorStatus.builder()
                .simulatorId(simulatorId)
                .simulatorName(simulatorName)
                .status(Status.ERROR)
                .errorMessage(errorMessage)
                .build();
    }
}
