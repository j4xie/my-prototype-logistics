package com.cretas.aims.dto.blueprint;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 工厂蓝图绑定DTO
 *
 * Sprint 3 任务: S3-7 蓝图版本管理
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "工厂蓝图绑定信息")
public class FactoryBindingDTO {

    @Schema(description = "绑定ID")
    private String id;

    @Schema(description = "工厂ID")
    private String factoryId;

    @Schema(description = "工厂名称")
    private String factoryName;

    @Schema(description = "蓝图ID")
    private String blueprintId;

    @Schema(description = "蓝图名称")
    private String blueprintName;

    @Schema(description = "当前应用的版本")
    private Integer appliedVersion;

    @Schema(description = "最新可用版本")
    private Integer latestVersion;

    @Schema(description = "是否有更新可用")
    private Boolean hasUpdate;

    @Schema(description = "是否自动更新")
    private Boolean autoUpdate;

    @Schema(description = "更新策略: MANUAL, AUTO_MINOR, AUTO_ALL")
    private String updatePolicy;

    @Schema(description = "待处理的更新版本")
    private Integer pendingVersion;

    @Schema(description = "通知状态: NONE, PENDING, NOTIFIED, DISMISSED")
    private String notificationStatus;

    @Schema(description = "上次应用时间")
    private LocalDateTime lastAppliedAt;

    @Schema(description = "上次检查更新时间")
    private LocalDateTime lastCheckedAt;
}
