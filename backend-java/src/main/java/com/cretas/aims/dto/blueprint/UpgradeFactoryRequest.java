package com.cretas.aims.dto.blueprint;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 升级工厂版本请求
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
@Schema(description = "升级工厂蓝图版本请求")
public class UpgradeFactoryRequest {

    @Schema(description = "目标版本 (不填则升级到最新)")
    private Integer targetVersion;

    @Schema(description = "是否强制升级 (忽略自定义修改)")
    private Boolean forceUpgrade;

    @Schema(description = "升级操作人ID")
    private Long upgradedBy;

    @Schema(description = "升级说明")
    private String upgradeNote;
}
