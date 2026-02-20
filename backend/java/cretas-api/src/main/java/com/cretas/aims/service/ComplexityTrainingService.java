package com.cretas.aims.service;

import java.util.List;
import java.util.Map;

/**
 * 复杂度分类器训练服务接口
 *
 * 功能：
 * 1. 使用 Qwen Max 生成标注训练数据
 * 2. 训练 Softmax 分类器
 * 3. 保存/加载模型权重
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface ComplexityTrainingService {

    /**
     * 训练样本
     */
    record TrainingSample(String text, int level) {}

    /**
     * 使用 Qwen Max 生成训练数据
     *
     * @param samplesPerLevel 每个等级生成的样本数
     * @return 生成的训练样本列表
     */
    List<TrainingSample> generateTrainingData(int samplesPerLevel);

    /**
     * 训练分类器
     *
     * @param samples 训练样本
     * @return 训练后的模型 (weights + biases)
     */
    Map<String, Object> train(List<TrainingSample> samples);

    /**
     * 保存模型到文件
     *
     * @param model 模型参数
     * @param path 保存路径
     */
    void saveModel(Map<String, Object> model, String path);

    /**
     * 完整训练流程：生成数据 -> 训练 -> 保存
     *
     * @param samplesPerLevel 每个等级的样本数
     * @param modelPath 模型保存路径
     */
    void trainAndSave(int samplesPerLevel, String modelPath);

    /**
     * 从 JSON 文件加载训练数据
     *
     * @param filePath 训练数据文件路径
     * @return 训练样本列表
     */
    List<TrainingSample> loadTrainingDataFromFile(String filePath);
}
