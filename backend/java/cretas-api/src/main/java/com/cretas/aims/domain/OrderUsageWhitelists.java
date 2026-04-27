package com.cretas.aims.domain;

import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.enums.SalesOrderStatus;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * R21 / R23 (R22 audit C2+C3): single source of truth for SO/PO status whitelists used by
 * dropdown filters AND backend invariant checks.
 *
 * <p><b>R23 expansion</b>: R22 audit C3 found 4 more inline whitelists that R21's
 * commit message falsely claimed were centralized (SalesServiceImpl.createDelivery /
 * .getSalesStatistics, PurchaseServiceImpl.createReceiveRecord, ProductionPlanController
 * .getSelectableSalesOrders). Adding 3 named sets — SO_DELIVERABLE / SO_IN_FLIGHT /
 * PO_OPS_RECEIVABLE — and refactoring those callers.
 *
 * <p>Usage values are stable contract strings exposed via REST query param. New usage
 * categories must add a new key here (preferred over scattered Set.of in callers).
 *
 * <p>Domain semantics:
 * <ul>
 *   <li><b>invoiceable</b> (SO+PO): AR invoice / AP payable can link only to post-finance-approved
 *       orders. Bypassing this skips dual-control approval gate.</li>
 *   <li><b>plannable</b> (SO only): production planning works on confirmed→partial-delivered;
 *       COMPLETED makes no sense (already done) and DRAFT/CANCELLED are pre-confirmation.</li>
 *   <li><b>shippable</b> (SO only, strict): outbound picking gated on finance approval —
 *       new pull-from-stock shipments require finance OK.</li>
 *   <li><b>deliverable</b> (SO only, broader): includes CONFIRMED — the existing
 *       SalesServiceImpl.createDelivery semantic that allows non-finance-gated
 *       deliveries (e.g., consignment, advance shipment). Distinct from shippable
 *       intentionally — DO NOT merge without product-owner sign-off.</li>
 *   <li><b>in_flight</b> (SO only): "still active, not yet completed/cancelled". Used by
 *       sales statistics for "pending delivery" count.</li>
 *   <li><b>receivable</b> (PO only): inbound goods can arrive pre-finance for fast-moving
 *       consumables. Includes PENDING_FINANCE_REVIEW.</li>
 *   <li><b>ops_receivable</b> (PO only): operational receive — APPROVED + FINANCE_APPROVED
 *       + PARTIAL_RECEIVED only. Excludes PENDING_FINANCE_REVIEW (the existing
 *       PurchaseServiceImpl.createReceiveRecord stricter semantic).</li>
 *   <li><b>all</b>: legacy fallback excluding only obviously-invalid states. AVOID in new code —
 *       used only when no specific business semantic applies.</li>
 * </ul>
 *
 * <p><b>R23 audit I4</b>: all whitelists use {@link EnumSet} (bitset-backed,
 * ~10× faster {@code contains} for enums than HashSet from {@code Set.of}).
 */
public final class OrderUsageWhitelists {

    private OrderUsageWhitelists() {}

    /** Strictest SO whitelist — used as fail-secure default. */
    public static final Set<SalesOrderStatus> SO_INVOICEABLE = EnumSet.of(
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED,
            SalesOrderStatus.COMPLETED);

    public static final Set<SalesOrderStatus> SO_SHIPPABLE = EnumSet.of(
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED);

    /** R23 audit C3: SalesServiceImpl.createDelivery — broader than SO_SHIPPABLE (includes CONFIRMED). */
    public static final Set<SalesOrderStatus> SO_DELIVERABLE = EnumSet.of(
            SalesOrderStatus.CONFIRMED,
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED);

    /** R23 audit C3: SalesServiceImpl.getSalesStatistics — "still active in flight" count. */
    public static final Set<SalesOrderStatus> SO_IN_FLIGHT = EnumSet.of(
            SalesOrderStatus.CONFIRMED,
            SalesOrderStatus.PENDING_FINANCE_REVIEW,
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING);

    public static final Set<SalesOrderStatus> SO_PLANNABLE = EnumSet.of(
            SalesOrderStatus.CONFIRMED,
            SalesOrderStatus.PENDING_FINANCE_REVIEW,
            SalesOrderStatus.FINANCE_APPROVED,
            SalesOrderStatus.PROCESSING,
            SalesOrderStatus.PARTIAL_DELIVERED);

