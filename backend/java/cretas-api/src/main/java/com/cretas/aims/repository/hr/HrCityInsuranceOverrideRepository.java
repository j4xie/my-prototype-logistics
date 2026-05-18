package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.HrCityInsuranceOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 城市差异化 社保 / 公积金 配置覆盖 数据访问层.
 *
 * @author Cretas Team — #863 城市差异化社保 follow-up
 * @since 2026-05-18
 */
@Repository
public interface HrCityInsuranceOverrideRepository
        extends JpaRepository<HrCityInsuranceOverride, String> {

    Optional<HrCityInsuranceOverride> findByIdAndFactoryId(String id, String factoryId);

    /**
     * 当前 ACTIVE 城市覆盖列表 (UI 列表用), 按 cityCode 字母序.
     */
    List<HrCityInsuranceOverride> findByFactoryIdAndStatusOrderByCityCodeAsc(
            String factoryId, String status);

    /**
     * 所有版本 (含 ARCHIVED), 给历史审计用.
     */
    List<HrCityInsuranceOverride> findByFactoryIdOrderByEffectiveFromDesc(String factoryId);

    /**
     * R4 防呆: 取 (factory, city) 当前 ACTIVE 版本. saveNew 切换时使用.
     */
    Optional<HrCityInsuranceOverride> findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
            String factoryId, String cityCode, String status);

    /**
     * 给定时点的 (factory, city) 生效覆盖 (effective_from ≤ probeDate, status 不限).
     * 用于历史月份重算时取当时配置.
     */
    @Query("""
            SELECT c FROM HrCityInsuranceOverride c
            WHERE c.factoryId = :factoryId
              AND c.cityCode = :cityCode
              AND c.effectiveFrom <= :probeDate
            ORDER BY c.effectiveFrom DESC
            """)
    List<HrCityInsuranceOverride> findEffectiveAt(
            @Param("factoryId") String factoryId,
            @Param("cityCode") String cityCode,
            @Param("probeDate") LocalDate probeDate);
}
