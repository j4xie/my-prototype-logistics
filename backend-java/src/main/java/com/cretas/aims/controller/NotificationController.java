package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.Notification;
import com.cretas.aims.entity.enums.NotificationType;
import com.cretas.aims.repository.NotificationRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
@Tag(name = "通知管理", description = "通知管理相关接口")
public class NotificationController {

    private static final Logger log = LoggerFactory.getLogger(NotificationController.class);

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    /**
     * 获取通知列表
     */
    @GetMapping
    @Operation(summary = "获取通知列表")
    public ApiResponse<PageResponse<Notification>> getNotifications(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestParam(defaultValue = "1") @Parameter(description = "页码（1-based）") Integer page,
            @RequestParam(defaultValue = "20") @Parameter(description = "每页大小") Integer size,
            @RequestParam(required = false) @Parameter(description = "通知类型") NotificationType type,
            @RequestParam(required = false) @Parameter(description = "是否已读") Boolean isRead) {

        log.debug("获取通知列表: factoryId={}, page={}, size={}, type={}, isRead={}",
                  factoryId, page, size, type, isRead);

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Notification> pageResult;
        if (type != null) {
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
    @Operation(summary = "获取未读通知数量")
    public ApiResponse<Map<String, Long>> getUnreadCount(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.debug("获取未读通知数量: factoryId={}", factoryId);

        long count = notificationRepository.countByFactoryIdAndIsReadFalse(factoryId);

        Map<String, Long> result = new HashMap<>();
        result.put("count", count);

        return ApiResponse.success(result);
    }

    /**
     * 获取最近通知
     */
    @GetMapping("/recent")
    @Operation(summary = "获取最近10条通知")
    public ApiResponse<List<Notification>> getRecentNotifications(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.debug("获取最近通知: factoryId={}", factoryId);

        List<Notification> notifications = notificationRepository.findTop10ByFactoryIdOrderByCreatedAtDesc(factoryId);

        return ApiResponse.success(notifications);
    }

    /**
     * 获取单个通知详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "获取通知详情")
    public ApiResponse<Notification> getNotificationById(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "通知ID") Long id) {

        log.debug("获取通知详情: factoryId={}, id={}", factoryId, id);

        Notification notification = notificationRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new RuntimeException("通知不存在: " + id));

        return ApiResponse.success(notification);
    }

    /**
     * 标记单个通知为已读
     */
    @PutMapping("/{id}/read")
    @Operation(summary = "标记通知为已读")
    @Transactional
    public ApiResponse<Notification> markAsRead(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "通知ID") Long id) {

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
     * 标记所有通知为已读
     */
    @PutMapping("/mark-all-read")
    @Operation(summary = "标记所有通知为已读")
    @Transactional
    public ApiResponse<Map<String, Integer>> markAllAsRead(
            @PathVariable @Parameter(description = "工厂ID") String factoryId) {

        log.info("标记所有通知为已读: factoryId={}", factoryId);

        int count = notificationRepository.markAllAsRead(factoryId, LocalDateTime.now());

        Map<String, Integer> result = new HashMap<>();
        result.put("updatedCount", count);

        return ApiResponse.success(result);
    }

    /**
     * 创建通知（系统内部使用）
     */
    @PostMapping
    @Operation(summary = "创建通知")
    public ApiResponse<Notification> createNotification(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @RequestBody Notification notification) {

        log.info("创建通知: factoryId={}, title={}", factoryId, notification.getTitle());

        notification.setFactoryId(factoryId);
        if (notification.getType() == null) {
            notification.setType(NotificationType.INFO);
        }
        if (notification.getIsRead() == null) {
            notification.setIsRead(false);
        }

        Notification saved = notificationRepository.save(notification);

        return ApiResponse.success(saved);
    }

    /**
     * 删除通知
     */
    @DeleteMapping("/{id}")
    @Operation(summary = "删除通知")
    @Transactional
    public ApiResponse<Void> deleteNotification(
            @PathVariable @Parameter(description = "工厂ID") String factoryId,
            @PathVariable @Parameter(description = "通知ID") Long id) {

        log.info("删除通知: factoryId={}, id={}", factoryId, id);

        Notification notification = notificationRepository.findByFactoryIdAndId(factoryId, id)
                .orElseThrow(() -> new RuntimeException("通知不存在: " + id));

        notificationRepository.delete(notification);

        return ApiResponse.success(null);
    }
}
