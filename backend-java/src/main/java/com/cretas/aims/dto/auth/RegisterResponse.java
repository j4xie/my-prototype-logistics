package com.cretas.aims.dto.auth;

import com.cretas.aims.dto.user.UserDTO;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户注册响应DTO
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户注册响应")
public class RegisterResponse {

    @Schema(description = "用户信息")
    private UserDTO user;

    @Schema(description = "访问令牌", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String accessToken;

    @Schema(description = "刷新令牌", example = "refresh_token_xxx")
    private String refreshToken;

    @Schema(description = "令牌类型", example = "Bearer")
    @Builder.Default
    private String tokenType = "Bearer";

    @Schema(description = "令牌过期时间（秒）", example = "3600")
    @Builder.Default
    private Long expiresIn = 3600L;

    @Schema(description = "提示消息", example = "注册成功，请等待管理员激活您的账户")
    private String message;
}
