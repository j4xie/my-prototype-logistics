package com.cretas.aims.dto.python;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 意图分类请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassifierRequest {

    /**
     * 待分类文本
     */
    private String text;

    /**
     * 返回 top-k 个结果
     */
    @Builder.Default
    private int topK = 3;

    /**
     * 批量分类的文本列表
     */
    private List<String> texts;

    /**
     * 创建单条分类请求
     */
    public static ClassifierRequest of(String text) {
        return ClassifierRequest.builder()
                .text(text)
                .topK(3)
                .build();
    }

    /**
     * 创建单条分类请求（指定 top-k）
     */
    public static ClassifierRequest of(String text, int topK) {
        return ClassifierRequest.builder()
                .text(text)
                .topK(topK)
                .build();
    }

    /**
     * 创建批量分类请求
     */
    public static ClassifierRequest ofBatch(List<String> texts) {
        return ClassifierRequest.builder()
                .texts(texts)
                .topK(1)
                .build();
    }

    /**
     * 创建批量分类请求（指定 top-k）
     */
    public static ClassifierRequest ofBatch(List<String> texts, int topK) {
        return ClassifierRequest.builder()
                .texts(texts)
                .topK(topK)
                .build();
    }
}
