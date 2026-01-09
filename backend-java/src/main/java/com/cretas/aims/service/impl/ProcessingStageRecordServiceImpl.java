package com.cretas.aims.service.impl;

import com.cretas.aims.dto.processing.ProcessingStageRecordDTO;
import com.cretas.aims.entity.ProcessingStageRecord;
import com.cretas.aims.entity.enums.ProcessingStageType;
import com.cretas.aims.exception.EntityNotFoundException;
import com.cretas.aims.repository.ProcessingStageRecordRepository;
import com.cretas.aims.service.ProcessingStageRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.EnumMap;
import java.util.stream.Collectors;

/**
 * 加工环节记录服务实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-23
 */
@Service
@RequiredArgsConstructor
public class ProcessingStageRecordServiceImpl implements ProcessingStageRecordService {

    private final ProcessingStageRecordRepository repository;

    @Override
    @Transactional
    public ProcessingStageRecordDTO create(String factoryId, ProcessingStageRecordDTO dto) {
        ProcessingStageRecord entity = new ProcessingStageRecord();
        BeanUtils.copyProperties(dto, entity, "id", "createdAt", "updatedAt");
        entity.setFactoryId(factoryId);

        // 如果没有设置stageOrder，自动计算
        if (entity.getStageOrder() == null) {
            long count = repository.countByProductionBatchId(dto.getProductionBatchId());
            entity.setStageOrder((int) count + 1);
        }

        ProcessingStageRecord saved = repository.save(entity);
        return toDTO(saved);
    }

    @Override
    @Transactional
    public ProcessingStageRecordDTO update(String factoryId, Long id, ProcessingStageRecordDTO dto) {
        ProcessingStageRecord entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("ProcessingStageRecord", id));

        if (!entity.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权操作此记录");
        }

