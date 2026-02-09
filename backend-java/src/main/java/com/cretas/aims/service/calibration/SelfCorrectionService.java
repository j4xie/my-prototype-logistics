package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.CorrectionRecord;
import com.cretas.aims.entity.calibration.CorrectionRecord.CorrectionStrategy;
import com.cretas.aims.entity.calibration.CorrectionRecord.ErrorCategory;

import java.util.List;
import java.util.Optional;

/**
 * 自我纠错服务接口
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的行为校准系统
 *
 * 核心功能:
 * 1. 错误分类 - 将错误分为 DATA_INSUFFICIENT, ANALYSIS_ERROR, FORMAT_ERROR, LOGIC_ERROR, UNKNOWN
 * 2. 恢复策略 - 根据错误类型确定最佳恢复策略
 * 3. 纠错记录 - 追踪纠错尝试和结果
 * 4. 部分重试 - 支持部分重试而非完全重试
 * 5. 轮次限制 - 最多3轮纠错
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface SelfCorrectionService {

    /**
     * 最大纠错轮次
     */
    int MAX_CORRECTION_ROUNDS = 3;

    // ==================== 错误分类 ====================

    /**
     * 分类错误类型
     * 根据错误信息和审核反馈识别错误的类别
     *
     * 分类规则:
     * - DATA_INSUFFICIENT: 包含 "数据不完整", "信息不足", "未找到", "数据为空" 等关键词
     * - ANALYSIS_ERROR: 包含 "分析错误", "计算错误", "统计失败", "结果异常" 等关键词
     * - FORMAT_ERROR: 包含 "格式错误", "解析失败", "JSON错误", "类型转换" 等关键词
     * - LOGIC_ERROR: 包含 "逻辑错误", "推理失败", "条件不满足", "规则冲突" 等关键词
     * - UNKNOWN: 无法识别的错误
     *
     * @param errorMessage 错误信息
     * @param reviewFeedback 审核反馈（可选，可为null）
     * @return 错误分类
     */
    ErrorCategory classifyError(String errorMessage, String reviewFeedback);

    /**
     * 分类错误类型（仅基于错误信息）
     *
     * @param errorMessage 错误信息
     * @return 错误分类
     */
    default ErrorCategory classifyError(String errorMessage) {
        return classifyError(errorMessage, null);
    }

    // ==================== 恢复策略 ====================

    /**
     * 根据错误分类确定恢复策略
     *
     * 策略映射:
     * - DATA_INSUFFICIENT -> RE_RETRIEVE (仅重新检索数据)
     * - ANALYSIS_ERROR -> RE_ANALYZE (保留检索数据，重做分析)
     * - FORMAT_ERROR -> FORMAT_FIX (仅修正格式)
     * - LOGIC_ERROR -> PROMPT_INJECTION (注入纠正提示)
     * - UNKNOWN -> FULL_RETRY (完全重试)
     *
     * @param category 错误分类
     * @return 推荐的恢复策略
     */
    CorrectionStrategy determineStrategy(ErrorCategory category);

    /**
     * 根据错误信息直接确定恢复策略
     *
     * @param errorMessage 错误信息
     * @param reviewFeedback 审核反馈
     * @return 推荐的恢复策略
     */
    default CorrectionStrategy determineStrategy(String errorMessage, String reviewFeedback) {
        ErrorCategory category = classifyError(errorMessage, reviewFeedback);
        return determineStrategy(category);
    }

    // ==================== 纠错记录管理 ====================

    /**
     * 创建纠错记录
     *
     * @param toolCallId 工具调用ID
     * @param factoryId 工厂ID
     * @param sessionId 会话ID
     * @param errorType 错误类型（业务错误码）
     * @param errorMessage 错误信息
     * @return 创建的纠错记录
     */
    CorrectionRecord createCorrectionRecord(Long toolCallId, String factoryId, String sessionId,
                                            String errorType, String errorMessage);

    /**
     * 创建纠错记录（带审核反馈）
     *
     * @param toolCallId 工具调用ID
     * @param factoryId 工厂ID
     * @param sessionId 会话ID
     * @param errorType 错误类型
     * @param errorMessage 错误信息
     * @param reviewFeedback 审核反馈
     * @return 创建的纠错记录
     */
    CorrectionRecord createCorrectionRecord(Long toolCallId, String factoryId, String sessionId,
                                            String errorType, String errorMessage, String reviewFeedback);

    /**
     * 记录纠错结果
     *
     * @param correctionRecordId 纠错记录ID
     * @param success 是否成功
     * @param finalStatus 最终状态
     */
    void recordCorrectionOutcome(Long correctionRecordId, boolean success, String finalStatus);

    /**
     * 增加纠错轮次
     *
     * @param correctionRecordId 纠错记录ID
     * @return 更新后的轮次数
     */
    int incrementCorrectionRound(Long correctionRecordId);

    /**
     * 获取纠错记录
     *
     * @param correctionRecordId 纠错记录ID
     * @return 纠错记录
     */
    Optional<CorrectionRecord> getCorrectionRecord(Long correctionRecordId);

    /**
     * 获取工具调用的所有纠错记录
     *
     * @param toolCallId 工具调用ID
     * @return 纠错记录列表
     */
    List<CorrectionRecord> getCorrectionRecordsByToolCall(Long toolCallId);

    /**
     * 获取会话的所有纠错记录
     *
     * @param sessionId 会话ID
     * @return 纠错记录列表
     */
    List<CorrectionRecord> getCorrectionRecordsBySession(String sessionId);

    // ==================== 重试控制 ====================

    /**
     * 检查是否应该重试
     * 基于当前纠错轮次判断是否还能继续重试
     *
     * @param toolCallId 工具调用ID
     * @return true 如果轮次 < MAX_CORRECTION_ROUNDS，否则 false
     */
    boolean shouldRetry(Long toolCallId);

    /**
     * 获取当前纠错轮次
     *
     * @param toolCallId 工具调用ID
     * @return 当前轮次，如果无记录返回 0
     */
    int getCurrentRound(Long toolCallId);

    /**
     * 获取剩余重试次数
     *
     * @param toolCallId 工具调用ID
     * @return 剩余次数
     */
    default int getRemainingRetries(Long toolCallId) {
        return Math.max(0, MAX_CORRECTION_ROUNDS - getCurrentRound(toolCallId));
    }

    // ==================== 纠正提示生成 ====================

    /**
     * 生成纠正提示
     * 根据错误类型生成针对性的纠正提示，用于注入到下一轮处理中
     *
     * @param category 错误分类
     * @param originalError 原始错误信息
     * @return 纠正提示
     */
    String generateCorrectionPrompt(ErrorCategory category, String originalError);

    /**
     * 生成纠正提示（带上下文）
     *
     * @param category 错误分类
     * @param originalError 原始错误信息
     * @param context 额外上下文信息
     * @return 纠正提示
     */
    String generateCorrectionPrompt(ErrorCategory category, String originalError, String context);

    /**
     * 生成针对特定策略的纠正提示
     *
     * @param strategy 纠错策略
     * @param originalError 原始错误信息
     * @param attemptNumber 当前尝试次数
     * @return 纠正提示
     */
    String generateCorrectionPromptForStrategy(CorrectionStrategy strategy, String originalError, int attemptNumber);

    // ==================== 统计与分析 ====================

    /**
     * 获取纠错成功率
     *
     * @param factoryId 工厂ID
     * @return 成功率（0.0 - 1.0）
     */
    double getCorrectionSuccessRate(String factoryId);

    /**
     * 获取各错误类型的分布
     *
     * @param factoryId 工厂ID
     * @return 错误类型 -> 数量的映射
     */
    java.util.Map<ErrorCategory, Long> getErrorCategoryDistribution(String factoryId);

    /**
     * 获取各策略的使用统计
     *
     * @param factoryId 工厂ID
     * @return 策略 -> 数量的映射
     */
    java.util.Map<CorrectionStrategy, Long> getStrategyUsageStats(String factoryId);

    // ==================== 纠错结果 DTO ====================

    /**
     * 纠错分析结果
     */
    interface CorrectionAnalysis {
        /**
         * 获取错误分类
         */
        ErrorCategory getErrorCategory();

        /**
         * 获取推荐策略
         */
        CorrectionStrategy getRecommendedStrategy();

        /**
         * 是否可重试
         */
        boolean isRetryable();

        /**
         * 获取纠正提示
         */
        String getCorrectionPrompt();

        /**
         * 获取当前轮次
         */
        int getCurrentRound();

        /**
         * 获取置信度
         */
        double getConfidence();
    }

    /**
     * 分析错误并返回完整的纠错建议
     *
     * @param toolCallId 工具调用ID
     * @param errorMessage 错误信息
     * @param reviewFeedback 审核反馈
     * @return 纠错分析结果
     */
    CorrectionAnalysis analyzeAndSuggest(Long toolCallId, String errorMessage, String reviewFeedback);
}
