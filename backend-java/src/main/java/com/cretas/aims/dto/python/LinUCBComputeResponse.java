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
public class LinUCBComputeResponse {
    private boolean success;
    private Double ucb;
    private Double expectedReward;
    private Double confidenceWidth;
    private List<Double> theta;
    private String error;
}
