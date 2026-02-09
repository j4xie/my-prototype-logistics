package com.cretas.aims.service;

import com.cretas.aims.dto.ai.IntentExecuteResponse;

/**
 * 结果格式化服务接口
 * 将意图执行的 resultData 转换为用户友好的自然语言文本
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface ResultFormatterService {

    /**
     * 格式化意图执行响应
     * 根据意图类型和执行结果，生成人类可读的文本摘要
     *
     * @param response 意图执行响应
     * @return 格式化后的文本，如果无法格式化则返回 null
     */
    String format(IntentExecuteResponse response);

    /**
     * 格式化并设置到响应对象
     * 便捷方法，直接将格式化结果设置到 response.formattedText
     *
     * @param response 意图执行响应（会被修改）
     * @return 同一个响应对象，已设置 formattedText
     */
    default IntentExecuteResponse formatAndSet(IntentExecuteResponse response) {
        if (response != null) {
            String formatted = format(response);
            if (formatted != null && !formatted.isEmpty()) {
                response.setFormattedText(formatted);
            }
        }
        return response;
    }
}
