package com.cretas.edge.config;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;

/**
 * 串口配置
 */
@Slf4j
@Data
@Configuration
@ConfigurationProperties(prefix = "serial")
public class SerialPortConfig {

    /**
     * 是否启用串口采集
     */
    private boolean enabled = true;

    /**
     * 串口设备列表
     */
    private List<PortConfig> ports = new ArrayList<>();

    /**
     * 默认波特率
     */
    private int defaultBaudRate = 9600;

    /**
     * 默认数据位
     */
    private int defaultDataBits = 8;

    /**
     * 默认停止位
     */
    private int defaultStopBits = 1;

    /**
     * 默认校验位 (NONE, ODD, EVEN, MARK, SPACE)
     */
    private String defaultParity = "NONE";

    /**
     * 读取超时时间 (毫秒)
     */
    private int readTimeout = 1000;

    /**
     * 数据采集间隔 (毫秒)
     */
    private int pollingInterval = 500;

    /**
     * 协议配置URL (从后端获取动态协议)
     */
    private String protocolConfigUrl;

    /**
     * 协议配置刷新间隔 (秒)
     */
    private int protocolRefreshInterval = 300;

    /**
     * 单个串口配置
     */
    @Data
    public static class PortConfig {
        /**
         * 设备ID (唯一标识)
         */
        private String deviceId;

        /**
         * 串口名称 (如 COM1, /dev/ttyUSB0)
         */
        private String portName;

        /**
         * 秤品牌/型号
         */
        private String scaleBrand;

        /**
         * 协议类型 (KELI_D2008, TOLEDO, METTLER, CUSTOM)
         */
        private String protocol;

        /**
         * 波特率 (可选，覆盖默认值)
         */
        private Integer baudRate;

        /**
         * 数据位 (可选)
         */
        private Integer dataBits;

        /**
         * 停止位 (可选)
         */
        private Integer stopBits;

        /**
         * 校验位 (可选)
         */
        private String parity;

        /**
         * 是否启用
         */
        private boolean enabled = true;

        /**
         * 自定义协议配置 (JSON格式)
         */
        private String customProtocolConfig;

        /**
         * 获取实际波特率
         */
        public int getActualBaudRate(int defaultValue) {
            return baudRate != null ? baudRate : defaultValue;
        }

        /**
         * 获取实际数据位
         */
        public int getActualDataBits(int defaultValue) {
            return dataBits != null ? dataBits : defaultValue;
        }

        /**
         * 获取实际停止位
         */
        public int getActualStopBits(int defaultValue) {
            return stopBits != null ? stopBits : defaultValue;
        }

        /**
         * 获取实际校验位
         */
        public String getActualParity(String defaultValue) {
            return parity != null ? parity : defaultValue;
        }
    }

    @PostConstruct
    public void init() {
        log.info("Serial port configuration loaded:");
        log.info("  Enabled: {}", enabled);
        log.info("  Default baud rate: {}", defaultBaudRate);
        log.info("  Polling interval: {}ms", pollingInterval);
        log.info("  Configured ports: {}", ports.size());

        for (PortConfig port : ports) {
            log.info("    - {} ({}) - {} - {}",
                    port.getDeviceId(),
                    port.getPortName(),
                    port.getScaleBrand(),
                    port.isEnabled() ? "ENABLED" : "DISABLED");
        }
    }

    /**
     * 获取启用的串口配置列表
     */
    public List<PortConfig> getEnabledPorts() {
        List<PortConfig> enabledPorts = new ArrayList<>();
        for (PortConfig port : ports) {
            if (port.isEnabled()) {
                enabledPorts.add(port);
            }
        }
        return enabledPorts;
    }

    /**
     * 根据设备ID获取串口配置
     */
    public PortConfig getPortByDeviceId(String deviceId) {
        for (PortConfig port : ports) {
            if (port.getDeviceId().equals(deviceId)) {
                return port;
            }
        }
        return null;
    }
}
