package com.cretas.aims.service.scheduling.impl;

import com.cretas.aims.dto.scheduling.*;
import com.cretas.aims.entity.scheduling.LineSchedule;
import com.cretas.aims.entity.production.ProductionLine;
import com.cretas.aims.repository.scheduling.LineScheduleRepository;
import com.cretas.aims.repository.production.ProductionLineRepository;
import com.cretas.aims.service.scheduling.ProductionLineScheduleService;
import com.cretas.aims.mapper.SchedulingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 产线排程服务实现
 *
 * 负责产线和排程的管理
 *
 * @author Cretas Team
 * @version 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProductionLineScheduleServiceImpl implements ProductionLineScheduleService {

    private final LineScheduleRepository scheduleRepository;
    private final ProductionLineRepository lineRepository;
    private final SchedulingMapper mapper;

    // ==================== 排程管理 ====================

    @Override
    public LineScheduleDTO getSchedule(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));
        return mapper.toDTO(schedule);
    }

    @Override
    @Transactional
    public LineScheduleDTO updateSchedule(String factoryId, String scheduleId, UpdateScheduleRequest request) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));

        if (request.getPlannedQuantity() != null) {
            schedule.setPlannedQuantity(request.getPlannedQuantity());
        }
        if (request.getExpectedStartTime() != null) {
            schedule.setExpectedStartTime(request.getExpectedStartTime());
        }
        if (request.getExpectedEndTime() != null) {
            schedule.setExpectedEndTime(request.getExpectedEndTime());
        }
        if (request.getLineId() != null) {
            schedule.setLineId(request.getLineId());
        }

        schedule.setUpdatedAt(LocalDateTime.now());
        LineSchedule saved = scheduleRepository.save(schedule);

        log.info("Updated schedule: {}", scheduleId);
        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public LineScheduleDTO startSchedule(String factoryId, String scheduleId) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));

        if (schedule.getStatus() != LineSchedule.ScheduleStatus.pending) {
            throw new IllegalStateException("只能启动待执行的排程");
        }

        schedule.setStatus(LineSchedule.ScheduleStatus.in_progress);
        schedule.setActualStartTime(LocalDateTime.now());
        schedule.setUpdatedAt(LocalDateTime.now());

        LineSchedule saved = scheduleRepository.save(schedule);
        log.info("Started schedule: {}", scheduleId);

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public LineScheduleDTO completeSchedule(String factoryId, String scheduleId, Integer completedQuantity) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));

        schedule.setStatus(LineSchedule.ScheduleStatus.completed);
        schedule.setActualEndTime(LocalDateTime.now());
        schedule.setCompletedQuantity(completedQuantity);
        schedule.setUpdatedAt(LocalDateTime.now());

        // 计算实际效率
        if (schedule.getActualStartTime() != null && schedule.getPlannedQuantity() != null) {
            long minutes = java.time.Duration.between(schedule.getActualStartTime(), LocalDateTime.now()).toMinutes();
            if (minutes > 0) {
                double efficiency = (completedQuantity * 60.0) / (minutes * schedule.getPlannedQuantity());
                schedule.setActualEfficiency(java.math.BigDecimal.valueOf(Math.min(1.5, efficiency)));
            }
        }

        LineSchedule saved = scheduleRepository.save(schedule);
        log.info("Completed schedule: {}, quantity: {}", scheduleId, completedQuantity);

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public LineScheduleDTO updateProgress(String factoryId, String scheduleId, Integer completedQuantity) {
        LineSchedule schedule = scheduleRepository
                .findByFactoryIdAndScheduleIdAndDeletedAtIsNull(factoryId, scheduleId)
                .orElseThrow(() -> new IllegalArgumentException("排程不存在: " + scheduleId));

        schedule.setCompletedQuantity(completedQuantity);
        schedule.setUpdatedAt(LocalDateTime.now());

        // 计算进度百分比
        if (schedule.getPlannedQuantity() != null && schedule.getPlannedQuantity() > 0) {
            double progress = (completedQuantity * 100.0) / schedule.getPlannedQuantity();
            schedule.setProgressPercentage(java.math.BigDecimal.valueOf(Math.min(100, progress)));
        }

        LineSchedule saved = scheduleRepository.save(schedule);
        log.debug("Updated progress for schedule {}: {}", scheduleId, completedQuantity);

        return mapper.toDTO(saved);
    }

    // ==================== 产线管理 ====================

    @Override
    public List<ProductionLineDTO> getProductionLines(String factoryId, String status) {
        List<ProductionLine> lines;

        if (status != null && !status.isBlank()) {
            ProductionLine.LineStatus lineStatus = ProductionLine.LineStatus.valueOf(status);
            lines = lineRepository.findByFactoryIdAndStatusAndDeletedAtIsNull(factoryId, lineStatus);
        } else {
            lines = lineRepository.findByFactoryIdAndDeletedAtIsNull(factoryId);
        }

        return lines.stream().map(mapper::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProductionLineDTO createProductionLine(String factoryId, ProductionLineDTO request) {
        ProductionLine line = new ProductionLine();
        line.setLineId(generateLineId());
        line.setFactoryId(factoryId);
        line.setLineName(request.getLineName());
        line.setLineCode(request.getLineCode());
        line.setStatus(ProductionLine.LineStatus.idle);
        line.setCapacity(request.getCapacity());
        line.setCreatedAt(LocalDateTime.now());

        if (request.getDescription() != null) {
            line.setDescription(request.getDescription());
        }

        ProductionLine saved = lineRepository.save(line);
        log.info("Created production line: {} - {}", saved.getLineId(), saved.getLineName());

        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public ProductionLineDTO updateProductionLine(String factoryId, String lineId, ProductionLineDTO request) {
        ProductionLine line = lineRepository
                .findByFactoryIdAndLineIdAndDeletedAtIsNull(factoryId, lineId)
                .orElseThrow(() -> new IllegalArgumentException("产线不存在: " + lineId));

        if (request.getLineName() != null) {
            line.setLineName(request.getLineName());
        }
        if (request.getCapacity() != null) {
            line.setCapacity(request.getCapacity());
        }
        if (request.getDescription() != null) {
            line.setDescription(request.getDescription());
        }

        line.setUpdatedAt(LocalDateTime.now());
        ProductionLine saved = lineRepository.save(line);

        log.info("Updated production line: {}", lineId);
        return mapper.toDTO(saved);
    }

    @Override
    @Transactional
    public ProductionLineDTO updateProductionLineStatus(String factoryId, String lineId, String status) {
        ProductionLine line = lineRepository
                .findByFactoryIdAndLineIdAndDeletedAtIsNull(factoryId, lineId)
                .orElseThrow(() -> new IllegalArgumentException("产线不存在: " + lineId));

        ProductionLine.LineStatus newStatus = ProductionLine.LineStatus.valueOf(status);
        line.setStatus(newStatus);
        line.setUpdatedAt(LocalDateTime.now());

        ProductionLine saved = lineRepository.save(line);
        log.info("Updated production line {} status to {}", lineId, status);

        return mapper.toDTO(saved);
    }

    @Override
    public List<LineScheduleDTO> getSchedulesByLine(String factoryId, String lineId) {
        List<LineSchedule> schedules = scheduleRepository
                .findByFactoryIdAndLineIdAndDeletedAtIsNull(factoryId, lineId);
        return schedules.stream().map(mapper::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<LineScheduleDTO> getSchedulesByPlan(String factoryId, String planId) {
        List<LineSchedule> schedules = scheduleRepository
                .findByFactoryIdAndPlanIdAndDeletedAtIsNull(factoryId, planId);
        return schedules.stream().map(mapper::toDTO).collect(Collectors.toList());
    }

    /**
     * 生成产线ID
     */
    private String generateLineId() {
        return "LINE" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }
}
