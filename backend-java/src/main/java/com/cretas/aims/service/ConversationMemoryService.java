package com.cretas.aims.service;

import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.conversation.ConversationMessage;
import com.cretas.aims.dto.conversation.EntitySlot;

import java.util.List;

/**
 * 对话记忆服务接口
 *
 * 提供对话上下文管理、实体槽位跟踪、指代消解等功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
public interface ConversationMemoryService {

    /**
     * 获取或创建对话上下文
     *
     * 如果指定会话存在，返回现有上下文；否则创建新的上下文
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @param sessionId 会话ID (可选，为null时自动生成)
     * @return 对话上下文
     */
    ConversationContext getOrCreateContext(String factoryId, Long userId, String sessionId);

    /**
     * 更新实体槽位
     *
     * 将对话中提及的实体更新到对应的槽位
     *
     * @param sessionId 会话ID
     * @param type      槽位类型
     * @param slot      槽位数据
     */
    void updateEntitySlot(String sessionId, EntitySlot.SlotType type, EntitySlot slot);

    /**
     * 获取实体槽位
     *
     * @param sessionId 会话ID
     * @param type      槽位类型
     * @return 槽位数据，如果不存在返回 null
     */
    EntitySlot getEntitySlot(String sessionId, EntitySlot.SlotType type);

    /**
     * 指代消解
     *
     * 识别指代词（如"这批"、"那个供应商"）并返回对应的实体信息
     *
     * 支持的指代模式：
     * - "这批"、"那批"、"该批次" -> BATCH 槽位
     * - "这家"、"那个供应商"、"他们" -> SUPPLIER 槽位
     * - "这个客户"、"对方" -> CUSTOMER 槽位
     * - "这个产品"、"这种货" -> PRODUCT 槽位
     * - "那段时间"、"同期" -> TIME_RANGE 槽位
     * - "那个仓库"、"这里" -> WAREHOUSE 槽位
     *
     * @param sessionId     会话ID
     * @param referenceText 包含指代词的文本
     * @return 消解后的实体描述，如果无法消解返回原文
     */
    String resolveReference(String sessionId, String referenceText);

    /**
     * 添加消息到对话历史
     *
     * 使用滑动窗口机制，保留最近 6 轮原始消息
     *
     * @param sessionId 会话ID
     * @param message   消息
     */
    void addMessage(String sessionId, ConversationMessage message);

    /**
     * 获取最近的消息
     *
     * @param sessionId 会话ID
     * @param limit     返回的最大消息数
     * @return 消息列表
     */
    List<ConversationMessage> getRecentMessages(String sessionId, int limit);

    /**
     * 更新对话摘要
     *
     * 当 messageCount > 10 且距离上次摘要 > 5 条消息时，调用 LLM 生成摘要
     * 用于压缩长期对话历史，减少上下文长度
     *
     * @param sessionId 会话ID
     */
    void updateSummary(String sessionId);

    /**
     * 构建传递给 LLM 的上下文字符串
     *
     * 包含：
     * - 当前实体槽位（如有）
     * - 对话摘要（如有）
     * - 最近几轮消息
     *
     * @param sessionId 会话ID
     * @return 格式化的上下文字符串
     */
    String buildContextForLLM(String sessionId);

    /**
     * 清除会话
     *
     * 软删除会话及其所有关联数据
     *
     * @param sessionId 会话ID
     */
    void clearSession(String sessionId);

    /**
     * 更新最后意图代码
     *
     * @param sessionId  会话ID
     * @param intentCode 意图代码
     */
    void updateLastIntent(String sessionId, String intentCode);

    /**
     * 获取完整的对话上下文
     *
     * @param sessionId 会话ID
     * @return 对话上下文，如果不存在返回 null
     */
    ConversationContext getContext(String sessionId);

    /**
     * 批量过期旧会话
     *
     * @param expireMinutes 过期时间（分钟）
     * @return 过期的会话数
     */
    int expireOldSessions(int expireMinutes);
}
