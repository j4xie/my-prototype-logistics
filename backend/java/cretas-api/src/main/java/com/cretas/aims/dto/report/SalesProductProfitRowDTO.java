package com.cretas.aims.dto.report;

import com.cretas.aims.security.PriceSensitive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 产品级销售利润详情行 DTO.
 *
 * <p>Sprint 4 Wave 2 S-PROFIT-DETAIL-1: 11-col table per sales-order line item.
 * Price-sensitive fields are stripped to null for non-price roles (warehouse_manager).
 * Frontend additionally hides price columns via canViewPrice v-if defense-in-depth
 * (mirrors May 13 PR #520 35-view pattern).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalesProductProfitRowDTO {

    private String productTypeId;

    private String productName;

    private String unit;

    private BigDecimal quantity;

    @PriceSensitive
    private BigDecimal unitPrice;

    @PriceSensitive
    private BigDecimal costUnitPrice;

    /** 单位毛利 = unitPrice - costUnitPrice. Null when either input stripped. */
    @PriceSensitive
    private BigDecimal grossProfit;

    /** 毛利率 (%) = grossProfit / unitPrice * 100. Null when inputs stripped or unitPrice = 0. */
    @PriceSensitive
    private BigDecimal grossMarginPct;

    /** 折让金额 = lineAmount × discountRate / 100. Null when stripped. */
    @PriceSensitive
    private BigDecimal discountAmount;

    /** 税额 = lineAmount × taxRate / 100. Null when stripped. */
    @PriceSensitive
    private BigDecimal taxAmount;

    /** 净利润 (整行) = (unitPrice − costUnitPrice) × quantity × (1 − discountRate/100) − taxAmount. */
    @PriceSensitive
    private BigDecimal netProfit;

    /** 历史均价 — same productTypeId across factory in lookback window. */
    @PriceSensitive
    private BigDecimal historicalAvgPrice;

    /** 趋势 vs historical avg: "UP" | "DOWN" | "FLAT" | null when stripped. */
    @PriceSensitive
    private String priceTrend;
}
