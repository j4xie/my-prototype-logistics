package com.cretas.aims.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.*;

/**
 * 用户注册请求DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户注册请求")
public class RegisterRequest {

    @Schema(description = "临时令牌（验证手机后获得）", required = false, example = "temp_token_xxx")
    private String tempToken;

    @Schema(description = "工厂ID（可选）", required = false, example = "F001")
    private String factoryId;

    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度必须在3-50个字符之间")
    @Schema(description = "用户名（默认使用手机号）", required = true, example = "13800138000")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 100, message = "密码长度必须在6-100个字符之间")
    @Schema(description = "密码", required = true, example = "password123")
    private String password;

    @Schema(description = "真实姓名（可选）", required = false, example = "张三")
    private String realName;

    @Schema(description = "部门", example = "生产部")
    private String department;

    @Schema(description = "职位", example = "操作员")
    private String position;
}
