package com.cretas.aims.service.impl;

import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.VoucherEntry;
import com.cretas.aims.entity.finance.VoucherTemplate;
import com.cretas.aims.entity.finance.VoucherTemplate.Direction;
import com.cretas.aims.entity.finance.VoucherTemplate.TemplateEntry;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.finance.VoucherTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * VoucherTemplateServiceImpl — Sprint 4 W2 Chat J C-VOUCHER-TPL-1.
 *
 * <p>覆盖:
 * <ul>
 *   <li>findActiveTemplate: default → fallback any active → empty</li>
 *   <li>renderEntries 借贷必平 + SpEL #entity.field 求值</li>
 *   <li>renderEntries SpEL eval 错误抛 BusinessException</li>
 *   <li>renderEntries 沙箱: T(Runtime) 拒绝</li>
 *   <li>create R4 幂等 dup 拒绝</li>
 *   <li>create 借贷不平 validation 拒绝</li>
 *   <li>update 跨工厂 403</li>
 *   <li>setAsDefault 取消其他 default</li>
 * </ul>
 */
@DisplayName("VoucherTemplateServiceImpl 单元测试")
@ExtendWith(MockitoExtension.class)
class VoucherTemplateServiceImplTest {

    @Mock
    private VoucherTemplateRepository repository;

    private VoucherTemplateServiceImpl service;

    private static final String FACTORY_ID = "F001";

    @BeforeEach
    void setUp() {
        service = new VoucherTemplateServiceImpl(repository);
    }

    private VoucherTemplate salesReceiptTemplate(boolean isDefault) {
        VoucherTemplate t = new VoucherTemplate();
        t.setId("tpl-001");
        t.setFactoryId(FACTORY_ID);
        t.setVoucherType(VoucherType.SALES_RECEIPT);
        t.setName("销售收款模板");
        t.setIsDefault(isDefault);
        t.setIsActive(true);
        t.setEntries(List.of(
                TemplateEntry.builder()
                        .sortOrder(1).subjectCode("1122").subjectName("应收账款")
                        .direction(Direction.DEBIT).amountExpression("#entity.totalAmount")
                        .description("销售收入挂账").build(),
                TemplateEntry.builder()
                        .sortOrder(2).subjectCode("6001").subjectName("主营业务收入")
                        .direction(Direction.CREDIT).amountExpression("#entity.totalAmount")
                        .description("销售订单收入").build()
        ));
        return t;
    }

    private SalesOrder mockOrder(BigDecimal total) {
        SalesOrder o = new SalesOrder();
        o.setTotalAmount(total);
        return o;
    }

    // ==================== findActiveTemplate ====================

    @Test
    @DisplayName("findActiveTemplate: 优先返 default")
    void testFindActiveTemplate_default() {
        VoucherTemplate def = salesReceiptTemplate(true);
        when(repository.findActiveDefaultByFactoryAndType(FACTORY_ID, VoucherType.SALES_RECEIPT))
                .thenReturn(Optional.of(def));
        Optional<VoucherTemplate> result = service.findActiveTemplate(FACTORY_ID, VoucherType.SALES_RECEIPT);
        assertTrue(result.isPresent());
        assertEquals("tpl-001", result.get().getId());
        verify(repository, never()).findFirstActiveByFactoryAndType(any(), any());
    }

    @Test
    @DisplayName("findActiveTemplate: 无 default fallback 到第一个 active")
    void testFindActiveTemplate_fallback() {
        VoucherTemplate any = salesReceiptTemplate(false);
        when(repository.findActiveDefaultByFactoryAndType(FACTORY_ID, VoucherType.SALES_RECEIPT))
                .thenReturn(Optional.empty());
        when(repository.findFirstActiveByFactoryAndType(FACTORY_ID, VoucherType.SALES_RECEIPT))
                .thenReturn(Optional.of(any));
        Optional<VoucherTemplate> result = service.findActiveTemplate(FACTORY_ID, VoucherType.SALES_RECEIPT);
        assertTrue(result.isPresent());
    }

    @Test
    @DisplayName("findActiveTemplate: factoryId 空返 empty")
    void testFindActiveTemplate_emptyFactory() {
        assertTrue(service.findActiveTemplate("", VoucherType.SALES_RECEIPT).isEmpty());
        assertTrue(service.findActiveTemplate(null, VoucherType.SALES_RECEIPT).isEmpty());
    }

    // ==================== renderEntries (核心) ====================

