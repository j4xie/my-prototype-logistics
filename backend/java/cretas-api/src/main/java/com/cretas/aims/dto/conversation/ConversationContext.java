package com.cretas.aims.dto.conversation;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 对话上下文 DTO
 *
 * 封装完整的对话上下文信息，用于传递给 LLM 或业务逻辑
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationContext {

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 工厂ID
     */
    private String factoryId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 实体槽位
     */
    @Builder.Default
    private Map<EntitySlot.SlotType, EntitySlot> entitySlots = new HashMap<>();

    /**
     * 最近消息
     */
    private List<ConversationMessage> recentMessages;

    /**
     * 对话摘要
     */
    private String conversationSummary;

    /**
     * 用户偏好
     */
    @Builder.Default
    private Map<String, Object> userPreferences = new HashMap<>();

    /**
     * 最后意图代码
     */
    private String lastIntentCode;

    /**
     * 消息计数
     */
    private int messageCount;

    /**
     * 最后活跃时间
     */
    private LocalDateTime lastActiveAt;

    /**
     * 是否为新会话
     */
    private boolean newSession;

    /**
     * 获取指定类型的槽位
     */
    public EntitySlot getSlot(EntitySlot.SlotType type) {
        return entitySlots != null ? entitySlots.get(type) : null;
    }

    /**
     * 获取槽位值 (ID)
     */
    public String getSlotValue(EntitySlot.SlotType type) {
        EntitySlot slot = getSlot(type);
        return slot != null ? slot.getId() : null;
    }

    /**
     * 设置槽位
     */
    public void setSlot(EntitySlot.SlotType type, EntitySlot slot) {
        if (entitySlots == null) {
            entitySlots = new HashMap<>();
        }
        entitySlots.put(type, slot);
    }

    /**
     * 检查是否有指定类型的槽位
     */
    public boolean hasSlot(EntitySlot.SlotType type) {
        return entitySlots != null && entitySlots.containsKey(type);
    }

    /**
     * 清除指定类型的槽位
     */
    public void clearSlot(EntitySlot.SlotType type) {
        if (entitySlots != null) {
            entitySlots.remove(type);
        }
    }

    /**
     * 清除所有槽位
     */
    public void clearAllSlots() {
        if (entitySlots != null) {
            entitySlots.clear();
        }
    }

    /**
     * 获取用户偏好
     */
    @SuppressWarnings("unchecked")
    public <T> T getPreference(String key, T defaultValue) {
        if (userPreferences == null || !userPreferences.containsKey(key)) {
            return defaultValue;
        }
        return (T) userPreferences.get(key);
    }

    /**
     * 设置用户偏好
     */
    public void setPreference(String key, Object value) {
        if (userPreferences == null) {
            userPreferences = new HashMap<>();
        }
        userPreferences.put(key, value);
    }
}
