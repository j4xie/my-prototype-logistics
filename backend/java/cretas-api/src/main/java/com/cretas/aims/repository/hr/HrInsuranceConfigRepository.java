package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.HrInsuranceConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 工厂级 社保 / 公积金 费率配置 数据访问层.
 *
 * @author Cretas Team — #833 公积金/社保 rate config follow-up
 * @since 2026-05-18
 */
@Repository
public interface HrInsuranceConfigRepository
        extends JpaRepository<HrInsuranceConfig, String> {

    Optional<HrInsuranceConfig> findByIdAndFactoryId(String id, String factoryId);

    /**
     * 获取该 factory 当前 ACTIVE 配置 (R4 防呆: factory 最多 1 条 ACTIVE).
     * Service 层保证唯一性, 此处取 effective_from 最新一条作为 defensive 排序.
     */
    Optional<HrInsuranceConfig> findFirstByFactoryIdAndStatusOrderByEffectiveFromDesc(
            String factoryId, String status);

    /**
     * 历史列表 (含 ACTIVE + ARCHIVED), 按 effectiveFrom 倒序.
     */
    List<HrInsuranceConfig> findByFactoryIdOrderByEffectiveFromDesc(String factoryId);

    /**
     * 给定 yearMonth 月初日期, 查询当时生效的配置 (最近一条 effective_from ≤ probeDate).
     * 用于历史月份工资重算时拉取当时的费率.
     */
    @Query("""
            SELECT c FROM HrInsuranceConfig c
            WHERE c.factoryId = :factoryId
              AND c.effectiveFrom <= :probeDate
            ORDER BY c.effectiveFrom DESC
            """)
    List<HrInsuranceConfig> findEffectiveAt(
            @Param("factoryId") String factoryId,
            @Param("probeDate") LocalDate probeDate);
}
