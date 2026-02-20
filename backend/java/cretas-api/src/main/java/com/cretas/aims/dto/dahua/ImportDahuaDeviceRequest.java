package com.cretas.aims.dto.dahua;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 导入大华设备请求 DTO
 * 将发现的设备导入系统
 *
 * @author Cretas Team
 * @since 2026-01-23
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "导入大华设备请求")
public class ImportDahuaDeviceRequest {

    @NotNull(message = "发现的设备信息不能为空")
    @Schema(description = "发现的设备信息", required = true)
    private DiscoveredDahuaDevice discoveredDevice;

    @NotBlank(message = "用户名不能为空")
    @Schema(description = "设备用户名", required = true, example = "admin")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Schema(description = "设备密码", required = true)
    private String password;

    @Schema(description = "设备名称 (可选，不填则使用型号+IP)")
    private String deviceName;

    @Schema(description = "位置描述")
    private String locationDescription;

    @Schema(description = "部门ID")
    private String departmentId;
}
