package com.cretas.aims.service.hr;

import com.cretas.aims.entity.hr.HrInsuranceConfig;

import java.time.YearMonth;
import java.util.List;

/**
 * 工厂级 社保 / 公积金 费率配置 服务.
 *
 * <p>用法 (#833 H-WAGE follow-up):
 * <ul>
 *   <li>{@link #getCurrent} — 取该 factory + yearMonth 时点生效的费率配置 (含 fallback 到默认硬编码值)</li>
 *   <li>{@link #saveNew} — 保存新版本 (老 ACTIVE 自动 → ARCHIVED, 新版 ACTIVE)</li>
 *   <li>{@link #listHistory} — 历史版本列表 (含 ACTIVE + ARCHIVED, effective_from 倒序)</li>
 * </ul>
 *
 * @author Cretas Team — #833 公积金/社保 rate config follow-up
 * @since 2026-05-18
 */
public interface HrInsuranceConfigService {

    /**
     * 取该 factory 在指定月份生效的费率配置.
     *
     * <p>fallback 策略 (依次):
     * <ol>
     *   <li>最近的 effective_from ≤ 月初日期 的配置</li>
     *   <li>该 factory 的任意 ACTIVE 配置 (兼容遗留无 effective_from 数据)</li>
     *   <li>StatutoryDefaults (硬编码法定默认值) — 保证永不返回 null</li>
     * </ol>
     */
    HrInsuranceConfig getCurrent(String factoryId, YearMonth yearMonth);

    /**
     * 保存新版本配置. 自动归档旧 ACTIVE 配置.
     * R4 防呆: factory 始终最多 1 条 ACTIVE.
     */
    HrInsuranceConfig saveNew(String factoryId, HrInsuranceConfig payload, Long actorUserId);

    /**
     * 历史版本列表, 按 effective_from 倒序.
     */
    List<HrInsuranceConfig> listHistory(String factoryId);

    /**
     * 重置为法定默认值 (硬编码 statutory). 等同于 saveNew(默认 payload).
     */
    HrInsuranceConfig resetToDefaults(String factoryId, Long actorUserId);
}
