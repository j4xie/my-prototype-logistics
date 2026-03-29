package com.cretas.aims.service.report;

import jakarta.servlet.http.HttpServletResponse;
import java.time.LocalDate;
import java.util.Map;

/**
 * 报表导出服务接口
 * 负责 PDF (iText) 和 Excel (EasyExcel) 生成与导出
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
public interface ReportExportService {

    /**
     * 导出报表为 Excel (byte[])
     */
    byte[] exportReportToExcel(String factoryId, String reportType, Map<String, Object> parameters);

    /**
     * 导出报表为 PDF (byte[])
     */
    byte[] exportReportToPDF(String factoryId, String reportType, Map<String, Object> parameters);

    /**
     * 导出报表为 Excel (HttpServletResponse 流式)
     */
    void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                             HttpServletResponse response);

    /**
     * 导出报表为 PDF (HttpServletResponse 流式)
     */
    void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                           HttpServletResponse response);
}
