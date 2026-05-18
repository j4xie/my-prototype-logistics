package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.HrInsuranceConfig;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.HrInsuranceConfigRepository;
import com.cretas.aims.service.hr.HrInsuranceConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/**
 * 工厂级 社保 / 公积金 费率配置 服务实现.
 *
 * @author Cretas Team — #833 公积金/社保 rate config follow-up
 * @since 2026-05-18
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class HrInsuranceConfigServiceImpl implements HrInsuranceConfigService {

    // 法定默认值 (与 SalaryItemServiceImpl 原硬编码值对齐, fallback only)
    private static final BigDecimal DEFAULT_EMPLOYEE_PENSION = new BigDecimal("0.0800");
    private static final BigDecimal DEFAULT_EMPLOYER_PENSION = new BigDecimal("0.1600");
    private static final BigDecimal DEFAULT_EMPLOYEE_MEDICAL = new BigDecimal("0.0200");
    private static final BigDecimal DEFAULT_EMPLOYER_MEDICAL = new BigDecimal("0.0800");
    private static final BigDecimal DEFAULT_EMPLOYEE_UNEMPLOYMENT = new BigDecimal("0.0050");
    private static final BigDecimal DEFAULT_EMPLOYER_UNEMPLOYMENT = new BigDecimal("0.0050");
    private static final BigDecimal DEFAULT_EMPLOYEE_FUND = new BigDecimal("0.0800");
    private static final BigDecimal DEFAULT_EMPLOYER_FUND = new BigDecimal("0.0800");

    // 费率 sanity 范围 (R1 防呆): 0 ~ 0.30 (30% 比任何法定上限都高)
    private static final BigDecimal RATE_MIN = BigDecimal.ZERO;
    private static final BigDecimal RATE_MAX = new BigDecimal("0.30");

    private final HrInsuranceConfigRepository repository;

    @Override
    @Transactional(readOnly = true)
    public HrInsuranceConfig getCurrent(String factoryId, YearMonth yearMonth) {
        if (factoryId == null || factoryId.isBlank()) {
            return buildDefaults(null);
        }
        LocalDate probe = yearMonth == null
                ? LocalDate.now()
                : yearMonth.atDay(1);

        // 1) 优先取月份生效的配置
        List<HrInsuranceConfig> effective = repository.findEffectiveAt(factoryId, probe);
        if (!effective.isEmpty()) {
            return effective.get(0);
        }

        // 2) 兼容老数据: 取任意 ACTIVE 配置
        Optional<HrInsuranceConfig> anyActive =
                repository.findFirstByFactoryIdAndStatusOrderByEffectiveFromDesc(factoryId, "ACTIVE");
        if (anyActive.isPresent()) {
            return anyActive.get();
        }

        // 3) Fallback 法定默认值 (in-memory, 不写库)
        log.debug("HrInsuranceConfig fallback to statutory defaults: factory={}, ym={}",
                factoryId, yearMonth);
        return buildDefaults(factoryId);
    }

    @Override
    @Transactional
    public HrInsuranceConfig saveNew(String factoryId, HrInsuranceConfig payload, Long actorUserId) {
        if (factoryId == null || factoryId.isBlank()) {
            throw new BusinessException("factoryId 不能为空");
        }
        if (payload == null) {
            throw new BusinessException("payload 不能为空");
        }
        // R1 防呆: 校验所有费率 0 ~ 0.30
        validateRate("employeePensionRate", payload.getEmployeePensionRate());
        validateRate("employerPensionRate", payload.getEmployerPensionRate());
        validateRate("employeeMedicalRate", payload.getEmployeeMedicalRate());
        validateRate("employerMedicalRate", payload.getEmployerMedicalRate());
        validateRate("employeeUnemploymentRate", payload.getEmployeeUnemploymentRate());
        validateRate("employerUnemploymentRate", payload.getEmployerUnemploymentRate());
        validateRate("employeeProvidentFundRate", payload.getEmployeeProvidentFundRate());
        validateRate("employerProvidentFundRate", payload.getEmployerProvidentFundRate());

        if (payload.getEffectiveFrom() == null) {
            throw new BusinessException("effectiveFrom 必须指定 (建议下个月 1 号)");
        }

        // 缴费基数上下限 (optional, 但若都填则需 lower ≤ upper)
        BigDecimal lower = payload.getBaseSalaryLowerBound();
        BigDecimal upper = payload.getBaseSalaryUpperBound();
        if (lower != null && lower.signum() < 0) {
            throw new BusinessException("baseSalaryLowerBound 必须 ≥ 0");
        }
        if (upper != null && upper.signum() < 0) {
            throw new BusinessException("baseSalaryUpperBound 必须 ≥ 0");
        }
        if (lower != null && upper != null && lower.compareTo(upper) > 0) {
            throw new BusinessException(
                    String.format("缴费基数下限 ¥%s 不可大于上限 ¥%s", lower, upper));
        }

        // R4 防呆: 老 ACTIVE → ARCHIVED
        Optional<HrInsuranceConfig> oldActive =
                repository.findFirstByFactoryIdAndStatusOrderByEffectiveFromDesc(factoryId, "ACTIVE");
        oldActive.ifPresent(c -> {
            c.setStatus("ARCHIVED");
            repository.save(c);
            log.info("HrInsuranceConfig archived: id={}, factory={}, effectiveFrom={}",
                    c.getId(), factoryId, c.getEffectiveFrom());
        });

        // 创建新 ACTIVE
        HrInsuranceConfig fresh = HrInsuranceConfig.builder()
                .factoryId(factoryId)
                .employeePensionRate(payload.getEmployeePensionRate())
                .employerPensionRate(payload.getEmployerPensionRate())
                .employeeMedicalRate(payload.getEmployeeMedicalRate())
                .employerMedicalRate(payload.getEmployerMedicalRate())
                .employeeUnemploymentRate(payload.getEmployeeUnemploymentRate())
                .employerUnemploymentRate(payload.getEmployerUnemploymentRate())
                .employeeProvidentFundRate(payload.getEmployeeProvidentFundRate())
                .employerProvidentFundRate(payload.getEmployerProvidentFundRate())
                .baseSalaryLowerBound(lower)
                .baseSalaryUpperBound(upper)
                .effectiveFrom(payload.getEffectiveFrom())
                .status("ACTIVE")
                .remark(payload.getRemark())
                .createdBy(actorUserId)
                .build();

        HrInsuranceConfig saved = repository.save(fresh);
        log.info("HrInsuranceConfig saved: id={}, factory={}, effectiveFrom={}, by={}",
                saved.getId(), factoryId, saved.getEffectiveFrom(), actorUserId);
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public List<HrInsuranceConfig> listHistory(String factoryId) {
        if (factoryId == null || factoryId.isBlank()) {
            return List.of();
        }
        return repository.findByFactoryIdOrderByEffectiveFromDesc(factoryId);
    }

    @Override
    @Transactional
    public HrInsuranceConfig resetToDefaults(String factoryId, Long actorUserId) {
        HrInsuranceConfig defaults = buildDefaults(factoryId);
        defaults.setEffectiveFrom(LocalDate.now().withDayOfMonth(1));
        defaults.setRemark("重置为法定默认值");
        return saveNew(factoryId, defaults, actorUserId);
    }

    // ===== 内部 helper =====

    private void validateRate(String field, BigDecimal value) {
        if (value == null) {
            throw new BusinessException(field + " 不能为空");
        }
        if (value.compareTo(RATE_MIN) < 0 || value.compareTo(RATE_MAX) > 0) {
            throw new BusinessException(String.format(
                    "%s 必须在 0%% ~ 30%% 之间 (got %s%%)",
                    field, value.multiply(new BigDecimal("100"))));
        }
    }

    private HrInsuranceConfig buildDefaults(String factoryId) {
        return HrInsuranceConfig.builder()
                .factoryId(factoryId)
                .employeePensionRate(DEFAULT_EMPLOYEE_PENSION)
                .employerPensionRate(DEFAULT_EMPLOYER_PENSION)
                .employeeMedicalRate(DEFAULT_EMPLOYEE_MEDICAL)
                .employerMedicalRate(DEFAULT_EMPLOYER_MEDICAL)
                .employeeUnemploymentRate(DEFAULT_EMPLOYEE_UNEMPLOYMENT)
                .employerUnemploymentRate(DEFAULT_EMPLOYER_UNEMPLOYMENT)
                .employeeProvidentFundRate(DEFAULT_EMPLOYEE_FUND)
                .employerProvidentFundRate(DEFAULT_EMPLOYER_FUND)
                .effectiveFrom(LocalDate.now().withDayOfMonth(1))
                .status("ACTIVE")
                .build();
    }
}
