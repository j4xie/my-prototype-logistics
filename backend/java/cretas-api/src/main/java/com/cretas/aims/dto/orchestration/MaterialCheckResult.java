package com.cretas.aims.dto.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 物料库存检查结果
 * 包含物料充足标志、短缺物料明细，以及可用批次的预分配方案
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class MaterialCheckResult {

    /** 是否所有物料均库存充足，可直接开始生产 */
    private boolean allSatisfied;

    /** 短缺物料明细列表，allSatisfied=false 时非空 */
    private List<MaterialShortfall> shortfalls;

    /** 可用库存的批次分配方案，用于后续生产领料 */
    private List<MaterialAllocation> allocations;
}
