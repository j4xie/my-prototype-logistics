package com.cretas.aims.service.calibration;

import java.util.Map;

/**
 * 纠错 Agent 服务接口
 *
 * 基于以下论文的核心思想设计：
 * - CRITIC (ICLR 2024): 工具交互式批评，使用外部工具验证后让 LLM 修正
 * - Reflexion (NeurIPS 2023): 语言反思学习，通过反思记忆改进决策
 * - Self-Refine (NeurIPS 2023): 迭代自我完善
 *
 * 工作流程：
 * 1. 接收原始错误信息和外部验证结果
 * 2. 调用 LLM 分析错误原因
 * 3. 生成修正后的工具调用参数
 * 4. 记录反思到 episodic memory
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-19
 */
public interface CorrectionAgentService {

    /**
     * 纠错结果
     */
    record CorrectionResult(
            boolean shouldRetry,
            String errorAnalysis,
            Map<String, Object> correctedParams,
            String correctionStrategy,
            String reflection,
            double confidence
    ) {
        public static CorrectionResult noRetry(String reason) {
            return new CorrectionResult(false, reason, null, "ABANDON", null, 0.0);
        }

        public static CorrectionResult withCorrection(
                String analysis,
                Map<String, Object> params,
                String strategy,
                String reflection,
                double confidence) {
            return new CorrectionResult(true, analysis, params, strategy, reflection, confidence);
        }
    }

    /**
     * 分析错误并生成修正参数
     *
     * 这是纠错 Agent 的核心方法，实现 CRITIC 论文的 Verify → Correct 循环
     *
     * @param userIntent 用户原始意图
     * @param toolName 工具名称
     * @param originalParams 原始参数
     * @param errorMessage 错误信息
     * @param verificationResult 外部验证结果（关键！）
     * @param attemptNumber 当前尝试次数
     * @return 纠错结果
     */
    CorrectionResult analyzeAndCorrect(
            String userIntent,
            String toolName,
            Map<String, Object> originalParams,
            String errorMessage,
            ExternalVerifierService.VerificationResult verificationResult,
            int attemptNumber
    );

    /**
     * 获取历史反思记录
     *
     * 基于 Reflexion 论文的 episodic memory 设计
     *
     * @param sessionId 会话ID
     * @param toolName 工具名称
     * @param limit 返回数量
     * @return 历史反思内容
     */
    String getHistoricalReflections(String sessionId, String toolName, int limit);

    /**
     * 判断是否应该继续重试
     *
     * 基于以下因素判断：
     * - 已尝试次数
     * - 错误类型
     * - 外部验证结果
     * - 历史纠错成功率
     *
     * @param errorMessage 错误信息
     * @param verificationResult 验证结果
     * @param attemptNumber 当前尝试次数
     * @return 是否应该重试
     */
    boolean shouldRetry(String errorMessage, ExternalVerifierService.VerificationResult verificationResult, int attemptNumber);
}
