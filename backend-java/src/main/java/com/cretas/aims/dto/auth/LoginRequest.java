package com.cretas.aims.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 登录请求对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "登录请求对象")
public class LoginRequest {

    @Schema(description = "用户名", required = true, example = "admin")
    @NotBlank(message = "用户名不能为空")
    private String username;

    @Schema(description = "密码", required = true, example = "password123")
    @NotBlank(message = "密码不能为空")
    private String password;

    @Schema(description = "记住我", example = "false")
    private Boolean rememberMe = false;
}