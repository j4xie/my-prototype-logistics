package com.cretas.aims.domain;

import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * R21 (R20 audit C2): single source of truth for SO/PO status whitelists used by
 * dropdown filters AND backend invariant checks. Previously 5+ copies scattered
 * across InvoiceServiceImpl, ArApServiceImpl, ReferenceDataController,
 * ProductionPlanController, SalesServiceImpl — drift waiting to happen.
 *
 * <p>Usage values are stable contract strings exposed via REST query param. New usage
 * categories must add a new key here (preferred over scattered Set.of in callers).
 *
 * <p>Domain semantics:
 * <ul>
 *   <li><b>invoiceable</b>: AR invoice / AP payable can link only to post-finance-approved orders.
 *       Bypassing this skips dual-control approval gate.</li>
 *   <li><b>plannable</b> (SO only): production planning works on confirmed→partial-delivered;
 *       COMPLETED makes no sense (already done) and DRAFT/CANCELLED are pre-confirmation.</li>
 *   <li><b>shippable</b> (SO only): outbound picking; needs finance-approved + in-progress states.</li>
 *   <li><b>receivable</b> (PO only): inbound goods can arrive pre-finance for fast-moving consumables.</li>
 *   <li><b>all</b>: legacy fallback excluding only obviously-invalid states. AVOID in new code —
 *       used only when no specific business semantic applies.</li>
 * </ul>
 */
public final class OrderUsageWhitelists {

    private OrderUsageWhitelists() {}

    /** Strictest SO whitelist — used as fail-secure default. */
    public static final Set<SalesOrderStatus> SO_INVOICEABLE = Set.of(
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED,
            SalesOrderStatus.COMPLETED);

    public static final Set<SalesOrderStatus> SO_SHIPPABLE = Set.of(
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED);

    public static final Set<SalesOrderStatus> SO_PLANNABLE = Set.of(
            SalesOrderStatus.CONFIRMED,
            SalesOrderStatus.PENDING_FINANCE_REVIEW,
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED);

    public static final Set<SalesOrderStatus> SO_ALL = EnumSet.complementOf(EnumSet.of(
            SalesOrderStatus.DRAFT,
            SalesOrderStatus.CANCELLED,
            SalesOrderStatus.FINANCE_REJECTED));

    public static final Map<String, Set<SalesOrderStatus>> SO_BY_USAGE = Map.of(
            "invoiceable", SO_INVOICEABLE,
            "shippable", SO_SHIPPABLE,
            "plannable", SO_PLANNABLE,
            "all", SO_ALL);

    /** Strictest PO whitelist — used as fail-secure default. */
    public static final Set<PurchaseOrderStatus> PO_INVOICEABLE = Set.of(
            PurchaseOrderStatus.FINANCE_APPROVED,
            PurchaseOrderStatus.PARTIAL_RECEIVED,
            PurchaseOrderStatus.COMPLETED,
            PurchaseOrderStatus.CLOSED);

    public static final Set<PurchaseOrderStatus> PO_RECEIVABLE = Set.of(
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PENDING_FINANCE_REVIEW,
            PurchaseOrderStatus.FINANCE_APPROVED,
            PurchaseOrderStatus.PARTIAL_RECEIVED);

    public static final Set<PurchaseOrderStatus> PO_ALL = EnumSet.complementOf(EnumSet.of(
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.CANCELLED,
            PurchaseOrderStatus.FINANCE_REJECTED));

    public static final Map<String, Set<PurchaseOrderStatus>> PO_BY_USAGE = Map.of(
            "invoiceable", PO_INVOICEABLE,
            "receivable", PO_RECEIVABLE,
            "all", PO_ALL);

    /**
     * R20 audit S1: fail-secure resolver. Unknown/missing usage → strictest (invoiceable),
     * NOT broad fallback. Caller must explicitly opt into 'all' or another permissive Set.
     */
    public static Set<SalesOrderStatus> resolveSO(String usage) {
        return SO_BY_USAGE.getOrDefault(usage, SO_INVOICEABLE);
    }

    public static Set<PurchaseOrderStatus> resolvePO(String usage) {
        return PO_BY_USAGE.getOrDefault(usage, PO_INVOICEABLE);
    }
}
