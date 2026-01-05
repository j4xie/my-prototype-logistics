package com.cretas.aims.dto.isapi;

import com.cretas.aims.entity.isapi.IsapiEventLog.EventState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * ISAPI 事件 DTO
 *
 * @author Cretas Team
 * @since 2026-01-05
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IsapiEventDTO {

    private Long id;
    private String factoryId;
    private String deviceId;
    private String deviceName;

    // ==================== 事件信息 ====================

    private String eventType;
    private String eventTypeName;
    private EventState eventState;
    private String eventDescription;

    // ==================== 通道信息 ====================

    private Integer channelId;
    private String channelName;

    // ==================== 事件详情 ====================

    private Map<String, Object> eventData;
    private Map<String, Object> detectionRegion;

    // ==================== 图片 ====================

    private String pictureUrl;
    private Boolean hasPicture;

    // ==================== 时间戳 ====================

    private LocalDateTime eventTime;
    private LocalDateTime receivedTime;

    // ==================== 处理状态 ====================

    private Boolean processed;
    private LocalDateTime processedAt;
    private String processedBy;
    private String processResult;

    // ==================== 关联告警 ====================

    private String alertId;

    /**
     * 是否为心跳事件
     */
    private Boolean isHeartbeat;

    /**
     * 事件严重级别
     */
    private String severity;

    // ==================== AI 分析结果 ====================

    /**
     * 是否已进行 AI 分析
     */
    private Boolean aiAnalyzed;

    /**
     * AI 分析时间
     */
    private LocalDateTime aiAnalyzedAt;

    /**
     * AI 判断的威胁等级: HIGH, MEDIUM, LOW, NONE
     */
    private String aiThreatLevel;

    /**
     * AI 检测到的对象列表
     */
    private List<String> aiDetectedObjects;

    /**
     * AI 检测到的对象数量
     */
    private Integer aiObjectCount;

    /**
     * AI 场景描述
     */
    private String aiSceneDescription;

    /**
     * AI 风险评估
     */
    private String aiRiskAssessment;

    /**
     * AI 建议措施列表
     */
    private List<String> aiRecommendedActions;

    /**
     * AI 对生产的影响评估
     */
    private String aiProductionImpact;

    /**
     * AI 是否检测到卫生隐患
     */
    private Boolean aiHygieneConcern;

    /**
     * AI 是否检测到安全隐患
     */
    private Boolean aiSafetyConcern;

    /**
     * AI 是否认为需要立即处理
     */
    private Boolean aiRequiresAction;

    /**
     * 根据事件类型推断严重级别
     */
    public static String inferSeverity(String eventType, EventState state) {
        if (state == EventState.INACTIVE) {
            return "info";
        }

        switch (eventType.toLowerCase()) {
            case "diskfull":
            case "diskerror":
            case "illaccess":
                return "critical";
            case "linedetection":
            case "fielddetection":
            case "facedetection":
                return "high";
            case "vmd":
            case "shelteralarm":
                return "medium";
            case "videoloss":
            case "ipconflict":
            case "netabort":
                return "low";
            default:
                return "medium";
        }
    }
}
