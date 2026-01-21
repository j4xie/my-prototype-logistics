package com.cretas.aims.dto.sop;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SOP 分析结果 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SopAnalysisResult {

    /**
     * SOP 步骤数
     */
    private Integer stepCount;

    /**
     * 复杂度等级 1-5
     */
    private Integer complexityLevel;

    /**
     * 分析理由
     */
    private String analysisReason;

    /**
     * 最低技能要求
     */
    private Integer minSkillRequired;

    /**
     * 质检点数量
     */
    private Integer qualityCheckCount;

    /**
     * 是否需要特殊设备
     */
    private Boolean specialEquipmentRequired;

    /**
     * 预计完成时间(分钟)
     */
    private Integer estimatedMinutes;

    /**
     * SKU 是否已更新
     */
    private Boolean skuUpdated;

    /**
     * 对排产的影响说明
     */
    private String schedulingImpact;
}
