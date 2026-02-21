package com.cretas.aims.dto.restaurant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 食材库存预警 DTO
 *
 * <p>用于餐饮专项的食材保质期与库存预警功能。
 * 涵盖三种预警类型：低库存、临期（3天内到期）、已过期。</p>
 *
 * <p>预警类型枚举值：</p>
 * <ul>
 *   <li>{@code LOW_STOCK}     - 库存低于最低警戒线</li>
 *   <li>{@code EXPIRING_SOON} - 距过期日期 ≤ 3 天（含当天）</li>
 *   <li>{@code EXPIRED}       - 已过期但仍有剩余库存</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class IngredientStockAlert {

    /** 食材名称 */
    private String ingredientName;

    /** 食材类别 */
    private String category;

    /** 预警类型：LOW_STOCK / EXPIRING_SOON / EXPIRED */
    private String alertType;

    /** 当前可用库存数量（receiptQuantity - usedQuantity - reservedQuantity） */
    private BigDecimal currentStock;

    /** 最低库存警戒线（LOW_STOCK 时有值） */
    private BigDecimal minStock;

    /** 计量单位 */
    private String unit;

    /** 距离过期日期的天数（负数表示已过期；LOW_STOCK 类型为 null） */
    private Integer daysToExpiry;

    /** 批次号 */
    private String batchNumber;

    /** 存储方式（fresh / frozen / dry） */
    private String storageType;
}
