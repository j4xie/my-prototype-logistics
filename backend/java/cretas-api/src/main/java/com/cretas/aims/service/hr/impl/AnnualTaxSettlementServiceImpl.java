package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.AnnualTaxSettlement;
import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.AnnualTaxSettlementStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.hr.AnnualTaxSettlementRepository;
import com.cretas.aims.repository.hr.SalaryItemRepository;
import com.cretas.aims.service.hr.AnnualTaxCalculator;
import com.cretas.aims.service.hr.AnnualTaxSettlementService;
import com.cretas.aims.service.hr.SalarySpecialDeductionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 年度汇算 Service 实现 (#833 follow-up).
 *
 * <p>聚合口径:
 * <ul>
 *   <li>totalSalary = sum(SalaryItem.baseSalary) for taxYear (LIKE "YYYY-")</li>
 *   <li>totalBonus = sum(SalaryItem.annualBonus) (info-only, 不进汇算)</li>
 *   <li>totalSocialInsurance = sum(SalaryItem.socialInsuranceEmployee)</li>
 *   <li>totalProvidentFund = sum(SalaryItem.providentFundEmployee)</li>
 *   <li>totalSpecialDeductions = sum(SpecialDeduction.computeTotalDeductionForMonth) 12 月探针累加</li>
 *   <li>annualTaxableIncome = AnnualTaxCalculator.computeTaxableIncome(...)</li>
 *   <li>annualTaxDue = AnnualTaxCalculator.computeAnnualTax(annualTaxableIncome)</li>
 *   <li>monthlyPrepaidSum = sum(SalaryItem.personalTax) (月度已预缴个税)</li>
 *   <li>refundOwed = annualTaxDue - monthlyPrepaidSum
 *       (>0: 应补缴, &lt;0: 应退税, =0: 平账)</li>
 *   <li>annualBonusTax = sum(SalaryItem.annualBonusTax) (info-only, 独立计税)</li>
 * </ul>
 *
 * <p>R4 防呆 idempotent: re-compute 同 (user, year) 走 update existing 不 insert.
 * R5 防呆: status=REPORTED 时 computeForUser 拒改 (已申报税局).
 *
 * @author Cretas Team — #833 年度汇算 follow-up
 * @since 2026-05-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnnualTaxSettlementServiceImpl implements AnnualTaxSettlementService {

    private final AnnualTaxSettlementRepository repository;
    private final SalaryItemRepository salaryItemRepository;

    /**
     * 专项扣除服务 — Optional 注入避免 unit test 缺 bean 启动失败.
     * 生产 / IT 环境总是有 bean. null 时年度专项扣除按 0 算 (fallback).
     */
    @Autowired(required = false)
    private SalarySpecialDeductionService specialDeductionService;

    @Override
    public Map<String, Object> previewCompute(String factoryId, Long userId, Integer taxYear) {
        validateYear(taxYear);
        AggregationResult agg = aggregate(factoryId, userId, taxYear);
        return buildBreakdownMap(agg);
    }

    @Override
    @Transactional
    public AnnualTaxSettlement computeForUser(String factoryId, Long userId, Integer taxYear) {
        validateYear(taxYear);
        // R4 防呆 (idempotent): existing → update
        Optional<AnnualTaxSettlement> existingOpt =
                repository.findByFactoryIdAndUserIdAndTaxYear(factoryId, userId, taxYear);
        if (existingOpt.isPresent()) {
            AnnualTaxSettlement existing = existingOpt.get();
            // R5 防呆: REPORTED 锁住, 拒绝重算 (已申报税局不能再改)
            if (existing.getStatus() == AnnualTaxSettlementStatus.REPORTED) {
                throw new BusinessException(String.format(
                        "用户 %d 在 %d 年度的汇算已申报税局, 不可修改 (id=%s)",
                        userId, taxYear, existing.getId()));
            }
        }
        AggregationResult agg = aggregate(factoryId, userId, taxYear);
        AnnualTaxSettlement target = existingOpt.orElseGet(() ->
                AnnualTaxSettlement.builder()
                        .factoryId(factoryId)
                        .userId(userId)
                        .taxYear(taxYear)
                        .status(AnnualTaxSettlementStatus.DRAFT)
                        .build());
        target.setTotalSalary(agg.totalSalary);
        target.setTotalBonus(agg.totalBonus);
        target.setTotalSocialInsurance(agg.totalSocialInsurance);
        target.setTotalProvidentFund(agg.totalProvidentFund);
        target.setTotalSpecialDeductions(agg.totalSpecialDeductions);
        target.setAnnualTaxableIncome(agg.annualTaxableIncome);
        target.setAnnualTaxDue(agg.annualTaxDue);
        target.setMonthlyPrepaidSum(agg.monthlyPrepaidSum);
        target.setRefundOwed(agg.refundOwed);
        target.setAnnualBonusTax(agg.annualBonusTax);
        target.setBracketLabel(agg.bracketLabel);
        target.setBracketRate(agg.bracketRate);
        target.setMonthsCovered(agg.monthsCovered);
        target.setComputedAt(LocalDateTime.now());
        AnnualTaxSettlement saved = repository.save(target);
        log.info("AnnualTaxSettlement computed: factory={}, user={}, year={}, refundOwed={}, months={}",
                factoryId, userId, taxYear, saved.getRefundOwed(), saved.getMonthsCovered());
        return saved;
    }

    @Override
    @Transactional
    public AnnualTaxSettlement confirm(String factoryId, String id, Long actorUserId) {
        AnnualTaxSettlement entity = load(factoryId, id);
        if (entity.getStatus() != AnnualTaxSettlementStatus.DRAFT) {
            throw new BusinessException("仅 DRAFT 状态可确认, 当前=" + entity.getStatus());
        }
        entity.setStatus(AnnualTaxSettlementStatus.CONFIRMED);
        entity.setConfirmedAt(LocalDateTime.now());
        entity.setConfirmedBy(actorUserId);
        log.info("AnnualTaxSettlement confirmed: id={}, by={}", id, actorUserId);
        return repository.save(entity);
    }

    @Override
    @Transactional
    public AnnualTaxSettlement markReported(String factoryId, String id, Long actorUserId) {
        AnnualTaxSettlement entity = load(factoryId, id);
        if (entity.getStatus() != AnnualTaxSettlementStatus.CONFIRMED) {
            throw new BusinessException(
                    "仅 CONFIRMED 状态可标记已申报, 当前=" + entity.getStatus());
        }
        entity.setStatus(AnnualTaxSettlementStatus.REPORTED);
        entity.setReportedAt(LocalDateTime.now());
        entity.setReportedBy(actorUserId);
        log.info("AnnualTaxSettlement reported: id={}, by={}", id, actorUserId);
        return repository.save(entity);
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        AnnualTaxSettlement entity = load(factoryId, id);
        if (entity.getStatus() != AnnualTaxSettlementStatus.DRAFT) {
            throw new BusinessException("仅 DRAFT 可删除, 当前=" + entity.getStatus());
        }
        repository.delete(entity);
        log.info("AnnualTaxSettlement deleted: id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AnnualTaxSettlement> getById(String factoryId, String id) {
        return repository.findByIdAndFactoryId(id, factoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AnnualTaxSettlement> list(String factoryId, Integer taxYear,
                                          AnnualTaxSettlementStatus status,
                                          Long userId, Pageable pageable) {
        return repository.findByFilters(factoryId, taxYear, status, userId, pageable);
    }

    // ============================================================
    // Internal helpers
    // ============================================================

    /**
     * 聚合年度数据 — pure 函数, 不写库. preview + computeForUser 复用.
     */
    private AggregationResult aggregate(String factoryId, Long userId, Integer taxYear) {
        String yearPrefix = taxYear + "-%";
        List<SalaryItem> items = salaryItemRepository
                .findByFactoryIdAndUserIdAndYearPrefix(factoryId, userId, yearPrefix);

        AggregationResult agg = new AggregationResult();
        agg.monthsCovered = items.size();

        for (SalaryItem it : items) {
            agg.totalSalary = agg.totalSalary.add(safe(it.getBaseSalary()));
            agg.totalSocialInsurance = agg.totalSocialInsurance.add(safe(it.getSocialInsuranceEmployee()));
            agg.totalProvidentFund = agg.totalProvidentFund.add(safe(it.getProvidentFundEmployee()));
            agg.monthlyPrepaidSum = agg.monthlyPrepaidSum.add(safe(it.getPersonalTax()));
            agg.totalBonus = agg.totalBonus.add(safe(it.getAnnualBonus()));
            agg.annualBonusTax = agg.annualBonusTax.add(safe(it.getAnnualBonusTax()));
        }

        // 总专项扣除 = sum across 12 month probes (用月底日作 probe).
        // 各月份独立查 ACTIVE 扣除合计, 累加 (跨月生效的会自动按月累加).
        // 不能简单按 SpecialDeduction.monthlyAmount * 12, 因为可能跨年生效/失效.
        agg.totalSpecialDeductions = computeTotalSpecialDeductions(factoryId, userId, taxYear);

        // 应纳税所得额 + 应纳税额
        agg.annualTaxableIncome = AnnualTaxCalculator.computeTaxableIncome(
                agg.totalSalary, agg.totalSocialInsurance,
                agg.totalProvidentFund, agg.totalSpecialDeductions);
        agg.annualTaxDue = AnnualTaxCalculator.computeAnnualTax(agg.annualTaxableIncome);

        // refundOwed = annualTaxDue - monthlyPrepaidSum
        // 正 = 应补缴, 负 = 应退税, 0 = 平账
        agg.refundOwed = agg.annualTaxDue.subtract(agg.monthlyPrepaidSum)
                .setScale(2, RoundingMode.HALF_UP);

        // bracket label / rate (UI 显示)
        AnnualTaxCalculator.BracketHit hit =
                AnnualTaxCalculator.findBracket(agg.annualTaxableIncome);
        agg.bracketLabel = hit.label;
        agg.bracketRate = hit.ratePercent;

        // normalize scale=2
        agg.totalSalary = agg.totalSalary.setScale(2, RoundingMode.HALF_UP);
        agg.totalBonus = agg.totalBonus.setScale(2, RoundingMode.HALF_UP);
        agg.totalSocialInsurance = agg.totalSocialInsurance.setScale(2, RoundingMode.HALF_UP);
        agg.totalProvidentFund = agg.totalProvidentFund.setScale(2, RoundingMode.HALF_UP);
        agg.totalSpecialDeductions = agg.totalSpecialDeductions.setScale(2, RoundingMode.HALF_UP);
        agg.monthlyPrepaidSum = agg.monthlyPrepaidSum.setScale(2, RoundingMode.HALF_UP);
        agg.annualBonusTax = agg.annualBonusTax.setScale(2, RoundingMode.HALF_UP);

        return agg;
    }

    /**
     * 12 月独立探针累加 — 跨月生效/失效的专项扣除自动按实际生效月数累加.
     * specialDeductionService=null (unit test) fallback 到 0.
     */
    private BigDecimal computeTotalSpecialDeductions(String factoryId, Long userId, Integer taxYear) {
        if (specialDeductionService == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = BigDecimal.ZERO;
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(taxYear, m);
            try {
                BigDecimal monthSum = specialDeductionService
                        .computeTotalDeductionForMonth(factoryId, userId, ym);
                if (monthSum != null) {
                    total = total.add(monthSum);
                }
            } catch (Exception ex) {
                // 防御: 单月查询失败不阻断汇算 (e.g. 临时 DB issue), 该月按 0
                log.warn("computeTotalSpecialDeductions month {} failed: {}", ym, ex.getMessage());
            }
        }
        return total;
    }

    private Map<String, Object> buildBreakdownMap(AggregationResult agg) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("totalSalary", agg.totalSalary);
        map.put("totalBonus", agg.totalBonus);
        map.put("totalSocialInsurance", agg.totalSocialInsurance);
        map.put("totalProvidentFund", agg.totalProvidentFund);
        map.put("totalSpecialDeductions", agg.totalSpecialDeductions);
        map.put("annualTaxableIncome", agg.annualTaxableIncome);
        map.put("annualTaxDue", agg.annualTaxDue);
        map.put("monthlyPrepaidSum", agg.monthlyPrepaidSum);
        map.put("refundOwed", agg.refundOwed);
        map.put("annualBonusTax", agg.annualBonusTax);
        map.put("bracketLabel", agg.bracketLabel);
        map.put("bracketRate", agg.bracketRate);
        map.put("monthsCovered", agg.monthsCovered);
        return map;
    }

    private AnnualTaxSettlement load(String factoryId, String id) {
        return repository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "AnnualTaxSettlement not found: " + id));
    }

    private void validateYear(Integer year) {
        if (year == null) throw new BusinessException("taxYear 不能为空");
        if (year < 2000 || year > 2100) {
            throw new BusinessException("taxYear 必须在 2000-2100 范围内, got=" + year);
        }
    }

    private static BigDecimal safe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /** 内部聚合结果, package-private 仅 service 内复用. */
    private static final class AggregationResult {
        BigDecimal totalSalary = BigDecimal.ZERO;
        BigDecimal totalBonus = BigDecimal.ZERO;
        BigDecimal totalSocialInsurance = BigDecimal.ZERO;
        BigDecimal totalProvidentFund = BigDecimal.ZERO;
        BigDecimal totalSpecialDeductions = BigDecimal.ZERO;
        BigDecimal monthlyPrepaidSum = BigDecimal.ZERO;
        BigDecimal annualBonusTax = BigDecimal.ZERO;
        BigDecimal annualTaxableIncome = BigDecimal.ZERO;
        BigDecimal annualTaxDue = BigDecimal.ZERO;
        BigDecimal refundOwed = BigDecimal.ZERO;
        String bracketLabel;
        String bracketRate;
        int monthsCovered;
    }
}
