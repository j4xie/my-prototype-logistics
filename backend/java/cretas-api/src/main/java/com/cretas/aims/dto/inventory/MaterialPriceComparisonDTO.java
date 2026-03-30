package com.cretas.aims.dto.inventory;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 原料三价对比 DTO
 * 用于采购订单中对比：BOM标准单价、移动平均价、当前采购单价
 *
 * @author Cretas Team
 * @since 2026-03-26
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaterialPriceComparisonDTO {

    /** 原料类型ID */
    private String materialTypeId;

    /** 原料名称 */
    private String materialName;

    /** 原料编码 */
    private String materialCode;

    /** 计量单位 */
    private String unit;

    // ==================== 三价 ====================

    /**
     * BOM标准单价 (来自 bom_items.unit_price)
     * 如果该原料出现在多个产品BOM中，取平均值
     * null 表示该原料未配置BOM
     */
    private BigDecimal bomStandardPrice;

    /**
     * 移动平均价 (来自 raw_material_types.moving_avg_price)
     * 根据历次入库自动计算的加权平均价
     * null 表示尚无入库记录
     */
    private BigDecimal movingAvgPrice;

    /**
     * 当前采购单价 (来自 purchase_order_items.unit_price)
     * 本次采购订单中的报价
     * null 表示未填写单价
     */
    private BigDecimal currentPrice;

    // ==================== 偏差分析 ====================

    /**
     * 当前价 vs BOM标准价 偏差百分比
     * 正数表示当前价高于BOM价，负数表示低于
     * null 表示无法计算（缺少BOM价或当前价）
     */
    private BigDecimal varianceFromBom;

    /**
     * 当前价 vs 移动平均价 偏差百分比
     * 正数表示当前价高于均价，负数表示低于
     * null 表示无法计算（缺少均价或当前价）
     */
    private BigDecimal varianceFromAvg;

    /**
     * 是否价格异常（偏差超过阈值）
     * true 表示当前价与BOM标准价或移动平均价偏差超过 10%
     */
    private Boolean priceAlert;

    /** BOM关联的产品名称（如果有多个产品，用逗号分隔） */
    private String bomProductNames;
}
