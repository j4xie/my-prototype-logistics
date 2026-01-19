package com.cretas.aims.service;

import com.cretas.aims.config.IntentKnowledgeBase.QuestionType;
import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisResult;
import com.cretas.aims.dto.ai.AnalysisTopic;

/**
 * 分析路由服务接口
 *
 * 用于处理 GENERAL_QUESTION 类型的业务分析请求。
 * 当用户询问"产品状态怎么样"等问题时，该服务会：
 * 1. 检测是否为分析请求
 * 2. 确定分析主题
 * 3. 调用相关工具获取数据
 * 4. 结合行业知识生成分析报告
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface AnalysisRouterService {

    /**
     * 检测是否为分析请求
     *
     * 条件：
     * 1. 问题类型为 GENERAL_QUESTION
     * 2. 包含业务关键词（产品、库存、质检等）
     * 3. 包含分析类词汇（怎么样、状态、情况等）
     *
     * @param userInput 用户输入
     * @param questionType 问题类型
     * @return true 如果是分析请求
     */
    boolean isAnalysisRequest(String userInput, QuestionType questionType);

    /**
     * 确定分析主题
     *
     * 根据用户输入中的关键词确定分析的业务领域。
     *
     * @param userInput 用户输入
     * @return 分析主题
     */
    AnalysisTopic detectAnalysisTopic(String userInput);

    /**
     * 执行分析流程
     *
     * 1. 确定需要调用的工具
     * 2. 并行执行工具获取数据
     * 3. 融合行业知识
     * 4. 生成分析报告
     *
     * @param context 分析上下文
     * @return 分析结果
     */
    AnalysisResult executeAnalysis(AnalysisContext context);
}
