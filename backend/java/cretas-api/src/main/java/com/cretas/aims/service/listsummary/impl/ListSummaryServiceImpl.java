package com.cretas.aims.service.listsummary.impl;

import com.cretas.aims.dto.listsummary.ListSummaryRequest;
import com.cretas.aims.dto.listsummary.ListSummaryResponse;
import com.cretas.aims.dto.listsummary.ListSummaryResponse.SummaryStat;
import com.cretas.aims.service.listsummary.ListSummaryService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sprint 2 Track I — U-FOOTER-1.
 * Native SQL aggregation per entity type. Keeps logic in one file vs spreading
 * @Query annotations across 5 repos. Tenant-scoped via factoryId in WHERE clause
 * (smartbi_user has no BYPASSRLS; this entity manager is the main cretas pool
 * which is also tenant-scoped via the JWT middleware GUC).
 *
 * Optimization later: if any entity becomes hot (>1000 rows/page), promote its
 * aggregation to a dedicated repo @Query with optimized index hints.
 */
@Slf4j
@Service
public class ListSummaryServiceImpl implements ListSummaryService {

    @PersistenceContext
    private EntityManager em;

    private static final Set<String> SUPPORTED = Set.of(
            "salesOrder", "purchaseOrder", "inventory", "wastage", "attendance",
            "returnOrder", "internalTransfer", "qualityInspection");

    @Override
    @Transactional(readOnly = true)
    public ListSummaryResponse computeSummary(String factoryId, String entityType, ListSummaryRequest request) {
        if (!SUPPORTED.contains(entityType)) {
            throw new IllegalArgumentException(
                    "Unsupported entityType: " + entityType + ". Day 2 supports: " + SUPPORTED);
        }
        Map<String, Object> filter = request.getFilterConditions() != null
                ? request.getFilterConditions() : Map.of();
        LocalDate dateFrom = request.getDateFrom();
        LocalDate dateTo = request.getDateTo();
        return switch (entityType) {
            case "salesOrder"        -> computeSalesOrderSummary(factoryId, filter, dateFrom, dateTo);
            case "purchaseOrder"     -> computePurchaseOrderSummary(factoryId, filter, dateFrom, dateTo);
            case "inventory"         -> computeInventorySummary(factoryId, filter);
            case "wastage"           -> computeWastageSummary(factoryId, filter, dateFrom, dateTo);
            case "attendance"        -> computeAttendanceSummary(factoryId, filter, dateFrom, dateTo);
            case "returnOrder"       -> computeReturnOrderSummary(factoryId, filter, dateFrom, dateTo);
            case "internalTransfer"  -> computeInternalTransferSummary(factoryId, filter, dateFrom, dateTo);
            case "qualityInspection" -> computeQualityInspectionSummary(factoryId, filter, dateFrom, dateTo);
            default -> throw new IllegalStateException("unreachable");
        };
    }

    // ==================== 销售订单 ====================

