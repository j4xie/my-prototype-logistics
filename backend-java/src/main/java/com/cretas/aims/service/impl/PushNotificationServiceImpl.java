package com.cretas.aims.service.impl;

import com.cretas.aims.entity.DeviceRegistration;
import com.cretas.aims.repository.DeviceRegistrationRepository;
import com.cretas.aims.service.PushNotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 推送通知服务实现
 * 使用 Expo Push Notification API
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationServiceImpl implements PushNotificationService {

    private static final String EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
    private static final int MAX_BATCH_SIZE = 100; // Expo 限制每次最多发送 100 条

    private final DeviceRegistrationRepository deviceRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void sendToDevice(String pushToken, String title, String body, Map<String, Object> data) {
        sendToDevice(pushToken, title, body, data, "default");
    }

    @Override
    public void sendToDevice(String pushToken, String title, String body, Map<String, Object> data, String priority) {
        if (!isValidExpoPushToken(pushToken)) {
            log.warn("无效的 Push Token: {}", pushToken);
            return;
        }

        try {
            Map<String, Object> message = buildPushMessage(pushToken, title, body, data, priority);
            sendPushRequest(Collections.singletonList(message));
            log.info("推送已发送到设备: token={}, title={}", pushToken, title);
        } catch (Exception e) {
            log.error("发送推送失败: token={}, error={}", pushToken, e.getMessage(), e);
        }
    }

    @Override
    public void sendToUser(Long userId, String title, String body, Map<String, Object> data) {
        List<DeviceRegistration> devices = deviceRepository.findByUserIdAndIsEnabledTrue(userId);

        if (devices.isEmpty()) {
            log.warn("用户 {} 没有已注册的设备", userId);
            return;
        }

        String[] tokens = devices.stream()
                .map(DeviceRegistration::getPushToken)
                .toArray(String[]::new);

        sendBatch(tokens, title, body, data);
    }

    @Override
    public void sendToFactory(String factoryId, String title, String body, Map<String, Object> data) {
        List<DeviceRegistration> devices = deviceRepository.findByFactoryIdAndIsEnabledTrue(factoryId);

        if (devices.isEmpty()) {
            log.warn("工厂 {} 没有已注册的设备", factoryId);
            return;
        }

        String[] tokens = devices.stream()
                .map(DeviceRegistration::getPushToken)
                .toArray(String[]::new);

        sendBatch(tokens, title, body, data);
    }

    @Override
    public void sendToUsers(Long[] userIds, String title, String body, Map<String, Object> data) {
        List<DeviceRegistration> devices = new ArrayList<>();

        for (Long userId : userIds) {
            devices.addAll(deviceRepository.findByUserIdAndIsEnabledTrue(userId));
        }

        if (devices.isEmpty()) {
            log.warn("指定的用户没有已注册的设备");
            return;
        }

        String[] tokens = devices.stream()
                .map(DeviceRegistration::getPushToken)
                .distinct()
                .toArray(String[]::new);

        sendBatch(tokens, title, body, data);
    }

    @Override
    public void sendBatch(String[] pushTokens, String title, String body, Map<String, Object> data) {
        // 过滤有效的 Token
        List<String> validTokens = Arrays.stream(pushTokens)
                .filter(this::isValidExpoPushToken)
                .distinct()
                .collect(Collectors.toList());

        if (validTokens.isEmpty()) {
            log.warn("没有有效的 Push Token");
            return;
        }

        // 分批发送（Expo 限制每次最多 100 条）
        List<List<String>> batches = partition(validTokens, MAX_BATCH_SIZE);

        for (List<String> batch : batches) {
            try {
                List<Map<String, Object>> messages = batch.stream()
                        .map(token -> buildPushMessage(token, title, body, data, "default"))
                        .collect(Collectors.toList());

                sendPushRequest(messages);
                log.info("批量推送已发送: count={}, title={}", batch.size(), title);
            } catch (Exception e) {
                log.error("批量推送失败: error={}", e.getMessage(), e);
            }
        }
    }

    @Override
    public void sendApprovalNotification(Long userId, String approvalType, Long approvalId, String message) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", "approval");
        data.put("approvalType", approvalType);
        data.put("approvalId", approvalId);
        data.put("screen", "ApprovalDetail");

        sendToUser(userId, "审批通知", message, data);
    }

    @Override
    public void sendQualityNotification(Long userId, Long inspectionId, String inspectionResult, String message) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", "quality");
        data.put("inspectionId", inspectionId);
        data.put("result", inspectionResult);
        data.put("screen", "QualityInspectionDetail");

        sendToUser(userId, "质检通知", message, data);
    }

    @Override
    public void sendPlanChangeNotification(Long[] userIds, Long planId, String changeType, String message) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", "plan_change");
        data.put("planId", planId);
        data.put("changeType", changeType);
        data.put("screen", "PlanDetail");

        sendToUsers(userIds, "计划变更通知", message, data);
    }

    @Override
    public void sendUrgentInsertNotification(Long userId, Long planId, String message) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", "urgent_insert");
        data.put("planId", planId);
        data.put("screen", "UrgentInsertScreen");

        // 紧急通知使用高优先级
        List<DeviceRegistration> devices = deviceRepository.findByUserIdAndIsEnabledTrue(userId);
        for (DeviceRegistration device : devices) {
            sendToDevice(device.getPushToken(), "紧急插单通知", message, data, "high");
        }
    }

    @Override
    public boolean validatePushToken(String pushToken) {
        return isValidExpoPushToken(pushToken);
    }

    /**
     * 构建推送消息对象
     */
    private Map<String, Object> buildPushMessage(String pushToken, String title, String body,
                                                   Map<String, Object> data, String priority) {
        Map<String, Object> message = new HashMap<>();
        message.put("to", pushToken);
        message.put("title", title);
        message.put("body", body);
        message.put("sound", "default");
        message.put("priority", priority);

        if (data != null && !data.isEmpty()) {
            message.put("data", data);
        }

        // Android 特定配置
        Map<String, Object> android = new HashMap<>();
        android.put("channelId", data != null && data.containsKey("type") ?
                data.get("type").toString() : "default");
        message.put("android", android);

        return message;
    }

    /**
     * 发送推送请求到 Expo API
     */
    private void sendPushRequest(List<Map<String, Object>> messages) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "application/json");
            headers.set("Accept-Encoding", "gzip, deflate");

            String jsonPayload = objectMapper.writeValueAsString(messages);
            HttpEntity<String> request = new HttpEntity<>(jsonPayload, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    EXPO_PUSH_API_URL,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK) {
                log.debug("Expo Push API 响应: {}", response.getBody());
            } else {
                log.error("Expo Push API 返回错误: status={}, body={}",
                        response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            log.error("调用 Expo Push API 失败", e);
            throw new RuntimeException("推送发送失败", e);
        }
    }

    /**
     * 验证 Expo Push Token 格式
     */
    private boolean isValidExpoPushToken(String token) {
        if (token == null || token.isEmpty()) {
            return false;
        }

        // Expo Push Token 格式: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
        // 或新格式: ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]
        return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
    }

    /**
     * 将列表分批
     */
    private <T> List<List<T>> partition(List<T> list, int size) {
        List<List<T>> partitions = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            partitions.add(list.subList(i, Math.min(i + size, list.size())));
        }
        return partitions;
    }
}
