package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 批量意图分类响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassifierBatchResponse {

    /**
     * 是否成功
     */
    private boolean success;

    /**
     * 结果数量
     */
    private int count;

    /**
     * 分类结果列表
     */
    private List<ClassifierResponse> results;

    /**
     * 错误消息（仅在失败时）
     */
    private String message;
}
