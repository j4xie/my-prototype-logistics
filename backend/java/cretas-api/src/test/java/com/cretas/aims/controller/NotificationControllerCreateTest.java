package com.cretas.aims.controller;

import com.cretas.aims.dto.common.ApiResponse;
import com.cretas.aims.dto.notification.CreateNotificationRequest;
import com.cretas.aims.entity.Notification;
import com.cretas.aims.entity.enums.NotificationType;
import com.cretas.aims.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Rule 17.1 cleanup verification for
 * {@link NotificationController#createNotification} (Issue #384 batch 6 final).
 *
 * <p>Asserts that the Controller correctly:
 * <ol>
 *   <li>Binds {@link CreateNotificationRequest} instead of the
 *       {@link Notification} entity directly (Rule 17.1 anti-pattern fix)</li>
 *   <li>Maps the DTO to the Entity at the controller boundary, leaving
 *       controller-owned defaults ({@code type = INFO}, {@code isRead = false})
 *       to be applied AFTER mapping rather than via {@code @Builder.Default}
 *       leakage through Jackson {@code @NoArgsConstructor}</li>
 *   <li>Sets {@code factoryId} from {@code @PathVariable} after mapping</li>
 *   <li>Preserves explicit caller intent (when {@code type} / {@code isRead}
 *       supplied, the default is NOT applied)</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class NotificationControllerCreateTest {

    @Mock NotificationRepository notificationRepository;

    @InjectMocks NotificationController controller;

    @Test
    void createNotification_minimumBody_appliesControllerDefaults_andFactoryIdFromContext() {
        // Minimum wire body: required fields only.
        // NO type (controller INFO fallback). NO isRead (controller false fallback).
        // NO factoryId (controller injects from path).
        CreateNotificationRequest req = new CreateNotificationRequest();
        req.setTitle("质量告警");
        req.setContent("批次 BATCH-F001-001 检测异常");

        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ApiResponse<Notification> resp = controller.createNotification("F001", req);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        Mockito.verify(notificationRepository).save(captor.capture());
        Notification saved = captor.getValue();

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        // Wire-side fields propagated by mapper
        assertEquals("质量告警", saved.getTitle());
        assertEquals("批次 BATCH-F001-001 检测异常", saved.getContent());
        // Controller sets factoryId AFTER mapper
        assertEquals("F001", saved.getFactoryId());
        // Controller-owned defaults applied AFTER mapping (NOT via @Builder.Default)
        assertEquals(NotificationType.INFO, saved.getType());
        assertFalse(saved.getIsRead());
        // Optional wire fields default to null (mapper does NOT fill)
        assertNull(saved.getUserId());
        assertNull(saved.getTargetRole());
        assertNull(saved.getSource());
        assertNull(saved.getSourceId());
        assertNull(saved.getActionUrl());
        // JPA-managed / not-from-wire
        assertNull(saved.getId());
        assertNull(saved.getReadAt());
    }

    @Test
    void createNotification_explicitTypeAndIsRead_preservedNotSilentlyOverwritten() {
        // Rule 17.1 root cause: previously @RequestBody Notification +
        // @Builder.Default could have set type=INFO via field-initializer
        // even when caller intent was ALERT. DTO route preserves the explicit value.
        CreateNotificationRequest req = new CreateNotificationRequest();
        req.setUserId(22L);
        req.setTitle("严重错误");
        req.setContent("数据库连接失败");
        req.setType(NotificationType.ALERT);
        req.setIsRead(true);  // explicit pre-read (e.g. system-generated archived)
        req.setTargetRole("FACTORY_SUPER_ADMIN");
        req.setSource("SYSTEM");
        req.setSourceId("DB-001");
        req.setActionUrl("/system/health");

        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ApiResponse<Notification> resp = controller.createNotification("F002", req);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        Mockito.verify(notificationRepository).save(captor.capture());
        Notification saved = captor.getValue();

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        assertEquals("F002", saved.getFactoryId());
        assertEquals(22L, saved.getUserId());
        assertEquals("严重错误", saved.getTitle());
        assertEquals("数据库连接失败", saved.getContent());
        // Explicit caller intent preserved — INFO fallback NOT applied
        assertEquals(NotificationType.ALERT, saved.getType());
        // sanity that explicit "alert" path differs from default
        assertFalse(NotificationType.INFO.equals(saved.getType()));
        // Explicit isRead=true preserved — false fallback NOT applied
        assertTrue(saved.getIsRead());
        assertEquals("FACTORY_SUPER_ADMIN", saved.getTargetRole());
        assertEquals("SYSTEM", saved.getSource());
        assertEquals("DB-001", saved.getSourceId());
        assertEquals("/system/health", saved.getActionUrl());
    }

    @Test
    void createNotification_responseEnvelope_successTrueDataPresent() {
        CreateNotificationRequest req = new CreateNotificationRequest();
        req.setTitle("Test");
        req.setContent("Body");

        Notification persisted = new Notification();
        persisted.setId(101L);
        persisted.setFactoryId("F001");
        persisted.setTitle("Test");
        persisted.setContent("Body");
        persisted.setType(NotificationType.INFO);
        persisted.setIsRead(false);
        when(notificationRepository.save(any(Notification.class))).thenReturn(persisted);

        ApiResponse<Notification> resp = controller.createNotification("F001", req);

        assertNotNull(resp);
        assertTrue(Boolean.TRUE.equals(resp.getSuccess()));
        assertEquals(persisted, resp.getData());
    }
}
