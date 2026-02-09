package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.*;
import java.util.List;

/**
 * 智能分析配置 DTO
 * 用于海康威视摄像头智能分析规则配置
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmartAnalysisDTO {

    /**
     * 通道 ID (1-based)
     */
    @NotNull(message = "通道ID不能为空")
    @Min(value = 1, message = "通道ID必须大于0")
    private Integer channelId;

    /**
     * 是否启用
     */
    private Boolean enabled;

    /**
     * 检测类型
     */
    private DetectionType detectionType;

    /**
     * 检测规则/区域列表
     */
    private List<DetectionRule> rules;

    /**
     * 检测类型枚举
     */
    public enum DetectionType {
        LINE_DETECTION,      // 越界检测 (虚拟警戒线)
        FIELD_DETECTION,     // 区域入侵检测
        FACE_DETECTION       // 人脸检测
    }

    /**
     * 检测规则 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetectionRule {
        /**
         * 规则 ID (1-based)
         */
        private Integer id;

        /**
         * 规则名称
         */
        @Size(max = 64, message = "规则名称不能超过64字符")
        private String name;

        /**
         * 是否启用此规则
         */
        private Boolean enabled;

        /**
         * 灵敏度等级 (1-100)
         */
        @Min(value = 1, message = "灵敏度必须在1-100之间")
        @Max(value = 100, message = "灵敏度必须在1-100之间")
        private Integer sensitivityLevel;

        /**
         * 检测目标类型
         * all - 所有目标
         * human - 仅人
         * vehicle - 仅车辆
         */
        private String detectionTarget;

        /**
         * 区域/线段坐标 (归一化坐标 0-10000)
         */
        private List<Coordinate> coordinates;

        /**
         * 越界方向 (仅用于 LINE_DETECTION)
         * A->B - 从A到B方向
         * B->A - 从B到A方向
         * both - 双向
         */
        private String direction;

        /**
         * 时间阈值 (秒) - 仅用于区域入侵
         * 目标在区域内停留超过此时间触发告警
         */
        private Integer timeThreshold;

        /**
         * 布防时间段
         */
        private List<TimeSchedule> schedules;
    }

    /**
     * 归一化坐标 DTO
     * 坐标值范围: 0-10000
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Coordinate {
        /**
         * X 坐标 (0-10000)
         */
        @Min(value = 0, message = "X坐标必须在0-10000之间")
        @Max(value = 10000, message = "X坐标必须在0-10000之间")
        private Integer x;

        /**
         * Y 坐标 (0-10000)
         */
        @Min(value = 0, message = "Y坐标必须在0-10000之间")
        @Max(value = 10000, message = "Y坐标必须在0-10000之间")
        private Integer y;
    }

    /**
     * 时间段配置 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeSchedule {
        /**
         * 星期几 (0=周日, 1=周一, ..., 6=周六)
         */
        private Integer dayOfWeek;

        /**
         * 开始时间 (HH:mm 格式)
         */
        private String startTime;

        /**
         * 结束时间 (HH:mm 格式)
         */
        private String endTime;
    }

    /**
     * 智能分析能力 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SmartCapabilities {
        /**
         * 设备是否支持智能分析
         */
        private Boolean smartSupported;

        /**
         * 支持的智能分析类型
         */
        private Boolean lineDetectionSupported;
        private Boolean fieldDetectionSupported;
        private Boolean faceDetectionSupported;
        private Boolean audioDetectionSupported;
        private Boolean motionDetectionSupported;
        private Boolean sceneChangeSupported;

        /**
         * 其他能力
         */
        private Integer maxLineRules;       // 最大越界规则数
        private Integer maxFieldRules;      // 最大区域入侵规则数
        private Integer maxFaceRules;       // 最大人脸检测规则数
    }
}
