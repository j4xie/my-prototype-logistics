package com.cretas.aims.repository.hr;

import com.cretas.aims.entity.hr.HrEmployeeCityAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 员工 → 城市 分配 数据访问层 (#863 follow-up - 城市差异化社保).
 *
 * @author Cretas Team — #863 城市差异化社保 follow-up
 * @since 2026-05-18
 */
@Repository
public interface HrEmployeeCityAssignmentRepository
        extends JpaRepository<HrEmployeeCityAssignment, String> {

    Optional<HrEmployeeCityAssignment> findByIdAndFactoryId(String id, String factoryId);

    /** 取 (factory, user) 当前 ACTIVE 分配 (R4: 唯一). */
    Optional<HrEmployeeCityAssignment> findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
            String factoryId, Long userId, String status);

    /** 列出某 city 当前 ACTIVE 分配 (UI 城市详情显示员工列表). */
    List<HrEmployeeCityAssignment> findByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
            String factoryId, String cityCode, String status);

    /** 列出 factory 全部 ACTIVE 分配 (UI 一览表). */
    List<HrEmployeeCityAssignment> findByFactoryIdAndStatusOrderByCityCodeAsc(
            String factoryId, String status);
}
