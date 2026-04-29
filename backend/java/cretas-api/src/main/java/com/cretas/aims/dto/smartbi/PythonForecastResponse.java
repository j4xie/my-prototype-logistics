package com.cretas.aims.dto.smartbi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python /api/forecast/predict 响应 DTO
 *
 * 严格对应 backend/python/smartbi/api/forecast.py 中的 ForecastResponse (line 31-43)。
 * 由 PythonSmartBIClient.forecastWithData() 使用,经 ObjectMapper 反序列化。
 *
 * @since 2026-04-17 (方案 E hotfix)
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PythonForecastResponse {
    private boolean success;
    private String algorithm;
    private Integer inputLength;
    private Integer forecastPeriods;
    private List<Double> predictions;
    private List<Double> lowerBound;
    private List<Double> upperBound;
    private Map<String, Object> parameters;
    private String selectedAlgorithm;
    private Double validationError;
    private String error;
}
