package com.cretas.aims.service.voucher;

import com.cretas.aims.entity.PayrollRecord;
import com.cretas.aims.entity.enums.VoucherType;
import com.cretas.aims.entity.finance.Voucher;
import com.cretas.aims.entity.inventory.InternalTransfer;
import com.cretas.aims.entity.inventory.PurchaseOrder;
import com.cretas.aims.entity.inventory.ReturnOrder;
import com.cretas.aims.entity.inventory.SalesOrder;
import com.cretas.aims.entity.restaurant.WastageRecord;
import com.cretas.aims.service.voucher.impl.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 7 VoucherGenerator 单测. 每 generator 验证:
 * 1. supports() 正确匹配业务类型
 * 2. generate() 返回 balanced Voucher (validateBalanced() not throw)
 * 3. 借贷分录正确科目
 */
class VoucherGeneratorsTest {

    private static final BigDecimal HUNDRED = new BigDecimal("100.00");

    // ==================== SalesReceiptVoucherGenerator ====================

    @Test
    void salesReceiptGeneratorBuildsBalancedVoucher() {
        SalesReceiptVoucherGenerator gen = new SalesReceiptVoucherGenerator();
        assertTrue(gen.supports("SALES_ORDER"));
        assertFalse(gen.supports("PURCHASE_ORDER"));

        SalesOrder order = new SalesOrder();
        order.setId("so-1");
        order.setOrderNumber("SO-2026-0001");
        order.setOrderDate(LocalDate.of(2026, 5, 16));
        order.setTotalAmount(HUNDRED);

        Voucher v = gen.generate("F001", order);
        assertEquals(VoucherType.SALES_RECEIPT, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals(2, v.getEntries().size());
        assertEquals("1122", v.getEntries().get(0).getSubjectCode());  // 应收账款
        assertEquals("6001", v.getEntries().get(1).getSubjectCode());  // 主营业务收入
        assertEquals("SALES_ORDER", v.getSourceBusinessType());
        assertEquals("so-1", v.getSourceBusinessId());
    }

    // ==================== PurchasePaymentVoucherGenerator ====================

    @Test
    void purchasePaymentGeneratorBuildsBalancedVoucher() {
        PurchasePaymentVoucherGenerator gen = new PurchasePaymentVoucherGenerator();
        assertTrue(gen.supports("PURCHASE_ORDER"));

        PurchaseOrder order = new PurchaseOrder();
        order.setId("po-1");
        order.setOrderNumber("PO-2026-0001");
        order.setOrderDate(LocalDate.of(2026, 5, 16));
        order.setTotalAmount(HUNDRED);

        Voucher v = gen.generate("F001", order);
        assertEquals(VoucherType.PURCHASE_PAYMENT, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals("1405", v.getEntries().get(0).getSubjectCode());  // 库存商品
        assertEquals("2202", v.getEntries().get(1).getSubjectCode());  // 应付账款
    }

    // ==================== InventoryTransferVoucherGenerator ====================

    @Test
    void inventoryTransferGeneratorBuildsBalancedVoucher() {
        InventoryTransferVoucherGenerator gen = new InventoryTransferVoucherGenerator();
        assertTrue(gen.supports("INTERNAL_TRANSFER"));

        InternalTransfer t = new InternalTransfer();
        t.setId("tr-1");
        t.setTransferNumber("TR-2026-0001");
        t.setTransferDate(LocalDate.of(2026, 5, 16));
        t.setTotalAmount(HUNDRED);
        t.setSourceFactoryId("F001");
        t.setTargetFactoryId("F002");
        t.setSourceWarehouseId("WH-A");
        t.setTargetWarehouseId("WH-B");

        Voucher v = gen.generate("F001", t);
        assertEquals(VoucherType.INVENTORY_TRANSFER, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals("1405", v.getEntries().get(0).getSubjectCode());  // 同科目, cost_center 区分
        assertEquals("1405", v.getEntries().get(1).getSubjectCode());
        assertTrue(v.getEntries().get(0).getCostCenter().contains("调入"));
        assertTrue(v.getEntries().get(1).getCostCenter().contains("调出"));
    }

    // ==================== ExpenseVoucherGenerator ====================

    @Test
    void expenseGeneratorBuildsBalancedVoucherFromWastage() {
        ExpenseVoucherGenerator gen = new ExpenseVoucherGenerator();
        assertTrue(gen.supports("WASTAGE_RECORD"));

        WastageRecord w = new WastageRecord();
        w.setId("w-1");
        w.setWastageNumber("WST-2026-0001");
        w.setWastageDate(LocalDate.of(2026, 5, 16));
        w.setEstimatedCost(HUNDRED);
        w.setType(WastageRecord.WastageType.EXPIRED);

        Voucher v = gen.generate("F001", w);
        assertEquals(VoucherType.EXPENSE, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals("6602.01", v.getEntries().get(0).getSubjectCode());  // 管理费用-损耗
        assertEquals("1405", v.getEntries().get(1).getSubjectCode());
    }

    // ==================== WageVoucherGenerator ====================

    @Test
    void wageGeneratorBuildsBalancedVoucherFromPayroll() {
        WageVoucherGenerator gen = new WageVoucherGenerator();
        assertTrue(gen.supports("PAYROLL_RECORD"));

        PayrollRecord r = new PayrollRecord();
        r.setId(123L);
        r.setWorkerName("张三");
        r.setPeriodStart(LocalDate.of(2026, 5, 1));
        r.setTotalWage(HUNDRED);

        Voucher v = gen.generate("F001", r);
        assertEquals(VoucherType.WAGE, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals("2211", v.getEntries().get(0).getSubjectCode());  // 应付职工薪酬
        assertEquals("1002", v.getEntries().get(1).getSubjectCode());  // 银行存款
        assertEquals("123", v.getSourceBusinessId());  // Long → String
    }

    // ==================== ReturnVoucherGenerator ====================

    @Test
    void returnGeneratorBuildsBalancedVoucherFromReturnOrder() {
        ReturnVoucherGenerator gen = new ReturnVoucherGenerator();
        assertTrue(gen.supports("RETURN_ORDER"));

        ReturnOrder r = new ReturnOrder();
        r.setId("ro-1");
        r.setReturnNumber("RT-2026-0001");
        r.setReturnDate(LocalDate.of(2026, 5, 16));
        r.setTotalAmount(HUNDRED);

        Voucher v = gen.generate("F001", r);
        assertEquals(VoucherType.RETURN, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals("6001", v.getEntries().get(0).getSubjectCode());  // 主营业务收入 (red)
        assertEquals("1122", v.getEntries().get(1).getSubjectCode());  // 应收账款
    }

    // ==================== DepreciationVoucherGenerator ====================

    @Test
    void depreciationGeneratorBuildsBalancedVoucherFromMap() {
        DepreciationVoucherGenerator gen = new DepreciationVoucherGenerator();
        assertTrue(gen.supports("DEPRECATION"));

        Map<String, Object> input = Map.of(
                "businessId", "DEP-202605",
                "amount", HUNDRED,
                "voucherDate", LocalDate.of(2026, 5, 31),
                "assetCategory", "生产设备"
        );

        Voucher v = gen.generate("F001", input);
        assertEquals(VoucherType.DEPRECATION, v.getVoucherType());
        assertEquals(HUNDRED, v.getTotalDebit());
        assertEquals(HUNDRED, v.getTotalCredit());
        assertEquals("6602.02", v.getEntries().get(0).getSubjectCode());  // 管理费用-折旧
        assertEquals("1602", v.getEntries().get(1).getSubjectCode());     // 累计折旧
        assertEquals("DEP-202605", v.getSourceBusinessId());
    }
}
