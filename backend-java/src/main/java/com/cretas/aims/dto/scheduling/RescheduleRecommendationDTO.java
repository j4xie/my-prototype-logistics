package com.cretas.aims.dto.scheduling;

import lombok.Data;

import java.util.List;

/**
 * 重排建议 DTO
 */
@Data
public class RescheduleRecommendationDTO {
    private boolean needReschedule;
    private String urgencyLevel;
    private List<String> reasons;
    private List<String> affectedTaskIds;
    private int estimatedImprovementMinutes;
    private double expectedOnTimeRateImprovement;
}
