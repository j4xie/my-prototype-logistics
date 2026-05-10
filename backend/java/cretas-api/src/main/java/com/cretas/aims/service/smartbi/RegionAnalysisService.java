package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;
import com.cretas.aims.dto.smartbi.RegionOpportunityScore;

import java.time.LocalDate;
import java.util.List;

/**
 * 区域分析服务接口
 *
 * 提供 SmartBI 系统中区域维度的分析能力，支持：
 * - 区域/省份/城市三级下钻分析
 * - 区域机会评分（增长率 + 基数 + 毛利率 + 渗透率）
 * - 地理分布热力图数据
 * - 区域销售趋势和目标完成情况
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see RegionOpportunityScore
 */
public interface RegionAnalysisService {

    // ==================== 区域排名分析 ====================

    /**
     * 获取区域销售排名
     *
     * 按销售额降序排列各大区的销售数据，包含完成率和预警级别。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 区域排名列表
     */
    List<RankingItem> getRegionRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    /**
     * 获取省份销售排名（按区域筛选）
     *
     * 在指定区域内，按销售额降序排列各省份的销售数据。
     *
     * @param factoryId 工厂ID
     * @param region    区域名称（可为null，表示不筛选区域）
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 省份排名列表
     */
    List<RankingItem> getProvinceRanking(String factoryId, String region, LocalDate startDate, LocalDate endDate);

    /**
     * 获取城市销售排名（按省份筛选）
     *
     * 在指定省份内，按销售额降序排列各城市的销售数据。
     *
     * @param factoryId 工厂ID
     * @param province  省份名称（可为null，表示不筛选省份）
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 城市排名列表
     */
    List<RankingItem> getCityRanking(String factoryId, String province, LocalDate startDate, LocalDate endDate);

    // ==================== 区域详情分析 ====================

    /**
     * 获取区域详情
     *
     * 返回指定区域的完整仪表盘数据，包含 KPI 卡片、图表、排行榜和 AI 洞察。
     *
     * @param factoryId 工厂ID
     * @param region    区域名称
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 区域仪表盘响应
     */
    DashboardResponse getRegionDetail(String factoryId, String region, LocalDate startDate, LocalDate endDate);

}
