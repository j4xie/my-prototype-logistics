package com.cretas.aims.service;

import com.cretas.aims.entity.conversation.ConversationSession;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Optional;

/**
 * 多轮对话服务接口
 *
 * 管理 Layer 5 的多轮对话流程，支持:
 * - 开始对话 (当 Layer 1-4 置信度 < 30%)
 * - 继续对话 (用户回复澄清问题)
 * - 结束对话 (成功识别意图并学习)
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-06
 */
public interface ConversationService {

    /**
     * 开始多轮对话
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param userInput 用户输入
     * @return 对话响应 (包含澄清问题)
     */
    ConversationResponse startConversation(String factoryId, Long userId, String userInput);

    /**
     * 继续多轮对话
     *
     * @param sessionId 会话ID
     * @param userReply 用户回复
     * @return 对话响应 (包含下一个问题或最终结果)
     */
    ConversationResponse continueConversation(String sessionId, String userReply);

    /**
     * 结束对话并学习
     *
     * 当用户确认意图后调用，将:
     * 1. 学习原始表达 (存入 LearnedExpression)
     * 2. 学习新关键词 (更新 AIIntentConfig)
     *
     * @param sessionId 会话ID
     * @param intentCode 确认的意图代码
     * @return 是否成功
     */
    boolean endConversation(String sessionId, String intentCode);

    /**
     * 取消对话
     *
     * @param sessionId 会话ID
     * @return 是否成功
     */
    boolean cancelConversation(String sessionId);

    /**
     * 获取活跃会话
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @return 活跃会话 (如果存在)
     */
    Optional<ConversationSession> getActiveSession(String factoryId, Long userId);

    /**
     * 获取会话详情
     *
     * @param sessionId 会话ID
     * @return 会话 (如果存在)
     */
    Optional<ConversationSession> getSession(String sessionId);

    /**
     * 处理超时会话 (定时任务调用)
     *
     * @return 处理的会话数
     */
    int processExpiredSessions();

    /**
     * 获取对话统计
     *
     * @param days 最近天数
     * @return 统计信息
     */
    ConversationStatistics getStatistics(int days);

    // ========== 响应类 ==========

    /**
     * 对话响应
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ConversationResponse {
        /** 会话ID */
        private String sessionId;
        /** 当前轮次 */
        private int currentRound;
        /** 最大轮次 */
        private int maxRounds;
        /** 会话状态 */
        private ConversationSession.SessionStatus status;
        /** 是否完成 (成功识别意图) */
        private boolean completed;
        /** 助手消息 (澄清问题或最终回复) */
        private String message;
        /** 识别的意图代码 (完成时) */
        private String intentCode;
        /** 识别的意图名称 (完成时) */
        private String intentName;
        /** 置信度 */
        private Double confidence;
        /** 候选意图列表 */
        private List<CandidateInfo> candidates;
        /** 是否需要确认 */
        private boolean requiresConfirmation;
    }

    /**
     * 候选意图信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class CandidateInfo {
        private String intentCode;
        private String intentName;
        private Double confidence;
        private String description;
    }

    /**
     * 对话统计
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class ConversationStatistics {
        /** 总会话数 */
        private long totalSessions;
        /** 成功完成数 */
        private long completedCount;
        /** 超时数 */
        private long timeoutCount;
        /** 取消数 */
        private long cancelledCount;
        /** 达到最大轮次数 */
        private long maxRoundsCount;
        /** 成功率 */
        private double successRate;
        /** 平均轮次 */
        private double averageRounds;
        /** 活跃会话数 */
        private long activeSessions;
    }
}
