package com.cretas.aims.service.workflow;

import com.cretas.aims.dto.workflow.WorkflowNodeDTO;
import com.cretas.aims.dto.workflow.WorkflowStatsDTO;
import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.entity.enums.PaymentRecordStatus;
import com.cretas.aims.entity.enums.ProductionPlanStatus;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/**
 * 工作流统计 service — 跨实体 COUNT, 不修改任何 entity-specific Repository.
 *
 * <p>跟前端 WorkflowVisualizer (RN) / WorkflowBar (Vue) 数据契约对齐: 每个 module
 * 返回 3 个 node (PENDING / IN_PROGRESS / DONE), 长度固定使前端不需要切换布局.
 *
 * <p>缓存: <code>workflowStats</code> 缓存名, TTL 5 分钟 (CacheConfig). Cache 失效暂用
 * TTL-only (Spring 不需要再手动 evict), 因为节点 count 接受 5 分钟 staleness.
 * 后续如需即时刷新, 可在写操作 (审批/创建/完成) 上加 {@code @CacheEvict}.
 *
 * <p>租户隔离: factoryId 来自 path variable, 所有 JPQL 已 WHERE factoryId = :factoryId.
 * Java 端目前没有 RLS, 但应用层 WHERE-clause 已经把数据 cross-tenant 隔离.
 */
@Slf4j
@Service
public class WorkflowStatsService {

    @PersistenceContext
    private EntityManager em;

    // ---------- public 接口 ----------

    @Cacheable(value = "workflowStats", key = "#factoryId + ':sales'")
    public WorkflowStatsDTO getSalesStats(String factoryId) {
        long pending = countSalesOrder(factoryId, List.of(
                SalesOrderStatus.DRAFT,
                SalesOrderStatus.CONFIRMED,
                SalesOrderStatus.PENDING_FINANCE_REVIEW));
        long inProgress = countSalesOrder(factoryId, List.of(
                SalesOrderStatus.FINANCE_APPROVED,
                SalesOrderStatus.PROCESSING,
                SalesOrderStatus.PARTIAL_DELIVERED));
        long done = countSalesOrder(factoryId, List.of(
                SalesOrderStatus.COMPLETED));
        return assemble("sales", pending, inProgress, done, "待审", "进行中", "已完成");
    }

    @Cacheable(value = "workflowStats", key = "#factoryId + ':purchase'")
    public WorkflowStatsDTO getPurchaseStats(String factoryId) {
        long pending = countPurchaseOrder(factoryId, List.of(
                PurchaseOrderStatus.DRAFT,
                PurchaseOrderStatus.SUBMITTED,
                PurchaseOrderStatus.APPROVED,
                PurchaseOrderStatus.PENDING_FINANCE_REVIEW));
        long inProgress = countPurchaseOrder(factoryId, List.of(
                PurchaseOrderStatus.FINANCE_APPROVED,
                PurchaseOrderStatus.PARTIAL_RECEIVED));
        long done = countPurchaseOrder(factoryId, List.of(
                PurchaseOrderStatus.COMPLETED,
                PurchaseOrderStatus.CLOSED));
        return assemble("purchase", pending, inProgress, done, "待审", "进行中", "已完成");
    }

    @Cacheable(value = "workflowStats", key = "#factoryId + ':production'")
    public WorkflowStatsDTO getProductionStats(String factoryId) {
        long pending = countProductionPlan(factoryId, List.of(
                ProductionPlanStatus.PLANNED,
                ProductionPlanStatus.PENDING));
        long inProgress = countProductionPlan(factoryId, List.of(
                ProductionPlanStatus.IN_PROGRESS,
                ProductionPlanStatus.PAUSED));
        long done = countProductionPlan(factoryId, List.of(
                ProductionPlanStatus.COMPLETED));
        return assemble("production", pending, inProgress, done, "待生产", "进行中", "已完成");
    }

    /**
     * Finance 是复合: PENDING = 待开票 (InvoiceRecord.REQUESTED),
     * IN_PROGRESS = 待回款 (InvoiceRecord 在 APPROVED / ISSUED + PaymentRecord 在 PENDING),
     * DONE = 已收款 (PaymentRecord.VERIFIED).
     */
    @Cacheable(value = "workflowStats", key = "#factoryId + ':finance'")
    public WorkflowStatsDTO getFinanceStats(String factoryId) {
        long pending = countInvoice(factoryId, List.of(InvoiceStatus.REQUESTED));
        long inProgress = countInvoice(factoryId, List.of(InvoiceStatus.APPROVED, InvoiceStatus.ISSUED))
                + countPayment(factoryId, List.of(PaymentRecordStatus.PENDING));
        long done = countPayment(factoryId, List.of(PaymentRecordStatus.VERIFIED));
        return assemble("finance", pending, inProgress, done, "待开票", "待回款", "已收款");
    }

