package com.cretas.aims.service.report.impl;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.write.style.column.LongestMatchColumnWidthStyleStrategy;
import com.cretas.aims.dto.report.DashboardStatisticsDTO;
import com.cretas.aims.entity.FactoryEquipment;
import com.cretas.aims.entity.MaterialBatch;
import com.cretas.aims.entity.ProductionBatch;
import com.cretas.aims.entity.QualityInspection;
import com.cretas.aims.entity.TimeClockRecord;
import com.cretas.aims.entity.enums.MaterialBatchStatus;
import com.cretas.aims.repository.*;
import com.cretas.aims.service.report.DashboardStatisticsService;
import com.cretas.aims.service.report.ProductionReportService;
import com.cretas.aims.service.report.ReportExportService;
import com.itextpdf.text.*;
import com.itextpdf.text.pdf.BaseFont;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 报表导出服务实现
 * 包含 PDF (iText) 和 Excel (EasyExcel) 的生成与导出逻辑
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
@Service
@RequiredArgsConstructor
public class ReportExportServiceImpl implements ReportExportService {

    private static final Logger log = LoggerFactory.getLogger(ReportExportServiceImpl.class);

    private final ProductionReportService productionReportService;
    private final DashboardStatisticsService dashboardStatisticsService;
    private final ProductionBatchRepository productionBatchRepository;
    private final MaterialBatchRepository materialBatchRepository;
    private final QualityInspectionRepository qualityInspectionRepository;
    private final EquipmentRepository equipmentRepository;
    private final TimeClockRecordRepository timeClockRecordRepository;

