package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 分析服务请求 DTO
 *
 * 用于调用 Python SmartBI 分析服务的通用请求结构
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonAnalysisRequest {

    /**
     * 分析数据
     */
    private List<Map<String, Object>> data;

    /**
     * 周期类型 (day, week, month, quarter, year)
     */
    private String periodType;

    /**
     * 排名数量
     */
    private Integer topN;

    /**
     * 第一年 (用于对比分析)
     */
    private Integer year1;

    /**
     * 第二年 (用于对比分析)
     */
    private Integer year2;

    /**
     * 字段映射
     */
    private Map<String, String> fieldMapping;

    /**
     * 便捷构造方法：仅数据
     */
    public static PythonAnalysisRequest of(List<Map<String, Object>> data) {
        return PythonAnalysisRequest.builder()
                .data(data)
                .build();
    }

    /**
     * 便捷构造方法：数据 + 周期
     */
    public static PythonAnalysisRequest of(List<Map<String, Object>> data, String periodType) {
        return PythonAnalysisRequest.builder()
                .data(data)
                .periodType(periodType)
                .build();
    }

    /**
     * 便捷构造方法：数据 + 排名数量
     */
    public static PythonAnalysisRequest ofRanking(List<Map<String, Object>> data, int topN) {
        return PythonAnalysisRequest.builder()
                .data(data)
                .topN(topN)
                .build();
    }
}
