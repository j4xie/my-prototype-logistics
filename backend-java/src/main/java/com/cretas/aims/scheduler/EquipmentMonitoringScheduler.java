package com.cretas.aims.scheduler;

import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.service.PushNotificationService;
import com.cretas.aims.websocket.EquipmentMonitoringHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 设备实时监控调度器
 * 定期检查设备状态并发送异常告警推送
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-02
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EquipmentMonitoringScheduler {

    private final EquipmentRepository equipmentRepository;
    private final PushNotificationService pushNotificationService;
    private final EquipmentMonitoringHandler webSocketHandler;

    /**
     * 已发送告警的设备ID缓存，避免重复发送
     * Key: equipmentId, Value: 最后告警时间戳
     */
    private final Map<Long, Long> alertedEquipments = new ConcurrentHashMap<>();

    /**
     * 告警冷却时间（毫秒）- 同一设备在此时间内不会重复发送告警
     */
    private static final long ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30分钟

    /**
     * 设备状态：异常
     */
    private static final String STATUS_ABNORMAL = "abnormal";

    /**
     * 设备状态：维护中
     */
    private static final String STATUS_MAINTENANCE = "maintenance";

    /**
     * 每30秒检测设备异常状态
     */
    @Scheduled(fixedRate = 30000)
    public void monitorEquipmentStatus() {
        log.debug("开始设备状态监控检查...");

        try {
            // 清理过期的告警缓存
            cleanExpiredAlerts();

            // 查询所有工厂ID（通过查询所有设备获取）
            List<FactoryEquipment> allEquipments = equipmentRepository.findAll();

            // 按工厂分组处理
            Map<String, List<FactoryEquipment>> equipmentsByFactory = new HashMap<>();
            for (FactoryEquipment equipment : allEquipments) {
                equipmentsByFactory.computeIfAbsent(equipment.getFactoryId(), k -> new java.util.ArrayList<>())
                        .add(equipment);
            }

            for (Map.Entry<String, List<FactoryEquipment>> entry : equipmentsByFactory.entrySet()) {
                String factoryId = entry.getKey();
                List<FactoryEquipment> factoryEquipments = entry.getValue();

                // 检查异常状态设备
                checkAbnormalEquipments(factoryId, factoryEquipments);

                // 检查需要维护的设备
                checkMaintenanceDueEquipments(factoryId);
            }
        } catch (Exception e) {
            log.error("设备状态监控检查失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 检查异常状态的设备并发送告警
     */
    private void checkAbnormalEquipments(String factoryId, List<FactoryEquipment> equipments) {
        for (FactoryEquipment equipment : equipments) {
            if (STATUS_ABNORMAL.equalsIgnoreCase(equipment.getStatus())) {
                sendEquipmentAlert(equipment, "equipment_abnormal", "设备异常提醒",
                        String.format("设备 %s 状态异常，请及时检查", equipment.getEquipmentName()));
            }
        }
    }

    /**
     * 检查需要维护的设备并发送提醒
     */
    private void checkMaintenanceDueEquipments(String factoryId) {
        try {
            LocalDate today = LocalDate.now();
            List<FactoryEquipment> maintenanceDue = equipmentRepository.findEquipmentNeedingMaintenance(factoryId, today);

            for (FactoryEquipment equipment : maintenanceDue) {
                sendEquipmentAlert(equipment, "maintenance_due", "设备维护提醒",
                        String.format("设备 %s 已到计划维护日期，请安排维护", equipment.getEquipmentName()));
            }
        } catch (Exception e) {
            log.warn("检查维护到期设备失败: factoryId={}, error={}", factoryId, e.getMessage());
        }
    }

    /**
     * 发送设备告警推送
     */
    private void sendEquipmentAlert(FactoryEquipment equipment, String alertType, String title, String message) {
        // 检查是否在冷却期内
        Long lastAlertTime = alertedEquipments.get(equipment.getId());
        if (lastAlertTime != null && System.currentTimeMillis() - lastAlertTime < ALERT_COOLDOWN_MS) {
            log.debug("设备 {} 在告警冷却期内，跳过发送", equipment.getId());
            return;
        }

        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", alertType);
            pushData.put("equipmentId", equipment.getId());
            pushData.put("equipmentCode", equipment.getEquipmentCode());
            pushData.put("equipmentName", equipment.getEquipmentName());
            pushData.put("status", equipment.getStatus());
            pushData.put("screen", "EquipmentDetail");

            pushNotificationService.sendToFactory(
                    equipment.getFactoryId(),
                    title,
                    message,
                    pushData
            );

            // 同时通过 WebSocket 广播告警
            if (webSocketHandler != null) {
                webSocketHandler.broadcastEquipmentAlert(
                        equipment.getFactoryId(),
                        equipment.getId(),
                        alertType,
                        message
                );
            }

            // 记录告警时间
            alertedEquipments.put(equipment.getId(), System.currentTimeMillis());

            log.info("已发送设备告警推送: equipmentId={}, type={}, factoryId={}",
                    equipment.getId(), alertType, equipment.getFactoryId());
        } catch (Exception e) {
            log.warn("发送设备告警推送失败: equipmentId={}, error={}",
                    equipment.getId(), e.getMessage());
        }
    }

    /**
     * 清理过期的告警缓存
     */
    private void cleanExpiredAlerts() {
        long now = System.currentTimeMillis();
        alertedEquipments.entrySet().removeIf(entry ->
                now - entry.getValue() > ALERT_COOLDOWN_MS * 2);
    }

    /**
     * 每5分钟检查保修即将到期的设备
     */
    @Scheduled(fixedRate = 300000)
    public void checkWarrantyExpiry() {
        log.debug("开始检查保修到期设备...");

        try {
            // 获取所有工厂
            List<FactoryEquipment> allEquipments = equipmentRepository.findAll();
            Set<String> factoryIds = new java.util.HashSet<>();
            for (FactoryEquipment eq : allEquipments) {
                factoryIds.add(eq.getFactoryId());
            }

            LocalDate warningDate = LocalDate.now().plusDays(30); // 30天内到期

            for (String factoryId : factoryIds) {
                List<FactoryEquipment> expiringEquipments =
                        equipmentRepository.findEquipmentWithExpiringWarranty(factoryId, warningDate);

                for (FactoryEquipment equipment : expiringEquipments) {
                    sendEquipmentAlert(equipment, "warranty_expiring", "保修到期提醒",
                            String.format("设备 %s 保修即将在 %s 到期",
                                    equipment.getEquipmentName(),
                                    equipment.getWarrantyExpiryDate()));
                }
            }
        } catch (Exception e) {
            log.error("检查保修到期设备失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 获取当前监控状态
     */
    public Map<String, Object> getMonitoringStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("alertedEquipmentCount", alertedEquipments.size());
        status.put("alertCooldownMinutes", ALERT_COOLDOWN_MS / 60000);
        return status;
    }

    /**
     * 手动清除指定设备的告警冷却
     */
    public void clearAlertCooldown(Long equipmentId) {
        alertedEquipments.remove(equipmentId);
        log.info("已清除设备 {} 的告警冷却", equipmentId);
    }
}
