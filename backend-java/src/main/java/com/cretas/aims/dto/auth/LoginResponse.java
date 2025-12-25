package com.cretas.aims.dto.auth;

import com.cretas.aims.dto.user.UserDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 登录响应对象
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "登录响应对象")
public class LoginResponse {

    @Schema(description = "访问令牌")
    private String accessToken;

    @Schema(description = "刷新令牌")
    private String refreshToken;

    @Schema(description = "令牌类型", example = "Bearer")
    @Builder.Default
    private String tokenType = "Bearer";

    @Schema(description = "过期时间（秒）", example = "3600")
    private Long expiresIn;

    @Schema(description = "用户信息")
    private UserDTO user;

    @Schema(description = "用户类型", example = "factory_user / platform_admin")
    private String userType;

    @Schema(description = "用户权限")
    private UserPermissions permissions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserPermissions {
        @Schema(description = "模块权限")
        private ModulePermissions modules;

        @Schema(description = "功能权限")
        private String[] features;

        @Schema(description = "角色名称")
        private String role;

        @Schema(description = "角色级别")
        private Integer roleLevel;

        @Schema(description = "用户类型")
        private String userType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModulePermissions {
        @JsonProperty("farming_access")
        private Boolean farmingAccess;

        @JsonProperty("processing_access")
        private Boolean processingAccess;

        @JsonProperty("logistics_access")
        private Boolean logisticsAccess;

        @JsonProperty("trace_access")
        private Boolean traceAccess;

        @JsonProperty("admin_access")
        private Boolean adminAccess;

        @JsonProperty("platform_access")
        private Boolean platformAccess;

        @JsonProperty("debug_access")
        private Boolean debugAccess;

        @JsonProperty("system_config")
        private Boolean systemConfig;
    }
}