package com.cretas.aims.repository.conversation;

import com.cretas.aims.entity.conversation.ConversationMemory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 对话记忆数据访问层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-15
 */
@Repository
public interface ConversationMemoryRepository extends JpaRepository<ConversationMemory, Long> {

    /**
     * 根据会话ID查找
     *
     * @param sessionId 会话ID
     * @return 对话记忆
     */
    Optional<ConversationMemory> findBySessionId(String sessionId);

    /**
     * 查找指定工厂和用户的活跃对话记忆（未删除的）
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @return 对话记忆
     */
    Optional<ConversationMemory> findByFactoryIdAndUserIdAndDeletedAtIsNull(
            String factoryId, Long userId);

    /**
     * 查找指定工厂下最后活跃时间早于指定时间的记忆
     * 用于清理过期会话
     *
     * @param factoryId 工厂ID
     * @param before    时间阈值
     * @return 过期的对话记忆列表
     */
    List<ConversationMemory> findByFactoryIdAndLastActiveAtBefore(
            String factoryId, LocalDateTime before);

    /**
     * 批量过期旧会话（软删除）
     *
     * @param expireTime 过期时间阈值
     * @param now        当前时间
     * @return 过期的记录数
     */
    @Modifying
    @Query("UPDATE ConversationMemory m SET m.deletedAt = :now WHERE m.lastActiveAt < :expireTime AND m.deletedAt IS NULL")
    int expireOldSessions(@Param("expireTime") LocalDateTime expireTime, @Param("now") LocalDateTime now);

    /**
     * 根据工厂ID和用户ID查找最近的活跃会话
     *
     * @param factoryId 工厂ID
     * @param userId    用户ID
     * @return 对话记忆
     */
    @Query("SELECT m FROM ConversationMemory m WHERE m.factoryId = :factoryId AND m.userId = :userId " +
           "AND m.deletedAt IS NULL ORDER BY m.lastActiveAt DESC")
    Optional<ConversationMemory> findLatestActiveByFactoryIdAndUserId(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId);

    /**
     * 查找需要更新摘要的会话
     *
     * @param messageThreshold 消息数阈值
     * @return 需要更新摘要的会话列表
     */
    @Query("SELECT m FROM ConversationMemory m WHERE m.messageCount > :messageThreshold " +
           "AND m.deletedAt IS NULL " +
           "AND (m.summaryUpdatedAt IS NULL OR m.messageCount > 15)")
    List<ConversationMemory> findNeedingSummaryUpdate(@Param("messageThreshold") int messageThreshold);

    /**
     * 统计指定工厂的活跃会话数
     *
     * @param factoryId 工厂ID
     * @return 活跃会话数
     */
    @Query("SELECT COUNT(m) FROM ConversationMemory m WHERE m.factoryId = :factoryId AND m.deletedAt IS NULL")
    long countActiveByFactoryId(@Param("factoryId") String factoryId);

    /**
     * 删除指定会话
     *
     * @param sessionId 会话ID
     * @param now       当前时间
     * @return 影响的记录数
     */
    @Modifying
    @Query("UPDATE ConversationMemory m SET m.deletedAt = :now WHERE m.sessionId = :sessionId")
    int softDeleteBySessionId(@Param("sessionId") String sessionId, @Param("now") LocalDateTime now);
}
