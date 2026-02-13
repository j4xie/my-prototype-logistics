package com.cretas.aims.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KPIItem {
    private String key;
    private String label;
    private Double value;
    private String unit;
    private Double change;      // 环比变化百分比
    private String changeType;  // "up" | "down" | "flat"
    private String gradient;    // 渐变色标识: "purple" | "pink" | "blue" | "green"
}
