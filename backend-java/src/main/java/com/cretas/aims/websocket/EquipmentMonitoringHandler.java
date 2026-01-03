package com.cretas.aims.websocket;

import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.repository.EquipmentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * 设备实时监控 WebSocket 处理器
 * 提供设备状态实时推送、心跳检测、自动重连支持
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EquipmentMonitoringHandler extends TextWebSocketHandler {

    private final EquipmentRepository equipmentRepository;
    private final ObjectMapper objectMapper;

    /**
     * 所有活跃的 WebSocket 会话
     * Key: sessionId, Value: WebSocketSession
     */
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    /**
     * 按工厂ID分组的会话
     * Key: factoryId, Value: Set of sessionIds
     */
    private final Map<String, Set<String>> factorySessions = new ConcurrentHashMap<>();

    /**
     * 会话订阅的工厂ID
     * Key: sessionId, Value: factoryId
     */
    private final Map<String, String> sessionFactoryMap = new ConcurrentHashMap<>();

    /**
     * 最后心跳时间
     * Key: sessionId, Value: timestamp
     */
    private final Map<String, Long> lastHeartbeat = new ConcurrentHashMap<>();

    /**
     * 心跳超时时间（毫秒）
     */
    private static final long HEARTBEAT_TIMEOUT_MS = 60000; // 60秒

    /**
     * 心跳检测间隔（毫秒）
     */
    private static final long HEARTBEAT_CHECK_INTERVAL_MS = 30000; // 30秒

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        sessions.put(sessionId, session);
        lastHeartbeat.put(sessionId, System.currentTimeMillis());

        log.info("WebSocket 连接建立: sessionId={}, remoteAddress={}",
                sessionId, session.getRemoteAddress());

        // 发送欢迎消息
        sendMessage(session, createMessage("connected", Map.of(
                "sessionId", sessionId,
                "message", "欢迎连接设备监控服务",
                "serverTime", LocalDateTime.now().toString()
        )));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        cleanupSession(sessionId);

        log.info("WebSocket 连接关闭: sessionId={}, status={}",
                sessionId, status.getCode());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();
        String payload = message.getPayload();

        // 更新心跳时间
        lastHeartbeat.put(sessionId, System.currentTimeMillis());

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(payload, Map.class);
            String type = (String) data.get("type");

            switch (type) {
                case "subscribe":
                    handleSubscribe(session, data);
                    break;
                case "unsubscribe":
                    handleUnsubscribe(session);
                    break;
                case "heartbeat":
                case "ping":
                    handlePing(session);
                    break;
                case "get_status":
                    handleGetStatus(session, data);
                    break;
                default:
                    log.warn("未知消息类型: type={}, sessionId={}", type, sessionId);
                    sendError(session, "UNKNOWN_MESSAGE_TYPE", "未知的消息类型: " + type);
            }
        } catch (JsonProcessingException e) {
            log.warn("消息解析失败: sessionId={}, payload={}", sessionId, payload);
            sendError(session, "INVALID_JSON", "无效的 JSON 格式");
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String sessionId = session.getId();
        log.error("WebSocket 传输错误: sessionId={}, error={}",
                sessionId, exception.getMessage());

        cleanupSession(sessionId);

        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    /**
     * 处理订阅请求
     */
    private void handleSubscribe(WebSocketSession session, Map<String, Object> data) {
        String sessionId = session.getId();
        String factoryId = (String) data.get("factoryId");

        if (factoryId == null || factoryId.isEmpty()) {
            sendError(session, "MISSING_FACTORY_ID", "缺少 factoryId 参数");
            return;
        }

        // 移除旧的订阅
        String oldFactoryId = sessionFactoryMap.get(sessionId);
        if (oldFactoryId != null) {
            Set<String> oldSessions = factorySessions.get(oldFactoryId);
            if (oldSessions != null) {
                oldSessions.remove(sessionId);
            }
        }

        // 添加新的订阅
        sessionFactoryMap.put(sessionId, factoryId);
        factorySessions.computeIfAbsent(factoryId, k -> new CopyOnWriteArraySet<>()).add(sessionId);

        log.info("会话订阅工厂: sessionId={}, factoryId={}", sessionId, factoryId);

        // 发送当前设备状态
        sendCurrentEquipmentStatus(session, factoryId);

        sendMessage(session, createMessage("subscribed", Map.of(
                "factoryId", factoryId,
                "message", "已订阅工厂设备监控"
        )));
    }

    /**
     * 处理取消订阅请求
     */
    private void handleUnsubscribe(WebSocketSession session) {
        String sessionId = session.getId();
        String factoryId = sessionFactoryMap.remove(sessionId);

        if (factoryId != null) {
            Set<String> sessions = factorySessions.get(factoryId);
            if (sessions != null) {
                sessions.remove(sessionId);
            }
        }

        log.info("会话取消订阅: sessionId={}, factoryId={}", sessionId, factoryId);

        sendMessage(session, createMessage("unsubscribed", Map.of(
                "message", "已取消订阅"
        )));
    }

    /**
     * 处理心跳请求
     */
    private void handlePing(WebSocketSession session) {
        sendMessage(session, createMessage("pong", Map.of(
                "serverTime", LocalDateTime.now().toString()
        )));
    }

    /**
     * 处理获取状态请求
     */
    private void handleGetStatus(WebSocketSession session, Map<String, Object> data) {
        String factoryId = sessionFactoryMap.get(session.getId());
        if (factoryId == null) {
            factoryId = (String) data.get("factoryId");
        }

        if (factoryId != null) {
            sendCurrentEquipmentStatus(session, factoryId);
        } else {
            sendError(session, "NOT_SUBSCRIBED", "请先订阅工厂");
        }
    }

    /**
     * 发送当前设备状态
     */
    private void sendCurrentEquipmentStatus(WebSocketSession session, String factoryId) {
        try {
            List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId);

            List<Map<String, Object>> equipmentList = new ArrayList<>();
            for (FactoryEquipment eq : equipments) {
                Map<String, Object> eqData = new HashMap<>();
                eqData.put("id", eq.getId());
                eqData.put("code", eq.getEquipmentCode());
                eqData.put("name", eq.getEquipmentName());
                eqData.put("status", eq.getStatus());
                eqData.put("type", eq.getType());
                eqData.put("location", eq.getLocation());
                eqData.put("totalRunningHours", eq.getTotalRunningHours());
                eqData.put("lastMaintenanceDate", eq.getLastMaintenanceDate());
                eqData.put("nextMaintenanceDate", eq.getNextMaintenanceDate());
                equipmentList.add(eqData);
            }

            sendMessage(session, createMessage("equipment_status", Map.of(
                    "factoryId", factoryId,
                    "equipments", equipmentList,
                    "count", equipmentList.size(),
                    "timestamp", LocalDateTime.now().toString()
            )));

        } catch (Exception e) {
            log.error("获取设备状态失败: factoryId={}, error={}", factoryId, e.getMessage());
            sendError(session, "FETCH_ERROR", "获取设备状态失败");
        }
    }

    /**
     * 广播设备状态更新到指定工厂的所有订阅者
     */
    public void broadcastEquipmentUpdate(String factoryId, FactoryEquipment equipment) {
        Set<String> subscriberIds = factorySessions.get(factoryId);
        if (subscriberIds == null || subscriberIds.isEmpty()) {
            return;
        }

        Map<String, Object> equipmentData = new HashMap<>();
        equipmentData.put("id", equipment.getId());
        equipmentData.put("code", equipment.getEquipmentCode());
        equipmentData.put("name", equipment.getEquipmentName());
        equipmentData.put("status", equipment.getStatus());
        equipmentData.put("type", equipment.getType());
        equipmentData.put("location", equipment.getLocation());
        equipmentData.put("totalRunningHours", equipment.getTotalRunningHours());

        Map<String, Object> message = createMessage("equipment_update", Map.of(
                "factoryId", factoryId,
                "equipment", equipmentData,
                "timestamp", LocalDateTime.now().toString()
        ));

        for (String sessionId : subscriberIds) {
            WebSocketSession session = sessions.get(sessionId);
            if (session != null && session.isOpen()) {
                sendMessage(session, message);
            }
        }

        log.debug("广播设备更新: factoryId={}, equipmentId={}, subscriberCount={}",
                factoryId, equipment.getId(), subscriberIds.size());
    }

    /**
     * 广播设备告警到指定工厂的所有订阅者
     */
    public void broadcastEquipmentAlert(String factoryId, Long equipmentId, String alertType, String alertMessage) {
        Set<String> subscriberIds = factorySessions.get(factoryId);
        if (subscriberIds == null || subscriberIds.isEmpty()) {
            return;
        }

        Map<String, Object> message = createMessage("equipment_alert", Map.of(
                "factoryId", factoryId,
                "equipmentId", equipmentId,
                "alertType", alertType,
                "message", alertMessage,
                "timestamp", LocalDateTime.now().toString()
        ));

        for (String sessionId : subscriberIds) {
            WebSocketSession session = sessions.get(sessionId);
            if (session != null && session.isOpen()) {
                sendMessage(session, message);
            }
        }

        log.info("广播设备告警: factoryId={}, equipmentId={}, alertType={}",
                factoryId, equipmentId, alertType);
    }

    /**
     * 定时心跳检测（每30秒执行一次）
     */
    @Scheduled(fixedRate = HEARTBEAT_CHECK_INTERVAL_MS)
    public void checkHeartbeats() {
        long now = System.currentTimeMillis();
        List<String> timeoutSessions = new ArrayList<>();

        for (Map.Entry<String, Long> entry : lastHeartbeat.entrySet()) {
            if (now - entry.getValue() > HEARTBEAT_TIMEOUT_MS) {
                timeoutSessions.add(entry.getKey());
            }
        }

        for (String sessionId : timeoutSessions) {
            WebSocketSession session = sessions.get(sessionId);
            if (session != null && session.isOpen()) {
                log.warn("会话心跳超时，关闭连接: sessionId={}", sessionId);
                try {
                    session.close(CloseStatus.GOING_AWAY);
                } catch (IOException e) {
                    log.error("关闭超时会话失败: sessionId={}, error={}", sessionId, e.getMessage());
                }
            }
            cleanupSession(sessionId);
        }
    }

    /**
     * 定时发送心跳到所有会话（每25秒执行一次）
     */
    @Scheduled(fixedRate = 25000)
    public void sendHeartbeats() {
        Map<String, Object> heartbeat = createMessage("heartbeat", Map.of(
                "serverTime", LocalDateTime.now().toString()
        ));

        for (WebSocketSession session : sessions.values()) {
            if (session.isOpen()) {
                sendMessage(session, heartbeat);
            }
        }
    }

    /**
     * 清理会话
     */
    private void cleanupSession(String sessionId) {
        sessions.remove(sessionId);
        lastHeartbeat.remove(sessionId);

        String factoryId = sessionFactoryMap.remove(sessionId);
        if (factoryId != null) {
            Set<String> factorySessionSet = factorySessions.get(factoryId);
            if (factorySessionSet != null) {
                factorySessionSet.remove(sessionId);
            }
        }
    }

    /**
     * 发送消息
     */
    private void sendMessage(WebSocketSession session, Map<String, Object> message) {
        if (session == null || !session.isOpen()) {
            return;
        }

        try {
            String json = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(json));
        } catch (IOException e) {
            log.error("发送消息失败: sessionId={}, error={}", session.getId(), e.getMessage());
        }
    }

    /**
     * 发送错误消息
     */
    private void sendError(WebSocketSession session, String code, String message) {
        sendMessage(session, createMessage("error", Map.of(
                "code", code,
                "message", message
        )));
    }

    /**
     * 创建消息对象
     */
    private Map<String, Object> createMessage(String type, Map<String, Object> data) {
        Map<String, Object> message = new HashMap<>();
        message.put("type", type);
        message.put("data", data);
        message.put("timestamp", System.currentTimeMillis());
        return message;
    }

    /**
     * 获取连接统计信息
     */
    public Map<String, Object> getConnectionStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSessions", sessions.size());
        stats.put("factorySubscriptions", factorySessions.size());

        Map<String, Integer> factoryStats = new HashMap<>();
        for (Map.Entry<String, Set<String>> entry : factorySessions.entrySet()) {
            factoryStats.put(entry.getKey(), entry.getValue().size());
        }
        stats.put("sessionsByFactory", factoryStats);

        return stats;
    }
}