    public static final Set<SalesOrderStatus> SO_ALL = EnumSet.complementOf(EnumSet.of(
            SalesOrderStatus.DRAFT,
            SalesOrderStatus.CANCELLED,
            SalesOrderStatus.FINANCE_REJECTED));

    /**
     * R39 BUG-8: states that can be cancelled. Excludes FINANCE_APPROVED+ because
     * downstream (production_plan, AR invoice) is committed; cancellation requires
     * explicit rollback workflow, not a status flip.
     */
    public static final Set<SalesOrderStatus> SO_CANCELLABLE = EnumSet.of(
            SalesOrderStatus.DRAFT,
            SalesOrderStatus.CONFIRMED,
            SalesOrderStatus.PENDING_FINANCE_REVIEW,
            SalesOrderStatus.FINANCE_REJECTED);

    public static final Map<String, Set<SalesOrderStatus>> SO_BY_USAGE = Map.of(
            "invoiceable", SO_INVOICEABLE,
            "shippable", SO_SHIPPABLE,
            "deliverable", SO_DELIVERABLE,
            "in_flight", SO_IN_FLIGHT,
            "plannable", SO_PLANNABLE,
            "cancellable", SO_CANCELLABLE,
            "all", SO_ALL);

    /** Strictest PO whitelist — used as fail-secure default. */
    public static final Set<PurchaseOrderStatus> PO_INVOICEABLE = EnumSet.of(
            PurchaseOrderStatus.FINANCE_APPROVED,
            PurchaseOrderStatus.PARTIAL_RECEIVED,
            PurchaseOrderStatus.COMPLETED,
            PurchaseOrderStatus.CLOSED);

    /** Includes PENDING_FINANCE_REVIEW — fast-moving consumables can receive pre-finance. */
    public static final Set<PurchaseOrderStatus> PO_RECEIVABLE = EnumSet.of(
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PENDING_FINANCE_REVIEW,
            PurchaseOrderStatus.FINANCE_APPROVED,
            PurchaseOrderStatus.PARTIAL_RECEIVED);

    /** R23 audit C3: PurchaseServiceImpl.createReceiveRecord — excludes PENDING_FINANCE_REVIEW. */
    public static final Set<PurchaseOrderStatus> PO_OPS_RECEIVABLE = EnumSet.of(
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.FINANCE_APPROVED,
            PurchaseOrderStatus.PARTIAL_RECEIVED);

    public static final Set<PurchaseOrderStatus> PO_ALL = EnumSet.complementOf(EnumSet.of(
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.CANCELLED,
            PurchaseOrderStatus.FINANCE_REJECTED));

    /**
     * R39 BUG-8: PO states cancellable. Excludes APPROVED+ (downstream supplier
     * commitment), PARTIAL_RECEIVED (inventory partially received, AP posted).
     */
    public static final Set<PurchaseOrderStatus> PO_CANCELLABLE = EnumSet.of(
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.SUBMITTED,
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PENDING_FINANCE_REVIEW,
            PurchaseOrderStatus.FINANCE_REJECTED);

    public static final Map<String, Set<PurchaseOrderStatus>> PO_BY_USAGE = Map.of(
            "invoiceable", PO_INVOICEABLE,
            "receivable", PO_RECEIVABLE,
            "ops_receivable", PO_OPS_RECEIVABLE,
            "cancellable", PO_CANCELLABLE,
            "all", PO_ALL);

    /**
     * R20 audit S1: fail-secure resolver. Unknown/missing usage → strictest (invoiceable),
     * NOT broad fallback. Caller must explicitly opt into 'all' or another permissive Set.
     *
     * <p>R23 audit I3 fix: explicit null guard. {@code Map.of(...).getOrDefault(null, ...)}
     * throws NPE because immutable Maps reject null keys (Java 9+). Pre-R23 R20 had this
     * latent bug — frontend ever sending {@code ?usage=} (empty/missing) would 500 instead
     * of falling back. R23 OrderUsageWhitelistsTest caught this.
     */
    public static Set<SalesOrderStatus> resolveSO(String usage) {
        if (usage == null) return SO_INVOICEABLE;
        return SO_BY_USAGE.getOrDefault(usage, SO_INVOICEABLE);
    }

    public static Set<PurchaseOrderStatus> resolvePO(String usage) {
        if (usage == null) return PO_INVOICEABLE;
        return PO_BY_USAGE.getOrDefault(usage, PO_INVOICEABLE);
    }
}
