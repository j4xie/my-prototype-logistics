package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 权重调整响应 DTO
 */
@Data
public class WeightAdjustmentResponse {
    private LocalDateTime adjustedAt;
    private Map<String, Double> previousWeights;
    private Map<String, Double> newWeights;
    private String reason;
}
