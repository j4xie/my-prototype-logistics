package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.SchedulingAlertDTO;
import com.cretas.aims.entity.scheduling.SchedulingAlert;
import com.cretas.aims.repository.scheduling.SchedulingAlertRepository;
import com.cretas.aims.service.scheduling.SchedulingAlertService;
import com.cretas.aims.mapper.SchedulingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 调度告警服务实现
 *
 * 负责告警的创建、查询和处理
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchedulingAlertServiceImpl implements SchedulingAlertService {

    private final SchedulingAlertRepository alertRepository;
    private final SchedulingMapper mapper;

    @Override
    public List<SchedulingAlertDTO> getUnresolvedAlerts(String factoryId) {
        List<SchedulingAlert> alerts = alertRepository
                .findByFactoryIdAndResolvedAtIsNullAndDeletedAtIsNullOrderBySeverityDescCreatedAtDesc(factoryId);
        return alerts.stream().map(mapper::toDTO).collect(Collectors.toList());
    }

    @Override
    public Page<SchedulingAlertDTO> getAlerts(String factoryId, String severity, String alertType, Pageable pageable) {
        Page<SchedulingAlert> alerts;

        if (severity != null && alertType != null) {
            alerts = alertRepository.findByFactoryIdAndSeverityAndAlertTypeAndDeletedAtIsNull(
                    factoryId, severity, alertType, pageable);
        } else if (severity != null) {
            alerts = alertRepository.findByFactoryIdAndSeverityAndDeletedAtIsNull(
                    factoryId, severity, pageable);
        } else if (alertType != null) {
            alerts = alertRepository.findByFactoryIdAndAlertTypeAndDeletedAtIsNull(
                    factoryId, alertType, pageable);
        } else {
            alerts = alertRepository.findByFactoryIdAndDeletedAtIsNull(factoryId, pageable);
        }

        return alerts.map(mapper::toDTO);
    }

    @Override
    @Transactional
    public SchedulingAlertDTO createAlert(String factoryId, String alertType, String severity,
                                           String message, String relatedEntityId) {
        SchedulingAlert alert = new SchedulingAlert();
        alert.setAlertId(generateAlertId());
        alert.setFactoryId(factoryId);
        alert.setAlertType(alertType);
        alert.setSeverity(severity);
        alert.setMessage(message);
        alert.setRelatedEntityId(relatedEntityId);
        alert.setCreatedAt(LocalDateTime.now());

        SchedulingAlert saved = alertRepository.save(alert);
        log.info("Created alert: {} - {} - {}", alertType, severity, message);

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public SchedulingAlertDTO acknowledgeAlert(String factoryId, String alertId, Long userId) {
        SchedulingAlert alert = alertRepository
                .findByFactoryIdAndAlertIdAndDeletedAtIsNull(factoryId, alertId)
                .orElseThrow(() -> new IllegalArgumentException("告警不存在: " + alertId));

        alert.setAcknowledgedAt(LocalDateTime.now());
        alert.setAcknowledgedBy(userId);
        alert.setUpdatedAt(LocalDateTime.now());

        SchedulingAlert saved = alertRepository.save(alert);
        log.info("Acknowledged alert: {} by user {}", alertId, userId);

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public SchedulingAlertDTO resolveAlert(String factoryId, String alertId, Long userId, String resolutionNotes) {
        SchedulingAlert alert = alertRepository
                .findByFactoryIdAndAlertIdAndDeletedAtIsNull(factoryId, alertId)
                .orElseThrow(() -> new IllegalArgumentException("告警不存在: " + alertId));

        alert.setResolvedAt(LocalDateTime.now());
        alert.setResolvedBy(userId);
        alert.setResolutionNotes(resolutionNotes);
        alert.setUpdatedAt(LocalDateTime.now());

        SchedulingAlert saved = alertRepository.save(alert);
        log.info("Resolved alert: {} by user {}", alertId, userId);

        return mapper.toDTO(saved);
    }

    @Override
    public long countUnresolvedAlerts(String factoryId) {
        return alertRepository.countByFactoryIdAndResolvedAtIsNullAndDeletedAtIsNull(factoryId);
    }

    @Override
    public long countAlertsBySeverity(String factoryId, String severity) {
        return alertRepository.countByFactoryIdAndSeverityAndResolvedAtIsNullAndDeletedAtIsNull(factoryId, severity);
    }

    @Override
    @Transactional
    public void deleteOldResolvedAlerts(String factoryId, int daysOld) {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(daysOld);
        int deleted = alertRepository.softDeleteResolvedAlertsBefore(factoryId, cutoff);
        log.info("Deleted {} old resolved alerts from factory {}", deleted, factoryId);
    }

    /**
     * 生成告警ID
     */
    private String generateAlertId() {
        return "ALT" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
