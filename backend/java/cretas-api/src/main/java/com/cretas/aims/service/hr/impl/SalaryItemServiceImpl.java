package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.HrInsuranceConfig;
import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.SalaryStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.hr.SalaryItemRepository;
import com.cretas.aims.service.hr.AnnualBonusTaxCalculator;
import com.cretas.aims.service.hr.HrCityInsuranceOverrideService;
import com.cretas.aims.service.hr.HrInsuranceConfigService;
import com.cretas.aims.service.hr.SalaryItemService;
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
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 工资单 Service 实现.
 *
 * <p>计算口径 (简化 MVP):
 * <ul>
 *   <li>个人社保 = base * 10.5% (养老 8% + 医疗 2% + 失业 0.5%)</li>
 *   <li>单位社保 = base * 26% (养老 16% + 医疗 8% + 失业 0.5% + 工伤 0.5% + 生育 1%)</li>
 *   <li>个人公积金 = base * 8%</li>
 *   <li>单位公积金 = base * 8%</li>
 *   <li>应税收入 = base - 个人社保 - 个人公积金 - 5000 起征点</li>
 *   <li>个税 = 7-bracket 月度公式 (3%/10%/20%/25%/30%/35%/45%)</li>
 * </ul>
 *
 * @author Cretas Team — P1-40 H-WAGE-FULL MVP
 * @since 2026-05-17
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SalaryItemServiceImpl implements SalaryItemService {

    // 法定默认费率 (#833 follow-up: 这些只作为 fallback;
    // 实际生效费率走 HrInsuranceConfigService.getCurrent(factoryId, yearMonth))
    private static final BigDecimal RATE_SOCIAL_EMPLOYEE = new BigDecimal("0.105");
    private static final BigDecimal RATE_SOCIAL_EMPLOYER = new BigDecimal("0.26");
    private static final BigDecimal RATE_FUND_EMPLOYEE = new BigDecimal("0.08");
    private static final BigDecimal RATE_FUND_EMPLOYER = new BigDecimal("0.08");
    private static final BigDecimal TAX_THRESHOLD = new BigDecimal("5000");

    private final SalaryItemRepository repository;

    /**
     * 专项扣除服务 — Optional 注入避免 unit test (mocking 只填 repository)
     * 因缺 bean 启动失败. 生产 / IT 环境总是有 bean.
     */
    @Autowired(required = false)
    private SalarySpecialDeductionService specialDeductionService;

    /**
     * #833 follow-up: 工厂级 社保 / 公积金 费率配置服务 (Optional 注入, 同上理由).
     * 当 service 为 null (e.g. legacy unit test) 时, fallback 到本文件硬编码 RATE_* 常量.
     */
    @Autowired(required = false)
    private HrInsuranceConfigService insuranceConfigService;

    /**
     * #863 follow-up: 城市差异化覆盖服务 (Optional 注入, 同上).
     * 当 user 关联了 city 且该 city 有 ACTIVE 覆盖时, 应用基数 / 费率覆盖.
     * 否则 fallback 到工厂默认 (insuranceConfigService).
     */
    @Autowired(required = false)
    private HrCityInsuranceOverrideService cityOverrideService;

    @Override
    @Transactional
    public SalaryItem create(String factoryId, Long userId, String yearMonth,
                             BigDecimal baseSalary, String remark) {
        validateYearMonth(yearMonth);
        if (baseSalary == null || baseSalary.signum() < 0) {
            throw new BusinessException("baseSalary 必须 ≥ 0");
        }
        // R4 防呆: 同 user+yearMonth 已存在 → 409
        Optional<SalaryItem> existing = repository.findByFactoryIdAndUserIdAndYearMonth(
                factoryId, userId, yearMonth);
        if (existing.isPresent()) {
            SalaryItem e = existing.get();
            throw new BusinessException(409, String.format(
                    "用户 %d 在 %s 已存在工资单 (id=%s, 状态=%s), 请直接编辑或先删除",
                    userId, yearMonth, e.getId(), e.getStatus()));
        }
        // 集成: 拉取该 user+yearMonth 所有 ACTIVE 专项扣除合计, 减少应税收入
        BigDecimal specialDeduction = fetchSpecialDeductionTotal(factoryId, userId, yearMonth);
        // #833 follow-up: 走工厂级费率配置 (fallback 到硬编码默认)
        // #863 follow-up: 若该 user 关联了 city, 应用城市覆盖 (基数 + 费率)
        Map<String, BigDecimal> calc = resolveRatesAndPreview(
                factoryId, userId, yearMonth, baseSalary, specialDeduction);
        SalaryItem item = SalaryItem.builder()
                .factoryId(factoryId)
                .userId(userId)
                .yearMonth(yearMonth)
                .baseSalary(baseSalary)
                .socialInsuranceEmployee(calc.get("socialInsuranceEmployee"))
                .socialInsuranceEmployer(calc.get("socialInsuranceEmployer"))
                .providentFundEmployee(calc.get("providentFundEmployee"))
                .providentFundEmployer(calc.get("providentFundEmployer"))
                .taxableIncome(calc.get("taxableIncome"))
                .personalTax(calc.get("personalTax"))
                .netSalary(calc.get("netSalary"))
                .status(SalaryStatus.DRAFT)
                .remark(remark)
                .build();
        SalaryItem saved = repository.save(item);
        log.info("SalaryItem created: id={}, user={}, ym={}, base={}, specialDeduction={}",
                saved.getId(), userId, yearMonth, baseSalary, specialDeduction);
        return saved;
    }

    @Override
    @Transactional
    public SalaryItem update(String factoryId, String id, BigDecimal baseSalary, String remark) {
        SalaryItem item = load(factoryId, id);
        if (item.getStatus() == SalaryStatus.PAID) {
            throw new BusinessException("已发放工资单不可修改");
        }
        if (item.getStatus() == SalaryStatus.CONFIRMED) {
            // 仅允许改 remark
            if (baseSalary != null && baseSalary.compareTo(item.getBaseSalary()) != 0) {
                throw new BusinessException("已确认工资单仅可修改备注, 如需改基本工资请先回退到 DRAFT");
            }
            item.setRemark(remark);
        } else {
            // DRAFT — 全字段允许改
            if (baseSalary != null) {
                if (baseSalary.signum() < 0) throw new BusinessException("baseSalary 必须 ≥ 0");
                BigDecimal specialDeduction = fetchSpecialDeductionTotal(
                        factoryId, item.getUserId(), item.getYearMonth());
                // #833 follow-up: 走工厂级费率配置
                // #863 follow-up: 含 user 关联 city 的覆盖
                Map<String, BigDecimal> calc = resolveRatesAndPreview(
                        factoryId, item.getUserId(), item.getYearMonth(), baseSalary, specialDeduction);
                item.setBaseSalary(baseSalary);
                item.setSocialInsuranceEmployee(calc.get("socialInsuranceEmployee"));
                item.setSocialInsuranceEmployer(calc.get("socialInsuranceEmployer"));
                item.setProvidentFundEmployee(calc.get("providentFundEmployee"));
                item.setProvidentFundEmployer(calc.get("providentFundEmployer"));
                item.setTaxableIncome(calc.get("taxableIncome"));
                item.setPersonalTax(calc.get("personalTax"));
                item.setNetSalary(calc.get("netSalary"));
            }
            item.setRemark(remark);
        }
        return repository.save(item);
    }

    /**
     * R1 防呆 preview: 算 social + fund + tax + net, 不写库.
     * Pure function — Controller 调它给 dialog 实时显示预览.
     *
     * <p>backward-compat: 默认 specialDeductionTotal=0. 调用方需要扣减专项扣除时
     * 改调 {@link #previewComputeFromBaseWithDeductions}.
     */
    @Override
    public Map<String, BigDecimal> previewComputeFromBase(BigDecimal baseSalary) {
        return previewComputeFromBaseWithDeductions(baseSalary, BigDecimal.ZERO);
    }

    /**
     * R1 防呆 preview with 专项扣除: 同 previewComputeFromBase, 但额外减去
     * specialDeductionTotal (6 大附加扣除月度合计).
     *
     * <p>计税公式: taxable = base - 个人社保 - 个人公积金 - 5000起征点 - specialDeductionTotal
     * (taxable < 0 截到 0)
     *
     * <p>backward-compat: 此入口走默认硬编码费率 (RATE_* 常量).
     * 走配置费率请用 {@link #previewComputeFromBaseWithRates}.
     */
    @Override
    public Map<String, BigDecimal> previewComputeFromBaseWithDeductions(
            BigDecimal baseSalary, BigDecimal specialDeductionTotal) {
        return previewComputeFromBaseWithRates(
                baseSalary, specialDeductionTotal,
                RATE_SOCIAL_EMPLOYEE, RATE_SOCIAL_EMPLOYER,
                RATE_FUND_EMPLOYEE, RATE_FUND_EMPLOYER);
    }

    /**
     * Internal helper: 同 previewComputeFromBaseWithDeductions 但接受外部传入的费率.
     * #833 follow-up: 让 create / update / applyComputeFromBase 路径走
     * HrInsuranceConfigService 解析的费率而非硬编码.
     */
    private Map<String, BigDecimal> previewComputeFromBaseWithRates(
            BigDecimal baseSalary, BigDecimal specialDeductionTotal,
            BigDecimal rateSocialEmployee, BigDecimal rateSocialEmployer,
            BigDecimal rateFundEmployee, BigDecimal rateFundEmployer) {
        if (baseSalary == null) baseSalary = BigDecimal.ZERO;
        if (specialDeductionTotal == null) specialDeductionTotal = BigDecimal.ZERO;
        if (specialDeductionTotal.signum() < 0) specialDeductionTotal = BigDecimal.ZERO;

        BigDecimal socialEmp = baseSalary.multiply(rateSocialEmployee).setScale(2, RoundingMode.HALF_UP);
        BigDecimal socialEmr = baseSalary.multiply(rateSocialEmployer).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fundEmp = baseSalary.multiply(rateFundEmployee).setScale(2, RoundingMode.HALF_UP);
        BigDecimal fundEmr = baseSalary.multiply(rateFundEmployer).setScale(2, RoundingMode.HALF_UP);
        // 关键改动: 专项扣除从应税收入中减去 (在 5000 起征点之后)
        BigDecimal taxable = baseSalary.subtract(socialEmp).subtract(fundEmp)
                .subtract(TAX_THRESHOLD).subtract(specialDeductionTotal);
        if (taxable.signum() < 0) taxable = BigDecimal.ZERO;
        BigDecimal tax = computePersonalTax(taxable);
        BigDecimal net = baseSalary.subtract(socialEmp).subtract(fundEmp).subtract(tax);
        if (net.signum() < 0) net = BigDecimal.ZERO;

        Map<String, BigDecimal> result = new LinkedHashMap<>();
        result.put("baseSalary", baseSalary.setScale(2, RoundingMode.HALF_UP));
        result.put("socialInsuranceEmployee", socialEmp);
        result.put("socialInsuranceEmployer", socialEmr);
        result.put("providentFundEmployee", fundEmp);
        result.put("providentFundEmployer", fundEmr);
        result.put("specialDeductionTotal",
                specialDeductionTotal.setScale(2, RoundingMode.HALF_UP));
        result.put("taxableIncome", taxable.setScale(2, RoundingMode.HALF_UP));
        result.put("personalTax", tax);
        result.put("netSalary", net.setScale(2, RoundingMode.HALF_UP));
        return result;
    }

    @Override
    @Transactional
    public SalaryItem applyComputeFromBase(String factoryId, String id) {
        SalaryItem item = load(factoryId, id);
        if (item.getStatus() != SalaryStatus.DRAFT) {
            throw new BusinessException("仅 DRAFT 状态可重算, 当前状态=" + item.getStatus());
        }
        BigDecimal specialDeduction = fetchSpecialDeductionTotal(
                factoryId, item.getUserId(), item.getYearMonth());
        // #833 follow-up: 走工厂级费率配置
        // #863 follow-up: 含 user 关联 city 的覆盖
        Map<String, BigDecimal> calc = resolveRatesAndPreview(
                factoryId, item.getUserId(), item.getYearMonth(),
                item.getBaseSalary(), specialDeduction);
        item.setSocialInsuranceEmployee(calc.get("socialInsuranceEmployee"));
        item.setSocialInsuranceEmployer(calc.get("socialInsuranceEmployer"));
        item.setProvidentFundEmployee(calc.get("providentFundEmployee"));
        item.setProvidentFundEmployer(calc.get("providentFundEmployer"));
        item.setTaxableIncome(calc.get("taxableIncome"));
        item.setPersonalTax(calc.get("personalTax"));
        item.setNetSalary(calc.get("netSalary"));
        return repository.save(item);
    }

    /**
     * #833 follow-up: 解析该 factory + yearMonth 的费率配置后调 previewComputeFromBaseWithRates.
     * insuranceConfigService null (legacy unit test) 时 fallback 到 RATE_* 硬编码常量.
     *
     * <p>#863 follow-up: 接受 {@code userId}, 若该 user 关联了 city 且 cityOverrideService 可用,
     * 取合并后的 effective 配置 (含城市基数 + 部分费率覆盖); 否则走工厂默认.
     *
     * <p>缴费基数 capping: effective.baseSalaryLowerBound / upperBound 不为空时,
     * baseSalary 被 clamp 到 [lower, upper] 后再算 social / fund. 这是城市差异化的核心价值.
     */
    private Map<String, BigDecimal> resolveRatesAndPreview(
            String factoryId, Long userId, String yearMonth,
            BigDecimal baseSalary, BigDecimal specialDeductionTotal) {
        if (insuranceConfigService == null) {
            // Fallback: 用硬编码默认 (backward-compat for unit tests)
            return previewComputeFromBaseWithDeductions(baseSalary, specialDeductionTotal);
        }
        YearMonth ym;
        try {
            ym = YearMonth.parse(yearMonth);
        } catch (DateTimeParseException ex) {
            log.warn("resolveRatesAndPreview: invalid yearMonth={}, fallback to defaults", yearMonth);
            return previewComputeFromBaseWithDeductions(baseSalary, specialDeductionTotal);
        }

        // #863: 查 user → city → effective merged config
        HrInsuranceConfig cfg;
        String cityCode = null;
        if (cityOverrideService != null && userId != null) {
            cityCode = cityOverrideService.getEmployeeCityCode(factoryId, userId);
        }
        if (cityCode != null && cityOverrideService != null) {
            cfg = cityOverrideService.getEffectiveConfigForCity(factoryId, cityCode, ym);
        } else {
            cfg = insuranceConfigService.getCurrent(factoryId, ym);
        }

        // 个人社保 = 养老 + 医疗 + 失业 (合计)
        BigDecimal socialEmp = safeRate(cfg.getEmployeePensionRate())
                .add(safeRate(cfg.getEmployeeMedicalRate()))
                .add(safeRate(cfg.getEmployeeUnemploymentRate()));
        BigDecimal socialEmr = safeRate(cfg.getEmployerPensionRate())
                .add(safeRate(cfg.getEmployerMedicalRate()))
                .add(safeRate(cfg.getEmployerUnemploymentRate()));

        // 应用基数 clamp (城市覆盖必填基数, 工厂默认 optional)
        BigDecimal cappedBase = clampBase(baseSalary,
                cfg.getBaseSalaryLowerBound(), cfg.getBaseSalaryUpperBound());

        Map<String, BigDecimal> result = previewComputeFromBaseWithRates(
                cappedBase, specialDeductionTotal,
                socialEmp, socialEmr,
                safeRate(cfg.getEmployeeProvidentFundRate()),
                safeRate(cfg.getEmployerProvidentFundRate()));
        // 计算结果中的 baseSalary 应当反映 cap 之后的值 (统计预览口径一致)
        result.put("baseSalary", cappedBase == null
                ? BigDecimal.ZERO
                : cappedBase.setScale(2, RoundingMode.HALF_UP));
        return result;
    }

    /**
     * #863 防呆: 缴费基数 cap 到 [lower, upper] (任一为空则跳过对应方向).
     */
    static BigDecimal clampBase(BigDecimal base, BigDecimal lower, BigDecimal upper) {
        if (base == null) return BigDecimal.ZERO;
        BigDecimal v = base;
        if (lower != null && v.compareTo(lower) < 0) v = lower;
        if (upper != null && v.compareTo(upper) > 0) v = upper;
        return v;
    }

    private static BigDecimal safeRate(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    /**
     * 拉取该 user+yearMonth 所有 ACTIVE 专项扣除合计.
     * MVP: specialDeductionService 是 @Autowired(required=false) — unit test (mock 只填
     * repository) 可能为 null, 此时返 0 维持向后兼容.
     */
    private BigDecimal fetchSpecialDeductionTotal(String factoryId, Long userId, String yearMonth) {
        if (specialDeductionService == null) {
            return BigDecimal.ZERO;
        }
        try {
            YearMonth ym = YearMonth.parse(yearMonth);
            BigDecimal v = specialDeductionService.computeTotalDeductionForMonth(
                    factoryId, userId, ym);
            return v == null ? BigDecimal.ZERO : v;
        } catch (DateTimeParseException ex) {
            // 已经在调用方 validateYearMonth 过, 这里防御一道
            log.warn("fetchSpecialDeductionTotal: invalid yearMonth={}, fallback to 0", yearMonth);
            return BigDecimal.ZERO;
        }
    }

    @Override
    @Transactional
    public SalaryItem confirm(String factoryId, String id, Long actorUserId) {
        SalaryItem item = load(factoryId, id);
        if (item.getStatus() != SalaryStatus.DRAFT) {
            throw new BusinessException("仅 DRAFT 可确认, 当前=" + item.getStatus());
        }
        item.setStatus(SalaryStatus.CONFIRMED);
        item.setConfirmedAt(LocalDateTime.now());
        item.setConfirmedBy(actorUserId);
        log.info("SalaryItem confirmed: id={}, by={}", id, actorUserId);
        return repository.save(item);
    }

    @Override
    @Transactional
    public SalaryItem markPaid(String factoryId, String id, Long actorUserId) {
        SalaryItem item = load(factoryId, id);
        if (item.getStatus() != SalaryStatus.CONFIRMED) {
            throw new BusinessException("仅 CONFIRMED 可标记发放, 当前=" + item.getStatus());
        }
        item.setStatus(SalaryStatus.PAID);
        item.setPaidAt(LocalDateTime.now());
        item.setPaidBy(actorUserId);
        log.info("SalaryItem paid: id={}, by={}", id, actorUserId);
        return repository.save(item);
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        SalaryItem item = load(factoryId, id);
        if (item.getStatus() != SalaryStatus.DRAFT) {
            throw new BusinessException("仅 DRAFT 可删除, 当前=" + item.getStatus());
        }
        repository.delete(item);
        log.info("SalaryItem deleted: id={}", id);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SalaryItem> getById(String factoryId, String id) {
        return repository.findByIdAndFactoryId(id, factoryId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SalaryItem> list(String factoryId, String yearMonth, SalaryStatus status,
                                 Long userId, Pageable pageable) {
        if (userId != null) {
            return repository.findByFactoryIdAndUserId(factoryId, userId, pageable);
        }
        if (yearMonth != null && status != null) {
            return repository.findByFactoryIdAndYearMonthAndStatus(factoryId, yearMonth, status, pageable);
        }
        if (yearMonth != null) {
            return repository.findByFactoryIdAndYearMonth(factoryId, yearMonth, pageable);
        }
        if (status != null) {
            return repository.findByFactoryIdAndStatus(factoryId, status, pageable);
        }
        return repository.findByFactoryId(factoryId, pageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, BigDecimal> summarizeMonth(String factoryId, String yearMonth) {
        validateYearMonth(yearMonth);
        Object[] row = repository.sumMonthlyTotals(factoryId, yearMonth);
        BigDecimal totalBase = BigDecimal.ZERO;
        BigDecimal totalSocial = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;
        BigDecimal totalNet = BigDecimal.ZERO;
        // sumMonthlyTotals 返回 Object[1][4] (Object[] wrap List, 取首元素)
        // Note: 当无记录时 SUM 返 null
        if (row != null && row.length >= 4) {
            // Some Hibernate variants wrap the row inside another array, we handle that.
            Object[] cells = row;
            if (row.length == 1 && row[0] instanceof Object[]) {
                cells = (Object[]) row[0];
            }
            if (cells.length >= 4) {
                if (cells[0] != null) totalBase = (BigDecimal) cells[0];
                if (cells[1] != null) totalSocial = (BigDecimal) cells[1];
                if (cells[2] != null) totalTax = (BigDecimal) cells[2];
                if (cells[3] != null) totalNet = (BigDecimal) cells[3];
            }
        }
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        result.put("totalBase", totalBase);
        result.put("totalSocialEmployee", totalSocial);
        result.put("totalPersonalTax", totalTax);
        result.put("totalNet", totalNet);
        return result;
    }

    /**
     * 简化月度个税 (2018-10 起 7-bracket).
     * 应税收入 (taxable income after 5000 threshold + social + fund deductions):
     *   ≤ 3000          : 3%, 速算扣除 0
     *   3000  - 12000   : 10%, 速算扣除 210
     *   12000 - 25000   : 20%, 速算扣除 1410
     *   25000 - 35000   : 25%, 速算扣除 2660
     *   35000 - 55000   : 30%, 速算扣除 4410
     *   55000 - 80000   : 35%, 速算扣除 7160
     *   > 80000         : 45%, 速算扣除 15160
     */
    static BigDecimal computePersonalTax(BigDecimal taxableIncome) {
        if (taxableIncome == null || taxableIncome.signum() <= 0) return BigDecimal.ZERO;
        BigDecimal rate;
        BigDecimal deduction;
        BigDecimal threshold3000 = new BigDecimal("3000");
        BigDecimal threshold12000 = new BigDecimal("12000");
        BigDecimal threshold25000 = new BigDecimal("25000");
        BigDecimal threshold35000 = new BigDecimal("35000");
        BigDecimal threshold55000 = new BigDecimal("55000");
        BigDecimal threshold80000 = new BigDecimal("80000");
        if (taxableIncome.compareTo(threshold3000) <= 0) {
            rate = new BigDecimal("0.03"); deduction = BigDecimal.ZERO;
        } else if (taxableIncome.compareTo(threshold12000) <= 0) {
            rate = new BigDecimal("0.10"); deduction = new BigDecimal("210");
        } else if (taxableIncome.compareTo(threshold25000) <= 0) {
            rate = new BigDecimal("0.20"); deduction = new BigDecimal("1410");
        } else if (taxableIncome.compareTo(threshold35000) <= 0) {
            rate = new BigDecimal("0.25"); deduction = new BigDecimal("2660");
        } else if (taxableIncome.compareTo(threshold55000) <= 0) {
            rate = new BigDecimal("0.30"); deduction = new BigDecimal("4410");
        } else if (taxableIncome.compareTo(threshold80000) <= 0) {
            rate = new BigDecimal("0.35"); deduction = new BigDecimal("7160");
        } else {
            rate = new BigDecimal("0.45"); deduction = new BigDecimal("15160");
        }
        BigDecimal tax = taxableIncome.multiply(rate).subtract(deduction);
        if (tax.signum() < 0) tax = BigDecimal.ZERO;
        return tax.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * #833 follow-up: 设置年终奖 + 计算 tax + 写库.
     *
     * <p>R4 防呆: PAID 拒改, DRAFT/CONFIRMED 可任意更新.
     * <p>不动月度个税字段 (personal_tax/socialInsuranceEmployee/etc.) — 独立于月度算法.
     */
    @Override
    @Transactional
    public SalaryItem setAnnualBonus(String factoryId, String id, BigDecimal bonus) {
        SalaryItem item = load(factoryId, id);
        if (item.getStatus() == SalaryStatus.PAID) {
            throw new BusinessException(
                    String.format("已发放工资单不可修改年终奖 [用户 %d / %s]",
                            item.getUserId(), item.getYearMonth()));
        }
        if (bonus == null) {
            // 清空模式: 清掉 annualBonus + tax
            item.setAnnualBonus(null);
            item.setAnnualBonusTax(null);
        } else {
            if (bonus.signum() < 0) {
                throw new BusinessException("年终奖必须 ≥ 0");
            }
            BigDecimal normalized = bonus.setScale(2, RoundingMode.HALF_UP);
            BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(normalized);
            item.setAnnualBonus(normalized);
            item.setAnnualBonusTax(tax);
        }
        SalaryItem saved = repository.save(item);
        log.info("SalaryItem annual bonus set: id={}, user={}, ym={}, bonus={}, tax={}",
                saved.getId(), saved.getUserId(), saved.getYearMonth(),
                saved.getAnnualBonus(), saved.getAnnualBonusTax());
        return saved;
    }

    /**
     * #833 follow-up R1: preview 年终奖税额 (不写库).
     */
    @Override
    public Map<String, Object> previewAnnualBonusTax(BigDecimal bonus) {
        BigDecimal amount = bonus == null ? BigDecimal.ZERO : bonus;
        if (amount.signum() < 0) amount = BigDecimal.ZERO;
        BigDecimal normalized = amount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal tax = AnnualBonusTaxCalculator.computeAnnualBonusTax(normalized);
        AnnualBonusTaxCalculator.BracketHit hit =
                AnnualBonusTaxCalculator.findBracket(normalized);
        BigDecimal monthlyEq = normalized.divide(
                new BigDecimal("12"), 2, RoundingMode.HALF_UP);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("annualBonus", normalized);
        result.put("annualBonusTax", tax);
        result.put("monthlyEquivalent", monthlyEq);
        result.put("bracketRate", hit.ratePercent);
        result.put("bracketLabel", hit.label);
        result.put("quickDeduction", hit.quickDeduction);
        return result;
    }

    private SalaryItem load(String factoryId, String id) {
        return repository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new ResourceNotFoundException("SalaryItem not found: " + id));
    }

    private void validateYearMonth(String ym) {
        if (ym == null || ym.length() != 7) {
            throw new BusinessException("yearMonth 必须为 YYYY-MM 格式 (got: " + ym + ")");
        }
        try {
            YearMonth.parse(ym);
        } catch (DateTimeParseException ex) {
            throw new BusinessException("yearMonth 格式错误 (期望 YYYY-MM): " + ym);
        }
    }
}
