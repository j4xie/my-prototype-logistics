package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.HrCityInsuranceOverride;
import com.cretas.aims.entity.hr.HrEmployeeCityAssignment;
import com.cretas.aims.entity.hr.HrInsuranceConfig;

import java.time.YearMonth;
import java.util.List;

/**
 * 城市差异化 社保 / 公积金 配置覆盖 服务 (#863 follow-up).
 *
 * <p>用法 (调用方 = SalaryItemServiceImpl):
 * <ol>
 *   <li>取员工分配的 city: {@link #getEmployeeCityCode}</li>
 *   <li>取该 city 在 yearMonth 时点的合并 effective config:
 *       {@link #getEffectiveConfigForCity}</li>
 * </ol>
 *
 * <p>切勿 refactor #863 {@link HrInsuranceConfig} 结构 — 本服务作为"组合层",
 * 把工厂默认配置 + 城市覆盖 合并为单个 effective view.
 *
 * @author Cretas Team — #863 城市差异化社保 follow-up
 * @since 2026-05-18
 */
public interface HrCityInsuranceOverrideService {

    /**
     * 取该 (factory, city) 当前的 ACTIVE 覆盖配置. 不存在返 Optional.empty.
     *
     * <p>用于 UI 列出已配置城市, 以及 SalaryItem 内部计算时取覆盖.
     */
    java.util.Optional<HrCityInsuranceOverride> getOverrideForCity(
            String factoryId, String cityCode, YearMonth yearMonth);

    /**
     * 取合并后的"工厂默认 + 城市覆盖" effective view (核心 API).
     *
     * <p>返回一个新 {@link HrInsuranceConfig} 对象 (不写库):
     * <ul>
     *   <li>所有费率: 优先取 {@code overrideRates.cityCode}, 缺则取工厂默认</li>
     *   <li>baseSalaryLowerBound / baseSalaryUpperBound: 城市覆盖必填, 取覆盖值</li>
     *   <li>cityCode 为 null 时直接 delegate {@link HrInsuranceConfigService#getCurrent}</li>
     * </ul>
     *
     * <p>R2 防呆: 调用方拿这个对象可以 inspect 任何字段, 业务消息可以含 city + factory context.
     */
    HrInsuranceConfig getEffectiveConfigForCity(
            String factoryId, String cityCode, YearMonth yearMonth);

    /**
     * 取员工分配的城市代号. 未分配 → null (走工厂默认).
     */
    String getEmployeeCityCode(String factoryId, Long userId);

    /**
     * 列出 factory 当前 ACTIVE 城市覆盖.
     */
    List<HrCityInsuranceOverride> listActive(String factoryId);

    /**
     * 列出 factory 全部历史覆盖 (ACTIVE + ARCHIVED).
     */
    List<HrCityInsuranceOverride> listHistory(String factoryId);

    /**
     * 保存新覆盖. (factory, city) 老 ACTIVE 自动归档 (TCC). R4 防呆.
     */
    HrCityInsuranceOverride saveNew(
            String factoryId, HrCityInsuranceOverride payload, Long actorUserId);

    /**
     * 删除某城市覆盖 (软删除).
     */
    void delete(String factoryId, String id);

    // ===== 员工 → 城市 分配 =====

    /**
     * 列出 factory 当前 ACTIVE 员工→城市分配.
     */
    List<HrEmployeeCityAssignment> listEmployeeAssignments(String factoryId);

    /**
     * 列出某 city 的所有员工分配.
     */
    List<HrEmployeeCityAssignment> listEmployeeAssignmentsByCity(String factoryId, String cityCode);

    /**
     * 分配员工到城市. 老 ACTIVE → ARCHIVED.
     */
    HrEmployeeCityAssignment assignEmployee(
            String factoryId, Long userId, String cityCode, Long actorUserId);

    /**
     * 取消分配 (员工回归"工厂默认").
     */
    void unassignEmployee(String factoryId, Long userId);
}
