package com.cretas.aims.service.shortage.dto;

import com.cretas.aims.dto.orchestration.LineItemMatch;
import com.cretas.aims.dto.orchestration.MaterialRequirement;
import com.cretas.aims.dto.orchestration.MaterialShortfall;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 销售订单缺料分析报告 (read-only 快照)
 *
 * <p>承载两层缺料信息:
 * <ul>
 *   <li><b>成品库存层 (FG)</b> — {@link #finishedGoodsLineItems} 列出每行待发货量 vs 当前可用成品库存。
 *       未满足项触发生产任务建议。</li>
 *   <li><b>原辅料层 (BOM)</b> — {@link #totalRequired} / {@link #materialShortages} 列出 FG 缺口
 *       展开 BOM 后的原料需求与短缺。未满足项触发采购建议。</li>
 * </ul>
 *
 * <p>对应数据库表 {@code sales_order_shortage_report} (Day 2 Flyway V20260601_01)。
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ShortageReport {

    /** 销售订单 ID */
    private String salesOrderId;

    /** 工厂 ID */
    private String factoryId;

    /** 分析状态: PENDING / COMPLETED / FAILED */
    private String analysisStatus;

    /** 分析时间 */
    private LocalDateTime analyzedAt;

    /**
     * 成品库存匹配结果 (每行 = 销售订单一个 SKU 行项目)。
     * 未满足的行 (isFullySatisfied()=false) 驱动 {@code productionSuggestions}。
     */
    private List<LineItemMatch> finishedGoodsLineItems;

    /**
     * 对所有 FG 缺口展开 BOM 后的原料需求 (聚合到 materialTypeId)。
     * 来源: {@code BomExpansionService.expandBOM}。
     */
    private List<MaterialRequirement> totalRequired;

    /**
     * 原辅料短缺列表 (聚合到 materialTypeId)。
     * 来源: {@code BomExpansionService.checkMaterialAvailability}。
     * 驱动 {@code procurementSuggestions}。
     */
    private List<MaterialShortfall> materialShortages;

    /** 总体是否完全满足 (FG + 原料均充足) */
    private boolean fullySatisfied;

    /** 人类可读摘要 (用于 AIChat 文字回复 / 钉钉卡片标题) */
    private String summary;
}
