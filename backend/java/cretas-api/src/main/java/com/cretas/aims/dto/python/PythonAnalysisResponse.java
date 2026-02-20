package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Python 分析服务响应 DTO
 *
 * 用于接收 Python SmartBI 分析服务的响应结果
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-25
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PythonAnalysisResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 分析结果数据
     */
    private Map<String, Object> data;

    /**
     * 错误信息
     */
    private String error;

    /**
     * 检查响应是否有效
     */
    public boolean isValid() {
        return success && data != null;
    }

    /**
     * 获取指定 key 的数据
     */
    @SuppressWarnings("unchecked")
    public <T> T get(String key) {
        if (data == null) {
            return null;
        }
        return (T) data.get(key);
    }

    /**
     * 获取指定 key 的数据，带默认值
     */
    @SuppressWarnings("unchecked")
    public <T> T get(String key, T defaultValue) {
        if (data == null) {
            return defaultValue;
        }
        Object value = data.get(key);
        return value != null ? (T) value : defaultValue;
    }
}
