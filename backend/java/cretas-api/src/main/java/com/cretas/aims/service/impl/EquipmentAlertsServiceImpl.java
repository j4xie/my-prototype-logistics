package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.CreateEquipmentAlertRequest;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.entity.EquipmentAlert;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.enums.DeviceAlertLevel;
import com.cretas.aims.entity.enums.AlertStatus;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.EquipmentAlertRepository;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.service.EquipmentAlertsService;
import com.cretas.aims.service.PushNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.criteria.Predicate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 设备告警服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-27
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EquipmentAlertsServiceImpl implements EquipmentAlertsService {

    private final EquipmentAlertRepository alertRepository;
    private final EquipmentRepository equipmentRepository;
    private final PushNotificationService pushNotificationService;

    @Override
    public PageResponse<EquipmentAlertDTO> getAlertList(String factoryId, PageRequest pageRequest,
                                                        String keyword, String severity, String status) {
        log.info("查询告警列表: factoryId={}, keyword={}, severity={}, status={}",
                factoryId, keyword, severity, status);

        Specification<EquipmentAlert> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("factoryId"), factoryId));

            if (keyword != null && !keyword.isEmpty()) {
                predicates.add(cb.like(root.get("message"), "%" + keyword + "%"));
            }

            if (severity != null && !severity.isEmpty()) {
                DeviceAlertLevel level = mapSeverityToLevel(severity);
                if (level != null) {
                    predicates.add(cb.equal(root.get("level"), level));
                }
            }

            if (status != null && !status.isEmpty()) {
                try {
                    AlertStatus alertStatus = AlertStatus.valueOf(status);
                    predicates.add(cb.equal(root.get("status"), alertStatus));
                } catch (IllegalArgumentException ignored) {}
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Pageable pageable = org.springframework.data.domain.PageRequest.of(
                pageRequest.getPage() - 1,
                pageRequest.getSize(),
                Sort.by(Sort.Direction.DESC, "triggeredAt")
        );

        Page<EquipmentAlert> page = alertRepository.findAll(spec, pageable);
        List<EquipmentAlertDTO> content = page.getContent().stream()
                .map(this::convertToDTO)
                .toList();

        return PageResponse.of(content, pageRequest.getPage(), pageRequest.getSize(), page.getTotalElements());
    }

    @Override
    @Cacheable(value = "alertStats", key = "#factoryId")
    public Map<String, Object> getAlertStatistics(String factoryId) {
        log.info("查询告警统计: factoryId={}", factoryId);

        List<EquipmentAlert> allAlerts = alertRepository.findByFactoryIdOrderByTriggeredAtDesc(factoryId);

        long total = allAlerts.size();
        long critical = allAlerts.stream()
                .filter(a -> a.getLevel() == DeviceAlertLevel.CRITICAL && a.getStatus() != AlertStatus.RESOLVED)
                .count();
        long warning = allAlerts.stream()
                .filter(a -> a.getLevel() == DeviceAlertLevel.WARNING && a.getStatus() != AlertStatus.RESOLVED)
                .count();
        long resolved = allAlerts.stream()
                .filter(a -> a.getStatus() == AlertStatus.RESOLVED)
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("critical", critical);
        stats.put("warning", warning);
        stats.put("resolved", resolved);

        return stats;
    }

    @Override
    public EquipmentAlertDTO getAlertById(String factoryId, Integer alertId) {
        log.info("获取告警详情: factoryId={}, alertId={}", factoryId, alertId);

        EquipmentAlert alert = alertRepository.findByFactoryIdAndId(factoryId, alertId)
                .orElseThrow(() -> new ResourceNotFoundException("告警不存在: " + alertId));

        return convertToDTO(alert);
    }

    @Override
    @Transactional
    @CacheEvict(value = "alertStats", key = "#factoryId")
    public EquipmentAlertDTO acknowledgeAlert(String factoryId, Integer alertId, Long userId, String userName) {
        log.info("确认告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, userId);

        EquipmentAlert alert = alertRepository.findByFactoryIdAndId(factoryId, alertId)
                .orElseThrow(() -> new ResourceNotFoundException("告警不存在: " + alertId));

        if (alert.getStatus() != AlertStatus.ACTIVE) {
            throw new IllegalStateException("只能确认活跃状态的告警");
        }

        alert.setStatus(AlertStatus.ACKNOWLEDGED);
        alert.setAcknowledgedAt(LocalDateTime.now());
        alert.setAcknowledgedBy(userId);
        alert.setAcknowledgedByName(userName);

        alertRepository.save(alert);

        // 发送告警确认推送通知
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "equipment_alert_acknowledged");
            pushData.put("alertId", alert.getId());
            pushData.put("screen", "EquipmentAlertDetail");
            pushNotificationService.sendToFactory(factoryId, "告警已确认",
                String.format("设备告警已被确认"), pushData);
        } catch (Exception e) {
            log.warn("发送告警确认推送失败: {}", e.getMessage());
        }

        return convertToDTO(alert);
    }

    @Override
    @Transactional
    @CacheEvict(value = "alertStats", key = "#factoryId")
    public EquipmentAlertDTO resolveAlert(String factoryId, Integer alertId, Long userId, String userName, String resolution) {
        log.info("处理告警: factoryId={}, alertId={}, userId={}", factoryId, alertId, userId);

        EquipmentAlert alert = alertRepository.findByFactoryIdAndId(factoryId, alertId)
                .orElseThrow(() -> new ResourceNotFoundException("告警不存在: " + alertId));

        if (alert.getStatus() == AlertStatus.RESOLVED) {
            throw new IllegalStateException("告警已处理");
        }

        alert.setStatus(AlertStatus.RESOLVED);
        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(userId);
        alert.setResolvedByName(userName);
        alert.setResolutionNotes(resolution);

        alertRepository.save(alert);

        // 发送告警解决推送通知
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "equipment_alert_resolved");
            pushData.put("alertId", alert.getId());
            pushData.put("screen", "EquipmentAlertDetail");
            pushNotificationService.sendToFactory(factoryId, "告警已解决",
                String.format("设备告警已解决: %s", resolution), pushData);
        } catch (Exception e) {
            log.warn("发送告警解决推送失败: {}", e.getMessage());
        }

        return convertToDTO(alert);
    }

    private EquipmentAlertDTO convertToDTO(EquipmentAlert alert) {
        String equipmentName = "未知设备";
        if (alert.getEquipmentId() != null) {
            // P0-1 修复: 删除无效空lambda，优化为单次查询
            equipmentName = equipmentRepository.findById(alert.getEquipmentId())
                    .map(FactoryEquipment::getEquipmentName)
                    .orElse("未知设备");
        }
        return EquipmentAlertDTO.builder()
                .id(alert.getId())
                .factoryId(alert.getFactoryId())
                .equipmentId(alert.getEquipmentId())
                .equipmentName(equipmentName)
                .alertType(alert.getAlertType())
                .level(alert.getLevel())
                .status(alert.getStatus())
                .message(alert.getMessage())
                .details(alert.getDetails())
                .triggeredAt(alert.getTriggeredAt())
                .acknowledgedAt(alert.getAcknowledgedAt())
                .acknowledgedBy(alert.getAcknowledgedBy())
                .acknowledgedByName(alert.getAcknowledgedByName())
                .resolvedAt(alert.getResolvedAt())
                .resolvedBy(alert.getResolvedBy())
                .resolvedByName(alert.getResolvedByName())
                .resolutionNotes(alert.getResolutionNotes())
                .createdAt(alert.getCreatedAt())
                .updatedAt(alert.getUpdatedAt())
                .build();
    }

    private DeviceAlertLevel mapSeverityToLevel(String severity) {
        if (severity == null) return null;
        switch (severity.toUpperCase()) {
            case "CRITICAL": return DeviceAlertLevel.CRITICAL;
            case "HIGH": return DeviceAlertLevel.WARNING;
            case "MEDIUM":
            case "LOW": return DeviceAlertLevel.INFO;
            default: return null;
        }
    }

    @Override
    @Transactional
    @CacheEvict(value = "alertStats", key = "#factoryId")
    public EquipmentAlertDTO createAlert(String factoryId, CreateEquipmentAlertRequest request) {
        log.info("创建告警: factoryId={}, equipmentId={}, alertType={}",
                factoryId, request.getEquipmentId(), request.getAlertType());

        // 验证设备是否存在
        FactoryEquipment equipment = equipmentRepository.findById(request.getEquipmentId())
                .orElseThrow(() -> new ResourceNotFoundException("设备不存在: " + request.getEquipmentId()));

        // 验证设备属于该工厂
        if (!factoryId.equals(equipment.getFactoryId())) {
            throw new IllegalArgumentException("设备不属于该工厂");
        }

        // 构建告警实体
        EquipmentAlert alert = EquipmentAlert.builder()
                .factoryId(factoryId)
                .equipmentId(request.getEquipmentId())
                .alertType(request.getAlertType())
                .level(request.getLevel())
                .status(AlertStatus.ACTIVE)
                .message(request.getMessage())
                .details(request.getDetails())
                .triggeredAt(LocalDateTime.now())
                .build();

        // 保存告警
        EquipmentAlert savedAlert = alertRepository.save(alert);

        log.info("告警创建成功: alertId={}", savedAlert.getId());

        // 发送推送通知到工厂所有设备
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "equipment_alert");
            pushData.put("alertId", savedAlert.getId());
            pushData.put("alertLevel", savedAlert.getLevel().name());
            pushData.put("equipmentId", savedAlert.getEquipmentId());
            pushData.put("screen", "EquipmentAlertDetail");

            String priority = savedAlert.getLevel() == DeviceAlertLevel.CRITICAL ? "high" : "default";
            String title = savedAlert.getLevel() == DeviceAlertLevel.CRITICAL ? "紧急设备告警" : "设备告警";

            pushNotificationService.sendToFactory(
                factoryId,
                title,
                String.format("设备 %s: %s", equipment.getEquipmentName(), savedAlert.getMessage()),
                pushData
            );
            log.info("设备告警推送通知已发送: alertId={}, level={}", savedAlert.getId(), savedAlert.getLevel());
        } catch (Exception e) {
            log.error("发送设备告警推送通知失败: alertId={}", savedAlert.getId(), e);
            // 不阻塞告警创建流程
        }

        return convertToDTO(savedAlert);
    }
}
