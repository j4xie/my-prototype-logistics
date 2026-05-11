package com.cretas.aims.dto.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 生产物料需求
 * 由BOM展开计算得出，包含损耗率信息，用于物料库存检查与采购建议
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class MaterialRequirement {

    /** 物料类型ID */
    private String materialTypeId;

    /** 物料类型名称 */
    private String materialTypeName;

    /** 所需净量（已含损耗率换算后的总需求量） */
    private BigDecimal requiredQuantity;

    /**
     * 物料损耗率（0.00 ~ 1.00）
     * 例如 0.05 表示 5% 的生产损耗，需求量已按此比率放大
     */
    private BigDecimal wastageRate;

    /**
     * D3 (2026-05-10 客户会议): BOM 来源单位。
     * 配方层用 g (克), 仓库 / 调拨层用 kg (千克)。
     * 当此字段为 "g" 且目标 RawMaterialType.unit 为 "kg" 时,
     * ProductionWorkflowOrchestrator.buildTransferRequest() 会自动按 1:1000 换算。
     *
     * 可为 null — 表示沿用原 1:1 透传逻辑 (历史 RPF/BOM 数据)。
     */
    private String sourceUnit;
}
