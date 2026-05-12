package com.cretas.aims.service.inventory;

import com.cretas.aims.entity.Factory;
import com.cretas.aims.entity.Supplier;
import com.cretas.aims.entity.enums.PurchaseOrderStatus;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.PurchaseOrderItem;
import com.cretas.aims.repository.FactoryRepository;
import com.cretas.aims.repository.SupplierRepository;
import com.cretas.aims.service.inventory.impl.PurchaseOrderPdfServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link PurchaseOrderPdfServiceImpl}.
 *
 * <p>P0 (六扇门 May 7 transcript) — PDF 生成功能首发,本测试验证:
 * <ul>
 *   <li>正常路径: 完整订单生成有效 PDF (PDF magic header %PDF-)</li>
 *   <li>条码: 输出包含 Code128 + QR 不抛异常 (graceful fallback)</li>
 *   <li>边界: 空 items 列表 / 无 supplier / 无 factory 时不崩</li>
 * </ul>
 *
 * <p>Test 策略: 复用 PurchaseServiceImplOverReceiveTest 的 Mockito @Mock 模式,
 * 不需要 Spring Context 也不需要 PostgreSQL — 纯 unit test, CI 友好。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PurchaseOrderPdfServiceImpl 单元测试 (P0 六扇门 May 7 transcript)")
class PurchaseOrderPdfServiceImplTest {

    @Mock private PurchaseService purchaseService;
    @Mock private SupplierRepository supplierRepository;
    @Mock private FactoryRepository factoryRepository;

    private PurchaseOrderPdfServiceImpl service;

    private static final String FACTORY_ID = "F006";
    private static final String SUPPLIER_ID = "SUP-LTM-001";
    private static final String ORDER_ID = "po-uuid-001";

    @BeforeEach
    void setup() {
        service = new PurchaseOrderPdfServiceImpl(purchaseService, supplierRepository, factoryRepository);
    }

