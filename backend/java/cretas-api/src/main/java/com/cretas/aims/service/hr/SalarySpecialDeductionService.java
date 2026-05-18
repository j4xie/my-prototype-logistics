package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.SalarySpecialDeduction;
import com.cretas.aims.entity.hr.enums.DeductionStatus;
import com.cretas.aims.entity.hr.enums.DeductionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/**
 * 个税专项附加扣除服务.
 *
 * <p>关键集成点: {@link #computeTotalDeductionForMonth} 被 SalaryItemServiceImpl
 * 在月度计税时调用, 把扣除总额加进 taxableIncome 减项, 减少应税金额.
 *
 * @author Cretas Team — P1-40 H-WAGE 专项扣除 follow-up
 * @since 2026-05-17
 */
public interface SalarySpecialDeductionService {

    /**
     * 创建一条专项附加扣除 (默认 ACTIVE).
     * R4 防呆: 同 (factoryId, userId, deductionType, validFrom) ACTIVE 已存在则 409.
     */
    SalarySpecialDeduction create(String factoryId, Long userId, DeductionType deductionType,
                                   BigDecimal monthlyAmount, LocalDate validFrom,
                                   LocalDate validTo, String notes);

    /**
     * 更新扣除项 (仅 ACTIVE 可改). 状态变更走 changeStatus.
     */
    SalarySpecialDeduction update(String factoryId, String id, BigDecimal monthlyAmount,
                                   LocalDate validTo, String notes);

    /**
     * 状态变更: ACTIVE → EXPIRED (用户结束) / ACTIVE → CANCELLED (HR 撤销).
     * 不允许 EXPIRED/CANCELLED 回到 ACTIVE (需要创建新记录).
     */
    SalarySpecialDeduction changeStatus(String factoryId, String id, DeductionStatus newStatus);

    /**
     * 软删除 (仅 EXPIRED/CANCELLED 可删).
     */
    void delete(String factoryId, String id);

    Optional<SalarySpecialDeduction> getById(String factoryId, String id);

    /** 列表查询 (按 user/status/type 组合 filter). */
    Page<SalarySpecialDeduction> list(String factoryId, Long userId, DeductionStatus status,
                                       DeductionType deductionType, Pageable pageable);

    /**
     * 计算指定 user 在指定 yearMonth 的专项扣除总额.
     * 用月末日作 probeDate 覆盖月内任意时点生效.
     *
     * <p>例: computeTotalDeductionForMonth("F006", 22, "2026-05") 返回该员工 2026-05
     * 所有 ACTIVE 的专项扣除月度金额之和 (子女教育 1000 + 房贷利息 1000 + 赡养老人 2000 = 4000).
     */
    BigDecimal computeTotalDeductionForMonth(String factoryId, Long userId, YearMonth yearMonth);

    /**
     * 列出指定 user 在指定 yearMonth 所有 ACTIVE 扣除明细 (R1 防呆 UI preview 用).
     */
    List<SalarySpecialDeduction> listActiveForMonth(String factoryId, Long userId,
                                                     YearMonth yearMonth);
}
