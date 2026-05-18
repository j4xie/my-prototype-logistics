package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.hr.AnnualTaxSettlement;
import com.cretas.aims.entity.hr.SalaryItem;
import com.cretas.aims.entity.hr.enums.AnnualTaxSettlementStatus;
import com.cretas.aims.entity.hr.enums.SalaryStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.AnnualTaxSettlementRepository;
import com.cretas.aims.repository.hr.SalaryItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * AnnualTaxSettlementServiceImpl 单元测试 — #833 年度汇算 follow-up.
 *
 * 覆盖:
 *   - aggregate 聚合 (12 月 SalaryItem sum)
 *   - computeForUser R4 idempotent: existing → update 不 insert
 *   - computeForUser R5 防呆: REPORTED → 拒改 抛 BusinessException
 *   - previewCompute: 不写库 (verify(save) never)
 *   - confirm 状态机: DRAFT → CONFIRMED
 *   - markReported: CONFIRMED → REPORTED
 *   - delete: 仅 DRAFT 可删
 *
 * 注: specialDeductionService 是 @Autowired(required=false), 不注入 → totalSpecial=0.
 */
@DisplayName("AnnualTaxSettlementServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class AnnualTaxSettlementServiceImplTest {

    @Mock
    private AnnualTaxSettlementRepository repository;

    @Mock
    private SalaryItemRepository salaryItemRepository;

    @InjectMocks
    private AnnualTaxSettlementServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final Integer YEAR = 2025;

    private SalaryItem monthlyItem(String ym, String base, String social, String fund, String tax,
                                   String bonus, String bonusTax) {
        SalaryItem.SalaryItemBuilder b = SalaryItem.builder()
                .id("S-" + ym)
                .factoryId(FACTORY)
                .userId(USER)
                .yearMonth(ym)
                .baseSalary(new BigDecimal(base))
                .socialInsuranceEmployee(new BigDecimal(social))
                .providentFundEmployee(new BigDecimal(fund))
                .personalTax(new BigDecimal(tax))
                .status(SalaryStatus.CONFIRMED);
        if (bonus != null) b.annualBonus(new BigDecimal(bonus));
        if (bonusTax != null) b.annualBonusTax(new BigDecimal(bonusTax));
        return b.build();
    }

    // ============= previewCompute =============

    @Test
    @DisplayName("preview: aggregate 12 月数据 + 不写库")
    void preview_happyPath() {
        // 12 月: base 15000, social 1000, fund 1200, tax 600, 12月有年终奖 30000 + tax 900
        List<SalaryItem> items = List.of(
                monthlyItem("2025-01", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-02", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-03", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-04", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-05", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-06", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-07", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-08", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-09", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-10", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-11", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-12", "15000", "1000", "1200", "600", "30000", "900")
        );
        when(salaryItemRepository.findByFactoryIdAndUserIdAndYearPrefix(
                FACTORY, USER, "2025-%")).thenReturn(items);

        Map<String, Object> r = service.previewCompute(FACTORY, USER, YEAR);

        assertEquals(0, new BigDecimal("180000.00")
                .compareTo((BigDecimal) r.get("totalSalary")));
        assertEquals(0, new BigDecimal("12000.00")
                .compareTo((BigDecimal) r.get("totalSocialInsurance")));
        assertEquals(0, new BigDecimal("14400.00")
                .compareTo((BigDecimal) r.get("totalProvidentFund")));
        assertEquals(0, new BigDecimal("7200.00")
                .compareTo((BigDecimal) r.get("monthlyPrepaidSum")));
        assertEquals(0, new BigDecimal("30000.00")
                .compareTo((BigDecimal) r.get("totalBonus")));
        assertEquals(0, new BigDecimal("900.00")
                .compareTo((BigDecimal) r.get("annualBonusTax")));
        // taxable = 180000 - 60000 - 12000 - 14400 - 0 = 93600
        assertEquals(0, new BigDecimal("93600.00")
                .compareTo((BigDecimal) r.get("annualTaxableIncome")));
        // tax = 93600 × 10% - 2520 = 9360 - 2520 = 6840.00 (第2档)
        assertEquals(0, new BigDecimal("6840.00")
                .compareTo((BigDecimal) r.get("annualTaxDue")));
        // refundOwed = 6840 - 7200 = -360 (应退税 ¥360)
        assertEquals(0, new BigDecimal("-360.00")
                .compareTo((BigDecimal) r.get("refundOwed")));
        assertEquals("≤144000", r.get("bracketLabel"));
        assertEquals("10%", r.get("bracketRate"));
        assertEquals(12, r.get("monthsCovered"));

        // R1 关键: preview 不写库
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("preview: 跨年入职 (只有 6 个月数据) monthsCovered=6")
    void preview_partialYear() {
        List<SalaryItem> items = List.of(
                monthlyItem("2025-07", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-08", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-09", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-10", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-11", "15000", "1000", "1200", "600", null, null),
                monthlyItem("2025-12", "15000", "1000", "1200", "600", null, null)
        );
        when(salaryItemRepository.findByFactoryIdAndUserIdAndYearPrefix(
                FACTORY, USER, "2025-%")).thenReturn(items);

        Map<String, Object> r = service.previewCompute(FACTORY, USER, YEAR);
        assertEquals(6, r.get("monthsCovered"));
        // taxable = 90000 - 60000 - 6000 - 7200 - 0 = 16800 ≤ 36000 → 第1档 3%
        assertEquals("≤36000", r.get("bracketLabel"));
        assertEquals("3%", r.get("bracketRate"));
    }

    // ============= computeForUser (R4 idempotent) =============

    @Test
    @DisplayName("computeForUser: 不存在 → INSERT 新记录 (DRAFT)")
    void computeForUser_insertNew() {
        when(repository.findByFactoryIdAndUserIdAndTaxYear(FACTORY, USER, YEAR))
                .thenReturn(Optional.empty());
        when(salaryItemRepository.findByFactoryIdAndUserIdAndYearPrefix(
                FACTORY, USER, "2025-%")).thenReturn(List.of(
                monthlyItem("2025-12", "20000", "2000", "1600", "100", null, null)));
        when(repository.save(any(AnnualTaxSettlement.class)))
                .thenAnswer(i -> i.getArgument(0));

        AnnualTaxSettlement saved = service.computeForUser(FACTORY, USER, YEAR);
        assertEquals(AnnualTaxSettlementStatus.DRAFT, saved.getStatus());
        assertEquals(YEAR, saved.getTaxYear());
        assertEquals(USER, saved.getUserId());
        assertEquals(1, saved.getMonthsCovered());
        verify(repository).save(any(AnnualTaxSettlement.class));
    }

    @Test
    @DisplayName("computeForUser R4 idempotent: existing DRAFT → UPDATE 不 INSERT 重复")
    void computeForUser_updateExisting() {
        AnnualTaxSettlement existing = AnnualTaxSettlement.builder()
                .id("AT-001")
                .factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .totalSalary(new BigDecimal("100"))
                .status(AnnualTaxSettlementStatus.DRAFT)
                .build();
        when(repository.findByFactoryIdAndUserIdAndTaxYear(FACTORY, USER, YEAR))
                .thenReturn(Optional.of(existing));
        when(salaryItemRepository.findByFactoryIdAndUserIdAndYearPrefix(
                FACTORY, USER, "2025-%")).thenReturn(List.of(
                monthlyItem("2025-01", "20000", "2000", "1600", "100", null, null)));
        when(repository.save(any(AnnualTaxSettlement.class)))
                .thenAnswer(i -> i.getArgument(0));

        AnnualTaxSettlement saved = service.computeForUser(FACTORY, USER, YEAR);
        // 验证是 update 同一 id 而不是新建
        assertEquals("AT-001", saved.getId());
        // 验证字段被聚合刷新 (不是旧 100)
        assertEquals(0, new BigDecimal("20000.00").compareTo(saved.getTotalSalary()));
        verify(repository).save(eq(existing));  // 同一引用
    }

    @Test
    @DisplayName("computeForUser R5 防呆: REPORTED 状态 → 拒改抛 BusinessException")
    void computeForUser_reportedRejects() {
        AnnualTaxSettlement reported = AnnualTaxSettlement.builder()
                .id("AT-002")
                .factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .status(AnnualTaxSettlementStatus.REPORTED)
                .build();
        when(repository.findByFactoryIdAndUserIdAndTaxYear(FACTORY, USER, YEAR))
                .thenReturn(Optional.of(reported));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.computeForUser(FACTORY, USER, YEAR));
        assertTrue(ex.getMessage().contains("已申报税局"),
                "expected 已申报税局 in message, got: " + ex.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("computeForUser: null taxYear → BusinessException")
    void computeForUser_nullYearRejects() {
        assertThrows(BusinessException.class,
                () -> service.computeForUser(FACTORY, USER, null));
    }

    @Test
    @DisplayName("computeForUser: 年份越界 → BusinessException")
    void computeForUser_yearOutOfRange() {
        assertThrows(BusinessException.class,
                () -> service.computeForUser(FACTORY, USER, 1999));
        assertThrows(BusinessException.class,
                () -> service.computeForUser(FACTORY, USER, 2101));
    }

    // ============= 状态机 =============

    @Test
    @DisplayName("confirm: DRAFT → CONFIRMED")
    void confirm_happyPath() {
        AnnualTaxSettlement draft = AnnualTaxSettlement.builder()
                .id("AT-003").factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .status(AnnualTaxSettlementStatus.DRAFT).build();
        when(repository.findByIdAndFactoryId("AT-003", FACTORY)).thenReturn(Optional.of(draft));
        when(repository.save(any(AnnualTaxSettlement.class)))
                .thenAnswer(i -> i.getArgument(0));

        AnnualTaxSettlement saved = service.confirm(FACTORY, "AT-003", 99L);
        assertEquals(AnnualTaxSettlementStatus.CONFIRMED, saved.getStatus());
        assertEquals(99L, saved.getConfirmedBy());
        assertNotNull(saved.getConfirmedAt());
    }

    @Test
    @DisplayName("confirm: 非 DRAFT 拒绝")
    void confirm_nonDraftRejects() {
        AnnualTaxSettlement confirmed = AnnualTaxSettlement.builder()
                .id("AT-004").factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .status(AnnualTaxSettlementStatus.CONFIRMED).build();
        when(repository.findByIdAndFactoryId("AT-004", FACTORY)).thenReturn(Optional.of(confirmed));
        assertThrows(BusinessException.class,
                () -> service.confirm(FACTORY, "AT-004", 99L));
    }

    @Test
    @DisplayName("markReported: CONFIRMED → REPORTED")
    void markReported_happyPath() {
        AnnualTaxSettlement confirmed = AnnualTaxSettlement.builder()
                .id("AT-005").factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .status(AnnualTaxSettlementStatus.CONFIRMED).build();
        when(repository.findByIdAndFactoryId("AT-005", FACTORY)).thenReturn(Optional.of(confirmed));
        when(repository.save(any(AnnualTaxSettlement.class)))
                .thenAnswer(i -> i.getArgument(0));

        AnnualTaxSettlement saved = service.markReported(FACTORY, "AT-005", 99L);
        assertEquals(AnnualTaxSettlementStatus.REPORTED, saved.getStatus());
        assertNotNull(saved.getReportedAt());
        assertEquals(99L, saved.getReportedBy());
    }

    @Test
    @DisplayName("markReported: 非 CONFIRMED 拒绝")
    void markReported_nonConfirmedRejects() {
        AnnualTaxSettlement draft = AnnualTaxSettlement.builder()
                .id("AT-006").factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .status(AnnualTaxSettlementStatus.DRAFT).build();
        when(repository.findByIdAndFactoryId("AT-006", FACTORY)).thenReturn(Optional.of(draft));
        assertThrows(BusinessException.class,
                () -> service.markReported(FACTORY, "AT-006", 99L));
    }

    @Test
    @DisplayName("delete: 仅 DRAFT 可删")
    void delete_onlyDraft() {
        AnnualTaxSettlement reported = AnnualTaxSettlement.builder()
                .id("AT-007").factoryId(FACTORY).userId(USER).taxYear(YEAR)
                .status(AnnualTaxSettlementStatus.REPORTED).build();
        when(repository.findByIdAndFactoryId("AT-007", FACTORY)).thenReturn(Optional.of(reported));
        assertThrows(BusinessException.class,
                () -> service.delete(FACTORY, "AT-007"));
    }
}
