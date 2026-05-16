package com.cretas.aims.service.shortage;

import com.cretas.aims.entity.inventory.SalesOrderShortageReport;
import com.cretas.aims.event.SalesOrderFinanceApprovedEvent;
import com.cretas.aims.repository.inventory.SalesOrderShortageReportRepository;
import com.cretas.aims.service.shortage.dto.ProcurementSuggestion;
import com.cretas.aims.service.shortage.dto.ProductionPlanSuggestion;
import com.cretas.aims.service.shortage.dto.ShortageReport;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

/**
 * 监听销售订单财务审核通过事件, 异步生成 + 持久化缺料报告快照, 推 NotificationPort。
 *
 * <p><b>跟 {@code SupplyChainOrchestrator.onSalesOrderFinanceApproved} 的分工</b>:
 * <ul>
 *   <li>Orchestrator (本来就有): 触发副作用 — 创建 PP / PO / 库存预留。</li>
 *   <li>本 Listener (新增 N31): 仅生成 read-only 快照 + 通知 — 不重复副作用。</li>
 * </ul>
 *
 * <p>{@code @Async} 让快照生成不阻塞财务审核响应。
 * Spring @EventListener 默认同步 — 必须显式 {@link Async} 才异步。
 * Async 配置见 {@code com.cretas.aims.config.AsyncConfig}。
 */
@Component
@RequiredArgsConstructor
public class SalesOrderShortageReportListener {

    private static final Logger log = LoggerFactory.getLogger(SalesOrderShortageReportListener.class);

    private final ShortageAnalysisService shortageAnalysisService;
    private final SalesOrderShortageReportRepository reportRepository;
    private final NotificationPort notificationPort;

    @Async
    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onSalesOrderFinanceApproved(SalesOrderFinanceApprovedEvent event) {
        String factoryId = event.getFactoryId();
        String salesOrderId = event.getSalesOrderId();
        log.info("[ShortageReport] async snapshot: factoryId={}, SO={}, approvedBy={}",
                factoryId, salesOrderId, event.getApprovedBy());

        ShortageReport report;
        try {
            report = shortageAnalysisService.analyzeForSalesOrder(factoryId, salesOrderId);
            List<ProcurementSuggestion> procurement = shortageAnalysisService.suggestProcurement(factoryId, report);
            List<ProductionPlanSuggestion> production = shortageAnalysisService.suggestProduction(factoryId, report);

            persistReport(report, procurement, production, "COMPLETED");
            notificationPort.publishShortageAlert(factoryId, report);
            log.info("[ShortageReport] persisted COMPLETED snapshot: SO={}, fgShort={}, matShort={}",
                    salesOrderId,
                    report.getFinishedGoodsLineItems() != null ? report.getFinishedGoodsLineItems().size() : 0,
                    report.getMaterialShortages() != null ? report.getMaterialShortages().size() : 0);
        } catch (Exception e) {
            // 不影响 orchestrator 主链路 — 仅记录 FAILED 占位行供前端展示 "分析失败, 请重试"
            log.error("[ShortageReport] analyze failed (orchestrator 仍正常工作): SO={}, factoryId={}",
                    salesOrderId, factoryId, e);
            persistFailedPlaceholder(factoryId, salesOrderId, e.getMessage());
        }
    }

    private void persistReport(ShortageReport report,
                               List<ProcurementSuggestion> procurement,
                               List<ProductionPlanSuggestion> production,
                               String status) {
        SalesOrderShortageReport entity = reportRepository
                .findByFactoryIdAndSalesOrderId(report.getFactoryId(), report.getSalesOrderId())
                .orElseGet(SalesOrderShortageReport::new);

        entity.setFactoryId(report.getFactoryId());
        entity.setSalesOrderId(report.getSalesOrderId());
        entity.setAnalysisStatus(status);
        entity.setTotalRequired(report.getTotalRequired());
        entity.setAvailable(report.getFinishedGoodsLineItems());
        entity.setShortage(report.getMaterialShortages());
        entity.setProcurementSuggestions(procurement);
        entity.setProductionSuggestions(production);
        entity.setAnalysisSummary(report.getSummary());
        reportRepository.save(entity);
    }

    private void persistFailedPlaceholder(String factoryId, String salesOrderId, String reason) {
        try {
            SalesOrderShortageReport entity = reportRepository
                    .findByFactoryIdAndSalesOrderId(factoryId, salesOrderId)
                    .orElseGet(SalesOrderShortageReport::new);
            entity.setFactoryId(factoryId);
            entity.setSalesOrderId(salesOrderId);
            entity.setAnalysisStatus("FAILED");
            entity.setAnalysisSummary("分析失败: " + (reason != null ? reason : "(unknown)"));
            entity.setTotalRequired(Collections.emptyList());
            entity.setAvailable(Collections.emptyList());
            entity.setShortage(Collections.emptyList());
            entity.setProcurementSuggestions(Collections.emptyList());
            entity.setProductionSuggestions(Collections.emptyList());
            reportRepository.save(entity);
        } catch (Exception inner) {
            log.error("[ShortageReport] FAILED placeholder also failed: SO={}", salesOrderId, inner);
        }
    }
}
