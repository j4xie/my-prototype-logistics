package com.cretas.edge;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 边缘网关启动类
 *
 * 功能：
 * 1. 串口采集电子秤数据 (RS232/RS485)
 * 2. 解析不同品牌秤的协议
 * 3. 通过 MQTT 上报数据到后端
 */
@Slf4j
@SpringBootApplication
@EnableScheduling
public class EdgeGatewayApplication {

    public static void main(String[] args) {
        log.info("========================================");
        log.info("  Cretas Edge Gateway Starting...");
        log.info("========================================");

        SpringApplication.run(EdgeGatewayApplication.class, args);

        log.info("========================================");
        log.info("  Cretas Edge Gateway Started!");
        log.info("========================================");
    }
}
