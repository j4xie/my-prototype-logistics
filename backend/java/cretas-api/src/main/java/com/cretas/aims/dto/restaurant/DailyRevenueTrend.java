package com.cretas.aims.dto.restaurant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 每日营业额趋势 DTO
 *
 * <p>用于餐饮专项 BI Dashboard 的营业额折线图分析。
 * 数据来源于销售订单（SalesOrder）的 totalAmount 按 orderDate 汇总。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class DailyRevenueTrend {

    /** 日期 */
    private LocalDate date;

    /** 当日营业额（元） */
    private BigDecimal revenue;

    /** 当日订单数 */
    private Long orderCount;

    /** 客单价（营业额 / 订单数，若无订单则为 0） */
    private BigDecimal averageOrderValue;
}
