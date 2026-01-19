package com.cretas.aims.service;

import com.cretas.aims.dto.ai.ProcessingMode;

/**
 * 复杂度分类器接口
 *
 * 基于 GTE embedding + 分类器的复杂度检测方案
 * 替代 LLM API 调用，实现低成本高效率的复杂度判断
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface ComplexityClassifier {

    /**
     * 预测查询的复杂度等级
     *
     * @param userInput 用户输入
     * @return 处理模式
     */
    ProcessingMode predict(String userInput);

    /**
     * 预测查询的复杂度分数
     *
     * @param userInput 用户输入
     * @return 复杂度分数 (0.0-1.0)
     */
    double predictScore(String userInput);

    /**
     * 获取各等级的概率分布
     *
     * @param userInput 用户输入
     * @return 各等级的概率 [P(level1), P(level2), ..., P(level5)]
     */
    double[] predictProbabilities(String userInput);

    /**
     * 检查分类器是否已训练
     *
     * @return 是否已训练
     */
    boolean isTrained();

    /**
     * 重新加载模型
     */
    void reload();
}
