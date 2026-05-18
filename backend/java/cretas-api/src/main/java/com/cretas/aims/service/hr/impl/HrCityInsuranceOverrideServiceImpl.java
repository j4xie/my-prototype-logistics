package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.HrCityInsuranceOverride;
import com.cretas.aims.entity.hr.HrEmployeeCityAssignment;
import com.cretas.aims.entity.hr.HrInsuranceConfig;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.HrCityInsuranceOverrideRepository;
import com.cretas.aims.repository.hr.HrEmployeeCityAssignmentRepository;
import com.cretas.aims.service.hr.HrCityInsuranceOverrideService;
import com.cretas.aims.service.hr.HrInsuranceConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 城市差异化 社保 / 公积金 配置覆盖 服务实现 (#863 follow-up).
 *
 * @author Cretas Team — #863 城市差异化社保 follow-up
 * @since 2026-05-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HrCityInsuranceOverrideServiceImpl implements HrCityInsuranceOverrideService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_ARCHIVED = "ARCHIVED";

    private static final BigDecimal RATE_MIN = BigDecimal.ZERO;
    private static final BigDecimal RATE_MAX = new BigDecimal("0.30");

    /**
     * 允许的费率覆盖 key 集合 (与 HrInsuranceConfig 字段对齐).
     * jsonb 提供的 key 必须在此集合中, 否则视为非法配置 (R1 防呆).
     */
    private static final Set<String> ALLOWED_RATE_KEYS = Set.of(
            "employeePensionRate", "employerPensionRate",
            "employeeMedicalRate", "employerMedicalRate",
            "employeeUnemploymentRate", "employerUnemploymentRate",
            "employeeProvidentFundRate", "employerProvidentFundRate"
    );

    private final HrCityInsuranceOverrideRepository overrideRepository;
    private final HrEmployeeCityAssignmentRepository assignmentRepository;
    private final HrInsuranceConfigService insuranceConfigService;

    // ============================================================
    //  Override CRUD
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public Optional<HrCityInsuranceOverride> getOverrideForCity(
            String factoryId, String cityCode, YearMonth yearMonth) {
        if (factoryId == null || factoryId.isBlank() || cityCode == null || cityCode.isBlank()) {
            return Optional.empty();
        }
        LocalDate probe = yearMonth == null ? LocalDate.now() : yearMonth.atDay(1);
        List<HrCityInsuranceOverride> effective =
                overrideRepository.findEffectiveAt(factoryId, cityCode, probe);
        if (!effective.isEmpty()) {
            return Optional.of(effective.get(0));
        }
        // Fallback: 任意 ACTIVE (不限 effective_from)
        return overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                factoryId, cityCode, STATUS_ACTIVE);
    }

    @Override
    @Transactional(readOnly = true)
    public HrInsuranceConfig getEffectiveConfigForCity(
            String factoryId, String cityCode, YearMonth yearMonth) {
        // 1. 取工厂默认 (永不返 null, 含 statutory fallback)
        HrInsuranceConfig baseConfig = insuranceConfigService.getCurrent(factoryId, yearMonth);

        // 2. cityCode 为空 → 直接返回工厂默认
        if (cityCode == null || cityCode.isBlank()) {
            return baseConfig;
        }

        // 3. 取城市覆盖
        Optional<HrCityInsuranceOverride> override =
                getOverrideForCity(factoryId, cityCode, yearMonth);
        if (override.isEmpty()) {
            return baseConfig;
        }

        // 4. 合并: 拷贝 base + 覆盖城市必填字段
        HrCityInsuranceOverride o = override.get();
        HrInsuranceConfig merged = HrInsuranceConfig.builder()
                .id(baseConfig.getId())
                .factoryId(baseConfig.getFactoryId())
                .employeePensionRate(baseConfig.getEmployeePensionRate())
                .employerPensionRate(baseConfig.getEmployerPensionRate())
                .employeeMedicalRate(baseConfig.getEmployeeMedicalRate())
                .employerMedicalRate(baseConfig.getEmployerMedicalRate())
                .employeeUnemploymentRate(baseConfig.getEmployeeUnemploymentRate())
                .employerUnemploymentRate(baseConfig.getEmployerUnemploymentRate())
                .employeeProvidentFundRate(baseConfig.getEmployeeProvidentFundRate())
                .employerProvidentFundRate(baseConfig.getEmployerProvidentFundRate())
                .baseSalaryLowerBound(o.getBaseSalaryLowerBound())
                .baseSalaryUpperBound(o.getBaseSalaryUpperBound())
                .effectiveFrom(baseConfig.getEffectiveFrom())
                .status(baseConfig.getStatus())
                .remark(baseConfig.getRemark())
                .createdBy(baseConfig.getCreatedBy())
                .build();

        // 5. 应用 overrideRates jsonb (如果有)
        if (o.getOverrideRates() != null && !o.getOverrideRates().isEmpty()) {
            applyRateOverride(merged, o.getOverrideRates());
        }
        return merged;
    }

    @Override
    public String getEmployeeCityCode(String factoryId, Long userId) {
        if (factoryId == null || factoryId.isBlank() || userId == null) {
            return null;
        }
        return assignmentRepository
                .findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
                        factoryId, userId, STATUS_ACTIVE)
                .map(HrEmployeeCityAssignment::getCityCode)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HrCityInsuranceOverride> listActive(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            return List.of();
        }
        return overrideRepository.findByFactoryIdAndStatusOrderByCityCodeAsc(factoryId, STATUS_ACTIVE);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HrCityInsuranceOverride> listHistory(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            return List.of();
        }
        return overrideRepository.findByFactoryIdOrderByEffectiveFromDesc(factoryId);
    }

    @Override
    @Transactional
    public HrCityInsuranceOverride saveNew(
            String factoryId, HrCityInsuranceOverride payload, Long actorUserId) {
        if (factoryId == null || factoryId.isBlank()) {
            throw new BusinessException("factoryId 不能为空");
        }
        if (payload == null) {
            throw new BusinessException("payload 不能为空");
        }

        String cityCode = payload.getCityCode();
        if (cityCode == null || cityCode.isBlank()) {
            throw new BusinessException("cityCode 不能为空");
        }
        cityCode = cityCode.trim().toUpperCase();

        // R1 防呆: 缴费基数必填 + 顺序合理
        BigDecimal lower = payload.getBaseSalaryLowerBound();
        BigDecimal upper = payload.getBaseSalaryUpperBound();
        if (lower == null || upper == null) {
            throw new BusinessException(String.format(
                    "[城市 %s] 缴费基数上下限必填 (lower=%s, upper=%s)", cityCode, lower, upper));
        }
        if (lower.signum() < 0 || upper.signum() < 0) {
            throw new BusinessException(String.format(
                    "[城市 %s] 缴费基数必须 ≥ 0 (lower=%s, upper=%s)", cityCode, lower, upper));
        }
        if (lower.compareTo(upper) > 0) {
            throw new BusinessException(String.format(
                    "[城市 %s] 缴费基数下限 ¥%s 不可大于上限 ¥%s", cityCode, lower, upper));
        }

        if (payload.getEffectiveFrom() == null) {
            throw new BusinessException("effectiveFrom 必须指定 (建议下个月 1 号)");
        }

        // R1 防呆: overrideRates 各 value 必须在 [0, 0.30]
        if (payload.getOverrideRates() != null) {
            validateOverrideRates(cityCode, payload.getOverrideRates());
        }

        // R4 防呆: (factory, city) 老 ACTIVE → ARCHIVED (TCC)
        Optional<HrCityInsuranceOverride> oldActive =
                overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                        factoryId, cityCode, STATUS_ACTIVE);
        oldActive.ifPresent(c -> {
            c.setStatus(STATUS_ARCHIVED);
            overrideRepository.save(c);
            log.info("HrCityInsuranceOverride archived: id={}, factory={}, city={}, effectiveFrom={}",
                    c.getId(), factoryId, c.getCityCode(), c.getEffectiveFrom());
        });

        HrCityInsuranceOverride fresh = HrCityInsuranceOverride.builder()
                .factoryId(factoryId)
                .cityCode(cityCode)
                .cityName(payload.getCityName())
                .baseSalaryLowerBound(lower)
                .baseSalaryUpperBound(upper)
                .overrideRates(payload.getOverrideRates())
                .effectiveFrom(payload.getEffectiveFrom())
                .status(STATUS_ACTIVE)
                .remark(payload.getRemark())
                .createdBy(actorUserId)
                .build();

        HrCityInsuranceOverride saved = overrideRepository.save(fresh);
        log.info("HrCityInsuranceOverride saved: id={}, factory={}, city={}, bounds=[{}, {}], effFrom={}, by={}",
                saved.getId(), factoryId, cityCode, lower, upper, saved.getEffectiveFrom(), actorUserId);
        return saved;
    }

    @Override
    @Transactional
    public void delete(String factoryId, String id) {
        HrCityInsuranceOverride entity = overrideRepository.findByIdAndFactoryId(id, factoryId)
                .orElseThrow(() -> new BusinessException(404,
                        String.format("城市覆盖配置不存在 [id=%s, factory=%s]", id, factoryId)));
        entity.softDelete();
        overrideRepository.save(entity);
        log.info("HrCityInsuranceOverride soft-deleted: id={}, factory={}, city={}",
                id, factoryId, entity.getCityCode());
    }

    // ============================================================
    //  Employee Assignment CRUD
    // ============================================================

    @Override
    @Transactional(readOnly = true)
    public List<HrEmployeeCityAssignment> listEmployeeAssignments(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            return List.of();
        }
        return assignmentRepository.findByFactoryIdAndStatusOrderByCityCodeAsc(factoryId, STATUS_ACTIVE);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HrEmployeeCityAssignment> listEmployeeAssignmentsByCity(
            String factoryId, String cityCode) {
        if (factoryId == null || factoryId.isBlank() || cityCode == null || cityCode.isBlank()) {
            return List.of();
        }
        return assignmentRepository.findByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                factoryId, cityCode.trim().toUpperCase(), STATUS_ACTIVE);
    }

    @Override
    @Transactional
    public HrEmployeeCityAssignment assignEmployee(
            String factoryId, Long userId, String cityCode, Long actorUserId) {
        if (factoryId == null || factoryId.isBlank()) {
            throw new BusinessException("factoryId 不能为空");
        }
        if (userId == null) {
            throw new BusinessException("userId 不能为空");
        }
        if (cityCode == null || cityCode.isBlank()) {
            throw new BusinessException("cityCode 不能为空");
        }
        String normalized = cityCode.trim().toUpperCase();

        // 校验 city 已配置 (R1 防呆: 否则分配后 SalaryItem 仍按工厂默认, 用户困惑)
        Optional<HrCityInsuranceOverride> existing =
                overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                        factoryId, normalized, STATUS_ACTIVE);
        if (existing.isEmpty()) {
            throw new BusinessException(String.format(
                    "城市 %s 尚未配置覆盖, 请先在'城市差异化社保'页配置缴费基数", normalized));
        }

        // R4 防呆: (factory, user) 老 ACTIVE → ARCHIVED
        Optional<HrEmployeeCityAssignment> oldActive =
                assignmentRepository.findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
                        factoryId, userId, STATUS_ACTIVE);
        oldActive.ifPresent(a -> {
            a.setStatus(STATUS_ARCHIVED);
            assignmentRepository.save(a);
            log.info("HrEmployeeCityAssignment archived: id={}, factory={}, user={}, oldCity={}",
                    a.getId(), factoryId, userId, a.getCityCode());
        });

        HrEmployeeCityAssignment fresh = HrEmployeeCityAssignment.builder()
                .factoryId(factoryId)
                .userId(userId)
                .cityCode(normalized)
                .effectiveFrom(LocalDate.now().withDayOfMonth(1))
                .status(STATUS_ACTIVE)
                .createdBy(actorUserId)
                .build();

        HrEmployeeCityAssignment saved = assignmentRepository.save(fresh);
        log.info("HrEmployeeCityAssignment created: id={}, factory={}, user={}, city={}, by={}",
                saved.getId(), factoryId, userId, normalized, actorUserId);
        return saved;
    }

    @Override
    @Transactional
    public void unassignEmployee(String factoryId, Long userId) {
        if (factoryId == null || userId == null) {
            return;
        }
        assignmentRepository
                .findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
                        factoryId, userId, STATUS_ACTIVE)
                .ifPresent(a -> {
                    a.setStatus(STATUS_ARCHIVED);
                    assignmentRepository.save(a);
                    log.info("HrEmployeeCityAssignment archived (unassign): id={}, factory={}, user={}",
                            a.getId(), factoryId, userId);
                });
    }

    // ============================================================
    //  内部 helper
    // ============================================================

    /**
     * 应用 jsonb {@code overrideRates} 到合并 cfg.
     * 仅识别 {@link #ALLOWED_RATE_KEYS} 中的 key, 其他 key 静默忽略 (校验已在 saveNew 做过).
     */
    private void applyRateOverride(HrInsuranceConfig cfg, Map<String, Object> rates) {
        for (Map.Entry<String, Object> entry : rates.entrySet()) {
            String key = entry.getKey();
            if (!ALLOWED_RATE_KEYS.contains(key)) continue;
            BigDecimal value = toBigDecimal(entry.getValue());
            if (value == null) continue;
            switch (key) {
                case "employeePensionRate" -> cfg.setEmployeePensionRate(value);
                case "employerPensionRate" -> cfg.setEmployerPensionRate(value);
                case "employeeMedicalRate" -> cfg.setEmployeeMedicalRate(value);
                case "employerMedicalRate" -> cfg.setEmployerMedicalRate(value);
                case "employeeUnemploymentRate" -> cfg.setEmployeeUnemploymentRate(value);
                case "employerUnemploymentRate" -> cfg.setEmployerUnemploymentRate(value);
                case "employeeProvidentFundRate" -> cfg.setEmployeeProvidentFundRate(value);
                case "employerProvidentFundRate" -> cfg.setEmployerProvidentFundRate(value);
                default -> {
                    // unreachable due to ALLOWED_RATE_KEYS guard
                }
            }
        }
    }

    private void validateOverrideRates(String cityCode, Map<String, Object> rates) {
        for (Map.Entry<String, Object> entry : rates.entrySet()) {
            String key = entry.getKey();
            if (!ALLOWED_RATE_KEYS.contains(key)) {
                throw new BusinessException(String.format(
                        "[城市 %s] overrideRates 包含非法 key '%s'. 允许的 key: %s",
                        cityCode, key, ALLOWED_RATE_KEYS));
            }
            BigDecimal value = toBigDecimal(entry.getValue());
            if (value == null) {
                throw new BusinessException(String.format(
                        "[城市 %s] overrideRates[%s] 值不能为空且必须是数值", cityCode, key));
            }
            if (value.compareTo(RATE_MIN) < 0 || value.compareTo(RATE_MAX) > 0) {
                throw new BusinessException(String.format(
                        "[城市 %s] overrideRates[%s] 必须在 0%% ~ 30%% 之间 (got %s%%)",
                        cityCode, key, value.multiply(new BigDecimal("100"))));
            }
        }
    }

    /**
     * 容忍 BigDecimal / Number / String 输入 (jsonb 反序列化形态多样).
     */
    private static BigDecimal toBigDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof BigDecimal bd) return bd;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /**
     * Helper Map.of() avoiding NPE on null values.
     */
    static Map<String, Object> mapOfNullable(String k1, Object v1) {
        Map<String, Object> m = new HashMap<>();
        m.put(k1, v1);
        return m;
    }
}
