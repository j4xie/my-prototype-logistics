package com.cretas.aims.service.impl;

import com.cretas.aims.dto.report.SalesProductProfitRowDTO;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.inventory.SalesOrderItem;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository;
import com.cretas.aims.repository.inventory.SalesOrderItemRepository.HistoricalAvgRow;
import com.cretas.aims.repository.inventory.SalesOrderRepository;
import com.cretas.aims.service.report.DashboardStatisticsService;
import com.cretas.aims.service.report.ProductionReportService;
import com.cretas.aims.service.report.ReportExportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link ReportServiceImpl#getSalesOrderProductProfitDetail}.
 *
 * <p>Sprint 4 Wave 2 S-PROFIT-DETAIL-1.
 */
@DisplayName("ReportServiceImpl.getSalesOrderProductProfitDetail")
@ExtendWith(MockitoExtension.class)
class ReportServiceImplProfitDetailTest {

    @Mock
    private DashboardStatisticsService dashboardStatisticsService;
    @Mock
    private ReportExportService reportExportService;
    @Mock
    private ProductionReportService productionReportService;
    @Mock
    private SalesOrderRepository salesOrderRepository;
    @Mock
    private SalesOrderItemRepository salesOrderItemRepository;

    @InjectMocks
    private ReportServiceImpl reportService;

    private static final String FACTORY = "F001";
    private static final String ORDER_ID = "SO-2026-001";

    @BeforeEach
    void resetMocks() {
        // Mockito @InjectMocks handles wiring.
    }

    @Test
    @DisplayName("Order not found throws BusinessException 404")
    void orderNotFound() {
        when(salesOrderRepository.findById(ORDER_ID)).thenReturn(Optional.empty());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> reportService.getSalesOrderProductProfitDetail(FACTORY, ORDER_ID, 90));
        assertTrue(ex.getMessage().contains("销售订单不存在"));
    }

    @Test
    @DisplayName("Cross-tenant order throws BusinessException 403")
    void crossTenant() {
        SalesOrder foreign = new SalesOrder();
        foreign.setId(ORDER_ID);
        foreign.setFactoryId("F999");
        foreign.setOrderDate(LocalDate.of(2026, 5, 1));
        when(salesOrderRepository.findById(ORDER_ID)).thenReturn(Optional.of(foreign));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> reportService.getSalesOrderProductProfitDetail(FACTORY, ORDER_ID, 90));
        assertTrue(ex.getMessage().contains("无权"));
    }

    @Test
    @DisplayName("Empty items returns empty list (not error)")
    void emptyItems() {
        SalesOrder order = buildOrder();
        when(salesOrderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(salesOrderItemRepository.findBySalesOrderId(ORDER_ID)).thenReturn(List.of());

        List<SalesProductProfitRowDTO> rows =
                reportService.getSalesOrderProductProfitDetail(FACTORY, ORDER_ID, 90);
        assertNotNull(rows);
        assertTrue(rows.isEmpty());
    }

    @Test
    @DisplayName("Happy path: computes gross profit, margin, discount, tax, net, trend")
    void happyPath() {
        SalesOrder order = buildOrder();
        SalesOrderItem item = new SalesOrderItem();
        item.setSalesOrderId(ORDER_ID);
        item.setProductTypeId("P-001");
        item.setProductName("精瘦肉");
        item.setUnit("kg");
        item.setQuantity(new BigDecimal("100"));
        item.setUnitPrice(new BigDecimal("50"));
        item.setCostUnitPrice(new BigDecimal("30"));
        item.setDiscountRate(new BigDecimal("10")); // 10% off
        item.setTaxRate(new BigDecimal("13"));     // 13% VAT

        when(salesOrderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(salesOrderItemRepository.findBySalesOrderId(ORDER_ID)).thenReturn(List.of(item));

        // Historical avg = 45 → current 50 is 11.1% up → "UP"
        HistoricalAvgRow histRow = new HistoricalAvgRow() {
            @Override public String getProductTypeId() { return "P-001"; }
            @Override public BigDecimal getAvgUnitPrice() { return new BigDecimal("45"); }
        };
        when(salesOrderItemRepository.findHistoricalAvgPrice(
                anyString(), any(Collection.class), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(histRow));

        List<SalesProductProfitRowDTO> rows =
                reportService.getSalesOrderProductProfitDetail(FACTORY, ORDER_ID, 90);

        assertEquals(1, rows.size());
        SalesProductProfitRowDTO row = rows.get(0);

        assertEquals("P-001", row.getProductTypeId());
        assertEquals("精瘦肉", row.getProductName());
        assertEquals(0, row.getQuantity().compareTo(new BigDecimal("100")));
        assertEquals(0, row.getUnitPrice().compareTo(new BigDecimal("50")));
        assertEquals(0, row.getCostUnitPrice().compareTo(new BigDecimal("30")));

        // Gross profit per unit = 50 - 30 = 20
        assertEquals(0, row.getGrossProfit().compareTo(new BigDecimal("20.0000")));
        // Gross margin pct = 20 / 50 * 100 = 40.00
        assertEquals(0, row.getGrossMarginPct().compareTo(new BigDecimal("40.00")));

        // Line amount raw = 50 * 100 = 5000; after 10% discount = 4500
        // Discount amount = 5000 - 4500 = 500
        assertEquals(0, row.getDiscountAmount().compareTo(new BigDecimal("500.00")));

        // Tax amount = 4500 * 13% = 585
        assertEquals(0, row.getTaxAmount().compareTo(new BigDecimal("585.00")));

        // Net profit = 20 * 100 * 0.9 - 585 = 1800 - 585 = 1215
        assertEquals(0, row.getNetProfit().compareTo(new BigDecimal("1215.00")));

        // Historical avg = 45; trend UP
        assertEquals(0, row.getHistoricalAvgPrice().compareTo(new BigDecimal("45.0000")));
        assertEquals("UP", row.getPriceTrend());
    }

    @Test
    @DisplayName("Null unitPrice (price-sensitive stripped) leaves derived fields null")
    void priceStripped() {
        SalesOrder order = buildOrder();
        SalesOrderItem item = new SalesOrderItem();
        item.setSalesOrderId(ORDER_ID);
        item.setProductTypeId("P-002");
        item.setProductName("调料包");
        item.setUnit("包");
        item.setQuantity(new BigDecimal("10"));
        // unitPrice / costUnitPrice / discountRate / taxRate all null — simulates stripped row
        item.setUnitPrice(null);
        item.setCostUnitPrice(null);
        item.setDiscountRate(null);
        item.setTaxRate(null);

        when(salesOrderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(salesOrderItemRepository.findBySalesOrderId(ORDER_ID)).thenReturn(List.of(item));
        when(salesOrderItemRepository.findHistoricalAvgPrice(
                anyString(), any(Collection.class), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of());

        List<SalesProductProfitRowDTO> rows =
                reportService.getSalesOrderProductProfitDetail(FACTORY, ORDER_ID, 90);

        assertEquals(1, rows.size());
        SalesProductProfitRowDTO row = rows.get(0);
        assertNull(row.getGrossProfit());
        assertNull(row.getGrossMarginPct());
        assertNull(row.getDiscountAmount());
        assertNull(row.getTaxAmount());
        assertNull(row.getNetProfit());
        assertNull(row.getHistoricalAvgPrice());
        assertNull(row.getPriceTrend());
    }

    private SalesOrder buildOrder() {
        SalesOrder o = new SalesOrder();
        o.setId(ORDER_ID);
        o.setFactoryId(FACTORY);
        o.setOrderDate(LocalDate.of(2026, 5, 16));
        return o;
    }
}
