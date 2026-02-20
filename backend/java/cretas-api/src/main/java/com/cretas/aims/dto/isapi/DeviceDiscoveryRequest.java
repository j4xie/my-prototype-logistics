package com.cretas.aims.dto.isapi;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.util.List;

/**
 * 设备发现请求 DTO
 * 用于扫描局域网中的 ISAPI 摄像机设备
 *
 * @author Cretas Team
 * @since 2026-01-08
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceDiscoveryRequest {

    /**
     * 网段 CIDR 格式
     * 示例: "192.168.1.0/24" 表示 192.168.1.1 - 192.168.1.254
     */
    @NotBlank(message = "网段不能为空")
    private String networkCIDR;

    /**
     * 扫描超时时间（秒）
     * 默认 10 秒
     */
    @Min(value = 1, message = "超时时间最小为1秒")
    @Max(value = 60, message = "超时时间最大为60秒")
    @Builder.Default
    private int timeout = 10;

    /**
     * 要扫描的端口列表
     * 默认: [80, 443, 554, 8080]
     */
    private List<Integer> ports;

    /**
     * 最大并发数
     * 默认 20
     */
    @Min(value = 1, message = "并发数最小为1")
    @Max(value = 100, message = "并发数最大为100")
    @Builder.Default
    private int maxConcurrent = 20;

    /**
     * 获取默认端口列表
     */
    public List<Integer> getPorts() {
        if (ports == null || ports.isEmpty()) {
            return List.of(80, 443, 554, 8080, 37777);
        }
        return ports;
    }
}