    @Override
    public byte[] exportReportToExcel(String factoryId, String reportType, Map<String, Object> parameters) {
        log.info("导出Excel报表: factoryId={}, reportType={}", factoryId, reportType);
        try {
            // 解析日期参数
            LocalDate startDate = parameters.containsKey("startDate") ?
                    LocalDate.parse((String) parameters.get("startDate")) : LocalDate.now().minusDays(30);
            LocalDate endDate = parameters.containsKey("endDate") ?
                    LocalDate.parse((String) parameters.get("endDate")) : LocalDate.now();
            // 获取报表数据
            Map<String, Object> reportData = productionReportService.getCustomReport(factoryId, Map.of(
                    "reportType", reportType,
                    "startDate", startDate.toString(),
                    "endDate", endDate.toString()
            ));
            // 转换为Excel数据格式
            List<List<Object>> excelData = new ArrayList<>();
            // 添加标题行
            List<Object> headerRow = new ArrayList<>();
            headerRow.add("指标名称");
            headerRow.add("数值");
            excelData.add(headerRow);
            // 添加数据行
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) reportData.get("data");
            if (data != null) {
                for (Map.Entry<String, Object> entry : data.entrySet()) {
                    List<Object> row = new ArrayList<>();
                    row.add(entry.getKey());
                    row.add(entry.getValue() != null ? entry.getValue().toString() : "");
                    excelData.add(row);
                }
            }
            // 使用EasyExcel导出
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            EasyExcel.write(outputStream)
                    .registerWriteHandler(new LongestMatchColumnWidthStyleStrategy())
                    .sheet(reportType + "报表")
                    .doWrite(excelData);
            log.info("Excel导出成功: {} 行数据", excelData.size());
            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Excel导出失败: {}", e.getMessage(), e);
            throw new RuntimeException("Excel导出失败: " + e.getMessage(), e);
        }
    }

    @Override
    public byte[] exportReportToPDF(String factoryId, String reportType, Map<String, Object> parameters) {
        log.info("导出PDF报表: factoryId={}, reportType={}", factoryId, reportType);

        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            // 创建PDF文档
            Document document = new Document(PageSize.A4, 50, 50, 50, 50);
            PdfWriter.getInstance(document, outputStream);
            document.open();

            // 创建中文字体
            BaseFont bfChinese = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
            Font titleFont = new Font(bfChinese, 18, Font.BOLD);
            Font headerFont = new Font(bfChinese, 12, Font.BOLD);
            Font normalFont = new Font(bfChinese, 10, Font.NORMAL);
            Font smallFont = new Font(bfChinese, 8, Font.NORMAL);

            // 添加标题
            String title = getReportTitle(reportType);
            Paragraph titleParagraph = new Paragraph(title, titleFont);
            titleParagraph.setAlignment(Element.ALIGN_CENTER);
            titleParagraph.setSpacingAfter(20);
            document.add(titleParagraph);

            // 添加报表元信息
            Paragraph metaInfo = new Paragraph();
            metaInfo.setFont(smallFont);
            metaInfo.add("工厂ID: " + factoryId + "\n");
            metaInfo.add("生成时间: " + LocalDateTime.now().toString() + "\n");
            metaInfo.add("报表类型: " + reportType + "\n");
            metaInfo.setSpacingAfter(15);
            document.add(metaInfo);

            // 根据报表类型生成内容
            switch (reportType.toLowerCase()) {
                case "production":
                    generateProductionPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "inventory":
                    generateInventoryPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "quality":
                    generateQualityPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "equipment":
                    generateEquipmentPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "labor":
                    generateLaborPdfContent(document, factoryId, parameters, headerFont, normalFont);
                    break;
                case "dashboard":
                default:
                    generateDashboardPdfContent(document, factoryId, headerFont, normalFont);
                    break;
            }

            // 添加页脚
            Paragraph footer = new Paragraph();
            footer.setFont(smallFont);
            footer.add("\n\n---\n");
            footer.add("白垩纪AI Agent - 自动生成报表");
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
            log.info("PDF导出成功: reportType={}", reportType);
            return outputStream.toByteArray();

        } catch (Exception e) {
            log.error("PDF导出失败: {}", e.getMessage(), e);
            throw new RuntimeException("PDF导出失败: " + e.getMessage(), e);
        }
    }

    @Override
    public void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                                    boolean maskPrice,
                                    jakarta.servlet.http.HttpServletResponse response) {
        // RBAC defense-in-depth (P0-C sweep, 2026-05-12): maskPrice wired through;
        // current impl is a stub returning a placeholder string, so no real prices
        // leak today. When the stub is replaced with a real export, swap to a
        // masked DTO / cell-replacement strategy mirroring CustomerService + PR #450.
        log.info("导出Excel报表: factoryId={}, type={}, startDate={}, endDate={}, maskPrice={}",
                factoryId, reportType, startDate, endDate, maskPrice);
        try {
            response.setContentType("application/vnd.ms-excel");
            response.setHeader("Content-Disposition", "attachment; filename=report.xlsx");
            response.getWriter().write("Excel export not yet implemented");
        } catch (Exception e) {
            log.error("导出Excel失败", e);
        }
    }

    @Override
    public void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                                  boolean maskPrice,
                                  jakarta.servlet.http.HttpServletResponse response) {
        // RBAC defense-in-depth (P0-C sweep, 2026-05-12): see exportReportAsExcel above.
        log.info("导出PDF报表: factoryId={}, type={}, startDate={}, endDate={}, maskPrice={}",
                factoryId, reportType, startDate, endDate, maskPrice);
        try {
            response.setContentType("application/pdf");
            response.setHeader("Content-Disposition", "attachment; filename=report.pdf");
            response.getWriter().write("PDF export not yet implemented");
        } catch (Exception e) {
            log.error("导出PDF失败", e);
        }
    }

    // ==================== PDF 内容生成方法 ====================

    private String getReportTitle(String reportType) {
        switch (reportType.toLowerCase()) {
            case "production": return "生产报表";
            case "inventory": return "库存报表";
            case "quality": return "质量报表";
            case "equipment": return "设备报表";
            case "labor": return "工时报表";
            case "dashboard": return "综合统计报表";
            default: return "统计报表";
        }
    }

    private void generateDashboardPdfContent(Document document, String factoryId, Font headerFont, Font normalFont) throws DocumentException {
        DashboardStatisticsDTO stats = dashboardStatisticsService.getDashboardStatistics(factoryId);

        // 生产统计
        Paragraph prodHeader = new Paragraph("一、生产统计", headerFont);
        prodHeader.setSpacingBefore(10);
        prodHeader.setSpacingAfter(5);
        document.add(prodHeader);

        if (stats.getProductionStats() != null) {
            PdfPTable prodTable = new PdfPTable(2);
            prodTable.setWidthPercentage(80);
            addTableRow(prodTable, "活跃计划", String.valueOf(stats.getProductionStats().getActivePlans()), normalFont);
            addTableRow(prodTable, "完成计划", String.valueOf(stats.getProductionStats().getCompletedPlans()), normalFont);
            addTableRow(prodTable, "总产量", formatDecimal(stats.getProductionStats().getTotalOutput()) + " kg", normalFont);
            addTableRow(prodTable, "完成率", formatDecimal(BigDecimal.valueOf(stats.getProductionStats().getCompletionRate() != null ? stats.getProductionStats().getCompletionRate() : 0)) + "%", normalFont);
            document.add(prodTable);
        }

        // 库存统计
        Paragraph invHeader = new Paragraph("二、库存统计", headerFont);
        invHeader.setSpacingBefore(15);
        invHeader.setSpacingAfter(5);
        document.add(invHeader);

        if (stats.getInventoryStats() != null) {
            PdfPTable invTable = new PdfPTable(2);
            invTable.setWidthPercentage(80);
            addTableRow(invTable, "原料批次数", String.valueOf(stats.getInventoryStats().getTotalBatches()), normalFont);
            addTableRow(invTable, "物料种类", String.valueOf(stats.getInventoryStats().getTotalMaterials()), normalFont);
            addTableRow(invTable, "总价值", formatDecimal(stats.getInventoryStats().getTotalValue()) + " 元", normalFont);
            addTableRow(invTable, "即将过期批次", String.valueOf(stats.getInventoryStats().getExpiringBatches()), normalFont);
            document.add(invTable);
        }

        // 人员统计
        Paragraph personnelHeader = new Paragraph("三、人员统计", headerFont);
        personnelHeader.setSpacingBefore(15);
        personnelHeader.setSpacingAfter(5);
        document.add(personnelHeader);

        if (stats.getPersonnelStats() != null) {
            PdfPTable pTable = new PdfPTable(2);
            pTable.setWidthPercentage(80);
            addTableRow(pTable, "员工总数", String.valueOf(stats.getPersonnelStats().getTotalEmployees()), normalFont);
            addTableRow(pTable, "活跃员工", String.valueOf(stats.getPersonnelStats().getActiveEmployees()), normalFont);
            addTableRow(pTable, "今日出勤", String.valueOf(stats.getPersonnelStats().getTodayPresent()), normalFont);
            addTableRow(pTable, "出勤率", formatDecimal(BigDecimal.valueOf(stats.getPersonnelStats().getAttendanceRate() != null ? stats.getPersonnelStats().getAttendanceRate() : 0)) + "%", normalFont);
            document.add(pTable);
        }

        // 设备统计
        Paragraph equipHeader = new Paragraph("四、设备统计", headerFont);
        equipHeader.setSpacingBefore(15);
        equipHeader.setSpacingAfter(5);
        document.add(equipHeader);

        if (stats.getEquipmentStats() != null) {
            PdfPTable eqTable = new PdfPTable(2);
            eqTable.setWidthPercentage(80);
            addTableRow(eqTable, "设备总数", String.valueOf(stats.getEquipmentStats().getTotalEquipment()), normalFont);
            addTableRow(eqTable, "运行中", String.valueOf(stats.getEquipmentStats().getRunningEquipment()), normalFont);
            addTableRow(eqTable, "维护中", String.valueOf(stats.getEquipmentStats().getMaintenanceEquipment()), normalFont);
            addTableRow(eqTable, "设备利用率", formatDecimal(BigDecimal.valueOf(stats.getEquipmentStats().getUtilizationRate() != null ? stats.getEquipmentStats().getUtilizationRate() : 0)) + "%", normalFont);
            document.add(eqTable);
        }
    }

    private void generateProductionPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                              Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("生产计划执行情况", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        LocalDate startDate = parameters.containsKey("startDate") ?
                (LocalDate) parameters.get("startDate") : LocalDate.now().minusDays(30);
        LocalDate endDate = parameters.containsKey("endDate") ?
                (LocalDate) parameters.get("endDate") : LocalDate.now();

        List<ProductionBatch> batches = productionBatchRepository.findByFactoryIdAndCreatedAtBetween(
                factoryId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2, 3, 2, 2});

        addTableHeader(table, new String[]{"批次号", "产品类型", "计划数量", "实际数量"}, normalFont);

        for (ProductionBatch batch : batches) {
            addTableCell(table, batch.getBatchNumber() != null ? batch.getBatchNumber() : "-", normalFont);
            addTableCell(table, batch.getProductName() != null ? batch.getProductName() : "-", normalFont);
            addTableCell(table, formatDecimal(batch.getPlannedQuantity()), normalFont);
            addTableCell(table, formatDecimal(batch.getActualQuantity()), normalFont);
        }

        document.add(table);
    }

    private void generateInventoryPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                             Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("库存状况报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        List<MaterialBatch> batches = materialBatchRepository.findByFactoryIdAndStatus(factoryId, MaterialBatchStatus.AVAILABLE);

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2, 3, 2, 2});

        addTableHeader(table, new String[]{"批次号", "物料类型", "当前库存", "过期日期"}, normalFont);

        for (MaterialBatch batch : batches) {
            addTableCell(table, batch.getBatchNumber() != null ? batch.getBatchNumber() : "-", normalFont);
            String materialTypeName = batch.getMaterialType() != null ? batch.getMaterialType().getName() : (batch.getMaterialTypeId() != null ? batch.getMaterialTypeId() : "-");
            addTableCell(table, materialTypeName, normalFont);
            addTableCell(table, formatDecimal(batch.getCurrentQuantity()), normalFont);
            addTableCell(table, batch.getExpireDate() != null ? batch.getExpireDate().toString() : "-", normalFont);
        }

        document.add(table);
    }

    private void generateQualityPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                           Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("质量检验报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        long totalInspections = qualityInspectionRepository.countByFactoryId(factoryId);
        long passedCount = qualityInspectionRepository.countByFactoryIdAndResult(factoryId, "PASS");
        double passRate = totalInspections > 0 ? (passedCount * 100.0 / totalInspections) : 0;

        PdfPTable summaryTable = new PdfPTable(2);
        summaryTable.setWidthPercentage(60);
        addTableRow(summaryTable, "总检验次数", String.valueOf(totalInspections), normalFont);
        addTableRow(summaryTable, "合格次数", String.valueOf(passedCount), normalFont);
        addTableRow(summaryTable, "合格率", String.format("%.2f%%", passRate), normalFont);

        document.add(summaryTable);
    }

    private void generateEquipmentPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                             Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("设备运行报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        List<FactoryEquipment> equipments = equipmentRepository.findByFactoryId(factoryId);

        PdfPTable table = new PdfPTable(4);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2, 2, 2, 2});

        addTableHeader(table, new String[]{"设备名称", "设备类型", "状态", "运行时长"}, normalFont);

        for (FactoryEquipment eq : equipments) {
            addTableCell(table, eq.getEquipmentName() != null ? eq.getEquipmentName() : "-", normalFont);
            addTableCell(table, eq.getType() != null ? eq.getType() : "-", normalFont);
            addTableCell(table, eq.getStatus() != null ? eq.getStatus() : "-", normalFont);
            addTableCell(table, eq.getTotalRunningHours() != null ? eq.getTotalRunningHours() + "h" : "-", normalFont);
        }

        document.add(table);
    }

    private void generateLaborPdfContent(Document document, String factoryId, Map<String, Object> parameters,
                                         Font headerFont, Font normalFont) throws DocumentException {
        Paragraph header = new Paragraph("工时统计报表", headerFont);
        header.setSpacingAfter(10);
        document.add(header);

        LocalDate startDate = parameters.containsKey("startDate") ?
                (LocalDate) parameters.get("startDate") : LocalDate.now().minusDays(7);
        LocalDate endDate = parameters.containsKey("endDate") ?
                (LocalDate) parameters.get("endDate") : LocalDate.now();

        List<TimeClockRecord> records = timeClockRecordRepository.findByFactoryIdAndClockDateBetween(
                factoryId, startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay());

        int totalRecords = records.size();
        int totalMinutes = records.stream()
                .mapToInt(r -> r.getWorkDurationMinutes() != null ? r.getWorkDurationMinutes() : 0)
                .sum();

        PdfPTable summaryTable = new PdfPTable(2);
        summaryTable.setWidthPercentage(60);
        addTableRow(summaryTable, "统计周期", startDate + " 至 " + endDate, normalFont);
        addTableRow(summaryTable, "打卡记录数", String.valueOf(totalRecords), normalFont);
        addTableRow(summaryTable, "总工时", String.format("%.2f 小时", totalMinutes / 60.0), normalFont);

        document.add(summaryTable);
    }

    // ==================== PDF 工具方法 ====================

    private void addTableRow(PdfPTable table, String label, String value, Font font) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        labelCell.setBackgroundColor(new BaseColor(240, 240, 240));
        labelCell.setPadding(5);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, font));
        valueCell.setPadding(5);
        table.addCell(valueCell);
    }

    private void addTableHeader(PdfPTable table, String[] headers, Font font) {
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, font));
            cell.setBackgroundColor(new BaseColor(200, 200, 200));
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setPadding(5);
            table.addCell(cell);
        }
    }

    private void addTableCell(PdfPTable table, String value, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(value, font));
        cell.setPadding(3);
        table.addCell(cell);
    }

    private String formatDecimal(BigDecimal value) {
        return value != null ? value.setScale(2, RoundingMode.HALF_UP).toString() : "0.00";
    }
}
