package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Python 字段检测请求 DTO
 *
 * 用于发送样本数据到 Python 服务进行字段类型检测
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonFieldDetectionRequest {

    /**
     * 样本数据 (每行是一个 Map)
     */
    private List<Map<String, Object>> sampleData;

    /**
     * 表头列表
     */
    private List<String> headers;

    /**
     * 数据类型提示 (可选，帮助 AI 更准确识别)
     */
    private String dataTypeHint;

    /**
     * 是否使用 LLM 辅助检测
     */
    @Builder.Default
    private Boolean useLLM = false;

    /**
     * 最大样本行数
     */
    @Builder.Default
    private Integer maxSampleRows = 100;
}
