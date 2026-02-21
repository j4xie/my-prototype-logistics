package com.cretas.aims.dto.restaurant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 食材成本占比 DTO
 *
 * <p>用于餐饮专项 BI Dashboard 的食材成本饼图分析。
 * 数据来源于原材料批次的入库成本（unitPrice × receiptQuantity）。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class IngredientCostRatio {

    /** 食材名称（对应 RawMaterialType.name） */
    private String ingredientName;

    /** 食材类别（对应 RawMaterialType.category） */
    private String category;

    /** 时段内总采购成本（元） */
    private BigDecimal totalCost;

    /** 占总采购成本的百分比（0~100，保留2位小数） */
    private Double percentage;
}
