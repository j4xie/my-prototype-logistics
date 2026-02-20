package com.cretas.aims.service;

import com.cretas.aims.dto.clarification.ClarificationDecision;
import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.entity.config.AIIntentConfig;

import java.util.List;
import java.util.Map;

/**
 * 智能澄清服务接口
 *
 * Phase 3 增强澄清机制：
 * 1. 智能澄清触发 - 基于业务实体检测决定是否需要澄清
 * 2. 精准问题生成 - 基于缺失 slot 生成针对性问题
 * 3. 结合历史上下文推断缺失信息
 *
 * 设计原则：
 * - 如果有足够的业务实体，即使表达不完整也尝试识别
 * - 只有在真正缺少必要信息时才触发澄清
 * - 区分"模糊但可推断"和"确实缺失信息"
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public interface SmartClarificationService {

    /**
     * 智能判断是否需要澄清
     *
     * 检查流程：
     * 1. 检测用户输入中的业务实体（时间、物料、数量等）
     * 2. 根据意图配置的必需参数判断是否有缺失
     * 3. 尝试从会话上下文推断缺失信息
     * 4. 只有真正无法推断时才返回需要澄清
     *
     * @param userInput 用户输入
     * @param intent 识别到的意图配置（可能为 null）
     * @param matchResult 意图匹配结果（可能为 null）
     * @param context 会话上下文（可能为 null）
     * @return 澄清决策
     */
    ClarificationDecision decideClarification(
            String userInput,
            AIIntentConfig intent,
            IntentMatchResult matchResult,
            ConversationContext context);

    /**
     * 生成精准的澄清问题
     *
     * 基于缺失的 slot 类型生成针对性问题：
     * - 时间缺失: "您想查询哪个时间段的数据？(今天/本周/本月/指定日期)"
     * - 物料缺失: "您想查询哪种物料？请提供物料名称或编号"
     * - 操作缺失: "您想对这些数据进行什么操作？(查询/统计/导出)"
     *
     * @param decision 澄清决策
     * @param intent 意图配置
     * @param context 会话上下文
     * @return 生成的澄清问题列表
     */
    List<String> generateClarificationQuestions(
            ClarificationDecision decision,
            AIIntentConfig intent,
            ConversationContext context);

    /**
     * 生成单个槽位的澄清问题
     *
     * @param slotName 槽位名称
     * @param slotType 槽位类型
     * @param intent 意图配置
     * @param context 会话上下文
     * @return 澄清问题
     */
    String generateQuestionForSlot(
            String slotName,
            String slotType,
            AIIntentConfig intent,
            ConversationContext context);

    /**
     * 从用户输入中检测业务实体
     *
     * 检测以下类型的实体：
     * - 时间实体: 今天、本周、上月、2024-01-01
     * - 物料实体: 原材料名称、编号
     * - 数量实体: 100kg、500件
     * - 供应商/客户实体
     * - 批次号
     *
     * @param userInput 用户输入
     * @return 检测到的实体映射 (槽位名 -> 值)
     */
    Map<String, Object> detectBusinessEntities(String userInput);

    /**
     * 尝试从上下文推断缺失信息
     *
     * 推断逻辑：
     * - 时间: 最近一次查询的时间范围、默认"今天"
     * - 物料: 最近操作的物料批次
     * - 供应商: 当前活跃供应商
     *
     * @param missingSlots 缺失的槽位列表
     * @param context 会话上下文
     * @return 推断的默认值映射
     */
    Map<String, Object> inferFromContext(
            List<String> missingSlots,
            ConversationContext context);

    /**
     * 评估不进行澄清直接执行的置信度
     *
     * 评估因素：
     * - 必需参数的完整度
     * - 上下文推断的可靠性
     * - 意图匹配的置信度
     *
     * @param decision 当前澄清决策
     * @param matchResult 意图匹配结果
     * @return 直接执行的置信度 (0-1)
     */
    double evaluateConfidenceWithoutClarification(
            ClarificationDecision decision,
            IntentMatchResult matchResult);

    /**
     * 构建友好的澄清响应消息
     *
     * @param decision 澄清决策
     * @param questions 澄清问题列表
     * @param intent 意图配置
     * @return 格式化的响应消息
     */
    String buildClarificationMessage(
            ClarificationDecision decision,
            List<String> questions,
            AIIntentConfig intent);

    /**
     * 检查是否为高风险操作需要强制澄清
     *
     * 高风险操作：删除、大批量修改、状态变更等
     *
     * @param intent 意图配置
     * @param detectedAction 检测到的操作类型
     * @return 是否需要强制澄清
     */
    boolean requiresMandatoryClarification(AIIntentConfig intent, String detectedAction);

    /**
     * 检查服务是否可用
     *
     * @return true 如果服务可用
     */
    boolean isAvailable();
}
