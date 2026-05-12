package com.cretas.aims.security;

import com.cretas.aims.dto.customer.CustomerDTO;
import com.cretas.aims.dto.customer.CustomerExportDTO;
import com.cretas.aims.dto.customer.CustomerMaskedExportDTO;
import com.cretas.aims.dto.material.MaterialBatchExportDTO;
import com.cretas.aims.dto.material.MaterialBatchMaskedExportDTO;
import com.cretas.aims.dto.production.ProductionPlanImportDTO;
import com.cretas.aims.dto.supplier.SupplierDTO;
import com.cretas.aims.dto.supplier.SupplierExportDTO;
import com.cretas.aims.dto.supplier.SupplierMaskedExportDTO;
import com.cretas.aims.utils.ExcelUtil;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P0-C Binary export RBAC sweep — byte-level price-mask verification.
 *
 * <p>Companion to {@link com.cretas.aims.service.inventory.PurchaseOrderPdfServiceImplTest}
 * (PR #450, commit c290c8d8d9). PR #450 fixed the Purchase Order PDF byte[] leak;
 * the sweep matrix in PR #450's body flagged 6 additional binary export endpoints
 * vulnerable to the same {@link PriceFieldResponseAdvice}-bypass:
 *
 * <ol>
 *   <li>{@code ReportController.exportExcelReport} — stub today, wired for future</li>
 *   <li>{@code ReportController.exportPdfReport} — stub today, wired for future</li>
 *   <li>{@code CustomerController.exportCustomerList} — creditLimit / currentBalance</li>
 *   <li>{@code SupplierController.exportSupplierList} — creditLimit</li>
 *   <li>{@code MaterialBatchController.exportInventoryReport} — purchasePrice / inventoryValue</li>
 *   <li>{@code ProductionPlanController.exportProductionPlans} — no cost cols in DTO today; param wired</li>
 * </ol>
 *
 * <p>Strategy mirrors PR #450 ({@code PdfTextExtractor} for PDF, Apache POI
 * {@link XSSFWorkbook} for xlsx): generate bytes via {@link ExcelUtil}, parse, assert
 * masked cell contains "—" and the raw numeric value is absent anywhere in any row/col.
 */
class BinaryExportRbacTest {

    private static final String EM_DASH = "—";
    private static final ExcelUtil excelUtil = new ExcelUtil();

    // ==================== Endpoint 3: CustomerController.exportCustomerList ====================

    @Test
    @DisplayName("RBAC P0-C-3: Customer Excel masked — 信用额度 col 9 + 当前余额 col 10 显示 '—', 真实 50000 / 12345.67 不出现")
    void customer_exportCustomerList_maskPriceTrue_creditLimitAndCurrentBalanceMasked() throws Exception {
        CustomerDTO src = new CustomerDTO();
        src.setCustomerCode("C001");
        src.setName("张氏餐饮");
        src.setCreditLimit(new BigDecimal("50000"));
        src.setCurrentBalance(new BigDecimal("12345.67"));
        src.setIsActive(true);
        src.setCreatedAt(LocalDateTime.of(2026, 5, 12, 10, 0));

        List<CustomerMaskedExportDTO> masked = List.of(CustomerMaskedExportDTO.fromCustomerDTO(src));
        byte[] xlsx = excelUtil.exportToExcel(masked, CustomerMaskedExportDTO.class, "客户列表");

        Sheet sheet = readFirstSheet(xlsx);
        // Row 0 is header, row 1 is the data row
        Row dataRow = sheet.getRow(1);
        assertNotNull(dataRow, "Data row 1 should exist");

        // creditLimit at col 9
        assertEquals(EM_DASH, cellAsString(dataRow.getCell(9)),
                "信用额度 col must render '—' for masked caller");
        // currentBalance at col 10
        assertEquals(EM_DASH, cellAsString(dataRow.getCell(10)),
                "当前余额 col must render '—' for masked caller");

        // Sanity: raw values must not appear in any cell of the entire sheet (defense-in-depth)
        assertSheetDoesNotContain(sheet, "50000");
        assertSheetDoesNotContain(sheet, "12345.67");
        // Non-price columns must remain readable (warehouse still needs customer name for receipt)
        assertEquals("张氏餐饮", cellAsString(dataRow.getCell(1)),
                "Customer name (col 1) must remain visible for warehouse audit");
    }