    @Test
    @DisplayName("正常路径: 完整订单 → 生成有效 PDF (含 PDF magic header)")
    void generatePdf_happyPath_emitsValidPdf() {
        // arrange
        PurchaseOrder order = makeOrder("PO-20260511-001", buildItems());
        Supplier supplier = makeSupplier("六扇门牛肉供应商 (Liutengmen Beef)");
        Factory factory = makeFactory("六扇门卤制品厂");

        when(purchaseService.getPurchaseOrderById(FACTORY_ID, ORDER_ID)).thenReturn(order);
        when(supplierRepository.findByIdAndFactoryId(SUPPLIER_ID, FACTORY_ID)).thenReturn(Optional.of(supplier));
        when(factoryRepository.findById(FACTORY_ID)).thenReturn(Optional.of(factory));

        // act
        byte[] pdfBytes = service.generatePurchaseOrderPdf(FACTORY_ID, ORDER_ID);

        // assert
        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 1000, "PDF should be non-trivial (got " + pdfBytes.length + " bytes)");
        // PDF magic header
        assertEquals(0x25, pdfBytes[0] & 0xff, "first byte = %");
        assertEquals(0x50, pdfBytes[1] & 0xff, "second byte = P");
        assertEquals(0x44, pdfBytes[2] & 0xff, "third byte = D");
        assertEquals(0x46, pdfBytes[3] & 0xff, "fourth byte = F");
    }

    @Test
    @DisplayName("边界: 空 items 列表 → 仍生成有效 PDF, 不抛异常")
    void generatePdf_emptyItems_stillValid() {
        PurchaseOrder order = makeOrder("PO-EMPTY-001", new ArrayList<>());
        when(purchaseService.getPurchaseOrderById(FACTORY_ID, ORDER_ID)).thenReturn(order);
        when(supplierRepository.findByIdAndFactoryId(anyString(), anyString())).thenReturn(Optional.empty());
        when(factoryRepository.findById(FACTORY_ID)).thenReturn(Optional.empty());

        byte[] pdfBytes = service.generatePurchaseOrderPdf(FACTORY_ID, ORDER_ID);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 500);
        assertEquals(0x25, pdfBytes[0] & 0xff);
    }

    @Test
    @DisplayName("边界: 无 supplier + 无 factory → fallback 到 supplierName + factoryId, 不抛异常")
    void generatePdf_noSupplierOrFactory_usesFallbacks() {
        PurchaseOrder order = makeOrder("PO-NOFB-001", buildItems());
        order.setSupplierName("冗余的供应商名称"); // 冗余字段, fallback
        when(purchaseService.getPurchaseOrderById(FACTORY_ID, ORDER_ID)).thenReturn(order);
        when(supplierRepository.findByIdAndFactoryId(anyString(), anyString())).thenReturn(Optional.empty());
        when(factoryRepository.findById(FACTORY_ID)).thenReturn(Optional.empty());

        byte[] pdfBytes = service.generatePurchaseOrderPdf(FACTORY_ID, ORDER_ID);

        assertNotNull(pdfBytes);
        assertTrue(pdfBytes.length > 500);
    }

    @Test
    @DisplayName("边界: 订单号含 ASCII (常见) — Code128 一维码生成不抛异常")
    void generatePdf_asciiOrderNumber_barcodeOk() {
        PurchaseOrder order = makeOrder("PO-20260511-001", buildItems());
        when(purchaseService.getPurchaseOrderById(FACTORY_ID, ORDER_ID)).thenReturn(order);
        when(supplierRepository.findByIdAndFactoryId(anyString(), anyString())).thenReturn(Optional.empty());
        when(factoryRepository.findById(FACTORY_ID)).thenReturn(Optional.empty());

        byte[] pdfBytes = service.generatePurchaseOrderPdf(FACTORY_ID, ORDER_ID);

        assertNotNull(pdfBytes);
        // Code128 + QR + 中文 = PDF 至少几 KB
        assertTrue(pdfBytes.length > 2000, "PDF with barcode+QR should be >2KB, got " + pdfBytes.length);
    }

    // ==================== helpers ====================

    private PurchaseOrder makeOrder(String orderNumber, List<PurchaseOrderItem> items) {
        PurchaseOrder order = new PurchaseOrder();
        order.setId(ORDER_ID);
        order.setFactoryId(FACTORY_ID);
        order.setOrderNumber(orderNumber);
        order.setSupplierId(SUPPLIER_ID);
        order.setOrderDate(LocalDate.of(2026, 5, 11));
        order.setExpectedDeliveryDate(LocalDate.of(2026, 5, 22));
        order.setStatus(PurchaseOrderStatus.APPROVED);
        order.setTotalAmount(new BigDecimal("500.00"));
        order.setRemark("六扇门牛肉测试供货单");
        order.setItems(items);
        return order;
    }

    private List<PurchaseOrderItem> buildItems() {
        List<PurchaseOrderItem> items = new ArrayList<>();
        items.add(makeItem("牛腩", "100", "kg", "5.00", "10"));
        items.add(makeItem("酱油", "20", "瓶", "8.50", "1"));
        return items;
    }

    private PurchaseOrderItem makeItem(String name, String qty, String unit, String price, String box) {
        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setMaterialTypeId("MT-" + name);
        item.setMaterialName(name);
        item.setQuantity(new BigDecimal(qty));
        item.setUnit(unit);
        item.setUnitPrice(new BigDecimal(price));
        item.setBoxQuantity(new BigDecimal(box));
        item.setSpecification("规格-" + name);
        return item;
    }

    private Supplier makeSupplier(String name) {
        Supplier supplier = new Supplier();
        supplier.setId(SUPPLIER_ID);
        supplier.setFactoryId(FACTORY_ID);
        supplier.setName(name);
        supplier.setContactName("张三");
        supplier.setContactPhone("13800000000");
        supplier.setAddress("上海市浦东新区某某路 123 号");
        return supplier;
    }

    private Factory makeFactory(String name) {
        Factory factory = new Factory();
        factory.setId(FACTORY_ID);
        factory.setName(name);
        return factory;
    }
}
