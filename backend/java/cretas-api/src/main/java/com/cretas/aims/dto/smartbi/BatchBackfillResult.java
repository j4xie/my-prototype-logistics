package com.cretas.aims.dto.smartbi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Batch backfill result DTO.
 * AUDIT-086: Extracted from SmartBIController inner class.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchBackfillResult {
    private int totalProcessed;
    private int successCount;
    private int skippedCount;
    private int failedCount;
    private List<BackfillResult> details;
}