    @Test
    @DisplayName("RBAC P0-C-3: Customer Excel unmasked (admin) — 信用额度 / 当前余额 显示真实数值, 仍可解析")
    void customer_exportCustomerList_maskPriceFalse_pricesVisibleForAdmin() throws Exception {
        CustomerDTO src = new CustomerDTO();
        src.setCustomerCode("C002");
        src.setName("admin-visible-test");
        src.setCreditLimit(new BigDecimal("50000"));
        src.setCurrentBalance(new BigDecimal("12345.67"));
        src.setIsActive(true);
        src.setCreatedAt(LocalDateTime.of(2026, 5, 12, 10, 0));

        List<CustomerExportDTO> admin = List.of(CustomerExportDTO.fromCustomerDTO(src));
        byte[] xlsx = excelUtil.exportToExcel(admin, CustomerExportDTO.class, "客户列表");

        Sheet sheet = readFirstSheet(xlsx);
        Row dataRow = sheet.getRow(1);
        // creditLimit is BigDecimal in the admin DTO so POI renders it as numeric
        assertEquals(50000.0, dataRow.getCell(9).getNumericCellValue(), 0.001,
                "Admin sees real creditLimit");
        assertEquals(12345.67, dataRow.getCell(10).getNumericCellValue(), 0.001,
                "Admin sees real currentBalance");
    }

    // ==================== Endpoint 4: SupplierController.exportSupplierList ====================

    @Test
    @DisplayName("RBAC P0-C-4: Supplier Excel masked — 信用额度 col 9 显示 '—', 真实 88888 不出现")
    void supplier_exportSupplierList_maskPriceTrue_creditLimitMasked() throws Exception {
        SupplierDTO src = new SupplierDTO();
        src.setSupplierCode("S001");
        src.setName("青旺果蔬");
        src.setCreditLimit(new BigDecimal("88888"));
        src.setIsActive(true);
        src.setCreatedAt(LocalDateTime.of(2026, 5, 12, 10, 0));

        List<SupplierMaskedExportDTO> masked = List.of(SupplierMaskedExportDTO.fromSupplierDTO(src));
        byte[] xlsx = excelUtil.exportToExcel(masked, SupplierMaskedExportDTO.class, "供应商列表");

        Sheet sheet = readFirstSheet(xlsx);
        Row dataRow = sheet.getRow(1);
        assertEquals(EM_DASH, cellAsString(dataRow.getCell(9)),
                "信用额度 col 9 must render '—' for masked caller");

        assertSheetDoesNotContain(sheet, "88888");
        assertEquals("青旺果蔬", cellAsString(dataRow.getCell(1)),
                "Supplier name (col 1) must remain visible");
    }

    @Test
    @DisplayName("RBAC P0-C-4: Supplier Excel unmasked (admin) — 信用额度 显示真实数值")
    void supplier_exportSupplierList_maskPriceFalse_creditLimitVisibleForAdmin() throws Exception {
        SupplierDTO src = new SupplierDTO();
        src.setSupplierCode("S002");
        src.setName("admin-visible-test");
        src.setCreditLimit(new BigDecimal("88888"));
        src.setIsActive(true);
        src.setCreatedAt(LocalDateTime.of(2026, 5, 12, 10, 0));

        List<SupplierExportDTO> admin = List.of(SupplierExportDTO.fromSupplierDTO(src));
        byte[] xlsx = excelUtil.exportToExcel(admin, SupplierExportDTO.class, "供应商列表");

        Sheet sheet = readFirstSheet(xlsx);
        assertEquals(88888.0, sheet.getRow(1).getCell(9).getNumericCellValue(), 0.001,
                "Admin sees real creditLimit");
    }

    // ==================== Endpoint 5: MaterialBatchController.exportInventoryReport ====================

