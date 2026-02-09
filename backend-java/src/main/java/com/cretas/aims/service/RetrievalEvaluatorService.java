package com.cretas.aims.service;

import com.cretas.aims.dto.ai.RetrievalQualityScore;

import java.util.List;
import java.util.Map;

/**
 * 检索评估服务接口 (CRAG 核心)
 *
 * 评估检索结果的质量并决定后续处理方式。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface RetrievalEvaluatorService {

    /**
     * 评估检索结果质量
     *
     * @param query 用户查询
     * @param retrievalResults 检索结果列表
     * @return 质量评分 (CORRECT/AMBIGUOUS/INCORRECT)
     */
    RetrievalQualityScore evaluateRetrieval(String query, List<Map<String, Object>> retrievalResults);

    /**
     * 计算检索结果与查询的相关性分数
     *
     * @param query 用户查询
     * @param result 单个检索结果
     * @return 相关性分数 (0-1)
     */
    double calculateRelevanceScore(String query, Map<String, Object> result);

    /**
     * 知识分解：将文档分解为语义单元
     *
     * @param content 文档内容
     * @return 语义单元列表
     */
    List<String> decomposeToKnowledgeStrips(String content);

    /**
     * 过滤相关的知识片段
     *
     * @param query 用户查询
     * @param strips 知识片段列表
     * @return 过滤后的相关片段
     */
    List<String> filterRelevantStrips(String query, List<String> strips);
}
