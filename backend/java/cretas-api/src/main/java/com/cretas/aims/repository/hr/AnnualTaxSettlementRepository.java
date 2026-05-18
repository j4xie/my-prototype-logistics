package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.AnnualTaxSettlement;
import com.cretas.aims.entity.hr.enums.AnnualTaxSettlementStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 年度汇算数据访问层 (#833 follow-up).
 *
 * @author Cretas Team — #833 年度汇算 follow-up
 * @since 2026-05-18
 */
@Repository
public interface AnnualTaxSettlementRepository extends JpaRepository<AnnualTaxSettlement, String> {

    Optional<AnnualTaxSettlement> findByIdAndFactoryId(String id, String factoryId);

    /** R4 防呆: 同 factory+user+year 已存在则 update 不 insert. */
    Optional<AnnualTaxSettlement> findByFactoryIdAndUserIdAndTaxYear(
            String factoryId, Long userId, Integer taxYear);

    Page<AnnualTaxSettlement> findByFactoryId(String factoryId, Pageable pageable);

    Page<AnnualTaxSettlement> findByFactoryIdAndTaxYear(
            String factoryId, Integer taxYear, Pageable pageable);

    Page<AnnualTaxSettlement> findByFactoryIdAndStatus(
            String factoryId, AnnualTaxSettlementStatus status, Pageable pageable);

    /**
     * 列表查询 (year + status 任一为 null 跳过过滤).
     * 用 CAST(:status AS string) 模式适配 PostgreSQL 严格类型推断
     * (见 .claude/rules/database-entity-sync.md "could not determine data type").
     */
    @Query("""
            SELECT s FROM AnnualTaxSettlement s
            WHERE s.factoryId = :factoryId
              AND (:taxYear IS NULL OR s.taxYear = :taxYear)
              AND (CAST(:status AS string) IS NULL OR s.status = :status)
              AND (:userId IS NULL OR s.userId = :userId)
            ORDER BY s.taxYear DESC, s.userId ASC
            """)
    Page<AnnualTaxSettlement> findByFilters(
            @Param("factoryId") String factoryId,
            @Param("taxYear") Integer taxYear,
            @Param("status") AnnualTaxSettlementStatus status,
            @Param("userId") Long userId,
            Pageable pageable);
}
