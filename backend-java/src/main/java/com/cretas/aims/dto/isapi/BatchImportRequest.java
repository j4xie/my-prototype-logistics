package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotBlank;
import java.util.List;

/**
 * 批量导入设备请求 DTO
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchImportRequest {

    /**
     * 要导入的设备列表
     */
    @NotEmpty(message = "设备列表不能为空")
    private List<DeviceImportItem> devices;

    /**
     * 单个设备导入项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DeviceImportItem {
        /**
         * IP 地址
         */
        @NotBlank(message = "IP地址不能为空")
        private String ipAddress;

        /**
         * 端口
         */
        private int port;

        /**
         * 用户名
         */
        @NotBlank(message = "用户名不能为空")
        private String username;

        /**
         * 密码
         */
        @NotBlank(message = "密码不能为空")
        private String password;

        /**
         * 设备名称（可选，默认使用 IP）
         */
        private String deviceName;

        /**
         * 设备类型（可选）
         */
        private String deviceType;

        /**
         * 位置描述（可选）
         */
        private String locationDescription;
    }
}
