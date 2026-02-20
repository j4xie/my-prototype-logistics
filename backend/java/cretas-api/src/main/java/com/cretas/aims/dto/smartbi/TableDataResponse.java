package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Table data response DTO for upload data preview.
 * AUDIT-086: Extracted from SmartBIController inner class.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TableDataResponse {
    private List<String> headers;
    private List<Map<String, Object>> data;
    private long total;
    private int page;
    private int size;
    private int totalPages;
}
