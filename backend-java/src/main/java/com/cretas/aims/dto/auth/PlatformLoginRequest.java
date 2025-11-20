package com.cretas.aims.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;

/**
 * 平台管理员登录请求DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "平台管理员登录请求")
public class PlatformLoginRequest {

    @NotBlank(message = "用户名不能为空")
    @Schema(description = "用户名", required = true, example = "platform_admin")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Schema(description = "密码", required = true, example = "admin123")
    private String password;

    @Schema(description = "设备信息（可选）")
    private String deviceInfo;
}