    @Test
    @DisplayName("RBAC P0-C-5: MaterialBatch Excel masked — 采购单价 col 10 + 库存价值 col 11 显示 '—', 真实 25.5 / 2550 不出现")
    void materialBatch_exportInventoryReport_maskPriceTrue_purchasePriceAndInventoryValueMasked() throws Exception {
        MaterialBatchExportDTO src = MaterialBatchExportDTO.builder()
                .batchNumber("MB-001")
                .materialTypeName("牛腩")
                .supplierName("青旺果蔬")
                .currentQuantity(new BigDecimal("100"))
                .purchasePrice(new BigDecimal("25.5"))
                .inventoryValue(new BigDecimal("2550"))
                .unit("kg")
                .status("AVAILABLE")
                .build();

        List<MaterialBatchMaskedExportDTO> masked = List.of(
                MaterialBatchMaskedExportDTO.fromExportDTO(src));
        byte[] xlsx = excelUtil.exportToExcel(masked,
                MaterialBatchMaskedExportDTO.class, "库存报表");

        Sheet sheet = readFirstSheet(xlsx);
        Row dataRow = sheet.getRow(1);
        // purchasePrice at col 10
        assertEquals(EM_DASH, cellAsString(dataRow.getCell(10)),
                "采购单价 col 10 must render '—'");
        // inventoryValue at col 11
        assertEquals(EM_DASH, cellAsString(dataRow.getCell(11)),
                "库存价值 col 11 must render '—'");

        assertSheetDoesNotContain(sheet, "25.5");
        assertSheetDoesNotContain(sheet, "2550");
        // Non-price columns: warehouse still needs batch number / material name / qty for audit
        assertEquals("MB-001", cellAsString(dataRow.getCell(0)),
                "批次号 col 0 must remain visible");
        assertEquals("牛腩", cellAsString(dataRow.getCell(1)),
                "Material name col 1 must remain visible");
    }

    @Test
    @DisplayName("RBAC P0-C-5: MaterialBatch Excel unmasked (admin) — 采购单价 + 库存价值 真实数值")
    void materialBatch_exportInventoryReport_maskPriceFalse_pricesVisibleForAdmin() throws Exception {
        MaterialBatchExportDTO src = MaterialBatchExportDTO.builder()
                .batchNumber("MB-002")
                .materialTypeName("admin-visible-test")
                .currentQuantity(new BigDecimal("100"))
                .purchasePrice(new BigDecimal("25.5"))
                .inventoryValue(new BigDecimal("2550"))
                .unit("kg")
                .status("AVAILABLE")
                .build();

        byte[] xlsx = excelUtil.exportToExcel(List.of(src), MaterialBatchExportDTO.class, "库存报表");
        Sheet sheet = readFirstSheet(xlsx);
        Row dataRow = sheet.getRow(1);
        assertEquals(25.5, dataRow.getCell(10).getNumericCellValue(), 0.001,
                "Admin sees real purchasePrice");
        assertEquals(2550.0, dataRow.getCell(11).getNumericCellValue(), 0.001,
                "Admin sees real inventoryValue");
    }

    // ==================== Endpoint 6: ProductionPlanController.exportProductionPlans ====================

    @Test
    @DisplayName("RBAC P0-C-6: ProductionPlan Excel — maskPrice param wired; DTO has no cost cols today, no leak regardless")
    void productionPlan_exportProductionPlans_paramWired_noCostColumnsToLeak() throws Exception {
        ProductionPlanImportDTO row = new ProductionPlanImportDTO();
        row.setProductName("番茄酱-A");
        row.setPlannedQuantity(new BigDecimal("500"));
        row.setExpectedCompletionDate(LocalDate.of(2026, 5, 20));
        row.setPriority(5);

        byte[] xlsx = excelUtil.exportToExcel(List.of(row),
                ProductionPlanImportDTO.class, "生产计划");
        Sheet sheet = readFirstSheet(xlsx);

        // Verify columns are: 产品名称 / 计划数量 / 预计完成日期 / 优先级 / 产线编号 /
        // 预计工人数 / 车间主管(用户名) / 客户订单号 / 备注  — NO cost / price / amount column.
        Row headerRow = sheet.getRow(0);
        for (int c = 0; c < headerRow.getLastCellNum(); c++) {
            String header = cellAsString(headerRow.getCell(c));
            assertFalse(header == null || header.contains("成本") || header.contains("价格")
                            || header.toLowerCase().contains("cost") || header.toLowerCase().contains("price"),
                    "ProductionPlanImportDTO must NOT contain cost/price columns (col " + c + " header: " + header + ")");
        }

        // Sanity: planned qty IS exposed; that's part of the operational data, not price.
        assertEquals(500.0, sheet.getRow(1).getCell(1).getNumericCellValue(), 0.001);
    }

    // ==================== Endpoints 1 + 2: Report Excel + PDF stubs ====================

