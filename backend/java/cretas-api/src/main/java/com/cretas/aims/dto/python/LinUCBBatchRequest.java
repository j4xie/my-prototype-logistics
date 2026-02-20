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
public class LinUCBBatchRequest {
    private List<List<List<Double>>> matrixAList;
    private List<List<Double>> vectorBList;
    private List<Double> context;
    @Builder.Default
    private Double alpha = 0.5;
}
