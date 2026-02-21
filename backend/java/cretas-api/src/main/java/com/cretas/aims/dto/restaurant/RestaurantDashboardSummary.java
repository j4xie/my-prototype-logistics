package com.cretas.aims.dto.restaurant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 餐饮 Dashboard 综合摘要 DTO
 *
 * <p>用于 GET /summary 端点，返回今日核心经营指标快照，
 * 适合 Dashboard 首屏的 KPI 卡片展示。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class RestaurantDashboardSummary {

    /** 今日营业额（元） */
    private BigDecimal todayRevenue;

    /** 今日订单数 */
    private Long todayOrderCount;

    /** 今日客单价（元）；无订单时为 0 */
    private BigDecimal todayAverageOrderValue;

    /** 当前库存预警总数（低库存 + 临期 + 已过期） */
    private Integer stockAlertCount;

    /** 其中：低库存预警数 */
    private Integer lowStockCount;

    /** 其中：临期预警数（3 天内过期） */
    private Integer expiringSoonCount;

    /** 其中：已过期但有剩余库存的批次数 */
    private Integer expiredCount;

    /** 近 30 日损耗率（%），保留 2 位小数 */
    private BigDecimal wastageRate30d;
}
