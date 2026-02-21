package com.cretas.aims.dto.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 物料批次分配记录
 * 表示从特定批次中分配给生产任务的物料数量
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class MaterialAllocation {

    /** 物料类型ID */
    private String materialTypeId;

    /** 物料批次ID */
    private String materialBatchId;

    /** 批次编号，便于追溯 */
    private String batchNumber;

    /** 从该批次分配的数量 */
    private BigDecimal allocatedQuantity;
}
