package com.cretas.aims.service;

import com.cretas.aims.dto.ai.ProcessingMode;

/**
 * 小语言模型复杂度检测器接口
 *
 * Phase 2 实现：使用轻量级 LLM 判断查询复杂度
 * 用于处理规则难以判断的边界情况
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface SmallLlmComplexityDetector {

    /**
     * 使用 LLM 检测查询复杂度等级
     *
     * @param userInput 用户输入
     * @return 处理模式 (FAST/ANALYSIS/MULTI_AGENT/DEEP_REASONING)
     */
    ProcessingMode detectComplexity(String userInput);

    /**
     * 使用 LLM 检测查询复杂度分数
     *
     * @param userInput 用户输入
     * @return 复杂度分数 (0.0-1.0)
     */
    double detectComplexityScore(String userInput);

    /**
     * 检查服务是否可用
     *
     * @return 是否可用
     */
    boolean isAvailable();
}
