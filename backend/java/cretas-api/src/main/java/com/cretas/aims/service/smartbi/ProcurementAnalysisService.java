package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 采购分析服务接口
 *
 * 提供 SmartBI 系统中采购相关的分析能力：
 * - 采购概览分析：采购总额、批次数、平均批次金额、成本率
 *
 * 所有计算使用 BigDecimal 确保精度，并支持按时间范围过滤。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see DashboardResponse
 * @see RankingItem
 * @see MetricResult
 * @see ChartConfig
 */
public interface ProcurementAnalysisService {

    // ==================== 指标代码常量 ====================

    /** 采购总额 */
    String PROCUREMENT_AMOUNT = "PROCUREMENT_AMOUNT";

    /** 采购批次数 */
    String BATCH_COUNT = "BATCH_COUNT";

    /** 平均批次金额 */
    String AVG_BATCH_AMOUNT = "AVG_BATCH_AMOUNT";

    /** 采购成本率 */
    String PROCUREMENT_COST_RATE = "PROCUREMENT_COST_RATE";

    /** 准时交付率 */
    String ON_TIME_DELIVERY_RATE = "ON_TIME_DELIVERY_RATE";

    /** 质量合格率 */
    String QUALITY_PASS_RATE = "QUALITY_PASS_RATE";

    /** 供应商数量 */
    String SUPPLIER_COUNT = "SUPPLIER_COUNT";

    /** 活跃供应商数 */
    String ACTIVE_SUPPLIER_COUNT = "ACTIVE_SUPPLIER_COUNT";

    /** 供应商集中度 */
    String SUPPLIER_CONCENTRATION = "SUPPLIER_CONCENTRATION";

    /** 采购环比增长 */
    String PROCUREMENT_MOM_GROWTH = "PROCUREMENT_MOM_GROWTH";

    // ==================== 采购概览 ====================

    /**
     * 获取采购概览数据
     *
     * 返回完整的采购仪表盘数据，包括：
     * - KPI 卡片：采购总额、批次数、平均批次金额、准时交付率
     * - 图表：采购趋势图、供应商占比图、材料类别分布图
     * - 排行榜：供应商排名
     * - AI 洞察：基于数据的智能分析和建议
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 仪表盘响应数据
     */
    DashboardResponse getProcurementOverview(String factoryId, LocalDate startDate, LocalDate endDate);
}
