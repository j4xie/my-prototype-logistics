package com.cretas.aims.service;

import com.cretas.aims.dto.intent.MultiIntentResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;

/**
 * 多标签意图分类器接口
 *
 * 基于 Sigmoid 的多标签意图分类：
 * 1. 将用户输入转为向量 (已有 EmbeddingService)
 * 2. 与所有意图向量计算余弦相似度
 * 3. Sigmoid 归一化为 0-1 概率
 * 4. 阈值筛选 (default: 0.6)
 *
 * 优势：
 * - 不依赖连接词，基于语义相似度
 * - 每个意图独立评分，互不影响
 * - 阈值可配置，可根据场景调优
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
public interface MultiLabelIntentClassifier {

    /**
     * 多标签意图分类
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @return 多意图分类结果
     */
    MultiIntentResult classifyMultiLabel(String userInput, String factoryId);

    /**
     * 多标签意图分类（自定义阈值）
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @param threshold 置信度阈值 (0.0 - 1.0)
     * @return 多意图分类结果
     */
    MultiIntentResult classifyMultiLabel(String userInput, String factoryId, double threshold);

    /**
     * 获取单个意图的相似度评分
     *
     * @param userInput 用户输入
     * @param intent 意图配置
     * @return 相似度评分 (0.0 - 1.0)
     */
    double computeIntentScore(String userInput, AIIntentConfig intent);

    /**
     * 获取所有意图的相似度评分（用于调试）
     *
     * @param userInput 用户输入
     * @param factoryId 工厂ID
     * @return 所有意图及其评分
     */
    List<ScoredIntent> getAllIntentScores(String userInput, String factoryId);

    /**
     * 评分意图结果
     */
    interface ScoredIntent {
        AIIntentConfig getIntent();
        double getRawSimilarity();
        double getSigmoidScore();
    }

    /**
     * 获取默认阈值
     *
     * @return 默认阈值
     */
    double getDefaultThreshold();

    /**
     * 检查服务是否可用
     *
     * @return 是否可用
     */
    boolean isAvailable();
}
