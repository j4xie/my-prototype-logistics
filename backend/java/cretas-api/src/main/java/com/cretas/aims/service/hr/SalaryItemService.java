package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.SalaryStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/**
 * 月度工资单服务 (MVP).
 *
 * <p>MVP scope: 基本工资 + 社保 + 公积金 + 简化个税 (7-bracket 月度).
 *
 * <p>Deferred (next batch): 专项扣除 / 年度汇算 / 工资条 PDF / 个税复杂 brackets.
 *
 * @author Cretas Team — P1-40 H-WAGE-FULL MVP
 * @since 2026-05-17
 */
public interface SalaryItemService {

    /**
     * 创建工资单 (DRAFT 状态). R4 防呆: 同 user+yearMonth 已存在则抛 409.
     */
    SalaryItem create(String factoryId, Long userId, String yearMonth,
                      BigDecimal baseSalary, String remark);

    /**
     * 更新 DRAFT 状态工资单的基本工资和备注.
     * CONFIRMED 仅允许更新 remark; PAID 不可改.
     */
    SalaryItem update(String factoryId, String id, BigDecimal baseSalary, String remark);

    /**
     * R1 防呆 preview: 根据 baseSalary 计算 social/tax/net, 不写库.
     * 返回 Map: baseSalary / socialInsuranceEmployee / socialInsuranceEmployer /
     * providentFundEmployee / providentFundEmployer / taxableIncome / personalTax / netSalary.
     *
     * <p>backward-compat 入口 — 默认 specialDeductionTotal=0.
     */
    Map<String, BigDecimal> previewComputeFromBase(BigDecimal baseSalary);

    /**
     * R1 防呆 preview with 专项扣除: 同 previewComputeFromBase, 但额外减去
     * specialDeductionTotal (6 大附加扣除月度合计).
     *
     * <p>计税公式: taxable = base - 个人社保 - 个人公积金 - 5000起征点 - specialDeductionTotal
     * (taxable < 0 截到 0)
     */
    Map<String, BigDecimal> previewComputeFromBaseWithDeductions(
            BigDecimal baseSalary, BigDecimal specialDeductionTotal);

    /**
     * 应用 computeFromBase 到已存在的 DRAFT 工资单.
     * CONFIRMED/PAID 拒绝.
     */
    SalaryItem applyComputeFromBase(String factoryId, String id);

    /**
     * 确认 DRAFT 工资单 (DRAFT → CONFIRMED).
     */
    SalaryItem confirm(String factoryId, String id, Long actorUserId);

    /**
     * 标记 CONFIRMED 工资单已发放 (CONFIRMED → PAID).
     */
    SalaryItem markPaid(String factoryId, String id, Long actorUserId);

    /**
     * 删除 DRAFT 工资单 (soft delete). CONFIRMED/PAID 拒绝.
     */
    void delete(String factoryId, String id);

    Optional<SalaryItem> getById(String factoryId, String id);

    /** 列表查询 (可按 yearMonth/status 过滤). */
    Page<SalaryItem> list(String factoryId, String yearMonth, SalaryStatus status,
                          Long userId, Pageable pageable);

    /**
     * 月度汇总: 工厂某月份的总应发/总社保/总税/总实发.
     * 返回 Map: totalBase / totalSocialEmployee / totalPersonalTax / totalNet / recordCount.
     */
    Map<String, BigDecimal> summarizeMonth(String factoryId, String yearMonth);

    /**
     * #833 follow-up: 设置/更新年终奖金额 + 按一次性年终奖税法计算个税写库.
     *
     * <p>R4 防呆: PAID 状态拒绝修改, DRAFT/CONFIRMED 可任意更新.
     * <p>不影响月度个税 (personal_tax 不变).
     *
     * @param factoryId factory
     * @param id        SalaryItem id
     * @param bonus     年终奖金额 (≥0). null 视为清空 (annualBonus=null, tax=null).
     * @return saved SalaryItem (含 annualBonus + annualBonusTax)
     */
    SalaryItem setAnnualBonus(String factoryId, String id, BigDecimal bonus);

    /**
     * #833 follow-up R1: preview 年终奖税额 (不写库).
     * 用于 Vue dialog 输入 bonus 时实时显示 "税额 ¥X (税率 Y% bracket)".
     *
     * @param bonus 年终奖金额 (null/≤0 返 zero)
     * @return Map: annualBonus / annualBonusTax / bracketRate / bracketLabel / monthlyEquivalent
     */
    Map<String, Object> previewAnnualBonusTax(BigDecimal bonus);
}
