package com.cretas.aims.config;

import com.cretas.aims.websocket.EquipmentMonitoringHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket 配置类
 * 用于配置设备实时监控等 WebSocket 端点
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final EquipmentMonitoringHandler equipmentMonitoringHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 设备监控 WebSocket 端点
        // 支持原生 WebSocket 和 SockJS 回退
        registry.addHandler(equipmentMonitoringHandler, "/ws/equipment-monitoring")
                .setAllowedOrigins("*"); // 允许跨域，生产环境应限制

        // SockJS 回退支持（适用于不支持 WebSocket 的客户端）
        registry.addHandler(equipmentMonitoringHandler, "/ws/equipment-monitoring/sockjs")
                .setAllowedOrigins("*")
                .withSockJS()
                .setHeartbeatTime(25000)      // 心跳间隔 25 秒
                .setDisconnectDelay(5000)     // 断开延迟 5 秒
                .setSessionCookieNeeded(false);
    }
}
