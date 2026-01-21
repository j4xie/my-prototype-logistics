package com.cretas.aims.dto.sop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * SOP 分析结果 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SopAnalysisResult {

    /**
     * 分析是否成功
     */
    private Boolean success;

    /**
     * 文件URL
     */
    private String fileUrl;

    /**
     * SKU 编码
     */
    private String skuCode;

    /**
     * SOP 步骤数
     */
    private Integer stepCount;

    /**
     * 复杂度等级 1-5（旧字段，保持兼容）
     */
    private Integer complexityLevel;

    /**
     * 复杂度评分 (1-10)
     */
    private BigDecimal complexityScore;

    /**
     * 分析理由/摘要
     */
    private String analysisReason;

    /**
     * 分析摘要
     */
    private String summary;

    /**
     * 最低技能要求
     */
    private Integer minSkillRequired;

    /**
     * 技能要求列表
     */
    private List<String> skillRequirements;

    /**
     * 质检点数量
     */
    private Integer qualityCheckCount;

    /**
     * 质检项列表
     */
    private List<String> qualityCheckItems;

    /**
     * 是否需要特殊设备
     */
    private Boolean specialEquipmentRequired;

    /**
     * 设备要求列表
     */
    private List<String> equipmentRequirements;

    /**
     * 预计完成时间(分钟)
     */
    private Integer estimatedMinutes;

    /**
     * 预估工时（分钟）
     */
    private Integer estimatedWorkMinutes;

    /**
     * 加工步骤
     */
    private List<Map<String, Object>> processingSteps;

    /**
     * 原材料信息
     */
    private List<Map<String, Object>> materials;

    /**
     * SKU 是否已更新
     */
    private Boolean skuUpdated;

    /**
     * 对排产的影响说明
     */
    private String schedulingImpact;

    /**
     * 错误消息（如果失败）
     */
    private String errorMessage;

    /**
     * 分析时间
     */
    private LocalDateTime analyzedAt;

    /**
     * 原始分析数据
     */
    private Map<String, Object> rawData;
}
