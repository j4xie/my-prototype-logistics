package com.cretas.aims.dto.listsummary;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Sprint 2 Track I — U-FOOTER-1.
 * Request body for POST /api/mobile/{factoryId}/list-summary/{entityType}.
 * Filter conditions mirror the entity-list endpoint's filter shape so the
 * footer totals reflect exactly what the user is looking at.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ListSummaryRequest {

    /** Same shape as the list-endpoint filter — e.g. {"status": "APPROVED", "customerId": "C001"}. */
    private Map<String, Object> filterConditions;

    /** Optional projection: only compute these stat fields. Null/empty = all defaults for the entity. */
    private List<String> fields;

    private LocalDate dateFrom;

    private LocalDate dateTo;
}
