package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 排名项 DTO
 * 用于表示排行榜中的单个条目
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RankingItem {

    /**
     * 排名
     */
    private Integer rank;

    /**
     * 名称
     */
    private String name;

    /**
     * 当前值
     */
    private BigDecimal value;

    /**
     * 目标值
     */
    private BigDecimal target;

    /**
     * 完成率
     */
    private BigDecimal completionRate;

    /**
     * 告警级别: RED, YELLOW, GREEN
     */
    private String alertLevel;
}