        BeanUtils.copyProperties(dto, entity, "id", "factoryId", "createdAt", "updatedAt", "deletedAt");
        ProcessingStageRecord saved = repository.save(entity);
        return toDTO(saved);
    }

    @Override
    public ProcessingStageRecordDTO getById(String factoryId, Long id) {
        ProcessingStageRecord entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("ProcessingStageRecord", id));

        if (!entity.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权访问此记录");
        }

        return toDTO(entity);
    }

    @Override
    public List<ProcessingStageRecordDTO> getByBatchId(String factoryId, Long productionBatchId) {
        List<ProcessingStageRecord> records = repository
                .findByFactoryIdAndProductionBatchIdOrderByStageOrderAsc(factoryId, productionBatchId);
        return records.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<ProcessingStageRecordDTO> getByBatchIdWithComparison(String factoryId, Long productionBatchId) {
        List<ProcessingStageRecord> records = repository
                .findByFactoryIdAndProductionBatchIdOrderByStageOrderAsc(factoryId, productionBatchId);

        // N+1 修复：预先批量查询所有环节类型的统计数据
        Map<ProcessingStageType, Double> avgLossRateMap = new EnumMap<>(ProcessingStageType.class);
        Map<ProcessingStageType, Double> avgPassRateMap = new EnumMap<>(ProcessingStageType.class);
        Map<ProcessingStageType, Double> avgDurationMap = new EnumMap<>(ProcessingStageType.class);

        repository.findAllAverageLossRatesByFactoryId(factoryId).forEach(row ->
                avgLossRateMap.put((ProcessingStageType) row[0], (Double) row[1]));
        repository.findAllAveragePassRatesByFactoryId(factoryId).forEach(row ->
                avgPassRateMap.put((ProcessingStageType) row[0], (Double) row[1]));
        repository.findAllAverageDurationsByFactoryId(factoryId).forEach(row ->
                avgDurationMap.put((ProcessingStageType) row[0], (Double) row[1]));

        return records.stream().map(record -> {
            ProcessingStageRecordDTO dto = toDTO(record);

            // 使用预加载的 Map 进行查找，避免 N+1 查询
            ProcessingStageType stageType = record.getStageType();
            Double avgLossRate = avgLossRateMap.get(stageType);
            Double avgPassRate = avgPassRateMap.get(stageType);
            Double avgDuration = avgDurationMap.get(stageType);

            if (avgLossRate != null) {
                dto.setAvgLossRate(BigDecimal.valueOf(avgLossRate));
            }
            if (avgPassRate != null) {
                dto.setAvgPassRate(BigDecimal.valueOf(avgPassRate));
            }
            dto.setAvgDuration(avgDuration);

            return dto;
        }).collect(Collectors.toList());
    }

    @Override
    public List<ProcessingStageRecordDTO> getByTimeRange(String factoryId, LocalDateTime startTime, LocalDateTime endTime) {
        List<ProcessingStageRecord> records = repository.findByFactoryIdAndTimeRange(factoryId, startTime, endTime);
        return records.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public List<ProcessingStageRecordDTO> getByStageType(String factoryId, ProcessingStageType stageType) {
        List<ProcessingStageRecord> records = repository.findByFactoryIdAndStageType(factoryId, stageType);
        return records.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void delete(String factoryId, Long id) {
        ProcessingStageRecord entity = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("ProcessingStageRecord", id));

        if (!entity.getFactoryId().equals(factoryId)) {
            throw new RuntimeException("无权删除此记录");
        }

        repository.delete(entity);
    }

    @Override
    @Transactional
    public void deleteByBatchId(String factoryId, Long productionBatchId) {
        List<ProcessingStageRecord> records = repository
                .findByFactoryIdAndProductionBatchIdOrderByStageOrderAsc(factoryId, productionBatchId);
        repository.deleteAll(records);
    }

    @Override
    @Transactional
    public List<ProcessingStageRecordDTO> batchCreate(String factoryId, Long productionBatchId, List<ProcessingStageRecordDTO> dtos) {
        List<ProcessingStageRecordDTO> results = new ArrayList<>();
        int order = 1;

        for (ProcessingStageRecordDTO dto : dtos) {
            dto.setProductionBatchId(productionBatchId);
            if (dto.getStageOrder() == null) {
                dto.setStageOrder(order++);
            }
            results.add(create(factoryId, dto));
        }

        return results;
    }

    @Override
    public Map<ProcessingStageType, Map<String, Object>> getStageStatistics(String factoryId) {
        Map<ProcessingStageType, Map<String, Object>> statistics = new HashMap<>();

        // N+1 修复：预先批量查询所有环节类型的统计数据，只需 3 次 DB 查询
        Map<ProcessingStageType, Double> avgLossRateMap = new EnumMap<>(ProcessingStageType.class);
        Map<ProcessingStageType, Double> avgPassRateMap = new EnumMap<>(ProcessingStageType.class);
        Map<ProcessingStageType, Double> avgDurationMap = new EnumMap<>(ProcessingStageType.class);

        repository.findAllAverageLossRatesByFactoryId(factoryId).forEach(row ->
                avgLossRateMap.put((ProcessingStageType) row[0], (Double) row[1]));
        repository.findAllAveragePassRatesByFactoryId(factoryId).forEach(row ->
                avgPassRateMap.put((ProcessingStageType) row[0], (Double) row[1]));
        repository.findAllAverageDurationsByFactoryId(factoryId).forEach(row ->
                avgDurationMap.put((ProcessingStageType) row[0], (Double) row[1]));

        // 遍历所有环节类型，使用预加载的 Map 进行查找
        for (ProcessingStageType stageType : ProcessingStageType.values()) {
            Double avgLossRate = avgLossRateMap.get(stageType);
            Double avgPassRate = avgPassRateMap.get(stageType);
            Double avgDuration = avgDurationMap.get(stageType);

            if (avgLossRate != null || avgPassRate != null || avgDuration != null) {
                Map<String, Object> stats = new HashMap<>();
                stats.put("avgLossRate", avgLossRate);
                stats.put("avgPassRate", avgPassRate);
                stats.put("avgDuration", avgDuration);
                statistics.put(stageType, stats);
            }
        }

        return statistics;
    }

    @Override
    public Map<String, String> formatForAIAnalysis(String factoryId, Long productionBatchId) {
        Map<String, String> result = new HashMap<>();

        List<ProcessingStageRecordDTO> records = getByBatchIdWithComparison(factoryId, productionBatchId);

        for (ProcessingStageRecordDTO record : records) {
            String prefix = record.getStageType().name().toLowerCase() + "_";

            // 时间数据
            if (record.getDurationMinutes() != null) {
                result.put(prefix + "duration", String.valueOf(record.getDurationMinutes()));
            }
            if (record.getAvgDuration() != null) {
                result.put("avg_" + prefix + "duration", String.format("%.1f", record.getAvgDuration()));
            }

            // 损耗数据
            if (record.getLossRate() != null) {
                result.put(prefix + "loss_rate", record.getLossRate().toString());
            }
            if (record.getAvgLossRate() != null) {
                result.put("avg_" + prefix + "loss_rate", record.getAvgLossRate().toString());
            }

            // 合格率
            if (record.getPassRate() != null) {
                result.put(prefix + "pass_rate", record.getPassRate().toString());
            }
            if (record.getAvgPassRate() != null) {
                result.put("avg_" + prefix + "pass_rate", record.getAvgPassRate().toString());
            }

            // 温度数据
            if (record.getProductTemperature() != null) {
                result.put(prefix + "temperature", record.getProductTemperature().toString());
            }

            // 特殊数据
            if (record.getStageType() == ProcessingStageType.THAWING) {
                if (record.getDripLoss() != null) {
                    result.put("drip_loss", record.getDripLoss().toString());
                }
            }
            if (record.getStageType() == ProcessingStageType.SLICING) {
                if (record.getThicknessSd() != null) {
                    result.put("thickness_sd", record.getThicknessSd().toString());
                }
            }
            if (record.getStageType() == ProcessingStageType.MARINATING) {
                if (record.getMarinadeAbsorption() != null) {
                    result.put("marinade_absorption", record.getMarinadeAbsorption().toString());
                }
                if (record.getPhValue() != null) {
                    result.put("ph_salinity", record.getPhValue().toString());
                }
            }

            // 设备数据
            if (record.getEquipmentOee() != null) {
                result.put(prefix + "oee", record.getEquipmentOee().toString());
            }

            // 资源消耗
            if (record.getWaterUsage() != null) {
                result.put(prefix + "water_usage", record.getWaterUsage().toString());
            }
            if (record.getPowerUsage() != null) {
                result.put(prefix + "power_usage", record.getPowerUsage().toString());
            }

            // 微生物和CCP
            if (record.getMicroPassRate() != null) {
                result.put("micro_pass_rate", record.getMicroPassRate().toString());
            }
            if (record.getCcpPassRate() != null) {
                result.put("ccp_pass_rate", record.getCcpPassRate().toString());
            }
            if (record.getAtpResult() != null) {
                result.put("atp_pass_rate", record.getAtpResult().toString());
            }
        }

        return result;
    }

    private ProcessingStageRecordDTO toDTO(ProcessingStageRecord entity) {
        ProcessingStageRecordDTO dto = new ProcessingStageRecordDTO();
        BeanUtils.copyProperties(entity, dto);
        return dto;
    }
}
