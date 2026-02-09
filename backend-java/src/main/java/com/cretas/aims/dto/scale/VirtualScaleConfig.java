package com.cretas.aims.dto.scale;

import lombok.*;

import javax.validation.constraints.*;
import java.math.BigDecimal;

/**
 * 虚拟秤配置 DTO
 * 用于配置虚拟秤模拟器的行为参数
 *
 * @author Cretas Team
 * @since 2026-01-04
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VirtualScaleConfig {

    /**
     * 模拟器名称
     */
    @NotBlank(message = "模拟器名称不能为空")
    @Size(max = 100, message = "模拟器名称不能超过100个字符")
    private String simulatorName;

    /**
     * 使用的协议ID
     */
    @NotBlank(message = "协议ID不能为空")
    private String protocolId;

    /**
     * 默认单位 (kg, g, lb, oz)
     */
    @Builder.Default
    private String defaultUnit = "kg";

    /**
     * 最小重量
     */
    @DecimalMin(value = "0.0", message = "最小重量不能为负数")
    @Builder.Default
    private BigDecimal minWeight = BigDecimal.ZERO;

    /**
     * 最大重量
     */
    @DecimalMax(value = "100000.0", message = "最大重量不能超过100000")
    @Builder.Default
    private BigDecimal maxWeight = new BigDecimal("10000");

    /**
     * 波动百分比 (默认5%)
     * 模拟称重过程中的波动幅度
     */
    @DecimalMin(value = "0.0", message = "波动百分比不能为负数")
    @DecimalMax(value = "50.0", message = "波动百分比不能超过50%")
    @Builder.Default
    private BigDecimal fluctuationPercent = new BigDecimal("5.0");

    /**
     * 稳定步数 (默认5步)
     * 从波动到稳定需要的数据帧数量
     */
    @Min(value = 1, message = "稳定步数最少为1")
    @Max(value = 20, message = "稳定步数最多为20")
    @Builder.Default
    private Integer stabilizationSteps = 5;

    /**
     * 每步间隔毫秒 (默认200ms)
     */
    @Min(value = 50, message = "步间隔最少50ms")
    @Max(value = 2000, message = "步间隔最多2000ms")
    @Builder.Default
    private Integer stepIntervalMs = 200;

    /**
     * 小数位数 (默认2位)
     */
    @Min(value = 0, message = "小数位数不能为负")
    @Max(value = 4, message = "小数位数最多4位")
    @Builder.Default
    private Integer decimalPlaces = 2;

    /**
     * 是否自动发送数据
     * true: 模拟器启动后自动按间隔发送数据
     * false: 只在调用sendWeight时发送
     */
    @Builder.Default
    private Boolean autoSend = false;

    /**
     * 自动发送间隔毫秒 (仅autoSend=true时有效)
     */
    @Min(value = 100, message = "自动发送间隔最少100ms")
    @Max(value = 5000, message = "自动发送间隔最多5000ms")
    @Builder.Default
    private Integer autoSendIntervalMs = 500;
}
