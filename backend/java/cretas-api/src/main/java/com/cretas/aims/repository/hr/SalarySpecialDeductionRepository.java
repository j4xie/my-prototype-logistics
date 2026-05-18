package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.SalarySpecialDeduction;
import com.cretas.aims.entity.hr.enums.DeductionStatus;
import com.cretas.aims.entity.hr.enums.DeductionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 专项附加扣除数据访问层.
 *
 * @author Cretas Team — P1-40 H-WAGE 专项扣除 follow-up
 * @since 2026-05-17
 */
@Repository
public interface SalarySpecialDeductionRepository
        extends JpaRepository<SalarySpecialDeduction, String> {

    Optional<SalarySpecialDeduction> findByIdAndFactoryId(String id, String factoryId);

    /**
     * R4 防呆: 检查同 factory+user+type+validFrom 是否已存在 ACTIVE 记录.
     * MVP unique key 包含 valid_from 是因为同一类型扣除可能历史多段
     * (比如新生孩子, 子女教育扣除从新生日重新申报).
     */
    Optional<SalarySpecialDeduction>
        findByFactoryIdAndUserIdAndDeductionTypeAndValidFromAndStatus(
            String factoryId, Long userId, DeductionType deductionType,
            LocalDate validFrom, DeductionStatus status);

    Page<SalarySpecialDeduction> findByFactoryId(String factoryId, Pageable pageable);

    Page<SalarySpecialDeduction> findByFactoryIdAndStatus(
            String factoryId, DeductionStatus status, Pageable pageable);

    Page<SalarySpecialDeduction> findByFactoryIdAndUserId(
            String factoryId, Long userId, Pageable pageable);

    Page<SalarySpecialDeduction> findByFactoryIdAndDeductionType(
            String factoryId, DeductionType deductionType, Pageable pageable);

    /**
     * 列表查询带组合 filter (userId / status / deductionType 任意为 null 跳过过滤).
     * 用 (CAST(:status AS string) IS NULL OR ...) 模式适配 PostgreSQL 严格类型推断
     * (见 .claude/rules/database-entity-sync.md "could not determine data type").
     */
    @Query("""
            SELECT d FROM SalarySpecialDeduction d
            WHERE d.factoryId = :factoryId
              AND (:userId IS NULL OR d.userId = :userId)
              AND (CAST(:status AS string) IS NULL OR d.status = :status)
              AND (CAST(:deductionType AS string) IS NULL OR d.deductionType = :deductionType)
            ORDER BY d.userId ASC, d.deductionType ASC, d.validFrom DESC
            """)
    Page<SalarySpecialDeduction> findByFilters(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            @Param("status") DeductionStatus status,
            @Param("deductionType") DeductionType deductionType,
            Pageable pageable);

    /**
     * 月度计税核心: 计算指定 user 在指定日期 (月初任意一天作为代表) 的
     * ACTIVE 专项扣除总额. 命中条件: status='ACTIVE' AND validFrom ≤ probeDate AND
     * (validTo IS NULL OR validTo ≥ probeDate).
     *
     * <p>注: probeDate 通常传该月份的月底 (e.g. 2026-05-31) 以覆盖月内任意时点生效.
     * 月度个税是月度概念, 此处简化为"月内任意时点 active 即整月按比例扣除".
     */
    @Query("""
            SELECT COALESCE(SUM(d.monthlyAmount), 0)
            FROM SalarySpecialDeduction d
            WHERE d.factoryId = :factoryId
              AND d.userId = :userId
              AND d.status = com.cretas.aims.entity.hr.enums.DeductionStatus.ACTIVE
              AND d.validFrom <= :probeDate
              AND (d.validTo IS NULL OR d.validTo >= :probeDate)
            """)
    BigDecimal sumActiveDeductionsForUserAtDate(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            @Param("probeDate") LocalDate probeDate);

    /**
     * 列出指定 user 在指定日期所有 ACTIVE 专项扣除明细 (R1 防呆 UI preview 用).
     */
    @Query("""
            SELECT d FROM SalarySpecialDeduction d
            WHERE d.factoryId = :factoryId
              AND d.userId = :userId
              AND d.status = com.cretas.aims.entity.hr.enums.DeductionStatus.ACTIVE
              AND d.validFrom <= :probeDate
              AND (d.validTo IS NULL OR d.validTo >= :probeDate)
            ORDER BY d.deductionType ASC
            """)
    List<SalarySpecialDeduction> listActiveForUserAtDate(
            @Param("factoryId") String factoryId,
            @Param("userId") Long userId,
            @Param("probeDate") LocalDate probeDate);
}