    /**
     * Inventory 用 MaterialBatchStatus: PENDING = 需关注 (EXPIRED/USED_UP/SCRAPPED 异常),
     * IN_PROGRESS = 使用中 (INSPECTING/RESERVED/DEPLETED), DONE = 可用
     * (IN_STOCK/AVAILABLE/FRESH/FROZEN).
     */
    @Cacheable(value = "workflowStats", key = "#factoryId + ':inventory'")
    public WorkflowStatsDTO getInventoryStats(String factoryId) {
        long pending = countMaterialBatch(factoryId, List.of(
                MaterialBatchStatus.EXPIRED,
                MaterialBatchStatus.USED_UP,
                MaterialBatchStatus.SCRAPPED));
        long inProgress = countMaterialBatch(factoryId, List.of(
                MaterialBatchStatus.INSPECTING,
                MaterialBatchStatus.RESERVED,
                MaterialBatchStatus.DEPLETED));
        long done = countMaterialBatch(factoryId, List.of(
                MaterialBatchStatus.IN_STOCK,
                MaterialBatchStatus.AVAILABLE,
                MaterialBatchStatus.FRESH,
                MaterialBatchStatus.FROZEN));
        return assemble("inventory", pending, inProgress, done, "需关注", "使用中", "可用");
    }

    // ---------- private 计数 helpers ----------

    private long countSalesOrder(String factoryId, Collection<SalesOrderStatus> statuses) {
        return em.createQuery(
                        "SELECT COUNT(o) FROM SalesOrder o "
                                + "WHERE o.factoryId = :factoryId AND o.status IN :statuses",
                        Long.class)
                .setParameter("factoryId", factoryId)
                .setParameter("statuses", statuses)
                .getSingleResult();
    }

    private long countPurchaseOrder(String factoryId, Collection<PurchaseOrderStatus> statuses) {
        return em.createQuery(
                        "SELECT COUNT(o) FROM PurchaseOrder o "
                                + "WHERE o.factoryId = :factoryId AND o.status IN :statuses",
                        Long.class)
                .setParameter("factoryId", factoryId)
                .setParameter("statuses", statuses)
                .getSingleResult();
    }

    private long countProductionPlan(String factoryId, Collection<ProductionPlanStatus> statuses) {
        return em.createQuery(
                        "SELECT COUNT(p) FROM ProductionPlan p "
                                + "WHERE p.factoryId = :factoryId AND p.status IN :statuses",
                        Long.class)
                .setParameter("factoryId", factoryId)
                .setParameter("statuses", statuses)
                .getSingleResult();
    }

    private long countInvoice(String factoryId, Collection<InvoiceStatus> statuses) {
        return em.createQuery(
                        "SELECT COUNT(i) FROM InvoiceRecord i "
                                + "WHERE i.factoryId = :factoryId AND i.status IN :statuses "
                                + "AND i.deletedAt IS NULL",
                        Long.class)
                .setParameter("factoryId", factoryId)
                .setParameter("statuses", statuses)
                .getSingleResult();
    }

    private long countPayment(String factoryId, Collection<PaymentRecordStatus> statuses) {
        return em.createQuery(
                        "SELECT COUNT(p) FROM PaymentRecord p "
                                + "WHERE p.factoryId = :factoryId AND p.status IN :statuses "
                                + "AND p.deletedAt IS NULL",
                        Long.class)
                .setParameter("factoryId", factoryId)
                .setParameter("statuses", statuses)
                .getSingleResult();
    }

    private long countMaterialBatch(String factoryId, Collection<MaterialBatchStatus> statuses) {
        return em.createQuery(
                        "SELECT COUNT(b) FROM MaterialBatch b "
                                + "WHERE b.factoryId = :factoryId AND b.status IN :statuses",
                        Long.class)
                .setParameter("factoryId", factoryId)
                .setParameter("statuses", statuses)
                .getSingleResult();
    }

    private WorkflowStatsDTO assemble(
            String module,
            long pending,
            long inProgress,
            long done,
            String pendingLabel,
            String inProgressLabel,
            String doneLabel) {
        return WorkflowStatsDTO.builder()
                .module(module)
                .nodes(List.of(
                        WorkflowNodeDTO.builder()
                                .id("pending").label(pendingLabel).status("PENDING").count(pending).build(),
                        WorkflowNodeDTO.builder()
                                .id("in_progress").label(inProgressLabel).status("IN_PROGRESS").count(inProgress).build(),
                        WorkflowNodeDTO.builder()
                                .id("done").label(doneLabel).status("DONE").count(done).build()))
                .lastRefreshedAt(Instant.now())
                .build();
    }
}
