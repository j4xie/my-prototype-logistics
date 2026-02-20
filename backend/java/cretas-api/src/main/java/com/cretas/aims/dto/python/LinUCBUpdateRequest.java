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
public class LinUCBUpdateRequest {
    private List<List<Double>> matrixA;
    private List<Double> vectorB;
    private List<Double> context;
    private Double reward;
}
