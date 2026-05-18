package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.AnnualTaxSettlement;
import com.cretas.aims.entity.hr.enums.AnnualTaxSettlementStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Map;
import java.util.Optional;

/**
 * 年度汇算服务 (#833 follow-up).
 *
 * <p>聚合 SalaryItem (#833) 年度月度数据 + SpecialDeduction (#844) +
 * AnnualBonusTax (#861), 按中国 综合所得 7-bracket annual tax 算应纳税总额,
 * 对比月度已预缴 sum, 输出应退/应补结果.
 *
 * <p>R4 防呆 (idempotent): re-compute 同 (user, taxYear) 走 update 不 insert.
 *
 * @author Cretas Team — #833 年度汇算 follow-up
 * @since 2026-05-18
 */
public interface AnnualTaxSettlementService {

    /**
     * R1 防呆 preview: 给定 user + year, 计算汇算结果, NOT 写库.
     * 返回完整 breakdown Map 供 dialog 显示 "应退/应补 ¥X" + 详细分项.
     *
     * <p>返回字段 (Map):
     * <ul>
     *   <li>{@code totalSalary} / {@code totalBonus} / {@code totalSocialInsurance} /
     *       {@code totalProvidentFund} / {@code totalSpecialDeductions}</li>
     *   <li>{@code annualTaxableIncome} / {@code annualTaxDue} /
     *       {@code monthlyPrepaidSum} / {@code refundOwed}</li>
     *   <li>{@code annualBonusTax} (info-only)</li>
     *   <li>{@code bracketLabel} / {@code bracketRate}</li>
     *   <li>{@code monthsCovered}</li>
     * </ul>
     */
    Map<String, Object> previewCompute(String factoryId, Long userId, Integer taxYear);

    /**
     * R4 防呆 (idempotent): 计算并保存. 若 (user, year) 已存在 settlement,
     * REPORTED 状态拒改 (R5 防呆), 否则 update existing; 不存在则新建.
     *
     * @return 保存后的 entity (含完整 breakdown).
     */
    AnnualTaxSettlement computeForUser(String factoryId, Long userId, Integer taxYear);

    /**
     * 确认: DRAFT → CONFIRMED.
     */
    AnnualTaxSettlement confirm(String factoryId, String id, Long actorUserId);

    /**
     * 标记已申报税局: CONFIRMED → REPORTED (R5 防呆 锁住, 后续 computeForUser 拒改).
     */
    AnnualTaxSettlement markReported(String factoryId, String id, Long actorUserId);

    /**
     * 删除: 仅 DRAFT 可删 (soft delete).
     */
    void delete(String factoryId, String id);

    Optional<AnnualTaxSettlement> getById(String factoryId, String id);

    /** 列表查询 (filter by taxYear/status/userId). */
    Page<AnnualTaxSettlement> list(String factoryId, Integer taxYear,
                                    AnnualTaxSettlementStatus status,
                                    Long userId, Pageable pageable);
}
