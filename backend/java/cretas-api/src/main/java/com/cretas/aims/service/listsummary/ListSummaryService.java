package com.cretas.aims.service.listsummary;

import com.cretas.aims.dto.listsummary.ListSummaryRequest;
import com.cretas.aims.dto.listsummary.ListSummaryResponse;

/**
 * Sprint 2 Track I — U-FOOTER-1.
 * Computes aggregate stats (sum/count/avg) for a single entity list,
 * filtered by the same conditions as the list endpoint, for display in
 * the sticky footer of RN/Vue list pages.
 *
 * Day 2 ships 5 entity types (salesOrder/purchaseOrder/inventory/wastage/attendance).
 * Sprint 3+ extends per organizer ask.
 */
public interface ListSummaryService {

    /**
     * @param factoryId  tenant scope
     * @param entityType e.g. "salesOrder", "purchaseOrder", "inventory", "wastage", "attendance"
     * @param request    filter conditions + date range
     * @return aggregated stats list ready to render
     * @throws IllegalArgumentException if entityType is not supported
     */
    ListSummaryResponse computeSummary(String factoryId, String entityType, ListSummaryRequest request);
}
