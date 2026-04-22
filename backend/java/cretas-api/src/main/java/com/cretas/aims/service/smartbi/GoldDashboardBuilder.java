package com.cretas.aims.service.smartbi;

import com.cretas.aims.client.GoldFinanceClient;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.KPICard;
import com.cretas.aims.dto.smartbi.RankingItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared helper that converts Python Gold `/api/smartbi/gold/finance-summary`
 * output into the legacy DashboardResponse shape.
 *
 * Both FinanceAnalysisServiceImpl.getFinanceOverview and
 * SalesAnalysisServiceImpl.getSalesOverview inject this bean, gate on the
 * same `smartbi.gold.read-primary.enabled` flag, and fall back to legacy
 * on any failure.
 *
 * Coverage today:
 *   - KPI cards: 总营收 / 账单数 / 客单价 / 门店数 (from finance_summary)
 *   - Rankings: top_stores (from finance_summary.top_stores)
 *   - Charts, AI insights, suggestions: empty (Gold doesn't emit those
 *     yet — will extend as Silver captures more metrics)
 *
 * Null-return contract: returns null when Gold reports zero bills AND
 * zero revenue (new tenant, no Silver data yet). Caller should fall
 * through to legacy rather than show a blank dashboard.
 *
 * @since 2026-04-22
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoldDashboardBuilder {

    private static final int DISPLAY_SCALE = 2;
    private static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    private final GoldFinanceClient goldFinanceClient;

    /**
     * Call Python Gold finance-summary and convert to DashboardResponse.
     * Returns null when the Gold response has no meaningful data (revenue=0
     * AND bills=0) so the caller can fall back to legacy.
     */
    public DashboardResponse buildFromFinanceSummary(
            String factoryId, LocalDate startDate, LocalDate endDate) throws IOException {
        Map<String, Object> gold = goldFinanceClient.fetchFinanceSummary(
                factoryId, startDate, endDate, 10);

        BigDecimal revenue = toBigDecimal(gold.get("total_revenue"));
        BigDecimal bills = toBigDecimal(gold.get("bill_count"));
        BigDecimal avgBill = toBigDecimal(gold.get("avg_bill_value"));
        BigDecimal stores = toBigDecimal(gold.get("store_count"));

        if (revenue.signum() == 0 && bills.signum() == 0) {
            log.info("[gold-builder] factory={} range={}..{} empty Gold → null (legacy fallback)",
                    factoryId, startDate, endDate);
            return null;
        }

        List<KPICard> kpiCards = new ArrayList<>();
        kpiCards.add(KPICard.builder()
                .key("total_revenue").title("总营收")
                .value(formatKpiValue(revenue, "元")).rawValue(revenue).unit("元")
                .status("green").build());
        kpiCards.add(KPICard.builder()
                .key("bill_count").title("账单数")
                .value(formatKpiValue(bills, "单")).rawValue(bills).unit("单")
                .status("green").build());
        kpiCards.add(KPICard.builder()
                .key("avg_bill_value").title("客单价")
                .value(formatKpiValue(avgBill, "元")).rawValue(avgBill).unit("元")
                .status("green").build());
        kpiCards.add(KPICard.builder()
                .key("store_count").title("门店数")
                .value(formatKpiValue(stores, "家")).rawValue(stores).unit("家")
                .status("green").build());

        List<RankingItem> topStores = new ArrayList<>();
        Object topStoresRaw = gold.get("top_stores");
        if (topStoresRaw instanceof List) {
            int rank = 1;
            for (Object item : (List<?>) topStoresRaw) {
                if (!(item instanceof Map)) continue;
                Map<?, ?> store = (Map<?, ?>) item;
                topStores.add(RankingItem.builder()
                        .rank(rank++)
                        .name(String.valueOf(store.get("store_name")))
                        .value(toBigDecimal(store.get("revenue")))
                        .build());
            }
        }
        Map<String, List<RankingItem>> rankings = new LinkedHashMap<>();
        rankings.put("top_stores", topStores);

        return DashboardResponse.builder()
                .kpiCards(kpiCards)
                .charts(new LinkedHashMap<>())
                .rankings(rankings)
                .aiInsights(new ArrayList<>())
                .suggestions(new ArrayList<>())
                .lastUpdated(LocalDateTime.now())
                .build();
    }

    /** Tolerant Number → BigDecimal. */
    static BigDecimal toBigDecimal(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal) return (BigDecimal) v;
        if (v instanceof Number) return new BigDecimal(v.toString());
        try {
            return new BigDecimal(String.valueOf(v));
        } catch (NumberFormatException nfe) {
            return BigDecimal.ZERO;
        }
    }

    static String formatKpiValue(BigDecimal v, String unit) {
        if ("元".equals(unit)) {
            return v.setScale(DISPLAY_SCALE, ROUNDING_MODE).toPlainString();
        }
        return v.setScale(0, ROUNDING_MODE).toPlainString();
    }
}
