package com.cretas.aims.service;

import com.cretas.aims.entity.DisposalRecord;
import com.cretas.aims.repository.DisposalRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 报废记录服务层
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DisposalRecordService {

    private final DisposalRecordRepository disposalRecordRepository;

    /**
     * 创建报废记录
     */
    @Transactional
    public DisposalRecord createDisposalRecord(DisposalRecord record) {
        // 设置默认值
        if (record.getDisposalDate() == null) {
            record.setDisposalDate(LocalDateTime.now());
        }
        if (record.getIsApproved() == null) {
            record.setIsApproved(false);
        }
        log.info("创建报废记录: 工厂={}, 类型={}", record.getFactoryId(), record.getDisposalType());
        return disposalRecordRepository.save(record);
    }

    /**
     * 审批报废记录
     */
    @Transactional
    public DisposalRecord approveDisposal(Long id, Integer approverId, String approverName) {
        DisposalRecord record = disposalRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("报废记录不存在: " + id));

        record.approve(approverId, approverName);
        log.info("审批报废记录: id={}, 审批人={}", id, approverName);
        return disposalRecordRepository.save(record);
    }

    /**
     * 根据ID获取报废记录
     */
    public Optional<DisposalRecord> getById(Long id) {
        return disposalRecordRepository.findById(id);
    }

    /**
     * 分页查询工厂报废记录
     */
    public Page<DisposalRecord> getByFactoryId(String factoryId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "disposalDate"));
        return disposalRecordRepository.findByFactoryId(factoryId, pageable);
    }

    /**
     * 按报废类型分页查询
     */
    public Page<DisposalRecord> getByFactoryIdAndType(String factoryId, String disposalType, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "disposalDate"));
        return disposalRecordRepository.findByFactoryIdAndDisposalType(factoryId, disposalType, pageable);
    }

    /**
     * 获取待审批的报废记录
     */
    public List<DisposalRecord> getPendingApprovals(String factoryId) {
        return disposalRecordRepository.findPendingApprovals(factoryId);
    }

    /**
     * 按日期范围查询
     */
    public List<DisposalRecord> getByDateRange(String factoryId, LocalDateTime startDate, LocalDateTime endDate) {
        return disposalRecordRepository.findByDateRange(factoryId, startDate, endDate);
    }

    /**
     * 获取报废统计
     */
    public Map<String, Object> getDisposalStats(String factoryId, LocalDateTime startDate, LocalDateTime endDate) {
        Map<String, Object> stats = new HashMap<>();
        
        stats.put("totalCount", disposalRecordRepository.countByFactoryId(factoryId));
        stats.put("pendingCount", disposalRecordRepository.countByFactoryIdAndIsApproved(factoryId, false));
        
        Double totalQuantity = disposalRecordRepository.calculateTotalDisposalQuantity(factoryId, startDate, endDate);
        stats.put("totalQuantity", totalQuantity != null ? totalQuantity : 0.0);
        
        Double totalLoss = disposalRecordRepository.calculateTotalLoss(factoryId, startDate, endDate);
        stats.put("totalLoss", totalLoss != null ? totalLoss : 0.0);
        
        Double recoveryValue = disposalRecordRepository.calculateTotalRecoveryValue(factoryId, startDate, endDate);
        stats.put("recoveryValue", recoveryValue != null ? recoveryValue : 0.0);
        
        Double netLoss = disposalRecordRepository.calculateNetLoss(factoryId, startDate, endDate);
        stats.put("netLoss", netLoss != null ? netLoss : 0.0);

        return stats;
    }

    /**
     * 按类型统计
     */
    public List<Object[]> getStatsByType(String factoryId, LocalDateTime startDate, LocalDateTime endDate) {
        return disposalRecordRepository.getDisposalStatsByType(factoryId, startDate, endDate);
    }

    /**
     * 获取可回收报废记录
     */
    public List<DisposalRecord> getRecyclableDisposals(String factoryId) {
        return disposalRecordRepository.findRecyclableDisposals(factoryId);
    }

    /**
     * 更新报废记录
     */
    @Transactional
    public DisposalRecord updateDisposalRecord(Long id, DisposalRecord updateData) {
        DisposalRecord existing = disposalRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("报废记录不存在: " + id));

        // 只能更新未审批的记录
        if (existing.getIsApproved()) {
            throw new IllegalStateException("已审批的记录不能修改");
        }

        if (updateData.getDisposalQuantity() != null) {
            existing.setDisposalQuantity(updateData.getDisposalQuantity());
        }
        if (updateData.getDisposalType() != null) {
            existing.setDisposalType(updateData.getDisposalType());
        }
        if (updateData.getDisposalReason() != null) {
            existing.setDisposalReason(updateData.getDisposalReason());
        }
        if (updateData.getDisposalMethod() != null) {
            existing.setDisposalMethod(updateData.getDisposalMethod());
        }
        if (updateData.getEstimatedLoss() != null) {
            existing.setEstimatedLoss(updateData.getEstimatedLoss());
        }
        if (updateData.getRecoveryValue() != null) {
            existing.setRecoveryValue(updateData.getRecoveryValue());
        }
        if (updateData.getNotes() != null) {
            existing.setNotes(updateData.getNotes());
        }

        log.info("更新报废记录: id={}", id);
        return disposalRecordRepository.save(existing);
    }

    /**
     * 删除报废记录（软删除）
     */
    @Transactional
    public void deleteDisposalRecord(Long id) {
        DisposalRecord record = disposalRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("报废记录不存在: " + id));

        if (record.getIsApproved()) {
            throw new IllegalStateException("已审批的记录不能删除");
        }

        record.softDelete();
        disposalRecordRepository.save(record);
        log.info("删除报废记录: id={}", id);
    }
}
