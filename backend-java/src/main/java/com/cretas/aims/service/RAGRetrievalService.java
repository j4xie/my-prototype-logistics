package com.cretas.aims.service;

import java.util.List;
import java.util.Optional;

/**
 * RAG 检索服务接口
 * 用于检索历史相似案例，增强意图识别
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-23
 */
public interface RAGRetrievalService {

    /**
     * 检索相似历史案例用于候选补充
     *
     * @param factoryId     工厂ID
     * @param userInput     用户输入
     * @param topK          返回数量
     * @param minSimilarity 最低相似度阈值
     * @return RAG 候选结果列表
     */
    List<RAGCandidate> retrieveSimilarCases(String factoryId, String userInput, int topK, double minSimilarity);

    /**
     * 获取 Few-Shot 示例用于 LLM 增强
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param count     示例数量
     * @return Few-Shot 示例列表
     */
    List<RAGExample> getFewShotExamples(String factoryId, String userInput, int count);

    /**
     * 查找可直接复用的高置信历史
     *
     * @param factoryId     工厂ID
     * @param userInput     用户输入
     * @param minConfidence 最低置信度
     * @return 直接匹配结果
     */
    Optional<RAGCandidate> findDirectMatch(String factoryId, String userInput, double minConfidence);

    /**
     * 检查是否有相关历史
     *
     * @param factoryId 工厂ID
     * @param userInput 用户输入
     * @param threshold 相似度阈值
     * @return 是否有相关历史
     */
    boolean hasRelevantHistory(String factoryId, String userInput, double threshold);

    /**
     * RAG 候选结果
     */
    interface RAGCandidate {
        /**
         * 获取用户输入
         */
        String getUserInput();

        /**
         * 获取意图代码
         */
        String getIntentCode();

        /**
         * 获取置信度
         */
        double getConfidence();

        /**
         * 获取相似度
         */
        double getSimilarity();

        /**
         * 获取来源
         * @return LEARNED_EXPRESSION, MATCH_RECORD, USER_CONFIRMED
         */
        String getSource();
    }

    /**
     * Few-Shot 示例
     */
    interface RAGExample {
        /**
         * 获取用户输入
         */
        String getUserInput();

        /**
         * 获取意图代码
         */
        String getIntentCode();

        /**
         * 获取意图名称
         */
        String getIntentName();
    }
}
