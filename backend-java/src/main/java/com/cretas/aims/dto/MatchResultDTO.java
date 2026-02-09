package com.cretas.aims.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 未来计划匹配结果DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-25
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchResultDTO {

    /**
     * 匹配的生产计划ID
     */
    private String planId;

    /**
     * 生产计划编号
     */
    private String planNumber;

    /**
     * 匹配的原材料批次ID
     */
    private String batchId;

    /**
     * 批次编号
     */
    private String batchNumber;

    /**
     * 分配的数量
     */
    private BigDecimal allocatedQuantity;

    /**
     * 是否完全满足计划需求
     */
    private Boolean isFullyMatched;

    /**
     * 计划剩余需求量（匹配后）
     */
    private BigDecimal remainingQuantity;

    /**
     * 匹配进度百分比
     */
    private Integer matchingProgress;

    /**
     * 产品类型名称
     */
    private String productTypeName;

    /**
     * 原料类型名称
     */
    private String materialTypeName;
}
