package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LinUCBBatchResponse {
    private boolean success;
    private List<LinUCBComputeResponse> results;
    private Integer totalWorkers;
    private Integer successCount;
    private String error;
}
