package com.cretas.aims.service.shortage;

import com.cretas.aims.service.shortage.dto.ProcurementSuggestion;
import com.cretas.aims.service.shortage.dto.ProductionPlanSuggestion;
import com.cretas.aims.service.shortage.dto.ShortageReport;

import java.util.List;

/**
 * 销售订单缺料分析统一入口 (Sprint 2 Track E — S-MRP-1 / N31)
 *
 * <p>客户原话 (六扇门 F006): "销售单审核通过 → 系统自动判断库存 → 缺料则分流采购,
 * 否则直接生产 → 输出 chain-card UI"。本服务为 AIChat (ShortageAnalysisTool) 与
 * RN (SalesOrderShortageReviewScreen) 提供 read-only 的缺料分析视图。
 *
 * <p>设计要点:
 * <ul>
 *   <li><b>编排不重写</b> — 内部委派给 {@code InventoryMatchingService} / {@code BomExpansionService}
 *       / {@code ProcurementSuggestionService}; 不复制 4 个 service 的算术。</li>
 *   <li><b>无副作用</b> — 仅查询，不写库 / 不创建 PP / 不发布 event。持久化由
 *       {@code SalesOrderShortageReportListener} 监听 {@link com.cretas.aims.event.SalesOrderFinanceApprovedEvent}
 *       异步完成。</li>
 *   <li><b>双层短缺</b> — 同时反映成品库存短缺 (FG short) 与原辅料短缺 (raw material short)。</li>
 * </ul>
 */
public interface ShortageAnalysisService {

    /**
     * 对销售订单做缺料分析快照。
     *
     * <p>步骤:
     * <ol>
     *   <li>调 {@code InventoryMatchingService.checkAvailability} 检查每个行项目的成品库存。</li>
     *   <li>对所有未满足的行项目，调 {@code BomExpansionService.expandBOM} 展开 BOM。</li>
     *   <li>对展开后的物料需求，调 {@code BomExpansionService.checkMaterialAvailability} 检查原料库存。</li>
     *   <li>装配 {@link ShortageReport} 返回。</li>
     * </ol>
     *
     * @param factoryId    工厂 ID
     * @param salesOrderId 销售订单 ID
     * @return 缺料分析报告 (read-only snapshot)
     */
    ShortageReport analyzeForSalesOrder(String factoryId, String salesOrderId);

    /**
     * 基于报告中的原辅料短缺，给出每种短缺物料的采购建议 (供应商 / 单价 / leadDays / 三价对比)。
     *
     * <p>不创建采购单 — 仅返回建议。采购员在 RN 上点击"一键确认"才触发
     * {@code ProcurementSuggestionService.generateSuggestions}。
     *
     * @param factoryId 工厂 ID
     * @param report    已分析的报告 (通常来自 {@link #analyzeForSalesOrder})
     * @return 采购建议列表
     */
    List<ProcurementSuggestion> suggestProcurement(String factoryId, ShortageReport report);

    /**
     * 基于报告中的成品库存短缺，给出生产任务建议 (工序链 / 计划起止日期)。
     *
     * <p>不创建生产计划 — 仅返回建议。
     *
     * @param factoryId 工厂 ID
     * @param report    已分析的报告
     * @return 生产任务建议列表
     */
    List<ProductionPlanSuggestion> suggestProduction(String factoryId, ShortageReport report);
}
