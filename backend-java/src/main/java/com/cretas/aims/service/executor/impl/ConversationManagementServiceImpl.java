package com.cretas.aims.service.executor.impl;

import com.cretas.aims.dto.conversation.ConversationContext;
import com.cretas.aims.dto.conversation.ConversationMessage;
import com.cretas.aims.service.ConversationMemoryService;
import com.cretas.aims.service.executor.ConversationManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 对话管理服务实现
 *
 * 负责管理对话上下文，包括：
 * - 上下文创建和获取
 * - 消息历史管理
 * - 实体跟踪
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationManagementServiceImpl implements ConversationManagementService {

    private final ConversationMemoryService conversationMemoryService;

    // 活跃会话缓存
    private final Map<String, ConversationContext> activeContexts = new ConcurrentHashMap<>();

    @Override
    public ConversationContext getOrCreateContext(String factoryId, Long userId, String sessionId) {
        String contextKey = buildContextKey(factoryId, userId, sessionId);

        return activeContexts.computeIfAbsent(contextKey, key -> {
            ConversationContext context = conversationMemoryService.getOrCreateContext(factoryId, userId, sessionId);
            log.debug("Created/retrieved conversation context: {}", contextKey);
            return context;
        });
    }

    @Override
    public void addMessage(String sessionId, ConversationMessage message) {
        ConversationContext context = findContextBySessionId(sessionId);
        if (context != null) {
            context.addMessage(message);
            log.debug("Added message to session {}: {}", sessionId, message.getRole());
        }
    }

    @Override
    public List<ConversationMessage> getRecentMessages(String sessionId, int limit) {
        ConversationContext context = findContextBySessionId(sessionId);
        if (context == null) {
            return List.of();
        }

        List<ConversationMessage> messages = context.getMessages();
        int start = Math.max(0, messages.size() - limit);
        return messages.subList(start, messages.size());
    }

    @Override
    public void updateTrackedEntities(String sessionId, Map<String, Object> entities) {
        ConversationContext context = findContextBySessionId(sessionId);
        if (context != null && entities != null) {
            context.getTrackedEntities().putAll(entities);
            log.debug("Updated tracked entities for session {}: {}", sessionId, entities.keySet());
        }
    }

    @Override
    public Map<String, Object> getTrackedEntities(String sessionId) {
        ConversationContext context = findContextBySessionId(sessionId);
        return context != null ? context.getTrackedEntities() : Map.of();
    }

    @Override
    public void clearContext(String sessionId) {
        // 从缓存中移除
        activeContexts.entrySet().removeIf(entry -> entry.getKey().endsWith(":" + sessionId));

        // 清除持久化的上下文
        conversationMemoryService.clearContext(sessionId);
        log.info("Cleared conversation context for session: {}", sessionId);
    }

    @Override
    public boolean isContextActive(String sessionId) {
        ConversationContext context = findContextBySessionId(sessionId);
        if (context == null) {
            return false;
        }

        // 检查最后活动时间
        LocalDateTime lastActivity = context.getLastActivityTime();
        if (lastActivity == null) {
            return false;
        }

        // 30分钟无活动则认为不活跃
        return lastActivity.plusMinutes(30).isAfter(LocalDateTime.now());
    }

    @Override
    public void setContextVariable(String sessionId, String key, Object value) {
        ConversationContext context = findContextBySessionId(sessionId);
        if (context != null) {
            context.setVariable(key, value);
        }
    }

    @Override
    public Object getContextVariable(String sessionId, String key) {
        ConversationContext context = findContextBySessionId(sessionId);
        return context != null ? context.getVariable(key) : null;
    }

    @Override
    public String resolvePronouns(String sessionId, String input) {
        ConversationContext context = findContextBySessionId(sessionId);
        if (context == null) {
            return input;
        }

        String resolved = input;

        // 简单的代词消解
        Map<String, Object> entities = context.getTrackedEntities();

        // "它" -> 最近提到的实体
        if (resolved.contains("它") && entities.containsKey("lastMentionedEntity")) {
            resolved = resolved.replace("它", entities.get("lastMentionedEntity").toString());
        }

        // "这个批次" -> 最近的批次号
        if (resolved.contains("这个批次") && entities.containsKey("currentBatchId")) {
            resolved = resolved.replace("这个批次", "批次" + entities.get("currentBatchId"));
        }

        // "刚才的" -> 最近查询的内容
        if (resolved.contains("刚才的") && entities.containsKey("lastQuerySubject")) {
            resolved = resolved.replace("刚才的", entities.get("lastQuerySubject").toString());
        }

        return resolved;
    }

    /**
     * 构建上下文键
     */
    private String buildContextKey(String factoryId, Long userId, String sessionId) {
        return String.format("%s:%d:%s", factoryId, userId, sessionId);
    }

    /**
     * 通过 sessionId 查找上下文
     */
    private ConversationContext findContextBySessionId(String sessionId) {
        for (Map.Entry<String, ConversationContext> entry : activeContexts.entrySet()) {
            if (entry.getKey().endsWith(":" + sessionId)) {
                return entry.getValue();
            }
        }
        return null;
    }
}
