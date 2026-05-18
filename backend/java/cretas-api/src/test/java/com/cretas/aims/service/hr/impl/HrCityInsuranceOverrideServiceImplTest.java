package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.HrCityInsuranceOverride;
import com.cretas.aims.entity.hr.HrEmployeeCityAssignment;
import com.cretas.aims.entity.hr.HrInsuranceConfig;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.HrCityInsuranceOverrideRepository;
import com.cretas.aims.repository.hr.HrEmployeeCityAssignmentRepository;
import com.cretas.aims.service.hr.HrInsuranceConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * HrCityInsuranceOverrideServiceImpl 单元测试 — #863 城市差异化社保 follow-up.
 *
 * 覆盖:
 *   - getEffectiveConfigForCity: city=null 直接 fallback / 有 city 但无 override / 完整合并
 *   - saveNew R1 防呆: 缴费基数必填 / lower>upper / overrideRates 非法 key / 费率超 30%
 *   - saveNew R4 防呆: 老 ACTIVE 自动归档
 *   - assignEmployee: city 未配置 → 拒绝 / 老分配自动归档
 *   - applyRateOverride: 仅识别白名单 key
 */
@DisplayName("HrCityInsuranceOverrideServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class HrCityInsuranceOverrideServiceImplTest {

    @Mock
    private HrCityInsuranceOverrideRepository overrideRepository;

    @Mock
    private HrEmployeeCityAssignmentRepository assignmentRepository;

    @Mock
    private HrInsuranceConfigService insuranceConfigService;

    private HrCityInsuranceOverrideServiceImpl service;

    private static final String FACTORY = "F006";
    private static final String CITY_SHANGHAI = "SHANGHAI";
    private static final String CITY_BEIJING = "BEIJING";
    private static final LocalDate FROM = LocalDate.of(2026, 6, 1);
    private static final YearMonth YM = YearMonth.of(2026, 6);

    @BeforeEach
    void setUp() {
        service = new HrCityInsuranceOverrideServiceImpl(
                overrideRepository, assignmentRepository, insuranceConfigService);
    }

    private HrInsuranceConfig factoryDefault() {
        return HrInsuranceConfig.builder()
                .factoryId(FACTORY)
                .employeePensionRate(new BigDecimal("0.0800"))
                .employerPensionRate(new BigDecimal("0.1600"))
                .employeeMedicalRate(new BigDecimal("0.0200"))
                .employerMedicalRate(new BigDecimal("0.0800"))
                .employeeUnemploymentRate(new BigDecimal("0.0050"))
                .employerUnemploymentRate(new BigDecimal("0.0050"))
                .employeeProvidentFundRate(new BigDecimal("0.0800"))
                .employerProvidentFundRate(new BigDecimal("0.0800"))
                .effectiveFrom(FROM)
                .status("ACTIVE")
                .build();
    }

    private HrCityInsuranceOverride shanghaiOverride() {
        return HrCityInsuranceOverride.builder()
                .id("O-SH").factoryId(FACTORY)
                .cityCode(CITY_SHANGHAI).cityName("上海")
                .baseSalaryLowerBound(new BigDecimal("7384.00"))
                .baseSalaryUpperBound(new BigDecimal("36549.00"))
                .effectiveFrom(FROM).status("ACTIVE")
                .build();
    }

    // ===== getEffectiveConfigForCity =====

    @Test
    @DisplayName("getEffectiveConfigForCity: cityCode 为空 → 直接返回工厂默认")
    void effective_nullCity_returnsFactoryDefault() {
        when(insuranceConfigService.getCurrent(FACTORY, YM)).thenReturn(factoryDefault());

        HrInsuranceConfig r = service.getEffectiveConfigForCity(FACTORY, null, YM);

        assertEquals(new BigDecimal("0.0800"), r.getEmployeeProvidentFundRate());
        assertNull(r.getBaseSalaryLowerBound());
        verifyNoInteractions(overrideRepository);
    }

    @Test
    @DisplayName("getEffectiveConfigForCity: 有 city 但无 override → 返回工厂默认")
    void effective_cityWithoutOverride_returnsFactoryDefault() {
        when(insuranceConfigService.getCurrent(FACTORY, YM)).thenReturn(factoryDefault());
        when(overrideRepository.findEffectiveAt(FACTORY, CITY_SHANGHAI, FROM))
                .thenReturn(List.of());
        when(overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                FACTORY, CITY_SHANGHAI, "ACTIVE")).thenReturn(Optional.empty());

        HrInsuranceConfig r = service.getEffectiveConfigForCity(FACTORY, CITY_SHANGHAI, YM);

        assertEquals(new BigDecimal("0.0800"), r.getEmployeeProvidentFundRate());
        assertNull(r.getBaseSalaryLowerBound());
    }

    @Test
    @DisplayName("getEffectiveConfigForCity: 完整合并 — 基数覆盖 + 部分费率覆盖")
    void effective_fullMerge() {
        HrCityInsuranceOverride o = shanghaiOverride();
        o.setOverrideRates(Map.of(
                "employeeProvidentFundRate", 0.12,
                "employerProvidentFundRate", 0.12
        ));
        when(insuranceConfigService.getCurrent(FACTORY, YM)).thenReturn(factoryDefault());
        when(overrideRepository.findEffectiveAt(FACTORY, CITY_SHANGHAI, FROM))
                .thenReturn(List.of(o));

        HrInsuranceConfig r = service.getEffectiveConfigForCity(FACTORY, CITY_SHANGHAI, YM);

        assertEquals(new BigDecimal("7384.00"), r.getBaseSalaryLowerBound());
        assertEquals(new BigDecimal("36549.00"), r.getBaseSalaryUpperBound());
        // 公积金被覆盖
        assertEquals(new BigDecimal("0.12"), r.getEmployeeProvidentFundRate());
        assertEquals(new BigDecimal("0.12"), r.getEmployerProvidentFundRate());
        // 养老/医疗保持工厂默认
        assertEquals(new BigDecimal("0.0800"), r.getEmployeePensionRate());
        assertEquals(new BigDecimal("0.0200"), r.getEmployeeMedicalRate());
    }

    // ===== saveNew R1 防呆 =====

    @Test
    @DisplayName("saveNew R1: 缴费基数必填")
    void saveNew_missingBounds_throws() {
        HrCityInsuranceOverride p = HrCityInsuranceOverride.builder()
                .cityCode(CITY_SHANGHAI)
                .effectiveFrom(FROM)
                .build();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.saveNew(FACTORY, p, 1L));
        assertTrue(ex.getMessage().contains("缴费基数上下限必填"));
    }

    @Test
    @DisplayName("saveNew R1: lower > upper 拒绝")
    void saveNew_lowerGtUpper_throws() {
        HrCityInsuranceOverride p = HrCityInsuranceOverride.builder()
                .cityCode(CITY_SHANGHAI)
                .baseSalaryLowerBound(new BigDecimal("10000"))
                .baseSalaryUpperBound(new BigDecimal("5000"))
                .effectiveFrom(FROM)
                .build();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.saveNew(FACTORY, p, 1L));
        assertTrue(ex.getMessage().contains("不可大于上限"));
    }

    @Test
    @DisplayName("saveNew R1: overrideRates 非法 key 拒绝")
    void saveNew_invalidRateKey_throws() {
        HrCityInsuranceOverride p = HrCityInsuranceOverride.builder()
                .cityCode(CITY_SHANGHAI)
                .baseSalaryLowerBound(new BigDecimal("7384"))
                .baseSalaryUpperBound(new BigDecimal("36549"))
                .overrideRates(Map.of("badKey", 0.1))
                .effectiveFrom(FROM)
                .build();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.saveNew(FACTORY, p, 1L));
        assertTrue(ex.getMessage().contains("非法 key"));
    }

    @Test
    @DisplayName("saveNew R1: 费率值 > 30% 拒绝")
    void saveNew_rateOver30Pct_throws() {
        HrCityInsuranceOverride p = HrCityInsuranceOverride.builder()
                .cityCode(CITY_SHANGHAI)
                .baseSalaryLowerBound(new BigDecimal("7384"))
                .baseSalaryUpperBound(new BigDecimal("36549"))
                .overrideRates(Map.of("employeePensionRate", 0.5))
                .effectiveFrom(FROM)
                .build();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.saveNew(FACTORY, p, 1L));
        assertTrue(ex.getMessage().contains("0%") && ex.getMessage().contains("30%"));
    }

    // ===== saveNew R4 =====

    @Test
    @DisplayName("saveNew R4: 老 ACTIVE 自动归档")
    void saveNew_archivesOldActive() {
        HrCityInsuranceOverride old = shanghaiOverride();
        old.setId("O-OLD");
        when(overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                FACTORY, CITY_SHANGHAI, "ACTIVE")).thenReturn(Optional.of(old));
        when(overrideRepository.save(any(HrCityInsuranceOverride.class)))
                .thenAnswer(i -> i.getArgument(0));

        HrCityInsuranceOverride payload = shanghaiOverride();
        payload.setId(null);

        HrCityInsuranceOverride saved = service.saveNew(FACTORY, payload, 99L);

        assertEquals("ACTIVE", saved.getStatus());
        assertEquals(99L, saved.getCreatedBy());
        assertEquals("ARCHIVED", old.getStatus());
        verify(overrideRepository, times(2)).save(any(HrCityInsuranceOverride.class));
    }

    // ===== assignEmployee =====

    @Test
    @DisplayName("assignEmployee: city 未配置 → 拒绝")
    void assign_cityNotConfigured_throws() {
        when(overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                FACTORY, CITY_BEIJING, "ACTIVE")).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.assignEmployee(FACTORY, 22L, CITY_BEIJING, 1L));
        assertTrue(ex.getMessage().contains("尚未配置覆盖"));
    }

    @Test
    @DisplayName("assignEmployee: 老分配自动 ARCHIVED")
    void assign_archivesOldAssignment() {
        when(overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                FACTORY, CITY_SHANGHAI, "ACTIVE")).thenReturn(Optional.of(shanghaiOverride()));
        HrEmployeeCityAssignment old = HrEmployeeCityAssignment.builder()
                .id("A-OLD").factoryId(FACTORY).userId(22L).cityCode(CITY_BEIJING)
                .status("ACTIVE").effectiveFrom(FROM).build();
        when(assignmentRepository.findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
                FACTORY, 22L, "ACTIVE")).thenReturn(Optional.of(old));
        when(assignmentRepository.save(any(HrEmployeeCityAssignment.class)))
                .thenAnswer(i -> i.getArgument(0));

        HrEmployeeCityAssignment saved = service.assignEmployee(FACTORY, 22L, CITY_SHANGHAI, 88L);

        assertEquals(CITY_SHANGHAI, saved.getCityCode());
        assertEquals("ACTIVE", saved.getStatus());
        assertEquals(88L, saved.getCreatedBy());
        assertEquals("ARCHIVED", old.getStatus());
    }

    // ===== getEmployeeCityCode =====

    @Test
    @DisplayName("getEmployeeCityCode: 无分配 → null")
    void getCityCode_noAssignment_returnsNull() {
        when(assignmentRepository.findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
                FACTORY, 22L, "ACTIVE")).thenReturn(Optional.empty());

        assertNull(service.getEmployeeCityCode(FACTORY, 22L));
    }

    @Test
    @DisplayName("getEmployeeCityCode: 有分配 → 返 cityCode")
    void getCityCode_hasAssignment_returnsCode() {
        HrEmployeeCityAssignment a = HrEmployeeCityAssignment.builder()
                .cityCode(CITY_SHANGHAI).build();
        when(assignmentRepository.findFirstByFactoryIdAndUserIdAndStatusOrderByEffectiveFromDesc(
                FACTORY, 22L, "ACTIVE")).thenReturn(Optional.of(a));

        assertEquals(CITY_SHANGHAI, service.getEmployeeCityCode(FACTORY, 22L));
    }

    // ===== city code normalization =====

    @Test
    @DisplayName("saveNew: cityCode 自动 trim + uppercase")
    void saveNew_normalizesCity() {
        HrCityInsuranceOverride p = HrCityInsuranceOverride.builder()
                .cityCode(" shanghai ")
                .baseSalaryLowerBound(new BigDecimal("7384"))
                .baseSalaryUpperBound(new BigDecimal("36549"))
                .effectiveFrom(FROM)
                .build();
        when(overrideRepository.findFirstByFactoryIdAndCityCodeAndStatusOrderByEffectiveFromDesc(
                eq(FACTORY), eq("SHANGHAI"), eq("ACTIVE"))).thenReturn(Optional.empty());
        when(overrideRepository.save(any(HrCityInsuranceOverride.class)))
                .thenAnswer(i -> i.getArgument(0));

        HrCityInsuranceOverride saved = service.saveNew(FACTORY, p, 1L);
        assertEquals("SHANGHAI", saved.getCityCode());
    }
}
