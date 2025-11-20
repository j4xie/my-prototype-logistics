package com.cretas.aims.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 刷新令牌请求
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Schema(description = "刷新令牌请求")
public class RefreshTokenRequest {

    @Schema(description = "刷新令牌", required = true, example = "550e8400-e29b-41d4-a716-446655440000")
    @NotBlank(message = "刷新令牌不能为空")
    private String refreshToken;
}
