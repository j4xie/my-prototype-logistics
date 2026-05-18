package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.SalarySpecialDeduction;
import com.cretas.aims.entity.hr.enums.DeductionStatus;
import com.cretas.aims.entity.hr.enums.DeductionType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.hr.SalarySpecialDeductionRepository;
import com.cretas.aims.service.hr.SalarySpecialDeductionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/**
 * 专项附加扣除 Service 实现.
 *
 * @author Cretas Team — P1-40 H-WAGE 专项扣除 follow-up
 * @since 2026-05-17
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SalarySpecialDeductionServiceImpl implements SalarySpecialDeductionService {

    private final SalarySpecialDeductionRepository repository;

    @Override
    @Transactional
    public SalarySpecialDeduction create(String factoryId, Long userId,
                                          DeductionType deductionType, BigDecimal monthlyAmount,
                                          LocalDate validFrom, LocalDate validTo, String notes) {
        if (userId == null || userId <= 0) {
            throw new BusinessException("userId 必填且 > 0");
        }
        if (deductionType == null) {
            throw new BusinessException("deductionType 必填 (6 选 1)");
        }
        if (monthlyAmount == null || monthlyAmount.signum() < 0) {
            throw new BusinessException("monthlyAmount 必填且 ≥ 0");
        }
        if (validFrom == null) {
            throw new BusinessException("validFrom 必填 (生效起始日)");
        }
        if (validTo != null && validTo.isBefore(validFrom)) {
            throw new BusinessException(String.format(
                    "validTo (%s) 不能早于 validFrom (%s)", validTo, validFrom));
        }
        // R4 防呆: 同 (factory, user, type, validFrom) ACTIVE 已存在 → 409
        Optional<SalarySpecialDeduction> existing =
                repository.findByFactoryIdAndUserIdAndDeductionTypeAndValidFromAndStatus(
                        factoryId, userId, deductionType, validFrom, DeductionStatus.ACTIVE);
        if (existing.isPresent()) {
            SalarySpecialDeduction e = existing.get();
            throw new BusinessException(409, String.format(
                    "用户 %d 已存在生效中的[%s]扣除项 (id=%s, 起始 %s, 月扣 ¥%s), 请直接编辑或先结束再新增",
                    userId, deductionType, e.getId(), e.getValidFrom(), e.getMonthlyAmount()));
        }
        SalarySpecialDeduction saved = repository.save(SalarySpecialDeduction.builder()
                .factoryId(factoryId)
                .userId(userId)
                .deductionType(deductionType)
                .monthlyAmount(monthlyAmount)
                .validFrom(validFrom)
                .validTo(validTo)
                .status(DeductionStatus.ACTIVE)
                .notes(notes)
                .build());
        log.info("SalarySpecialDeduction created: id={}, user={}, type={}, amount={}, from={}",
                saved.getId(), userId, deductionType, monthlyAmount, validFrom);
        return saved;
    }

    @Override
    @Transactional
    public SalarySpecialDeduction update(String factoryId, String id, BigDecimal monthlyAmount,
                                          LocalDate validTo, String notes) {
        SalarySpecialDeduction d = load(factoryId, id);
        if (d.getStatus() != DeductionStatus.ACTIVE) {
            throw new BusinessException(String.format(
                    "仅 ACTIVE 状态可编辑, 当前=%s (如需修改请先 status 改回 ACTIVE 或创建新记录)",
                    d.getStatus()));
        }
        if (monthlyAmount != null) {
            if (monthlyAmount.signum() < 0) {
                throw new BusinessException("monthlyAmount 必须 ≥ 0");
            }
            d.setMonthlyAmount(monthlyAmount);
        }
        if (validTo != null && validTo.isBefore(d.getValidFrom())) {
            throw new BusinessException(String.format(
                    "validTo (%s) 不能早于 validFrom (%s)", validTo, d.getValidFrom()));
        }
        d.setValidTo(validTo);  // null 允许 (清掉变长期)
        d.setNotes(notes);
        return repository.save(d);
    }

    @Override
    @Transactional
    public SalarySpecialDeduction changeStatus(String factoryId, String id,
                                                DeductionStatus newStatus) {
        SalarySpecialDeduction d = load(factoryId, id);
        if (newStatus == null) {
            throw new BusinessException("newStatus 必填 (ACTIVE/EXPIRED/CANCELLED)");
        }
        if (d.getStatus() == newStatus) {
            return d;
        }
        // 不允许 EXPIRED/CANCELLED 回到 ACTIVE
        if (newStatus == DeductionStatus.ACTIVE
                && d.getStatus() != DeductionStatus.ACTIVE) {
            throw new BusinessException(String.format(
                    "%s 状态不可改回 ACTIVE, 请创建新扣除记录", d.getStatus()));
        }
        d.setStatus(newStatus);
        if (newStatus == DeductionStatus.EXPIRED && d.getValidTo() == null) {
            d.setValidTo(LocalDate.now());
        }
        log.info("SalarySpecialDeduction status changed: id={}, {} → {}",
                id, d.getStatus(), newStatus);
        return repository.save(d);
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        SalarySpecialDeduction d = load(factoryId, id);
        if (d.getStatus() == DeductionStatus.ACTIVE) {
            throw new BusinessException(
                    "仅 EXPIRED/CANCELLED 状态可删除, 请先 changeStatus 再删除");
        }
        repository.delete(d);
        log.info("SalarySpecialDeduction deleted: id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SalarySpecialDeduction> getById(String factoryId, String id) {
        return repository.findByIdAndFactoryId(id, factoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SalarySpecialDeduction> list(String factoryId, Long userId,
                                              DeductionStatus status, DeductionType deductionType,
                                              Pageable pageable) {
        return repository.findByFilters(factoryId, userId, status, deductionType, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal computeTotalDeductionForMonth(String factoryId, Long userId,
                                                     YearMonth yearMonth) {
        if (yearMonth == null) return BigDecimal.ZERO;
        LocalDate probeDate = yearMonth.atEndOfMonth();
        BigDecimal sum = repository.sumActiveDeductionsForUserAtDate(factoryId, userId, probeDate);
        return sum == null ? BigDecimal.ZERO : sum;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SalarySpecialDeduction> listActiveForMonth(String factoryId, Long userId,
                                                            YearMonth yearMonth) {
        if (yearMonth == null) return List.of();
        return repository.listActiveForUserAtDate(factoryId, userId, yearMonth.atEndOfMonth());
    }

    private SalarySpecialDeduction load(String factoryId, String id) {
        return repository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("SalarySpecialDeduction not found: " + id));
    }
}
