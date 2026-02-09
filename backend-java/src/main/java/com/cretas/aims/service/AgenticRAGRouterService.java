package com.cretas.aims.service;

import com.cretas.aims.dto.ai.ConsultationType;
import com.cretas.aims.dto.ai.RAGRouteResult;

/**
 * Agentic RAG 路由服务接口
 *
 * 用于对 GENERAL_QUESTION 类型的咨询进行细分路由。
 * 核心职责：
 * 1. 检测咨询类型（知识库检索/网络搜索/追溯查询/通用）
 * 2. 提取相关参数（如批次号、产品名等）
 * 3. 返回路由决策结果
 *
 * 路由逻辑：
 * - KNOWLEDGE_SEARCH: 调用向量知识库检索标准、规范、流程等
 * - WEB_SEARCH: 调用网络搜索获取最新行情、政策等
 * - TRACEABILITY: 转换为业务意图执行追溯查询
 * - GENERAL: 直接调用 LLM 生成对话式回复
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface AgenticRAGRouterService {

    /**
     * 路由咨询请求
     *
     * 分析用户输入，确定最适合的处理路径。
     *
     * @param userInput 用户输入的咨询内容
     * @return 路由结果，包含咨询类型、建议意图、置信度等
     */
    RAGRouteResult route(String userInput);

    /**
     * 检测咨询类型
     *
     * 基于关键词匹配和语义分析确定咨询类型。
     *
     * @param userInput 用户输入
     * @return 检测到的咨询类型
     */
    ConsultationType detectConsultationType(String userInput);

    /**
     * 执行知识库检索
     *
     * 对于 KNOWLEDGE_SEARCH 类型的咨询，执行向量知识库检索。
     *
     * @param userInput 用户输入
     * @param routeResult 路由结果
     * @return 检索结果文本
     */
    String executeKnowledgeSearch(String userInput, RAGRouteResult routeResult);

    /**
     * 执行网络搜索
     *
     * 对于 WEB_SEARCH 类型的咨询，执行网络搜索。
     * 注意：当前版本可能返回占位符响应，待集成搜索 API。
     *
     * @param userInput 用户输入
     * @param routeResult 路由结果
     * @return 搜索结果文本
     */
    String executeWebSearch(String userInput, RAGRouteResult routeResult);

    /**
     * 提取追溯参数
     *
     * 从用户输入中提取追溯相关参数（批次号、产品名等）。
     *
     * @param userInput 用户输入
     * @return 提取的参数映射
     */
    java.util.Map<String, String> extractTraceabilityParams(String userInput);

    /**
     * 生成建议的搜索查询
     *
     * 基于用户输入优化搜索查询语句。
     *
     * @param userInput 用户输入
     * @param consultationType 咨询类型
     * @return 优化后的搜索查询
     */
    String generateSearchQuery(String userInput, ConsultationType consultationType);
}
