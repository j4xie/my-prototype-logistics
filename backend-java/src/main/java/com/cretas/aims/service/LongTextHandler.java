package com.cretas.aims.service;

/**
 * 长文本处理服务接口
 *
 * 用于在意图分类前处理超长文本输入：
 * 1. 停用词移除 - 减少无意义词汇
 * 2. 意图摘要 - 使用 LLM 提取核心意图
 *
 * 解决问题：超长句子（>300字）导致 LLM 调用超时（默认 30s readTimeout）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface LongTextHandler {

    /**
     * 处理长文本以优化意图识别
     *
     * 处理流程：
     * 1. 检查缓存，避免重复处理
     * 2. 移除中文停用词（可选）
     * 3. 如果仍超过阈值，调用 LLM 生成摘要
     * 4. 缓存处理结果
     *
     * @param input 用户原始输入
     * @return 处理后的文本（适合意图分类）
     */
    String processForIntent(String input);

    /**
     * 针对意图分类场景的摘要方法
     *
     * 使用 qwen-turbo（correctionModel）快速摘要：
     * - 提取核心意图动词（查询、创建、更新、删除等）
     * - 保留关键实体（批次号、时间、数量、供应商等）
     * - 摘要长度控制在配置的最大长度以内
     *
     * @param input 用户原始输入
     * @return 意图摘要文本
     */
    String summarizeForIntent(String input);

    /**
     * 移除中文停用词
     *
     * @param input 原始文本
     * @return 移除停用词后的文本
     */
    String removeStopwords(String input);

    /**
     * 检查输入是否需要长文本处理
     *
     * @param input 用户输入
     * @return true 如果输入长度超过阈值
     */
    boolean needsProcessing(String input);

    /**
     * 获取处理统计信息
     *
     * @return 统计信息字符串
     */
    String getStats();

    /**
     * 清空摘要缓存
     */
    void clearCache();
}
