package com.cretas.aims.service.hr.impl;

import com.cretas.aims.entity.finance.PaymentRecord;
import com.cretas.aims.entity.hr.ExpenseRequest;
import com.cretas.aims.entity.hr.enums.ExpenseCategory;
import com.cretas.aims.entity.hr.enums.HrRequestStatus;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.hr.ExpenseRequestRepository;
import com.cretas.aims.service.ApprovalChainService;
import com.cretas.aims.service.finance.PaymentRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * ExpenseRequestServiceImpl 单元测试.
 *
 * 覆盖: create 5min dedup / approve → PaymentRecord PENDING (AP) +
 * paymentRecordId 反向链接 / approve soft-fail 兼容 PaymentRecord 创建失败.
 */
@DisplayName("ExpenseRequestServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class ExpenseRequestServiceImplTest {

    @Mock
    private ExpenseRequestRepository repository;

    @Mock
    private PaymentRecordService paymentRecordService;

    @Mock
    private ApprovalChainService approvalChainService;

    private ExpenseRequestServiceImpl service;

    private static final String FACTORY = "F006";
    private static final Long USER = 22L;
    private static final Long APPROVER = 99L;

    @BeforeEach
    void setUp() throws Exception {
        service = new ExpenseRequestServiceImpl(repository, paymentRecordService);
        Field f = ExpenseRequestServiceImpl.class.getDeclaredField("approvalChainService");
        f.setAccessible(true);
        f.set(service, approvalChainService);
    }

    private ExpenseRequest sample(HrRequestStatus status) {
        return ExpenseRequest.builder()
                .id("E-001").factoryId(FACTORY).userId(USER)
                .category(ExpenseCategory.TRAVEL)
                .amount(new BigDecimal("1500"))
                .expenseDate(LocalDate.of(2026, 5, 10))
                .status(status).build();
    }

    @Test
    @DisplayName("create R4 防呆: 5min 内重复 (同 user/category/amount/date) → 409")
    void create_dedup_rejects_5min_duplicate() {
        ExpenseRequest existing = sample(HrRequestStatus.SUBMITTED);
        when(repository.findRecentDuplicates(eq(FACTORY), eq(USER),
                eq(ExpenseCategory.TRAVEL), eq(new BigDecimal("1500")),
                eq(LocalDate.of(2026, 5, 10)), any(LocalDateTime.class)))
                .thenReturn(List.of(existing));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY, USER, ExpenseCategory.TRAVEL,
                        new BigDecimal("1500"), LocalDate.of(2026, 5, 10), "test"));
        assertTrue(ex.getMessage().contains("E-001") || ex.getMessage().contains("重复"));
    }

    @Test
    @DisplayName("approve → 创建 PaymentRecord PENDING + 反向链接 paymentRecordId")
    void approve_creates_payment_record_and_links() {
        ExpenseRequest req = sample(HrRequestStatus.SUBMITTED);
        PaymentRecord payment = new PaymentRecord();
        payment.setId("PAY-001");
        when(repository.findByIdAndFactoryId("E-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(ExpenseRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRecordService.recordExpenseReimbursement(eq(FACTORY), eq("E-001"),
                eq(new BigDecimal("1500")), eq(APPROVER), anyString())).thenReturn(payment);

        ExpenseRequest result = service.approve(FACTORY, APPROVER, "E-001");

        assertEquals(HrRequestStatus.APPROVED, result.getStatus());
        assertEquals("PAY-001", result.getPaymentRecordId());
        verify(paymentRecordService).recordExpenseReimbursement(eq(FACTORY), eq("E-001"),
                eq(new BigDecimal("1500")), eq(APPROVER), anyString());
    }

    @Test
    @DisplayName("approve soft-fail: PaymentRecord 创建抛异常仍 APPROVED + paymentRecordId 留 null")
    void approve_soft_fails_when_payment_record_creation_fails() {
        ExpenseRequest req = sample(HrRequestStatus.SUBMITTED);
        when(repository.findByIdAndFactoryId("E-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(ExpenseRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRecordService.recordExpenseReimbursement(any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("DB error simulated"));

        ExpenseRequest result = service.approve(FACTORY, APPROVER, "E-001");

        assertEquals(HrRequestStatus.APPROVED, result.getStatus());
        assertNull(result.getPaymentRecordId());
    }

    @Test
    @DisplayName("markPaid 仅 APPROVED → PAID + 设 paymentRecordId")
    void markPaid_transitions_approved_to_paid() {
        ExpenseRequest req = sample(HrRequestStatus.APPROVED);
        when(repository.findByIdAndFactoryId("E-001", FACTORY)).thenReturn(Optional.of(req));
        when(repository.save(any(ExpenseRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpenseRequest result = service.markPaid(FACTORY, "E-001", "PAY-002");

        assertEquals(HrRequestStatus.PAID, result.getStatus());
        assertEquals("PAY-002", result.getPaymentRecordId());
        assertNotNull(result.getPaidAt());
    }

    @Test
    @DisplayName("markPaid 非 APPROVED 拒绝")
    void markPaid_rejects_non_approved() {
        ExpenseRequest req = sample(HrRequestStatus.SUBMITTED);
        when(repository.findByIdAndFactoryId("E-001", FACTORY)).thenReturn(Optional.of(req));

        assertThrows(BusinessException.class,
                () -> service.markPaid(FACTORY, "E-001", "PAY-002"));
    }
}
