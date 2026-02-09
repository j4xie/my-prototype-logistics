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

    // ==================== 趋势分析 ====================

    /**
     * 获取区域销售趋势图表
     *
     * 按时间周期展示各区域的销售趋势，支持日/周/月粒度。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    时间周期: DAY, WEEK, MONTH
     * @return 趋势图表配置
     */
    ChartConfig getRegionTrendChart(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    // ==================== 目标完成分析 ====================

    /**
     * 获取区域目标完成情况（子弹图数据）
     *
     * 返回各区域的实际销售额、目标值和完成率，用于子弹图展示。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 目标完成指标列表
     */
    List<MetricResult> getRegionTargetCompletion(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 地理分布分析 ====================

    /**
     * 获取地理分布热力图数据
     *
     * 返回省份级别的聚合数据，用于地图热力图可视化。
     * 数据结构包含省份名称、销售额、颜色等级等。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 热力图图表配置
     */
    ChartConfig getGeographicHeatmapData(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 机会评分分析 ====================

    /**
     * 获取区域机会评分
     *
     * 综合评估各区域的市场机会，评分公式：
     * totalScore = growthScore * 0.3 + baseScore * 0.25 + marginScore * 0.25 + penetrationScore * 0.2
     *
     * 评分维度说明：
     * - growthScore: 增长率评分，考虑同比/环比增长
     * - baseScore: 基数评分，考虑现有销售规模
     * - marginScore: 毛利率评分，考虑盈利能力
     * - penetrationScore: 渗透率评分，考虑市场覆盖程度
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 区域机会评分列表
     */
    List<RegionOpportunityScore> getRegionOpportunityScores(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 树图分析 ====================

    /**
     * 获取区域-省份销售占比树图
     *
     * 以树图形式展示区域和省份的销售额占比关系。
     * 一级节点为区域，二级节点为省份。
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 树图图表配置
     */
    ChartConfig getRegionProvinceTreemap(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 辅助方法 ====================

    /**
     * 获取所有区域列表
     *
     * @param factoryId 工厂ID
     * @return 区域名称列表
     */
    List<String> getAllRegions(String factoryId);

    /**
     * 获取指定区域下的所有省份
     *
     * @param factoryId 工厂ID
     * @param region    区域名称
     * @return 省份名称列表
     */
    List<String> getProvincesByRegion(String factoryId, String region);

    /**
     * 获取指定省份下的所有城市
     *
     * @param factoryId 工厂ID
     * @param province  省份名称
     * @return 城市名称列表
     */
    List<String> getCitiesByProvince(String factoryId, String province);
}
