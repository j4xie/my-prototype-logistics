package com.cretas.aims.service.smartbi;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 生产数据导出服务接口
 * 提供多维度的生产数据聚合查询，用于 SmartBI 分析和报表生成
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-02-09
 */
public interface ProductionDataExportService {

    /**
     * 按日聚合生产摘要（产量、良率、成本等）
     *
     * @param factoryId 工厂ID
     * @param start     开始时间
     * @param end       结束时间
     * @return 每日生产数据列表
     */
    List<Map<String, Object>> getDailyProductionSummary(String factoryId, LocalDateTime start, LocalDateTime end);

    /**
     * 按产品聚合生产数据
     *
     * @param factoryId 工厂ID
     * @param start     开始时间
     * @param end       结束时间
     * @return 按产品分组的生产数据列表
     */
    List<Map<String, Object>> getProductionByProduct(String factoryId, LocalDateTime start, LocalDateTime end);

    /**
     * 按设备聚合生产数据
     *
     * @param factoryId 工厂ID
     * @param start     开始时间
     * @param end       结束时间
     * @return 按设备分组的生产数据列表
     */
    List<Map<String, Object>> getProductionByEquipment(String factoryId, LocalDateTime start, LocalDateTime end);

    /**
     * 按负责人聚合生产数据
     *
     * @param factoryId 工厂ID
     * @param start     开始时间
     * @param end       结束时间
     * @return 按负责人分组的生产数据列表
     */
    List<Map<String, Object>> getProductionByPersonnel(String factoryId, LocalDateTime start, LocalDateTime end);

    /**
     * 获取完整的生产分析仪表盘数据（多维度汇总）
     *
     * @param factoryId 工厂ID
     * @param period    时间周期: week, month, quarter, year
     * @return 包含 dailySummary, byProduct, byEquipment, byPersonnel 的综合数据
     */
    Map<String, Object> getProductionAnalysisDashboard(String factoryId, String period);
}
