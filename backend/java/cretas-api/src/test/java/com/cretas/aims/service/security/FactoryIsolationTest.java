package com.cretas.aims.service.security;

import com.cretas.aims.entity.enums.InvoiceStatus;
import com.cretas.aims.entity.enums.TransferStatus;
import com.cretas.aims.entity.finance.InvoiceRecord;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.rd.ProductSample;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.CustomerRepository;
import com.cretas.aims.repository.InvoiceRecordRepository;
import com.cretas.aims.repository.inventory.InternalTransferRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.repository.rd.ProductSampleRepository;
import com.cretas.aims.service.OssService;
import com.cretas.aims.service.finance.impl.InvoiceServiceImpl;
import com.cretas.aims.service.inventory.impl.TransferServiceImpl;
import com.cretas.aims.service.rd.impl.ProductSampleServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 跨工厂 factoryId 隔离回归测试 — V3 W1 DoD 第 3 项.
 *
 * 覆盖 Verification Round 1+2 修复的 3 个 HIGH 漏洞 + Transfer 7 状态机方法:
 * <ul>
 *   <li>SampleApprove (commit 7526a254)</li>
 *   <li>InvoiceApprove (commit 7526a254)</li>
 *   <li>TransferDetail + 7 状态机 (commit 7526a254 + 4c03b9d4)</li>
 * </ul>
 *
 * 每个测试都模拟 "F001 工厂用户尝试操作 F002 工厂数据" 的场景,
 * 期望抛 IllegalArgumentException / ResourceNotFoundException / BusinessException.
 *
 * @author Cretas Team (Round 2 Agent E)
 * @since 2026-04-07
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("FactoryIsolation — 跨工厂隔离回归")
class FactoryIsolationTest {

    private static final String FACTORY_A = "F001";
    private static final String FACTORY_B = "F002";

    // ────────────────────────────────────────────────────────────
    // ProductSampleService — SampleApprove 漏洞修复回归
    // ────────────────────────────────────────────────────────────

    @Mock private ProductSampleRepository productSampleRepository;
    @Mock private com.cretas.aims.repository.rd.RdRequestRepository rdRequestRepository;
    @Mock private com.cretas.aims.repository.rd.QuotationTaskRepository quotationTaskRepository;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @InjectMocks private ProductSampleServiceImpl productSampleService;

    @Test
    @DisplayName("approveSample: F001 用户尝试审批 F002 的样品 → 抛异常")
    void approveSample_crossFactory_throws() {
        // Repository 的 by-factory finder 直接返回空 (模拟工厂隔离已生效)
        when(productSampleRepository.findByIdAndFactoryIdAndDeletedAtIsNull(eq("sample-123"), eq(FACTORY_A)))
                .thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> productSampleService.approveSample(FACTORY_A, "sample-123", 1L, "ok"));
        assertTrue(ex.getMessage().contains("不存在或无权访问"),
                "异常信息应明确指出无权访问, 实际: " + ex.getMessage());

