package com.cretas.aims.dto.scheduling;

import lombok.Data;

/**
 * 排产自动化配置 DTO
 * 用于排产设置页面的配置读取和更新
 */
@Data
public class SchedulingSettingsDTO {

    /**
     * 自动排产模式
     * - FULLY_AUTO: 完全自动化，直接执行排产
     * - MANUAL_CONFIRM: 需人工确认，生成建议后等待确认
     * - DISABLED: 禁用自动排产
     */
    private String autoSchedulingMode;

    /**
     * 低风险阈值
     * 完成概率高于此值视为低风险，可自动排产
     * 默认值: 0.85 (85%)
     */
    private Double lowRiskThreshold;

    /**
     * 中风险阈值
     * 完成概率在此值和低风险阈值之间视为中风险
     * 默认值: 0.70 (70%)
     */
    private Double mediumRiskThreshold;

    /**
     * 是否启用通知
     * 当自动排产触发时是否发送通知
     */
    private Boolean enableNotifications;

    /**
     * 构建默认设置
     */
    public static SchedulingSettingsDTO defaultSettings() {
        SchedulingSettingsDTO settings = new SchedulingSettingsDTO();
        settings.setAutoSchedulingMode("MANUAL_CONFIRM");
        settings.setLowRiskThreshold(0.85);
        settings.setMediumRiskThreshold(0.70);
        settings.setEnableNotifications(true);
        return settings;
    }
}
