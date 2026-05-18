package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.SalarySpecialDeduction;
import com.cretas.aims.entity.hr.enums.DeductionStatus;
import com.cretas.aims.entity.hr.enums.DeductionType;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.SalarySpecialDeductionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * SalarySpecialDeductionServiceImpl 单元测试 — P1-40 H-WAGE 专项扣除 follow-up.
 *
 * 覆盖:
 *   - create R4 防呆: 同 (factory, user, type, validFrom) ACTIVE 重复 → 409
 *   - create 参数校验 (userId/type/amount/validFrom/validTo range)
 *   - update state guard: 仅 ACTIVE 可改
 *   - changeStatus 状态转换 (ACTIVE → EXPIRED/CANCELLED; 不可回 ACTIVE)
 *   - delete state guard: 仅 EXPIRED/CANCELLED 可删
 *   - computeTotalDeductionForMonth: null safe + 转发 probeDate
 */
@DisplayName("SalarySpecialDeductionServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class SalarySpecialDeductionServiceImplTest {

    @Mock
    private SalarySpecialDeductionRepository repository;

    private SalarySpecialDeductionServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final LocalDate FROM = LocalDate.of(2026, 5, 1);

    @BeforeEach
    void setUp() {
        service = new SalarySpecialDeductionServiceImpl(repository);
    }

    private SalarySpecialDeduction sample(DeductionStatus status) {
        return SalarySpecialDeduction.builder()
                .id("D-001").factoryId(FACTORY).userId(USER)
                .deductionType(DeductionType.CHILD_EDUCATION)
                .monthlyAmount(new BigDecimal("1000.00"))
                .validFrom(FROM)
                .validTo(null)
                .status(status)
                .build();
    }

    // ---------- create ----------

    @Test
    @DisplayName("create: 正常路径 — 默认 ACTIVE 状态")
    void create_happyPath() {
        when(repository.findByFactoryIdAndUserIdAndDeductionTypeAndValidFromAndStatus(
                any(), any(), any(), any(), any())).thenReturn(Optional.empty());
        when(repository.save(any(SalarySpecialDeduction.class)))
                .thenAnswer(i -> i.getArgument(0));

        SalarySpecialDeduction r = service.create(FACTORY, USER,
                DeductionType.CHILD_EDUCATION, new BigDecimal("1000"), FROM, null, "test");

        assertEquals(FACTORY, r.getFactoryId());
        assertEquals(USER, r.getUserId());
        assertEquals(DeductionType.CHILD_EDUCATION, r.getDeductionType());
        assertEquals(DeductionStatus.ACTIVE, r.getStatus());
        assertEquals(0, new BigDecimal("1000").compareTo(r.getMonthlyAmount()));
    }

    @Test
    @DisplayName("create R4 防呆: 同 (factory, user, type, validFrom) ACTIVE 重复 → 409")
    void create_dedup_rejects() {
        when(repository.findByFactoryIdAndUserIdAndDeductionTypeAndValidFromAndStatus(
                FACTORY, USER, DeductionType.CHILD_EDUCATION, FROM, DeductionStatus.ACTIVE))
                .thenReturn(Optional.of(sample(DeductionStatus.ACTIVE)));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, DeductionType.CHILD_EDUCATION,
                        new BigDecimal("1000"), FROM, null, null));
        assertEquals(409, ex.getCode());
        assertTrue(ex.getMessage().contains("已存在生效中"));
        // R2 防呆 message context: userId + type + id + amount
        assertTrue(ex.getMessage().contains(String.valueOf(USER)));
        assertTrue(ex.getMessage().contains("CHILD_EDUCATION"));
    }

    @Test
    @DisplayName("create: userId 非法 → BusinessException")
    void create_invalidUserId() {
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, null, DeductionType.CHILD_EDUCATION,
                        new BigDecimal("1000"), FROM, null, null));
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, 0L, DeductionType.CHILD_EDUCATION,
                        new BigDecimal("1000"), FROM, null, null));
    }

    @Test
    @DisplayName("create: type/amount/validFrom 必填校验")
    void create_requiredFields() {
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, null,
                        new BigDecimal("1000"), FROM, null, null));
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, DeductionType.CHILD_EDUCATION,
                        null, FROM, null, null));
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, DeductionType.CHILD_EDUCATION,
                        new BigDecimal("-100"), FROM, null, null));
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, DeductionType.CHILD_EDUCATION,
                        new BigDecimal("1000"), null, null, null));
    }

    @Test
    @DisplayName("create: validTo < validFrom → BusinessException")
    void create_invalidRange() {
        LocalDate to = LocalDate.of(2026, 4, 30);
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, DeductionType.CHILD_EDUCATION,
                        new BigDecimal("1000"), FROM, to, null));
        assertTrue(ex.getMessage().contains("不能早于"));
    }

    // ---------- update ----------

    @Test
    @DisplayName("update: ACTIVE 可改金额 + validTo + notes")
    void update_happyPath() {
        SalarySpecialDeduction d = sample(DeductionStatus.ACTIVE);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        LocalDate to = LocalDate.of(2027, 6, 30);
        SalarySpecialDeduction r = service.update(FACTORY, "D-001",
                new BigDecimal("1500"), to, "updated notes");
        assertEquals(0, new BigDecimal("1500").compareTo(r.getMonthlyAmount()));
        assertEquals(to, r.getValidTo());
        assertEquals("updated notes", r.getNotes());
    }

    @Test
    @DisplayName("update: EXPIRED 不可改")
    void update_expired_rejects() {
        SalarySpecialDeduction d = sample(DeductionStatus.EXPIRED);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.update(FACTORY, "D-001", new BigDecimal("1500"), null, null));
        assertTrue(ex.getMessage().contains("仅 ACTIVE"));
    }

    @Test
    @DisplayName("update: 负 amount 拒绝")
    void update_negativeAmount() {
        SalarySpecialDeduction d = sample(DeductionStatus.ACTIVE);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        assertThrows(BusinessException.class, () ->
                service.update(FACTORY, "D-001", new BigDecimal("-100"), null, null));
    }

    // ---------- changeStatus ----------

    @Test
    @DisplayName("changeStatus: ACTIVE → EXPIRED 自动填 validTo")
    void changeStatus_activeToExpired() {
        SalarySpecialDeduction d = sample(DeductionStatus.ACTIVE);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        SalarySpecialDeduction r = service.changeStatus(FACTORY, "D-001", DeductionStatus.EXPIRED);
        assertEquals(DeductionStatus.EXPIRED, r.getStatus());
        assertNotNull(r.getValidTo());  // 自动填今日
    }

    @Test
    @DisplayName("changeStatus: ACTIVE → CANCELLED OK")
    void changeStatus_activeToCancelled() {
        SalarySpecialDeduction d = sample(DeductionStatus.ACTIVE);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        SalarySpecialDeduction r = service.changeStatus(FACTORY, "D-001", DeductionStatus.CANCELLED);
        assertEquals(DeductionStatus.CANCELLED, r.getStatus());
    }

    @Test
    @DisplayName("changeStatus: EXPIRED → ACTIVE 拒绝 (须新建)")
    void changeStatus_expiredToActive_rejects() {
        SalarySpecialDeduction d = sample(DeductionStatus.EXPIRED);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.changeStatus(FACTORY, "D-001", DeductionStatus.ACTIVE));
        assertTrue(ex.getMessage().contains("不可改回 ACTIVE"));
    }

    @Test
    @DisplayName("changeStatus: same status no-op")
    void changeStatus_noChange() {
        SalarySpecialDeduction d = sample(DeductionStatus.ACTIVE);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));

        SalarySpecialDeduction r = service.changeStatus(FACTORY, "D-001", DeductionStatus.ACTIVE);
        assertEquals(DeductionStatus.ACTIVE, r.getStatus());
        verify(repository, never()).save(any());
    }

    // ---------- delete ----------

    @Test
    @DisplayName("delete: EXPIRED 可删")
    void delete_expired() {
        SalarySpecialDeduction d = sample(DeductionStatus.EXPIRED);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        service.delete(FACTORY, "D-001");
        verify(repository).delete(d);
    }

    @Test
    @DisplayName("delete: ACTIVE 拒绝")
    void delete_active_rejects() {
        SalarySpecialDeduction d = sample(DeductionStatus.ACTIVE);
        when(repository.findByIdAndFactoryId("D-001", FACTORY)).thenReturn(Optional.of(d));
        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.delete(FACTORY, "D-001"));
        assertTrue(ex.getMessage().contains("仅 EXPIRED/CANCELLED"));
    }

    // ---------- computeTotalDeductionForMonth (core integration with SalaryItem) ----------

    @Test
    @DisplayName("computeTotalDeductionForMonth: 月末作 probeDate 转发到 repository")
    void computeTotal_delegatesToRepository() {
        YearMonth ym = YearMonth.of(2026, 5);
        when(repository.sumActiveDeductionsForUserAtDate(
                FACTORY, USER, LocalDate.of(2026, 5, 31)))
                .thenReturn(new BigDecimal("4000.00"));

        BigDecimal r = service.computeTotalDeductionForMonth(FACTORY, USER, ym);
        assertEquals(0, new BigDecimal("4000").compareTo(r));
        verify(repository).sumActiveDeductionsForUserAtDate(
                FACTORY, USER, LocalDate.of(2026, 5, 31));
    }

    @Test
    @DisplayName("computeTotalDeductionForMonth: yearMonth null → 0")
    void computeTotal_nullYearMonth() {
        assertEquals(0, BigDecimal.ZERO.compareTo(
                service.computeTotalDeductionForMonth(FACTORY, USER, null)));
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("computeTotalDeductionForMonth: repository 返 null → 0")
    void computeTotal_repoNull() {
        when(repository.sumActiveDeductionsForUserAtDate(any(), any(), any()))
                .thenReturn(null);
        assertEquals(0, BigDecimal.ZERO.compareTo(
                service.computeTotalDeductionForMonth(FACTORY, USER, YearMonth.of(2026, 5))));
    }
}
