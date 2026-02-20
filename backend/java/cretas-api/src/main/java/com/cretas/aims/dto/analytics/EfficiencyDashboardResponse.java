package com.cretas.aims.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EfficiencyDashboardResponse {
    private List<KPIItem> kpis;
    private List<Map<String, Object>> workerRanking;
    private List<Map<String, Object>> dailyTrend;
    private List<Map<String, Object>> hoursByProduct;
    private List<Map<String, Object>> workerProcessCross;
}