    private ListSummaryResponse computeSalesOrderSummary(String factoryId, Map<String, Object> filter,
                                                          LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM sales_orders " +
                "WHERE factory_id = :fid AND deleted_at IS NULL");
        appendStatusFilter(sql, filter);
        appendDateRange(sql, "order_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, from, to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        BigDecimal total = (BigDecimal) row[1];
        BigDecimal avg = count > 0
                ? total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "条", false));
        stats.add(stat("总金额", total, "currency", "¥", true));
        stats.add(stat("平均金额", avg, "currency", "¥", true));
        return ListSummaryResponse.builder().entityType("salesOrder").stats(stats).build();
    }

    // ==================== 采购订单 ====================

    private ListSummaryResponse computePurchaseOrderSummary(String factoryId, Map<String, Object> filter,
                                                             LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM purchase_orders " +
                "WHERE factory_id = :fid AND deleted_at IS NULL");
        appendStatusFilter(sql, filter);
        appendDateRange(sql, "order_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, from, to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        BigDecimal total = (BigDecimal) row[1];
        BigDecimal avg = count > 0
                ? total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "条", false));
        stats.add(stat("总金额", total, "currency", "¥", true));
        stats.add(stat("平均金额", avg, "currency", "¥", true));
        return ListSummaryResponse.builder().entityType("purchaseOrder").stats(stats).build();
    }

    // ==================== 库存 (material_batches) ====================

    private ListSummaryResponse computeInventorySummary(String factoryId, Map<String, Object> filter) {
        // available = receipt_quantity - used_quantity - reserved_quantity
        // total value = SUM(available * unit_price)  (NULL unit_price → 0)
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), " +
                "       COALESCE(SUM(receipt_quantity - used_quantity - reserved_quantity), 0) AS avail_qty, " +
                "       COALESCE(SUM((receipt_quantity - used_quantity - reserved_quantity) * COALESCE(unit_price, 0)), 0) AS total_value, " +
                "       COUNT(*) FILTER (WHERE (receipt_quantity - used_quantity - reserved_quantity) < 10) AS low_stock " +
                "FROM material_batches WHERE factory_id = :fid AND deleted_at IS NULL");
        appendStatusFilter(sql, filter);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, null, null);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        BigDecimal availQty = (BigDecimal) row[1];
        BigDecimal totalValue = (BigDecimal) row[2];
        long lowStock = ((Number) row[3]).longValue();
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "批", false));
        stats.add(stat("可用数量", availQty, "number", "", false));
        stats.add(stat("总价值", totalValue, "currency", "¥", true));
        stats.add(stat("低库存", lowStock, "number", "项", false));
        return ListSummaryResponse.builder().entityType("inventory").stats(stats).build();
    }

    // ==================== 餐饮损耗 ====================

    private ListSummaryResponse computeWastageSummary(String factoryId, Map<String, Object> filter,
                                                       LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), COALESCE(SUM(quantity), 0) FROM wastage_records " +
                "WHERE factory_id = :fid AND deleted_at IS NULL");
        appendDateRange(sql, "wastage_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, from, to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        BigDecimal totalQty = (BigDecimal) row[1];
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "条", false));
        stats.add(stat("损耗数量", totalQty, "number", "", false));
        return ListSummaryResponse.builder().entityType("wastage").stats(stats).build();
    }

    // ==================== 考勤 ====================

    private ListSummaryResponse computeAttendanceSummary(String factoryId, Map<String, Object> filter,
                                                          LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), COUNT(DISTINCT user_id) FROM time_clock_records " +
                "WHERE factory_id = :fid");
        appendStatusFilter(sql, filter);
        appendDateRange(sql, "clock_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, from, to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        long distinctUsers = ((Number) row[1]).longValue();
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "条", false));
        stats.add(stat("打卡人数", distinctUsers, "number", "人", false));
        return ListSummaryResponse.builder().entityType("attendance").stats(stats).build();
    }

    // ==================== 退货单 ====================

    private ListSummaryResponse computeReturnOrderSummary(String factoryId, Map<String, Object> filter,
                                                           LocalDate from, LocalDate to) {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), COALESCE(SUM(total_amount), 0) FROM return_orders " +
                "WHERE factory_id = :fid AND deleted_at IS NULL");
        appendStatusFilter(sql, filter);
        appendDateRange(sql, "return_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, from, to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        BigDecimal total = (BigDecimal) row[1];
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "条", false));
        stats.add(stat("退货金额", total, "currency", "¥", true));
        return ListSummaryResponse.builder().entityType("returnOrder").stats(stats).build();
    }

    // ==================== 内部调拨 (multi-tenant: source 或 target = factory) ====================

    private ListSummaryResponse computeInternalTransferSummary(String factoryId, Map<String, Object> filter,
                                                                LocalDate from, LocalDate to) {
        // 调拨单 source_factory_id 或 target_factory_id 等于当前 factory 都算
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), COALESCE(SUM(total_amount), 0), " +
                "       COUNT(*) FILTER (WHERE source_factory_id = :fid) AS outbound_cnt, " +
                "       COUNT(*) FILTER (WHERE target_factory_id = :fid) AS inbound_cnt " +
                "FROM internal_transfers WHERE (source_factory_id = :fid OR target_factory_id = :fid) " +
                "AND deleted_at IS NULL");
        appendStatusFilter(sql, filter);
        appendDateRange(sql, "transfer_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        bindParams(q, factoryId, filter, from, to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        BigDecimal total = (BigDecimal) row[1];
        long outbound = ((Number) row[2]).longValue();
        long inbound = ((Number) row[3]).longValue();
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "条", false));
        stats.add(stat("调出", outbound, "number", "条", false));
        stats.add(stat("调入", inbound, "number", "条", false));
        stats.add(stat("总金额", total, "currency", "¥", true));
        return ListSummaryResponse.builder().entityType("internalTransfer").stats(stats).build();
    }

    // ==================== 质检 ====================

    private ListSummaryResponse computeQualityInspectionSummary(String factoryId, Map<String, Object> filter,
                                                                  LocalDate from, LocalDate to) {
        // result 字段值: PASS / FAIL / PENDING
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*), " +
                "       COUNT(*) FILTER (WHERE result = 'PASS') AS pass_cnt, " +
                "       COUNT(*) FILTER (WHERE result = 'FAIL') AS fail_cnt " +
                "FROM quality_inspections WHERE factory_id = :fid");
        // quality_inspections 用 result 不是 status — 用专用 filter
        if (filter.containsKey("result") && filter.get("result") != null) {
            sql.append(" AND result = :resultFilter");
        }
        appendDateRange(sql, "inspection_date", from, to);
        Query q = em.createNativeQuery(sql.toString());
        q.setParameter("fid", factoryId);
        if (filter.containsKey("result") && filter.get("result") != null) {
            q.setParameter("resultFilter", String.valueOf(filter.get("result")));
        }
        if (from != null) q.setParameter("dateFrom", from);
        if (to != null) q.setParameter("dateTo", to);
        Object[] row = (Object[]) q.getSingleResult();
        long count = ((Number) row[0]).longValue();
        long pass = ((Number) row[1]).longValue();
        long fail = ((Number) row[2]).longValue();
        double passRate = count > 0 ? (pass * 100.0 / count) : 0.0;
        List<SummaryStat> stats = new ArrayList<>();
        stats.add(stat("共", count, "number", "项", false));
        stats.add(stat("合格", pass, "number", "项", false));
        stats.add(stat("不合格", fail, "number", "项", false));
        stats.add(stat("合格率", BigDecimal.valueOf(passRate).setScale(1, RoundingMode.HALF_UP),
                "percent", "%", false));
        return ListSummaryResponse.builder().entityType("qualityInspection").stats(stats).build();
    }

    // ==================== Helpers ====================

    private static void appendStatusFilter(StringBuilder sql, Map<String, Object> filter) {
        if (filter.containsKey("status") && filter.get("status") != null) {
            sql.append(" AND status = :status");
        }
    }

    private static void appendDateRange(StringBuilder sql, String column, LocalDate from, LocalDate to) {
        if (from != null) sql.append(" AND ").append(column).append(" >= :dateFrom");
        if (to != null) sql.append(" AND ").append(column).append(" <= :dateTo");
    }

    private static void bindParams(Query q, String factoryId, Map<String, Object> filter,
                                    LocalDate from, LocalDate to) {
        q.setParameter("fid", factoryId);
        if (filter.containsKey("status") && filter.get("status") != null) {
            q.setParameter("status", String.valueOf(filter.get("status")));
        }
        if (from != null) q.setParameter("dateFrom", from);
        if (to != null) q.setParameter("dateTo", to);
    }

    private static SummaryStat stat(String label, Object value, String format, String unit, boolean priceRelated) {
        return SummaryStat.builder()
                .label(label)
                .value(value)
                .format(format)
                .unit(unit)
                .canViewPrice(priceRelated)
                .build();
    }
}