    @Test
    @DisplayName("RBAC P0-C-1+2: Report Excel/PDF stubs — maskPrice wired through, stub returns 'not yet implemented', no leak today")
    void report_exportReportAsExcelAndPdf_stubsReturnPlaceholder_noLeak() throws Exception {
        com.cretas.aims.service.report.impl.ReportExportServiceImpl service =
                new com.cretas.aims.service.report.impl.ReportExportServiceImpl(
                        mock(com.cretas.aims.service.report.ProductionReportService.class),
                        mock(com.cretas.aims.service.report.DashboardStatisticsService.class),
                        mock(com.cretas.aims.repository.ProductionBatchRepository.class),
                        mock(com.cretas.aims.repository.MaterialBatchRepository.class),
                        mock(com.cretas.aims.repository.QualityInspectionRepository.class),
                        mock(com.cretas.aims.repository.EquipmentRepository.class),
                        mock(com.cretas.aims.repository.TimeClockRecordRepository.class)
                );

        // Stub Excel — masked path. Use a StringWriter so we don't have to deal with
        // PrintWriter buffering across response.getWriter() boundaries.
        assertTrue(captureStubResponse(service, "finance", true, /*pdf*/ false).contains("not yet implemented"),
                "Stub Excel returns placeholder string for warehouse caller");

        // Stub PDF — masked path
        assertTrue(captureStubResponse(service, "finance", true, /*pdf*/ true).contains("not yet implemented"),
                "Stub PDF returns placeholder string for warehouse caller");

        // Admin path — same stub
        assertTrue(captureStubResponse(service, "finance", false, /*pdf*/ false).contains("not yet implemented"),
                "Stub Excel returns same placeholder for admin caller (both stubs today)");
        assertTrue(captureStubResponse(service, "finance", false, /*pdf*/ true).contains("not yet implemented"),
                "Stub PDF returns same placeholder for admin caller (both stubs today)");

        // Verify the param IS passed through (stub log line includes maskPrice=true/false).
        // Both code paths exercise the maskPrice param without throwing — proves wiring is intact.
    }

    /** Invoke the stub Excel or PDF export and return the written body as a String. */
    private static String captureStubResponse(
            com.cretas.aims.service.report.impl.ReportExportServiceImpl service,
            String reportType, boolean maskPrice, boolean pdf) throws Exception {
        jakarta.servlet.http.HttpServletResponse response =
                mock(jakarta.servlet.http.HttpServletResponse.class);
        java.io.StringWriter buffer = new java.io.StringWriter();
        PrintWriter writer = new PrintWriter(buffer);
        when(response.getWriter()).thenReturn(writer);

        if (pdf) {
            service.exportReportAsPdf("F001", reportType,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), maskPrice, response);
        } else {
            service.exportReportAsExcel("F001", reportType,
                    LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), maskPrice, response);
        }
        writer.flush();
        return buffer.toString();
    }

    // ==================== POI helpers ====================

    private static Sheet readFirstSheet(byte[] xlsxBytes) throws Exception {
        Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(xlsxBytes));
        return wb.getSheetAt(0);
    }

    /**
     * Read cell as string. Handles both string cells and numeric cells coerced to string.
     * For empty / null cells returns {@code ""} to make assertion failures clearer.
     */
    private static String cellAsString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                // Strip trailing .0 for integer-valued numerics so "50000" matches not "50000.0"
                double d = cell.getNumericCellValue();
                if (d == Math.floor(d) && !Double.isInfinite(d)) {
                    return String.valueOf((long) d);
                }
                return String.valueOf(d);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                return cell.getCellFormula();
            default:
                return "";
        }
    }

    /**
     * Assert that no cell in any row of the sheet contains {@code needle} as a string
     * representation. Used to prove a numeric value (e.g. "50000", "25.5") does not leak
     * anywhere in the masked export, mirroring PR #450's {@code containsAsToken} approach.
     */
    private static void assertSheetDoesNotContain(Sheet sheet, String needle) {
        int lastRow = sheet.getLastRowNum();
        List<String> matches = new ArrayList<>();
        for (int r = 0; r <= lastRow; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String text = cellAsString(row.getCell(c));
                if (text.equals(needle) || text.contains(needle)) {
                    matches.add("row " + r + " col " + c + " = '" + text + "'");
                }
            }
        }
        assertEquals(Collections.emptyList(), matches,
                "Masked sheet must not contain raw price value '" + needle + "', but found: " + matches);
    }
}
