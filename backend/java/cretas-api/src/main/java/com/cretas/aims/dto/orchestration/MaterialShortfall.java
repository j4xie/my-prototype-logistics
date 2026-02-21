package com.cretas.aims.dto.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 物料短缺信息
 * 描述某种物料的需求量、可用量与缺口量，用于采购建议生成
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class MaterialShortfall {

    /** 物料类型ID */
    private String materialTypeId;

    /** 物料类型名称 */
    private String materialTypeName;

    /** 所需总量（含损耗） */
    private BigDecimal requiredQuantity;

    /** 当前可用库存量 */
    private BigDecimal availableQuantity;

    /** 缺口数量（requiredQuantity - availableQuantity），大于0表示短缺 */
    private BigDecimal shortfallQuantity;
}
