package com.cretas.aims.service.impl;

import com.cretas.aims.dto.common.PageRequest;
import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.dto.equipment.EquipmentAlertDTO;
import com.cretas.aims.entity.EquipmentAlert;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.enums.AlertLevel;
import com.cretas.aims.entity.enums.AlertStatus;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.EquipmentAlertRepository;
import com.cretas.aims.repository.EquipmentRepository;
import com.cretas.aims.service.EquipmentAlertsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
                AlertLevel level = mapSeverityToLevel(severity);
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
    public Map<String, Object> getAlertStatistics(String factoryId) {
        log.info("查询告警统计: factoryId={}", factoryId);

        List<EquipmentAlert> allAlerts = alertRepository.findByFactoryIdOrderByTriggeredAtDesc(factoryId);

        long total = allAlerts.size();
        long critical = allAlerts.stream()
                .filter(a -> a.getLevel() == AlertLevel.CRITICAL && a.getStatus() != AlertStatus.RESOLVED)
                .count();
        long warning = allAlerts.stream()
                .filter(a -> a.getLevel() == AlertLevel.WARNING && a.getStatus() != AlertStatus.RESOLVED)
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

        return convertToDTO(alert);
    }

    @Override
    @Transactional
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

        return convertToDTO(alert);
    }

    private EquipmentAlertDTO convertToDTO(EquipmentAlert alert) {
        String equipmentName = "未知设备";
        if (alert.getEquipmentId() != null) {
            equipmentRepository.findById(alert.getEquipmentId())
                    .ifPresent(e -> {});
            Optional<FactoryEquipment> equipment = equipmentRepository.findById(alert.getEquipmentId());
            if (equipment.isPresent()) {
                equipmentName = equipment.get().getEquipmentName();
            }
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

    private AlertLevel mapSeverityToLevel(String severity) {
        if (severity == null) return null;
        switch (severity.toUpperCase()) {
            case "CRITICAL": return AlertLevel.CRITICAL;
            case "HIGH": return AlertLevel.WARNING;
            case "MEDIUM":
            case "LOW": return AlertLevel.INFO;
            default: return null;
        }
    }
}
