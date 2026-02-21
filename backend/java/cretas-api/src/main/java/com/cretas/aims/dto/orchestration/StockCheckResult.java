package com.cretas.aims.dto.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 销售订单库存检查结果
 * 包含订单每个行项目的库存匹配情况，以及整单是否可完全满足的汇总标志
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class StockCheckResult {

    /** 销售订单ID */
    private String salesOrderId;

    /** 各行项目的库存匹配明细 */
    private List<LineItemMatch> lineItems;

    /** 是否所有行项目均库存充足，可直接发货 */
    private boolean allSatisfied;
}
