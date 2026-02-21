package com.cretas.aims.dto.restaurant;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 菜品销量排行榜 DTO
 *
 * <p>用于餐饮专项 BI Dashboard 的菜品销量排行分析，支持 TOP-N 查询。</p>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-20
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class DishSalesRanking {

    /** 菜品名称（对应 ProductType.name） */
    private String dishName;

    /** 菜品类别（对应 ProductType.category） */
    private String category;

    /** 销售数量（出货件数汇总） */
    private Long salesCount;

    /** 销售额（含税） */
    private BigDecimal revenue;

    /** 排名（1-based） */
    private Integer rank;
}
