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
public class LinUCBUpdateResponse {
    private boolean success;
    private List<List<Double>> matrixA;
    private List<List<Double>> matrixAInverse;
    private List<Double> vectorB;
    private String error;
}