        // 关键: 不应该发生任何 save 操作
        verify(productSampleRepository, never()).save(any());
    }

    @Test
    @DisplayName("rejectSample: F001 用户尝试驳回 F002 的样品 → 抛异常")
    void rejectSample_crossFactory_throws() {
        when(productSampleRepository.findByIdAndFactoryIdAndDeletedAtIsNull(eq("sample-456"), eq(FACTORY_A)))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> productSampleService.rejectSample(FACTORY_A, "sample-456", 1L, "fail"));
        verify(productSampleRepository, never()).save(any());
    }

    @Test
    @DisplayName("getSample: 同工厂查询正常返回")
    void getSample_sameFactory_returnsRecord() {
        ProductSample sample = new ProductSample();
        sample.setId("sample-789");
        sample.setFactoryId(FACTORY_A);
        sample.setStatus("DRAFT");

        when(productSampleRepository.findByIdAndFactoryIdAndDeletedAtIsNull(eq("sample-789"), eq(FACTORY_A)))
                .thenReturn(Optional.of(sample));

        ProductSample result = productSampleService.getSample(FACTORY_A, "sample-789");
        assertNotNull(result);
        assertEquals(FACTORY_A, result.getFactoryId());
    }

    // ────────────────────────────────────────────────────────────
    // InvoiceService — InvoiceApprove 漏洞修复回归
    // ────────────────────────────────────────────────────────────

    @Mock private InvoiceRecordRepository invoiceRecordRepository;
    @Mock private SalesOrderRepository salesOrderRepository;
    @Mock private SalesOrderItemRepository salesOrderItemRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private OssService ossService;
    @InjectMocks private InvoiceServiceImpl invoiceService;

    @Test
    @DisplayName("approveInvoice: F001 用户尝试审批 F002 的开票申请 → 抛异常")
    void approveInvoice_crossFactory_throws() {
        when(invoiceRecordRepository.findByIdAndFactoryIdAndDeletedAtIsNull(eq("inv-123"), eq(FACTORY_A)))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> invoiceService.approveInvoice(FACTORY_A, "inv-123", 1L, "ok"));
        verify(invoiceRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("rejectInvoice: F001 用户尝试驳回 F002 的开票申请 → 抛异常")
    void rejectInvoice_crossFactory_throws() {
        when(invoiceRecordRepository.findByIdAndFactoryIdAndDeletedAtIsNull(eq("inv-456"), eq(FACTORY_A)))
                .thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> invoiceService.rejectInvoice(FACTORY_A, "inv-456", 1L, "no"));
        verify(invoiceRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("requestInvoiceFromOrder: F001 用户尝试给 F002 的订单开票 → 抛异常")
    void requestInvoiceFromOrder_crossFactory_throws() {
        SalesOrder otherFactoryOrder = new SalesOrder();
        otherFactoryOrder.setId("so-999");
        otherFactoryOrder.setFactoryId(FACTORY_B);  // 属于工厂 B
        when(salesOrderRepository.findById(eq("so-999"))).thenReturn(Optional.of(otherFactoryOrder));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> invoiceService.requestInvoiceFromOrder(FACTORY_A, "so-999", "NORMAL", 1L, "test"));
        assertTrue(ex.getMessage().contains("不存在或无权访问"));
        verify(invoiceRecordRepository, never()).save(any());
    }

    // ────────────────────────────────────────────────────────────
    // TransferService — TransferDetail + 7 状态机修复回归
    // ────────────────────────────────────────────────────────────

    @Mock private InternalTransferRepository transferRepository;
    @InjectMocks private TransferServiceImpl transferService;

    @Test
    @DisplayName("getTransferById: F001 查 F002 的调拨单 → 抛 ResourceNotFoundException")
    void getTransferById_crossFactory_throws() {
        when(transferRepository.findByIdAndEitherFactoryId(eq("tr-123"), eq(FACTORY_A)))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> transferService.getTransferById(FACTORY_A, "tr-123"));
    }

    @Test
    @DisplayName("approveTransfer: F001 尝试审批 F002 (作为 source/target 都不属) → 抛异常")
    void approveTransfer_crossFactory_throws() {
        when(transferRepository.findByIdAndEitherFactoryId(eq("tr-456"), eq(FACTORY_A)))
                .thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> transferService.approveTransfer(FACTORY_A, "tr-456", 1L));
        verify(transferRepository, never()).save(any());
    }

    @Test
    @DisplayName("approveTransfer: F001 是 target factory (不是 source) 尝试审批 → 抛 BusinessException")
    void approveTransfer_targetFactoryCannotApprove_throws() {
        InternalTransfer transfer = new InternalTransfer();
        transfer.setId("tr-789");
        transfer.setSourceFactoryId(FACTORY_B);   // source = F002
        transfer.setTargetFactoryId(FACTORY_A);   // target = F001
        transfer.setStatus(TransferStatus.REQUESTED);
        // 注意: items 在 loadForStateChange 中会调 .size() 触发懒加载
        transfer.setItems(java.util.Collections.emptyList());

        when(transferRepository.findByIdAndEitherFactoryId(eq("tr-789"), eq(FACTORY_A)))
                .thenReturn(Optional.of(transfer));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> transferService.approveTransfer(FACTORY_A, "tr-789", 1L));
        assertTrue(ex.getMessage().contains("调出方") || ex.getMessage().contains("审批"),
                "应明确指出审批操作只允许调出方, 实际: " + ex.getMessage());
        verify(transferRepository, never()).save(any());
    }

    @Test
    @DisplayName("receiveTransfer: F001 是 source factory (不是 target) 尝试签收 → 抛 BusinessException")
    void receiveTransfer_sourceFactoryCannotReceive_throws() {
        InternalTransfer transfer = new InternalTransfer();
        transfer.setId("tr-111");
        transfer.setSourceFactoryId(FACTORY_A);   // source = F001
        transfer.setTargetFactoryId(FACTORY_B);   // target = F002
        transfer.setStatus(TransferStatus.SHIPPED);
        transfer.setItems(java.util.Collections.emptyList());

        when(transferRepository.findByIdAndEitherFactoryId(eq("tr-111"), eq(FACTORY_A)))
                .thenReturn(Optional.of(transfer));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> transferService.receiveTransfer(FACTORY_A, "tr-111", 1L));
        assertTrue(ex.getMessage().contains("调入方") || ex.getMessage().contains("签收"),
                "应明确指出签收操作只允许调入方, 实际: " + ex.getMessage());
        verify(transferRepository, never()).save(any());
    }

    @Test
    @DisplayName("getTransferById: source factory 查询正常")
    void getTransferById_sourceFactoryAccess_returnsRecord() {
        InternalTransfer transfer = new InternalTransfer();
        transfer.setId("tr-good");
        transfer.setSourceFactoryId(FACTORY_A);
        transfer.setTargetFactoryId(FACTORY_B);
        transfer.setItems(java.util.Collections.emptyList());

        when(transferRepository.findByIdAndEitherFactoryId(eq("tr-good"), eq(FACTORY_A)))
                .thenReturn(Optional.of(transfer));

        InternalTransfer result = transferService.getTransferById(FACTORY_A, "tr-good");
        assertNotNull(result);
        assertEquals(FACTORY_A, result.getSourceFactoryId());
    }

    @Test
    @DisplayName("getTransferById: target factory 查询正常 (双向访问)")
    void getTransferById_targetFactoryAccess_returnsRecord() {
        InternalTransfer transfer = new InternalTransfer();
        transfer.setId("tr-good2");
        transfer.setSourceFactoryId(FACTORY_B);
        transfer.setTargetFactoryId(FACTORY_A);
        transfer.setItems(java.util.Collections.emptyList());

        when(transferRepository.findByIdAndEitherFactoryId(eq("tr-good2"), eq(FACTORY_A)))
                .thenReturn(Optional.of(transfer));

        InternalTransfer result = transferService.getTransferById(FACTORY_A, "tr-good2");
        assertNotNull(result);
        assertEquals(FACTORY_A, result.getTargetFactoryId());
    }
}
