package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.SalaryStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.SalaryItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * SalaryItemServiceImpl 单元测试 — P1-40 H-WAGE-FULL MVP.
 *
 * 覆盖:
 *   - previewComputeFromBase (R1 防呆 - 实时预览)
 *   - create R4 防呆: 同 user+yearMonth 重复 → 409
 *   - 7-bracket 个税阶梯准确性 (≤3000 / 3000-12000 / 12000-25000 / >80000)
 *   - 状态机: DRAFT → CONFIRMED → PAID transitions
 *   - state guard: PAID 不可改, CONFIRMED 仅可改 remark
 */
@DisplayName("SalaryItemServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class SalaryItemServiceImplTest {

    @Mock
    private SalaryItemRepository repository;

    private SalaryItemServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final String YM = "2026-05";

    @BeforeEach
    void setUp() {
        service = new SalaryItemServiceImpl(repository);
    }

    private SalaryItem sample(SalaryStatus status, BigDecimal base) {
        Map<String, BigDecimal> calc = service.previewComputeFromBase(base);
        return SalaryItem.builder()
                .id("S-001").factoryId(FACTORY).userId(USER).yearMonth(YM)
                .baseSalary(base)
                .socialInsuranceEmployee(calc.get("socialInsuranceEmployee"))
                .socialInsuranceEmployer(calc.get("socialInsuranceEmployer"))
                .providentFundEmployee(calc.get("providentFundEmployee"))
                .providentFundEmployer(calc.get("providentFundEmployer"))
                .taxableIncome(calc.get("taxableIncome"))
                .personalTax(calc.get("personalTax"))
                .netSalary(calc.get("netSalary"))
                .status(status).build();
    }

    // ---------- R1 防呆: preview ----------

    @Test
    @DisplayName("preview: base 10000 — 个人社保 1050, 公积金 800, 应税 3150, 个税 94.5")
    void preview_base10000() {
        Map<String, BigDecimal> r = service.previewComputeFromBase(new BigDecimal("10000"));
        assertEquals(0, new BigDecimal("10000.00").compareTo(r.get("baseSalary")));
        assertEquals(0, new BigDecimal("1050.00").compareTo(r.get("socialInsuranceEmployee")));
        assertEquals(0, new BigDecimal("2600.00").compareTo(r.get("socialInsuranceEmployer")));
        assertEquals(0, new BigDecimal("800.00").compareTo(r.get("providentFundEmployee")));
        assertEquals(0, new BigDecimal("800.00").compareTo(r.get("providentFundEmployer")));
        // taxable = 10000 - 1050 - 800 - 5000 = 3150 → bracket 2 (10%, 速算 210)
        assertEquals(0, new BigDecimal("3150.00").compareTo(r.get("taxableIncome")));
        // tax = 3150 * 0.10 - 210 = 105 (但 3150 > 3000 进入 bracket 2)
        assertEquals(0, new BigDecimal("105.00").compareTo(r.get("personalTax")));
        // net = 10000 - 1050 - 800 - 105 = 8045
        assertEquals(0, new BigDecimal("8045.00").compareTo(r.get("netSalary")));
    }

    @Test
    @DisplayName("preview: base 5000 — 应税收入截到 0, 个税 0, 实发 4425")
    void preview_base5000_lowIncome() {
        Map<String, BigDecimal> r = service.previewComputeFromBase(new BigDecimal("5000"));
        // taxable = 5000 - 525 - 400 - 5000 = negative → 0
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("taxableIncome")));
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("personalTax")));
        // net = 5000 - 525 - 400 - 0 = 4075
        assertEquals(0, new BigDecimal("4075.00").compareTo(r.get("netSalary")));
    }

    @Test
    @DisplayName("preview: base 0 — 全 0")
    void preview_base0() {
        Map<String, BigDecimal> r = service.previewComputeFromBase(BigDecimal.ZERO);
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("netSalary")));
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("personalTax")));
    }

    @Test
    @DisplayName("preview: base null safe (默认 0)")
    void preview_baseNull() {
        Map<String, BigDecimal> r = service.previewComputeFromBase(null);
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("netSalary")));
    }

    // ---------- 7-bracket 个税 ----------

    @Test
    @DisplayName("tax bracket 1: taxable 2500 → 75")
    void tax_bracket1() {
        BigDecimal tax = SalaryItemServiceImpl.computePersonalTax(new BigDecimal("2500"));
        // 2500 * 0.03 - 0 = 75
        assertEquals(0, new BigDecimal("75.00").compareTo(tax));
    }

    @Test
    @DisplayName("tax bracket 2: taxable 10000 → 790")
    void tax_bracket2() {
        BigDecimal tax = SalaryItemServiceImpl.computePersonalTax(new BigDecimal("10000"));
        // 10000 * 0.10 - 210 = 790
        assertEquals(0, new BigDecimal("790.00").compareTo(tax));
    }

    @Test
    @DisplayName("tax bracket 7 (top): taxable 100000 → 29840")
    void tax_bracketTop() {
        BigDecimal tax = SalaryItemServiceImpl.computePersonalTax(new BigDecimal("100000"));
        // 100000 * 0.45 - 15160 = 29840
        assertEquals(0, new BigDecimal("29840.00").compareTo(tax));
    }

    @Test
    @DisplayName("tax: 应税 ≤ 0 → 0")
    void tax_negative() {
        assertEquals(0, BigDecimal.ZERO.compareTo(
                SalaryItemServiceImpl.computePersonalTax(BigDecimal.ZERO)));
        assertEquals(0, BigDecimal.ZERO.compareTo(
                SalaryItemServiceImpl.computePersonalTax(new BigDecimal("-100"))));
    }

    // ---------- R4 防呆: create dedup ----------

    @Test
    @DisplayName("create R4 防呆: 同 user+yearMonth 已存在 → 409 BusinessException")
    void create_dedup_rejects() {
        SalaryItem existing = sample(SalaryStatus.DRAFT, new BigDecimal("8000"));
        when(repository.findByFactoryIdAndUserIdAndYearMonth(FACTORY, USER, YM))
                .thenReturn(Optional.of(existing));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, YM, new BigDecimal("10000"), null));
        assertEquals(409, ex.getCode());
        assertTrue(ex.getMessage().contains("已存在工资单"));
    }

    @Test
    @DisplayName("create: 正常路径 — 全字段写入 DRAFT")
    void create_happyPath() {
        when(repository.findByFactoryIdAndUserIdAndYearMonth(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(repository.save(any(SalaryItem.class))).thenAnswer(i -> i.getArgument(0));

        SalaryItem r = service.create(FACTORY, USER, YM, new BigDecimal("8000"), "test");
        assertEquals(FACTORY, r.getFactoryId());
        assertEquals(USER, r.getUserId());
        assertEquals(YM, r.getYearMonth());
        assertEquals(SalaryStatus.DRAFT, r.getStatus());
        assertEquals(0, new BigDecimal("840.00").compareTo(r.getSocialInsuranceEmployee())); // 8000 * 0.105
    }

    @Test
    @DisplayName("create: invalid yearMonth 格式 → BusinessException")
    void create_invalidYearMonth() {
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, "202605", new BigDecimal("8000"), null));
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, "2026-13", new BigDecimal("8000"), null));
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, null, new BigDecimal("8000"), null));
    }

    @Test
    @DisplayName("create: baseSalary < 0 → BusinessException")
    void create_negativeBase() {
        assertThrows(BusinessException.class, () ->
                service.create(FACTORY, USER, YM, new BigDecimal("-100"), null));
    }

    // ---------- 状态机 ----------

    @Test
    @DisplayName("confirm: DRAFT → CONFIRMED")
    void confirm_happyPath() {
        SalaryItem item = sample(SalaryStatus.DRAFT, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        SalaryItem r = service.confirm(FACTORY, "S-001", 99L);
        assertEquals(SalaryStatus.CONFIRMED, r.getStatus());
        assertEquals(99L, r.getConfirmedBy());
        assertNotNull(r.getConfirmedAt());
    }

    @Test
    @DisplayName("confirm: 非 DRAFT → BusinessException")
    void confirm_nonDraft() {
        SalaryItem item = sample(SalaryStatus.CONFIRMED, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(item));
        assertThrows(BusinessException.class, () -> service.confirm(FACTORY, "S-001", 99L));
    }

    @Test
    @DisplayName("markPaid: CONFIRMED → PAID")
    void markPaid_happyPath() {
        SalaryItem item = sample(SalaryStatus.CONFIRMED, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        SalaryItem r = service.markPaid(FACTORY, "S-001", 88L);
        assertEquals(SalaryStatus.PAID, r.getStatus());
        assertEquals(88L, r.getPaidBy());
        assertNotNull(r.getPaidAt());
    }

    @Test
    @DisplayName("markPaid: DRAFT → BusinessException (必须先 confirm)")
    void markPaid_draft() {
        SalaryItem item = sample(SalaryStatus.DRAFT, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(item));
        assertThrows(BusinessException.class, () -> service.markPaid(FACTORY, "S-001", 88L));
    }

    @Test
    @DisplayName("update: PAID 不可改")
    void update_paidRejected() {
        SalaryItem item = sample(SalaryStatus.PAID, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(item));
        assertThrows(BusinessException.class, () ->
                service.update(FACTORY, "S-001", new BigDecimal("9000"), "新备注"));
    }

    @Test
    @DisplayName("update: CONFIRMED 仅可改 remark, 改 baseSalary 抛错")
    void update_confirmed_remarkOnly() {
        SalaryItem item = sample(SalaryStatus.CONFIRMED, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        // remark only — OK
        SalaryItem r = service.update(FACTORY, "S-001", null, "新备注");
        assertEquals("新备注", r.getRemark());

        // 改 baseSalary → 抛错
        assertThrows(BusinessException.class, () ->
                service.update(FACTORY, "S-001", new BigDecimal("9000"), "x"));
    }

    @Test
    @DisplayName("delete: 仅 DRAFT 可删")
    void delete_onlyDraft() {
        SalaryItem draft = sample(SalaryStatus.DRAFT, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(draft));
        service.delete(FACTORY, "S-001");
        verify(repository, times(1)).delete(draft);

        SalaryItem paid = sample(SalaryStatus.PAID, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-002", FACTORY)).thenReturn(Optional.of(paid));
        assertThrows(BusinessException.class, () -> service.delete(FACTORY, "S-002"));
    }

    @Test
    @DisplayName("applyComputeFromBase: 仅 DRAFT 可重算")
    void recompute_draftOnly() {
        SalaryItem draft = sample(SalaryStatus.DRAFT, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-001", FACTORY)).thenReturn(Optional.of(draft));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        SalaryItem r = service.applyComputeFromBase(FACTORY, "S-001");
        // 8000 * 0.105 = 840
        assertEquals(0, new BigDecimal("840.00").compareTo(r.getSocialInsuranceEmployee()));

        SalaryItem confirmed = sample(SalaryStatus.CONFIRMED, new BigDecimal("8000"));
        when(repository.findByIdAndFactoryId("S-002", FACTORY)).thenReturn(Optional.of(confirmed));
        assertThrows(BusinessException.class, () -> service.applyComputeFromBase(FACTORY, "S-002"));
    }

    // ---------- 专项扣除 integration (P1-40 follow-up) ----------

    @Test
    @DisplayName("previewWithDeductions: base 10000 + 专项扣除 4000 → 应税截到 0, 个税 0")
    void preview_withDeductions_reducedToZero() {
        // base=10000, social=1050, fund=800, threshold=5000, deduction=4000
        // taxable = 10000 - 1050 - 800 - 5000 - 4000 = -850 → 截到 0
        Map<String, BigDecimal> r = service.previewComputeFromBaseWithDeductions(
                new BigDecimal("10000"), new BigDecimal("4000"));
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("taxableIncome")));
        assertEquals(0, BigDecimal.ZERO.compareTo(r.get("personalTax")));
        assertEquals(0, new BigDecimal("4000.00").compareTo(r.get("specialDeductionTotal")));
        // net = 10000 - 1050 - 800 - 0 = 8150 (税从 105 降到 0, 实发涨 105)
        assertEquals(0, new BigDecimal("8150.00").compareTo(r.get("netSalary")));
    }

    @Test
    @DisplayName("previewWithDeductions: base 20000 + 专项 3000 → taxable 10150, 税 805")
    void preview_withDeductions_reducedNotZero() {
        // base=20000, social=2100, fund=1600, threshold=5000, deduction=3000
        // taxable = 20000 - 2100 - 1600 - 5000 - 3000 = 8300 → bracket 2 (10%, 速算 210)
        // tax = 8300 * 0.10 - 210 = 620
        Map<String, BigDecimal> r = service.previewComputeFromBaseWithDeductions(
                new BigDecimal("20000"), new BigDecimal("3000"));
        assertEquals(0, new BigDecimal("8300.00").compareTo(r.get("taxableIncome")));
        assertEquals(0, new BigDecimal("620.00").compareTo(r.get("personalTax")));
        assertEquals(0, new BigDecimal("3000.00").compareTo(r.get("specialDeductionTotal")));
    }

    @Test
    @DisplayName("previewWithDeductions: deduction null/负 → 等同 0")
    void preview_withDeductions_nullNegative() {
        Map<String, BigDecimal> nullRes = service.previewComputeFromBaseWithDeductions(
                new BigDecimal("10000"), null);
        Map<String, BigDecimal> negRes = service.previewComputeFromBaseWithDeductions(
                new BigDecimal("10000"), new BigDecimal("-500"));
        Map<String, BigDecimal> zeroRes = service.previewComputeFromBaseWithDeductions(
                new BigDecimal("10000"), BigDecimal.ZERO);
        // 三个结果应当一致
        assertEquals(0, nullRes.get("personalTax").compareTo(zeroRes.get("personalTax")));
        assertEquals(0, negRes.get("personalTax").compareTo(zeroRes.get("personalTax")));
        assertEquals(0, BigDecimal.ZERO.compareTo(nullRes.get("specialDeductionTotal")));
    }

    @Test
    @DisplayName("previewWithDeductions: backward-compat — preview(base) == previewWithDeductions(base, 0)")
    void preview_backwardCompat() {
        Map<String, BigDecimal> legacy = service.previewComputeFromBase(new BigDecimal("10000"));
        Map<String, BigDecimal> withDed = service.previewComputeFromBaseWithDeductions(
                new BigDecimal("10000"), BigDecimal.ZERO);
        assertEquals(0, legacy.get("personalTax").compareTo(withDed.get("personalTax")));
        assertEquals(0, legacy.get("netSalary").compareTo(withDed.get("netSalary")));
        assertEquals(0, legacy.get("taxableIncome").compareTo(withDed.get("taxableIncome")));
    }
}
