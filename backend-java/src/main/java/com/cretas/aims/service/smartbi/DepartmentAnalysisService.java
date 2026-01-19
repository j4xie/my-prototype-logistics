package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ChartConfig;
import com.cretas.aims.dto.smartbi.DashboardResponse;
import com.cretas.aims.dto.smartbi.MetricResult;
import com.cretas.aims.dto.smartbi.RankingItem;

import java.time.LocalDate;
import java.util.List;

/**
 * 部门分析服务接口
 *
 * 提供 SmartBI 系统中部门维度的分析能力，包括：
 * - 部门业绩排名：按销售额、完成率排序
 * - 部门效率矩阵：人均产出 vs 人均成本的四象限分析
 * - 部门人员结构：人员分布统计
 * - 部门趋势对比：跨部门的销售趋势对比
 *
 * 参考规格文档: docs/architecture/smart-bi-ai-analysis-spec.md 第 6.3 节
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see MetricCalculatorService
 * @see ChartConfig
 */
public interface DepartmentAnalysisService {

    // ==================== 部门排名 ====================

    /**
     * 获取部门业绩排名
     *
     * 按销售额降序排列各部门，包含以下信息：
     * - 排名
     * - 部门名称
     * - 销售额
     * - 目标金额
     * - 完成率
     * - 预警级别（根据完成率自动计算）
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 部门排名列表，按销售额降序排列
     */
    List<RankingItem> getDepartmentRanking(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 部门详情 ====================

    /**
     * 获取部门详情仪表盘
     *
     * 返回指定部门的完整分析数据，包括：
     * - KPI卡片：销售额、完成率、人均产出、人均成本等
     * - 图表：销售趋势、人员分布、产品构成等
     * - 排行榜：部门内销售员排名
     *
     * @param factoryId  工厂ID
     * @param department 部门名称
     * @param startDate  开始日期
     * @param endDate    结束日期
     * @return 部门详情仪表盘响应
     */
    DashboardResponse getDepartmentDetail(String factoryId, String department, LocalDate startDate, LocalDate endDate);

    // ==================== 部门完成率 ====================

    /**
     * 获取各部门目标完成率
     *
     * 计算每个部门的目标完成率，并根据阈值设置预警级别：
     * - RED：低于 60%
     * - YELLOW：60% ~ 85%
     * - GREEN：高于 85%
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 各部门完成率指标列表
     */
    List<MetricResult> getDepartmentCompletionRates(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 部门效率矩阵 ====================

    /**
     * 获取部门效率矩阵图配置
     *
     * 生成部门效率散点图，用于四象限分析：
     * - X轴：人均产出 (SALES_PER_CAPITA)
     * - Y轴：人均成本 (COST_PER_CAPITA)
     * - 气泡大小：销售额
     * - 颜色：按部门区分
     *
     * 四象限含义：
     * - 第一象限（高产出、高成本）：需要优化效率
     * - 第二象限（低产出、高成本）：需要重点关注
     * - 第三象限（低产出、低成本）：表现平庸
     * - 第四象限（高产出、低成本）：明星部门
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 散点图配置
     */
    ChartConfig getDepartmentEfficiencyMatrix(String factoryId, LocalDate startDate, LocalDate endDate);

    // ==================== 部门人员分布 ====================

    /**
     * 获取部门人员分布图配置
     *
     * 生成部门人数分布环形图：
     * - 数值：人员数量 (headcount)
     * - 分类：部门名称
     * - 中心显示：总人数
     *
     * @param factoryId 工厂ID
     * @param date      统计日期（取该日期最近的人员数据）
     * @return 环形图配置
     */
    ChartConfig getDepartmentHeadcountChart(String factoryId, LocalDate date);

    // ==================== 部门趋势对比 ====================

    /**
     * 获取部门销售趋势对比图配置
     *
     * 生成多部门销售趋势折线图：
     * - X轴：时间（按 period 粒度）
     * - Y轴：销售额
     * - 系列：各部门
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param period    时间粒度：DAY（日）、WEEK（周）、MONTH（月）
     * @return 多折线图配置
     */
    ChartConfig getDepartmentTrendComparison(String factoryId, LocalDate startDate, LocalDate endDate, String period);

    // ==================== 部门销售占比 ====================

    /**
     * 获取部门销售占比变化图配置
     *
     * 生成堆叠面积图，展示各部门销售额占比的变化趋势：
     * - X轴：月份
     * - Y轴：销售额（堆叠百分比）
     * - 系列：各部门
     *
     * @param factoryId 工厂ID
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @return 堆叠面积图配置
     */
    ChartConfig getDepartmentShareTrend(String factoryId, LocalDate startDate, LocalDate endDate);
}
