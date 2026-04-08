package com.cretas.aims.dto.sales;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 销售发货批次分配请求单元（P0-13）。
 */
@Data
public class BatchAllocationDTO {
    /** 对应 FinishedGoodsBatch.id */
    private String finishedGoodsBatchId;
    private BigDecimal allocatedQty;
}
