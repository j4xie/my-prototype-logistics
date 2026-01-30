package com.cretas.aims.service;

import com.cretas.aims.dto.ai.AnalysisContext;
import com.cretas.aims.dto.ai.AnalysisResult;

/**
 * Agent 编排服务接口
 *
 * 协调多个 Agent 完成复杂分析任务。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface AgentOrchestrator {

    /**
     * 执行多 Agent 协作分析
     *
     * @param context 分析上下文
     * @return 分析结果
     */
    AnalysisResult executeCollaborativeAnalysis(AnalysisContext context);

    /**
     * 检查是否需要多 Agent 协作
     *
     * @param context 分析上下文
     * @return true 如果需要多 Agent 协作
     */
    boolean requiresMultiAgentCollaboration(AnalysisContext context);
}
