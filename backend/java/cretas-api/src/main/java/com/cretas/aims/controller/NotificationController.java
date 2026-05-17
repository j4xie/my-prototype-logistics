package com.cretas.aims.controller;

import com.cretas.aims.config.RequireRole;
import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.notification.CreateNotificationRequest;
import com.cretas.aims.entity.Notification;
import com.cretas.aims.entity.enums.NotificationType;
import com.cretas.aims.repository.NotificationRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 通知管理控制器
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-26
 */
@RestController
@RequestMapping("/api/mobile/{factoryId}/notifications")
@Tag(name = "通知管理", description = "通知管理相关接口，包括通知列表查询、未读数量统计、最近通知获取、通知详情查看、已读标记（单条/全部）、通知创建和删除等功能")
public class NotificationController {

    private static final Logger log = LoggerFactory.getLogger(NotificationController.class);

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    /**
     * 获取通知列表
     * <p>When userId is supplied, returns notifications targeted at that user
     * plus broadcast notifications (userId=null), sorted unread-first.
     */
    @GetMapping
    @Operation(summary = "获取通知列表", description = "分页获取工厂的通知列表，支持按用户、通知类型和已读状态筛选。提供 userId 时返回该用户的通知+广播通知，未读优先排序")
    public ApiResponse<PageResponse<Notification>> getNotifications(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "用户ID，提供时返回该用户+广播通知", example = "22") Long userId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）", example = "1") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小", example = "20") Integer size,
            @RequestParam(required = false) @Parameter(description = "通知类型: INFO/WARNING/ERROR/SUCCESS", example = "INFO") NotificationType type,
            @RequestParam(required = false) @Parameter(description = "是否已读", example = "false") Boolean isRead) {

        log.debug("获取通知列表: factoryId={}, userId={}, page={}, size={}, type={}, isRead={}",
                  factoryId, userId, page, size, type, isRead);

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Notification> pageResult;
        if (userId != null) {
            // User-scoped: their own notifications + broadcasts, unread first
            pageResult = notificationRepository.findForUserUnreadFirst(factoryId, userId, pageable);
        } else if (type != null) {
            pageResult = notificationRepository.findByFactoryIdAndTypeOrderByCreatedAtDesc(factoryId, type, pageable);
        } else if (isRead != null) {
            pageResult = notificationRepository.findByFactoryIdAndIsReadOrderByCreatedAtDesc(factoryId, isRead, pageable);
        } else {
            pageResult = notificationRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
        }

        PageResponse<Notification> response = PageResponse.of(
                pageResult.getContent(),
                page,
                size,
                pageResult.getTotalElements()
        );

        return ApiResponse.success(response);
    }

    /**
     * 获取未读通知数量
     */
    @GetMapping("/unread-count")
    @Operation(summary = "获取未读通知数量", description = "获取未读通知总数。提供 userId 时返回该用户+广播通知的未读数")
    public ApiResponse<Map<String, Long>> getUnreadCount(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam(required = false) @Parameter(description = "用户ID", example = "22") Long userId) {

        log.debug("获取未读通知数量: factoryId={}, userId={}", factoryId, userId);

        long count;
        if (userId != null) {
            count = notificationRepository.countUnreadForUser(factoryId, userId);
        } else {
            count = notificationRepository.countByFactoryIdAndIsReadFalse(factoryId);
        }

        Map<String, Long> result = new HashMap<>();
        result.put("count", count);

        return ApiResponse.success(result);
    }

    /**
     * 获取最近通知
     */
    @GetMapping("/recent")
    @Operation(summary = "获取最近10条通知", description = "获取工厂最新的10条通知，用于快速预览通知消息，按创建时间倒序排列")
    public ApiResponse<List<Notification>> getRecentNotifications(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.debug("获取最近通知: factoryId={}", factoryId);

        List<Notification> notifications = notificationRepository.findTop10ByFactoryIdOrderByCreatedAtDesc(factoryId);

        return ApiResponse.success(notifications);
    }

    /**
     * 获取单个通知详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取通知详情", description = "根据通知ID获取单个通知的详细信息，包括标题、内容、类型、已读状态等")
    public ApiResponse<Notification> getNotificationById(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "通知ID", example = "1") Long id) {

        log.debug("获取通知详情: factoryId={}, id={}", factoryId, id);

        Notification notification = notificationRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new RuntimeException("通知不存在: " + id));

        return ApiResponse.success(notification);
    }

    /**
     * 标记单个通知为已读
     */
    @PutMapping("/{id}/read")
    @Operation(summary = "标记通知为已读", description = "将指定通知标记为已读状态，同时记录阅读时间。如果通知已经是已读状态则不做处理")
    @Transactional
    public ApiResponse<Notification> markAsRead(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "通知ID", example = "1") Long id) {

        log.info("标记通知为已读: factoryId={}, id={}", factoryId, id);

        Notification notification = notificationRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new RuntimeException("通知不存在: " + id));

        if (!notification.getIsRead()) {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());
            notification = notificationRepository.save(notification);
        }

        return ApiResponse.success(notification);
    }

    /**
     * 标记所有通知为已读 (factory-wide)
     */
    @PutMapping("/mark-all-read")
    @Operation(summary = "标记所有通知为已读", description = "一键将工厂所有未读通知标记为已读状态，返回更新的通知数量")
    @Transactional
    public ApiResponse<Map<String, Integer>> markAllAsRead(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId) {

        log.info("标记所有通知为已读: factoryId={}", factoryId);

        int count = notificationRepository.markAllAsRead(factoryId, LocalDateTime.now());

        Map<String, Integer> result = new HashMap<>();
        result.put("updatedCount", count);

        return ApiResponse.success(result);
    }

    /**
     * 标记用户的所有通知为已读 (含广播通知)
     */
    @PutMapping("/read-all")
    @Operation(summary = "标记用户所有通知为已读", description = "将指定用户的所有未读通知(含广播)标记为已读")
    @Transactional
    public ApiResponse<Map<String, Integer>> markAllAsReadForUser(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @RequestParam @Parameter(description = "用户ID", example = "22") Long userId) {

        log.info("标记用户所有通知为已读: factoryId={}, userId={}", factoryId, userId);

        int count = notificationRepository.markAllAsReadForUser(factoryId, userId, LocalDateTime.now());

        Map<String, Integer> result = new HashMap<>();
        result.put("updatedCount", count);

        return ApiResponse.success(result);
    }

    /**
     * 创建通知（系统内部使用）
     *
     * Issue #718 (2026-05-17): @RequireRole added — prevent any auth user from
     * spamming notifications to all factory users. Comment said 系统内部使用 but
     * had zero gating. Restricted to factory_super_admin + permission_admin +
     * platform admins (system-level operations).
     */
    @PostMapping
    @RequireRole({"factory_super_admin", "permission_admin", "platform_admin", "super_admin"})
    @Operation(summary = "创建通知", description = "创建新的通知消息，系统内部使用。默认通知类型为INFO，默认未读状态")
    public ApiResponse<Notification> createNotification(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @Valid @RequestBody @Parameter(description = "通知信息，包含标题、内容、类型等")
                CreateNotificationRequest request) {

        log.info("创建通知: factoryId={}, title={}", factoryId, request.getTitle());

        Notification notification = toNotification(request);
        notification.setFactoryId(factoryId);
        // Apply service-owned defaults when caller omits (Rule 17.1: defaults live in
        // a single source-of-truth — this controller, NOT @Builder.Default leaking
        // through Jackson @NoArgsConstructor field initializers).
        if (notification.getType() == null) {
            notification.setType(NotificationType.INFO);
        }
        if (notification.getIsRead() == null) {
            notification.setIsRead(false);
        }

        Notification saved = notificationRepository.save(notification);

        return ApiResponse.success(saved);
    }

    // ===================================================================
    // Rule 17.1 — wire→entity mappers (Issue #384 batch 6 final).
    // Mapper deliberately does NOT replicate service-owned defaults:
    //   - factoryId from @PathVariable (set after mapping)
    //   - type default NotificationType.INFO (controller-owned)
    //   - isRead default false (controller-owned)
    //   - id, readAt, audit timestamps managed by JPA / BaseEntity
    // ===================================================================

    /**
     * Map {@link CreateNotificationRequest} → {@link Notification}.
     *
     * <p>Auto-managed by controller after mapping: {@code factoryId} (path var),
     * {@code type} INFO-fallback, {@code isRead} false-fallback. Auto-managed by
     * JPA / BaseEntity: {@code id}, {@code readAt}, {@code createdAt},
     * {@code updatedAt}, {@code deletedAt}.
     */
    private static Notification toNotification(CreateNotificationRequest r) {
        Notification n = new Notification();
        n.setUserId(r.getUserId());
        n.setTitle(r.getTitle());
        n.setContent(r.getContent());
        n.setType(r.getType());
        n.setIsRead(r.getIsRead());
        n.setTargetRole(r.getTargetRole());
        n.setSource(r.getSource());
        n.setSourceId(r.getSourceId());
        n.setActionUrl(r.getActionUrl());
        return n;
    }

    /**
     * 删除通知
     *
     * Issue #718 (2026-05-17): @RequireRole added — prevent any auth user from
     * permanently deleting factory notifications. Restricted to admin roles.
     */
    @DeleteMapping("/{id}")
    @RequireRole({"factory_super_admin", "permission_admin", "platform_admin", "super_admin"})
    @Operation(summary = "删除通知", description = "永久删除指定的通知记录，此操作不可逆")
    @Transactional
    public ApiResponse<Void> deleteNotification(
            @PathVariable @Parameter(description = "工厂ID", example = "F001") String factoryId,
            @PathVariable @Parameter(description = "通知ID", example = "1") Long id) {

        log.info("删除通知: factoryId={}, id={}", factoryId, id);

        Notification notification = notificationRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new RuntimeException("通知不存在: " + id));

        notificationRepository.delete(notification);

        return ApiResponse.success(null);
    }
}