    @Test
    @DisplayName("renderEntries: SpEL 求值 #entity.totalAmount + 借贷必平")
    void testRenderEntries_balanced() {
        VoucherTemplate tpl = salesReceiptTemplate(true);
        SalesOrder order = mockOrder(new BigDecimal("15000"));

        List<VoucherEntry> entries = service.renderEntries(tpl, order);

        assertEquals(2, entries.size());
        VoucherEntry debit = entries.get(0);
        VoucherEntry credit = entries.get(1);
        assertEquals(new BigDecimal("15000"), debit.getDebit());
        assertEquals(BigDecimal.ZERO, debit.getCredit());
        assertEquals("1122", debit.getSubjectCode());
        assertEquals(new BigDecimal("15000"), credit.getCredit());
        assertEquals(BigDecimal.ZERO, credit.getDebit());
        assertEquals("6001", credit.getSubjectCode());
    }

    @Test
    @DisplayName("renderEntries: null amount → BigDecimal.ZERO (兼容现有 nullToZero)")
    void testRenderEntries_nullAmount() {
        VoucherTemplate tpl = salesReceiptTemplate(true);
        SalesOrder order = mockOrder(null);
        List<VoucherEntry> entries = service.renderEntries(tpl, order);
        assertEquals(BigDecimal.ZERO, entries.get(0).getDebit());
        assertEquals(BigDecimal.ZERO, entries.get(1).getCredit());
    }

    @Test
    @DisplayName("renderEntries: 空 entries 抛 BusinessException")
    void testRenderEntries_emptyEntries() {
        VoucherTemplate tpl = salesReceiptTemplate(true);
        tpl.setEntries(List.of());
        assertThrows(BusinessException.class,
                () -> service.renderEntries(tpl, mockOrder(new BigDecimal("100"))));
    }

    @Test
    @DisplayName("renderEntries: SpEL 求值失败抛 BusinessException 带 hint")
    void testRenderEntries_spelError() {
        VoucherTemplate tpl = salesReceiptTemplate(true);
        // 故意写不存在字段
        tpl.getEntries().get(0).setAmountExpression("#entity.nonExistentField");
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.renderEntries(tpl, mockOrder(new BigDecimal("100"))));
        assertNotNull(ex.getActionHint());
    }

    @Test
    @DisplayName("renderEntries 沙箱: T(Runtime) 拒绝")
    void testRenderEntries_sandboxBlocksRuntime() {
        VoucherTemplate tpl = salesReceiptTemplate(true);
        tpl.getEntries().get(0).setAmountExpression("T(java.lang.Runtime).getRuntime().freeMemory()");
        assertThrows(BusinessException.class,
                () -> service.renderEntries(tpl, mockOrder(new BigDecimal("100"))));
    }

    // ==================== CRUD ====================

    @Test
    @DisplayName("create R4 幂等: 同 voucherType+name 已存在抛 409")
    void testCreate_idempotentDup() {
        VoucherTemplate existing = salesReceiptTemplate(false);
        VoucherTemplate req = salesReceiptTemplate(false);
        when(repository.findByFactoryIdOrderByVoucherTypeAscCreatedAtDesc(FACTORY_ID))
                .thenReturn(List.of(existing));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY_ID, req));
        assertEquals(409, ex.getCode());
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("create 借贷不平 (只 DEBIT) 抛 400")
    void testCreate_unbalanced() {
        VoucherTemplate req = salesReceiptTemplate(false);
        // 只留 DEBIT
        req.setEntries(List.of(req.getEntries().get(0)));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY_ID, req));
        assertEquals(400, ex.getCode());
    }

    @Test
    @DisplayName("create 空 entries 抛 400")
    void testCreate_emptyEntries() {
        VoucherTemplate req = salesReceiptTemplate(false);
        req.setEntries(List.of());
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.create(FACTORY_ID, req));
        assertEquals(400, ex.getCode());
    }

    @Test
    @DisplayName("update 跨工厂模板抛 403")
    void testUpdate_crossFactoryRejected() {
        VoucherTemplate other = salesReceiptTemplate(false);
        other.setFactoryId("F006");
        when(repository.findById("tpl-001")).thenReturn(Optional.of(other));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.update(FACTORY_ID, "tpl-001", new VoucherTemplate()));
        assertEquals(403, ex.getCode());
    }

    @Test
    @DisplayName("setAsDefault 清除同 type 其他 default")
    void testSetAsDefault_clearsOthers() {
        VoucherTemplate target = salesReceiptTemplate(false);
        VoucherTemplate other = salesReceiptTemplate(true);
        other.setId("tpl-002");
        when(repository.findById("tpl-001")).thenReturn(Optional.of(target));
        when(repository.findByFactoryIdOrderByVoucherTypeAscCreatedAtDesc(FACTORY_ID))
                .thenReturn(List.of(target, other));
        when(repository.save(any(VoucherTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        VoucherTemplate result = service.setAsDefault(FACTORY_ID, "tpl-001");

        assertTrue(result.getIsDefault());
        // 校验 other 被 setIsDefault(false) (verify by save call)
        verify(repository, atLeastOnce()).save(argThat(t ->
                "tpl-002".equals(t.getId()) && Boolean.FALSE.equals(t.getIsDefault())));
    }
}
