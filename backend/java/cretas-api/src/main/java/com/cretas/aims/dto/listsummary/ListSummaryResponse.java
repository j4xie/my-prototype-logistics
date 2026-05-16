package com.cretas.aims.dto.listsummary;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Sprint 2 Track I — U-FOOTER-1.
 * Response body for POST /api/mobile/{factoryId}/list-summary/{entityType}.
 * Frontend (RN StickyFooterSummary + Vue TableFooter) renders stats array
 * directly and applies its own canViewPrice gate (defense-in-depth — backend
 * also strips price values for non-PRICE_VIEW_ROLES via @PriceSensitive).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ListSummaryResponse {

    private String entityType;

    private List<SummaryStat> stats;

    private Pagination pagination;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SummaryStat {
        /** Display label, e.g. "共" / "总金额" / "损耗率" */
        private String label;
        /** Numeric or pre-formatted string */
        private Object value;
        /** "currency" | "number" | "percent" | "plain" */
        private String format;
        /** Optional suffix ("条" / "%" / "¥") */
        private String unit;
        /** True = price-related; frontend hides for warehouse_manager etc */
        private Boolean canViewPrice;
        /** "up" | "down" | "flat" — optional */
        private String trend;
        /** Optional delta value paired with trend */
        private Number trendDelta;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Pagination {
        private int currentPage;
        private int totalPages;
        private int pageSize;
        private long totalItems;
    }
}
