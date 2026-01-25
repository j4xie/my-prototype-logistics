package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 预测请求 DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonForecastRequest {

    /**
     * 历史数据 (时序数据)
     */
    private List<Double> data;

    /**
     * 时间标签列表 (与 data 对应)
     */
    private List<String> timeLabels;

    /**
     * 预测算法
     * - linear: 线性回归
     * - exponential: 指数平滑
     * - arima: ARIMA 模型
     * - prophet: Prophet 模型 (需要 Python 端安装)
     * - holtwinters: Holt-Winters 季节性模型
     */
    @Builder.Default
    private String algorithm = "exponential";

    /**
     * 预测周期数
     */
    @Builder.Default
    private Integer periods = 6;

    /**
     * 时间粒度 (day, week, month, quarter, year)
     */
    @Builder.Default
    private String granularity = "month";

    /**
     * 季节性周期 (用于 Holt-Winters)
     */
    private Integer seasonalPeriod;

    /**
     * 置信区间 (0-1)
     */
    @Builder.Default
    private Double confidenceLevel = 0.95;

    /**
     * 是否返回置信区间
     */
    @Builder.Default
    private Boolean includeConfidenceInterval = true;

    /**
     * 外部特征 (用于多变量预测)
     */
    private Map<String, List<Double>> externalFeatures;

    /**
     * 异常值处理方式 (none, clip, interpolate)
     */
    @Builder.Default
    private String outlierHandling = "clip";
}
