package com.cretas.aims.service.restaurant.impl;

import com.cretas.aims.dto.common.PageResponse;
import com.cretas.aims.entity.restaurant.WastageRecord;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.restaurant.WastageRecordRepository;
import com.cretas.aims.service.restaurant.WastageRecordService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class WastageRecordServiceImpl implements WastageRecordService {

    private static final Logger log = LoggerFactory.getLogger(WastageRecordServiceImpl.class);

    private final WastageRecordRepository wastageRecordRepository;

    public WastageRecordServiceImpl(WastageRecordRepository wastageRecordRepository) {
        this.wastageRecordRepository = wastageRecordRepository;
    }

    @Override
    @Transactional
    public WastageRecord createWastageRecord(String factoryId, WastageRecord record, Long userId) {
        log.info("创建损耗记录: factoryId={}, type={}, rawMaterialTypeId={}",
                factoryId, record.getType(), record.getRawMaterialTypeId());

        record.setFactoryId(factoryId);
        record.setReportedBy(userId);
        record.setStatus(WastageRecord.Status.DRAFT);

        if (record.getWastageDate() == null) {
            record.setWastageDate(LocalDate.now());
        }

        record.setWastageNumber(generateWastageNumber(factoryId, record.getWastageDate()));

        record = wastageRecordRepository.save(record);
        log.info("损耗记录创建成功: id={}, number={}", record.getId(), record.getWastageNumber());
        return record;
    }

    @Override
    public PageResponse<WastageRecord> getWastageRecords(String factoryId,
                                                          LocalDate startDate, LocalDate endDate,
                                                          WastageRecord.Status status,
                                                          WastageRecord.WastageType type,
                                                          int page, int size) {
        PageRequest pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<WastageRecord> result;

        if (status != null) {
            result = wastageRecordRepository.findByFactoryIdAndStatusOrderByCreatedAtDesc(factoryId, status, pageable);
        } else if (type != null) {
            result = wastageRecordRepository.findByFactoryIdAndTypeOrderByCreatedAtDesc(factoryId, type, pageable);
        } else {
            result = wastageRecordRepository.findByFactoryIdOrderByCreatedAtDesc(factoryId, pageable);
        }

        return PageResponse.of(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    public WastageRecord getWastageRecordById(String factoryId, String wastageId) {
        return wastageRecordRepository.findByIdAndFactoryId(wastageId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("WastageRecord", "id", wastageId));
    }

    @Override
    @Transactional
    public WastageRecord submitWastageRecord(String factoryId, String wastageId, Long userId) {
        log.info("提交损耗记录: factoryId={}, wastageId={}", factoryId, wastageId);

        WastageRecord record = wastageRecordRepository.findByIdAndFactoryId(wastageId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("WastageRecord", "id", wastageId));

        if (record.getStatus() != WastageRecord.Status.DRAFT) {
            throw new BusinessException("只有草稿状态的损耗记录才能提交");
        }

        record.setStatus(WastageRecord.Status.SUBMITTED);
        record = wastageRecordRepository.save(record);
        log.info("损耗记录已提交: id={}", record.getId());
        return record;
    }

    @Override
    @Transactional
    public WastageRecord approveWastageRecord(String factoryId, String wastageId, Long approvedBy) {
        log.info("审批损耗记录: factoryId={}, wastageId={}", factoryId, wastageId);

        WastageRecord record = wastageRecordRepository.findByIdAndFactoryId(wastageId, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("WastageRecord", "id", wastageId));

        if (record.getStatus() != WastageRecord.Status.SUBMITTED) {
            throw new BusinessException("只有已提交状态的损耗记录才能审批");
        }

        record.setStatus(WastageRecord.Status.APPROVED);
        record.setApprovedBy(approvedBy);
        record.setApprovedAt(LocalDateTime.now());
        record = wastageRecordRepository.save(record);

        log.info("损耗记录审批通过: id={}, estimatedCost={}", record.getId(), record.getEstimatedCost());
        return record;
    }

    @Override
    public Map<String, Object> getStatistics(String factoryId, LocalDate startDate, LocalDate endDate) {
        List<Object[]> byType = wastageRecordRepository.getStatisticsByType(factoryId, startDate, endDate);
        List<Object[]> byMaterial = wastageRecordRepository.getStatisticsByMaterial(factoryId, startDate, endDate);
        BigDecimal totalCost = wastageRecordRepository.getTotalEstimatedCost(factoryId, startDate, endDate);

        List<Map<String, Object>> typeStats = new ArrayList<>();
        for (Object[] row : byType) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("type", row[0]);
            item.put("count", row[1]);
            item.put("totalQuantity", row[2]);
            item.put("totalCost", row[3]);
            typeStats.add(item);
        }

        List<Map<String, Object>> materialStats = new ArrayList<>();
        for (Object[] row : byMaterial) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("rawMaterialTypeId", row[0]);
            item.put("unit", row[1]);
            item.put("totalQuantity", row[2]);
            item.put("totalCost", row[3]);
            materialStats.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("byType", typeStats);
        result.put("byMaterial", materialStats);
        result.put("totalCost", totalCost);

        Map<String, Object> period = new LinkedHashMap<>();
        period.put("startDate", startDate.toString());
        period.put("endDate", endDate.toString());
        result.put("period", period);

        return result;
    }

    private String generateWastageNumber(String factoryId, LocalDate date) {
        long count = wastageRecordRepository.countByFactoryIdAndDate(factoryId, date);
        return String.format("WST-%s-%03d", date.format(DateTimeFormatter.BASIC_ISO_DATE), count + 1);
    }
}
