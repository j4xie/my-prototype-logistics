package com.cretas.aims.service;

import java.util.List;

/**
 * Embedding 客户端接口
 * 调用 Python Sentence-BERT 服务生成文本向量
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-05
 */
public interface EmbeddingClient {

    /**
     * 对单个文本进行向量化
     *
     * @param text 输入文本
     * @return 384 维 float 向量
     * @throws EmbeddingException 如果向量化失败
     */
    float[] encode(String text);

    /**
     * 批量向量化
     *
     * @param texts 文本列表
     * @return 向量列表，与输入顺序一致
     * @throws EmbeddingException 如果向量化失败
     */
    List<float[]> encodeBatch(List<String> texts);

    /**
     * 计算两个文本的语义相似度
     *
     * @param text1 文本1
     * @param text2 文本2
     * @return 余弦相似度 (0-1)
     * @throws EmbeddingException 如果计算失败
     */
    double computeSimilarity(String text1, String text2);

    /**
     * 在候选集中查找最相似的文本
     *
     * @param query 查询文本
     * @param candidates 候选文本列表
     * @param threshold 相似度阈值
     * @param topK 最多返回数量
     * @return 匹配结果列表
     * @throws EmbeddingException 如果查找失败
     */
    List<SimilarityResult> findSimilar(String query, List<String> candidates,
                                        double threshold, int topK);

    /**
     * 检查服务是否可用
     *
     * @return 是否可用
     */
    boolean isAvailable();

    /**
     * 获取向量维度
     *
     * @return 向量维度 (通常为 384)
     */
    int getDimension();

    /**
     * 获取模型名称
     *
     * @return 模型名称 (如 "gte-base-zh")
     */
    String getModelName();

    /**
     * 相似度匹配结果
     */
    interface SimilarityResult {
        int getIndex();
        String getText();
        double getScore();
    }

    /**
     * Embedding 服务异常
     */
    class EmbeddingException extends RuntimeException {
        public EmbeddingException(String message) {
            super(message);
        }

        public EmbeddingException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
