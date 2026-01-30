package com.cretas.aims.service.calibration;

import com.cretas.aims.dto.calibration.FailureType;
import com.cretas.aims.dto.calibration.RecoveryPrompt;

import java.util.List;
import java.util.Map;

/**
 * 提示注入服务接口
 * 通过分析工具执行失败原因，生成恢复提示来引导 LLM 重试
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的设计
 * 核心思想：通过结构化的提示注入，实现失败恢复的自动化
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface PromptInjectionService {

    /**
     * 最大重试次数
     */
    int MAX_RETRY_ATTEMPTS = 2;

    /**
     * 分析失败类型
     * 根据错误类型和错误消息判断具体的失败分类
     *
     * @param errorType    错误类型字符串（如 "VALIDATION_ERROR"）
     * @param errorMessage 详细错误消息
     * @return 识别出的失败类型
     */
    FailureType analyzeFailure(String errorType, String errorMessage);

    /**
     * 生成恢复提示
     * 根据失败类型、工具信息和错误详情，生成引导 LLM 重试的提示
     *
     * @param failureType  失败类型
     * @param toolName     失败的工具名称
     * @param parameters   工具参数（JSON 字符串）
     * @param errorMessage 错误消息
     * @return 恢复提示对象
     */
    RecoveryPrompt generateRecoveryPrompt(
        FailureType failureType,
        String toolName,
        String parameters,
        String errorMessage
    );

    /**
     * 生成恢复提示（带上下文）
     * 增加用户原始查询和会话上下文，生成更精准的恢复提示
     *
     * @param failureType   失败类型
     * @param toolName      失败的工具名称
     * @param parameters    工具参数（JSON 字符串）
     * @param errorMessage  错误消息
     * @param originalQuery 用户原始查询
     * @param context       会话上下文
     * @return 恢复提示对象
     */
    RecoveryPrompt generateRecoveryPromptWithContext(
        FailureType failureType,
        String toolName,
        String parameters,
        String errorMessage,
        String originalQuery,
        Map<String, Object> context
    );

    /**
     * 建议替代工具
     * 当原工具无法恢复时，推荐功能相似的替代工具
     *
     * @param failedToolName 失败的工具名称
     * @return 替代工具名称列表（按推荐优先级排序）
     */
    List<String> suggestAlternativeTools(String failedToolName);

    /**
     * 建议参数修复
     * 分析错误消息，给出参数修正建议
     *
     * @param toolName     工具名称
     * @param parameters   原始参数（JSON 字符串）
     * @param errorMessage 错误消息
     * @return 参数修复建议映射 (参数名 -> 修复建议)
     */
    Map<String, Object> suggestParameterFixes(
        String toolName,
        String parameters,
        String errorMessage
    );

    /**
     * 判断是否应该尝试恢复
     * 检查重试次数和恢复可行性
     *
     * @param toolCallId 工具调用记录 ID
     * @return true 如果应该尝试恢复
     */
    boolean shouldAttemptRecovery(Long toolCallId);

    /**
     * 记录恢复尝试
     * 保存恢复尝试的详细信息用于后续分析
     *
     * @param toolCallId     工具调用记录 ID
     * @param recoveryPrompt 使用的恢复提示
     * @param success        恢复是否成功
     */
    void recordRecoveryAttempt(Long toolCallId, RecoveryPrompt recoveryPrompt, boolean success);

    /**
     * 获取工具的恢复成功率
     * 基于历史数据计算特定工具的恢复成功概率
     *
     * @param toolName     工具名称
     * @param failureType  失败类型
     * @return 成功率（0-1），如果数据不足返回 null
     */
    Double getRecoverySuccessRate(String toolName, FailureType failureType);

    /**
     * 快速恢复（一步到位）
     * 综合分析失败并生成恢复提示，适用于简单场景
     *
     * @param toolCallId   工具调用记录 ID
     * @param toolName     工具名称
     * @param parameters   工具参数
     * @param errorType    错误类型
     * @param errorMessage 错误消息
     * @return 恢复提示，如果无法恢复返回 null
     */
    RecoveryPrompt quickRecover(
        Long toolCallId,
        String toolName,
        String parameters,
        String errorType,
        String errorMessage
    );

    /**
     * 批量分析失败模式
     * 分析多次失败的共同模式，用于系统优化
     *
     * @param factoryId 工厂 ID
     * @param toolName  工具名称（可选，null 表示所有工具）
     * @param days      分析天数
     * @return 失败模式分析结果
     */
    Map<String, Object> analyzeFailurePatterns(String factoryId, String toolName, int days);
}
