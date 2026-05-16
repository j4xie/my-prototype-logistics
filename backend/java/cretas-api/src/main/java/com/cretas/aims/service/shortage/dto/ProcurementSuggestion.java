package com.cretas.aims.service.shortage.dto;

import com.cretas.aims.dto.inventory.MaterialPriceComparisonDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 单一物料的采购建议 (read-only)
 *
 * <p>由 {@code ShortageAnalysisService.suggestProcurement} 基于 {@link ShortageReport#getMaterialShortages()} 生成。
 * 不创建采购单 — RN 上"一键确认采购"后再调用 {@code ProcurementSuggestionService.generateSuggestions} 落库。
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ProcurementSuggestion {

    /** 物料类型 ID */
    private String materialId;

    /** 物料名称 (冗余, 方便前端展示) */
    private String materialName;

    /** 建议采购量 (= 当前短缺量, 不含安全库存) */
    private BigDecimal suggestedQty;

    /** 物料单位 (kg / L / pcs) */
    private String unit;

    /** 建议供应商 ID (可为空; null 表示无历史供应商, 需采购员补) */
    private String suggestedSupplierId;

    /** 建议供应商名称 */
    private String suggestedSupplierName;

    /** 估算单价 (来自最近一次采购 / 移动平均) */
    private BigDecimal estimatedPrice;

    /** 估算金额 (= suggestedQty * estimatedPrice) */
    private BigDecimal estimatedTotal;

    /** 估算交付周期 (天) */
    private Integer leadDays;

    /**
     * 三价对比 (Sprint 1 Track C 集成): BOM 标价 / 移动平均 / 当前价 + 预警标记。
     * 若 Track C 数据不可用时为 null。
     */
    private MaterialPriceComparisonDTO priceComparison;
}
