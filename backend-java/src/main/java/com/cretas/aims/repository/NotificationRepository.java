package com.cretas.aims.repository;

import com.cretas.aims.entity.Notification;
import com.cretas.aims.entity.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 通知数据访问接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-26
 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long>, JpaSpecificationExecutor<Notification> {

    /**
     * 根据工厂ID分页查询通知
     */
    Page<Notification> findByFactoryIdOrderByCreatedAtDesc(String factoryId, Pageable pageable);

    /**
     * 根据工厂ID和用户ID分页查询通知
     */
    Page<Notification> findByFactoryIdAndUserIdOrderByCreatedAtDesc(String factoryId, Long userId, Pageable pageable);

    /**
     * 根据工厂ID和通知ID查询
     */
    Optional<Notification> findByFactoryIdAndId(String factoryId, Long id);

    /**
     * 根据工厂ID查询未读通知数量
     */
    long countByFactoryIdAndIsReadFalse(String factoryId);

    /**
     * 根据工厂ID和用户ID查询未读通知数量
     */
    long countByFactoryIdAndUserIdAndIsReadFalse(String factoryId, Long userId);

    /**
     * 根据工厂ID和类型查询通知
     */
    Page<Notification> findByFactoryIdAndTypeOrderByCreatedAtDesc(String factoryId, NotificationType type, Pageable pageable);

    /**
     * 根据工厂ID和已读状态查询通知
     */
    Page<Notification> findByFactoryIdAndIsReadOrderByCreatedAtDesc(String factoryId, Boolean isRead, Pageable pageable);

    /**
     * 批量标记为已读
     */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = :readAt WHERE n.factoryId = :factoryId AND n.isRead = false")
    int markAllAsRead(@Param("factoryId") String factoryId, @Param("readAt") LocalDateTime readAt);

    /**
     * 批量标记指定用户的通知为已读
     */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true, n.readAt = :readAt WHERE n.factoryId = :factoryId AND n.userId = :userId AND n.isRead = false")
    int markAllAsReadByUser(@Param("factoryId") String factoryId, @Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);

    /**
     * 查询最近的通知
     */
    List<Notification> findTop10ByFactoryIdOrderByCreatedAtDesc(String factoryId);

    /**
     * 根据来源查询通知
     */
    List<Notification> findByFactoryIdAndSourceOrderByCreatedAtDesc(String factoryId, String source);

    /**
     * 根据来源ID查询通知
     */
    Optional<Notification> findByFactoryIdAndSourceId(String factoryId, String sourceId);
}
