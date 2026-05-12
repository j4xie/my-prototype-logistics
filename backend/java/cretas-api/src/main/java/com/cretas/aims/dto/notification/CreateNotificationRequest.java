package com.cretas.aims.dto.notification;

import com.cretas.aims.entity.enums.NotificationType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 创建通知请求 DTO (Rule 17.1 cleanup — Issue #384 batch 6 final).
 *
 * <p>替代 {@code @RequestBody Notification} 实体直绑模式. 隔离 wire contract
 * 与 {@link com.cretas.aims.entity.Notification} 持久化模型 — 防止
 * {@code @Builder.Default} 字段 ({@code type = NotificationType.INFO},
 * {@code isRead = false}) 通过 {@code @NoArgsConstructor} 字段初始化器
 * 在 Jackson 反序列化时静默写入, 进而隐式覆盖客户端意图.
 *
 * <p>Auto-managed by controller / service / DB:
 * <ul>
 *   <li>{@code factoryId} — set from {@code @PathVariable} in controller</li>
 *   <li>{@code type} default {@code INFO} — applied by controller when null (service-owned default)</li>
 *   <li>{@code isRead} default {@code false} — applied by controller when null (service-owned default)</li>
 *   <li>{@code id}, {@code readAt}, {@code createdAt}, {@code updatedAt}, {@code deletedAt}
 *       — never accepted from wire</li>
 *   <li>{@code user} / {@code factory} JPA associations — derived from {@code userId} / {@code factoryId}</li>
 * </ul>
 *
 * @see com.cretas.aims.entity.Notification
 * @see <a href="https://github.com/j4xie/my-prototype-logistics/issues/384">Issue #384 Rule 17.1 batch 6</a>
 * @since 2026-05-11
 */
@Data
@Schema(description = "创建通知请求")
public class CreateNotificationRequest {

    @Schema(description = "目标用户ID, null 表示广播给工厂所有用户", example = "22")
    private Long userId;

    @Schema(description = "通知标题", example = "质量告警", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "通知标题不能为空")
    @Size(max = 200, message = "通知标题长度不能超过200个字符")
    private String title;

    @Schema(description = "通知内容", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "通知内容不能为空")
    private String content;

    @Schema(description = "通知类型: ALERT/INFO/WARNING/SUCCESS/SYSTEM. 不传时由服务端默认 INFO",
            example = "INFO")
    private NotificationType type;

    @Schema(description = "是否已读, 不传时由服务端默认 false", example = "false")
    private Boolean isRead;

    @Schema(description = "目标角色代码 (e.g. WORKSHOP_SUPERVISOR), null = specific user or broadcast",
            example = "WORKSHOP_SUPERVISOR")
    @Size(max = 50, message = "目标角色长度不能超过50个字符")
    private String targetRole;

    @Schema(description = "来源: SYSTEM / ALERT / BATCH / QUALITY 等", example = "ALERT")
    @Size(max = 50, message = "来源长度不能超过50个字符")
    private String source;

    @Schema(description = "关联业务ID", example = "BATCH-F001-001")
    @Size(max = 100, message = "关联业务ID长度不能超过100个字符")
    private String sourceId;

    @Schema(description = "点击跳转 URL", example = "/quality/alert/123")
    @Size(max = 500, message = "跳转 URL 长度不能超过500个字符")
    private String actionUrl;
}
