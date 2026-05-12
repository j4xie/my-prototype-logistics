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
     * 导出报表为 Excel (HttpServletResponse 流式).
     *
     * <p>RBAC defense-in-depth (PR P0-C sweep, 2026-05-12): {@code maskPrice}=true 时
     * 财务/成本/销售 类报表的金额列以 "—" 占位. 当前实现为 stub ("not yet implemented"),
     * 参数 wired through 以便未来实现自动 honor mask.
     */
    void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                             boolean maskPrice, HttpServletResponse response);

    /**
     * 导出报表为 PDF (HttpServletResponse 流式).
     *
     * <p>RBAC defense-in-depth (PR P0-C sweep, 2026-05-12): see {@link #exportReportAsExcel}.
     */
    void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate, LocalDate endDate,
                           boolean maskPrice, HttpServletResponse response);

    /** @deprecated callers must pass {@code maskPrice} (RBAC). Defaults to admin (no mask). */
    @Deprecated
    default void exportReportAsExcel(String factoryId, String reportType, LocalDate startDate,
                                     LocalDate endDate, HttpServletResponse response) {
        exportReportAsExcel(factoryId, reportType, startDate, endDate, false, response);
    }

    /** @deprecated callers must pass {@code maskPrice} (RBAC). Defaults to admin (no mask). */
    @Deprecated
    default void exportReportAsPdf(String factoryId, String reportType, LocalDate startDate,
                                   LocalDate endDate, HttpServletResponse response) {
        exportReportAsPdf(factoryId, reportType, startDate, endDate, false, response);
    }
}
