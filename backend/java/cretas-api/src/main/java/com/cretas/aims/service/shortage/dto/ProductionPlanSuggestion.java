package com.cretas.aims.service.shortage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 单一产品的生产任务建议 (read-only)
 *
 * <p>由 {@code ShortageAnalysisService.suggestProduction} 基于 {@link ShortageReport#getFinishedGoodsLineItems()}
 * 中未满足的行项目生成。不创建 ProductionPlan — RN 上"一键确认生产"后再走
 * {@code ProductionPlanService} 落库。
 *
 * <p>{@link #workProcessIds} 依赖 Sprint 1 Track D2 ({@code ProductWorkProcessConfig})。
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ProductionPlanSuggestion {

    /** 产品类型 ID */
    private String productId;

    /** 产品名称 (冗余) */
    private String productName;

    /** 建议生产量 (= 销售订单待发货量 - 当前可用成品库存) */
    private BigDecimal plannedQty;

    /** 工序链 ID 列表 (顺序 = 工艺路线顺序) */
    private List<String> workProcessIds;

    /** 工序链名称 (冗余, 同顺序) */
    private List<String> workProcessNames;

    /** 计划开始日期 */
    private LocalDate startDate;

    /** 计划结束日期 */
    private LocalDate endDate;
}
