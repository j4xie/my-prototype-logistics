package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.*;
import com.cretas.aims.entity.smartbi.enums.AlertLevel;
import com.cretas.aims.util.DateRangeUtils.DateRange;

import java.math.BigDecimal;
import java.util.List;

/**
 * 推荐和预警服务接口
 *
 * 提供 SmartBI 系统中的智能推荐和预警能力，包括：
 * - 销售预警：销售完成率、增长率监控
 * - 财务预警：应收账款账龄、成本超支监控
 * - 部门预警：人均产出、部门效能监控
 * - 综合建议：基于分析数据生成智能建议
 * - 激励方案：阶梯奖励计算和激励消息生成
 * - AI洞察：仪表盘数据的智能洞察汇总
 *
 * 预警阈值配置：
 * - 销售完成率: &lt; 60% → RED, &lt; 80% → YELLOW
 * - 应收账龄: &gt; 90天 → RED, &gt; 60天 → YELLOW
 * - 成本超预算: &gt; 20% → RED, &gt; 10% → YELLOW
 * - 环比下降: &gt; 20% → RED, &gt; 10% → YELLOW
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see Alert
 * @see Recommendation
 * @see IncentivePlan
 * @see AlertLevel
 */
public interface RecommendationService {

    // ==================== 预警生成 ====================

    /**
     * 生成销售预警
     *
     * 基于销售数据分析，生成以下类型的预警：
     * - 目标完成率预警：低于阈值时触发
     * - 环比增长预警：下降超过阈值时触发
     * - 销售员个人预警：表现异常时触发
     * - 产品销售预警：某产品销量异常时触发
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 销售预警列表
     */
    List<Alert> generateSalesAlerts(String factoryId, DateRange range);

    /**
     * 生成财务预警
     *
     * 基于财务数据分析，生成以下类型的预警：
     * - 应收账款账龄预警：超过账期时触发
     * - 成本超支预警：成本超过预算时触发
     * - 利润率预警：毛利率/净利率过低时触发
     * - 现金流预警：资金紧张时触发
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 财务预警列表
     */
    List<Alert> generateFinanceAlerts(String factoryId, DateRange range);

    /**
     * 生成部门预警
     *
     * 基于部门数据分析，生成以下类型的预警：
     * - 人均产出预警：低于标准时触发
     * - 部门目标预警：完成率过低时触发
     * - 人员效能预警：效率异常时触发
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 部门预警列表
     */
    List<Alert> generateDepartmentAlerts(String factoryId, DateRange range);

    /**
     * 生成综合预警
     *
     * 汇总所有类型的预警，按严重程度排序。
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 综合预警列表（按严重程度降序）
     */
    List<Alert> generateAllAlerts(String factoryId, DateRange range);

    // ==================== 建议生成 ====================

    /**
     * 生成综合建议
     *
     * 根据分析类型生成针对性的智能建议。
     *
     * @param factoryId    工厂ID
     * @param analysisType 分析类型: sales(销售), finance(财务), department(部门), all(综合)
     * @return 建议列表（按优先级排序）
     */
    List<Recommendation> generateRecommendations(String factoryId, String analysisType);

    /**
     * 生成销售提升建议
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 销售提升建议列表
     */
    List<Recommendation> generateSalesRecommendations(String factoryId, DateRange range);

    /**
     * 生成成本优化建议
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 成本优化建议列表
     */
    List<Recommendation> generateCostRecommendations(String factoryId, DateRange range);

    /**
     * 生成客户维护建议
     *
     * @param factoryId 工厂ID
     * @param range     日期范围
     * @return 客户维护建议列表
     */
    List<Recommendation> generateCustomerRecommendations(String factoryId, DateRange range);

    // ==================== 激励方案生成 ====================

    /**
     * 生成激励方案
     *
     * 根据目标类型生成阶梯激励方案。
     *
     * @param factoryId  工厂ID
     * @param targetType 目标类型: salesperson(销售员), department(部门), region(区域)
     * @return 激励方案
     */
    IncentivePlan generateIncentivePlan(String factoryId, String targetType);

    /**
     * 生成销售员激励方案
     *
     * @param factoryId      工厂ID
     * @param salespersonId  销售员ID
     * @param range          日期范围
     * @return 销售员激励方案
     */
    IncentivePlan generateSalespersonIncentivePlan(String factoryId, String salespersonId, DateRange range);

    /**
     * 生成部门激励方案
     *
     * @param factoryId    工厂ID
     * @param departmentId 部门ID
     * @param range        日期范围
     * @return 部门激励方案
     */
    IncentivePlan generateDepartmentIncentivePlan(String factoryId, String departmentId, DateRange range);

    // ==================== 预警级别计算 ====================

    /**
     * 计算销售员预警级别
     *
     * 根据完成率和增长率计算综合预警级别：
     * - 完成率 &lt; 60% 或增长率 &lt; -20% → RED
     * - 完成率 &lt; 80% 或增长率 &lt; -10% → YELLOW
     * - 其他 → GREEN
     *
     * @param completionRate 目标完成率（百分比）
     * @param growthRate     环比增长率（百分比）
     * @return 预警级别
     */
    AlertLevel calculateSalespersonAlertLevel(BigDecimal completionRate, BigDecimal growthRate);

    /**
     * 计算应收账款预警级别
     *
     * 根据账龄和金额计算预警级别：
     * - 账龄 &gt; 90天 或 金额 &gt; 100万 → RED
     * - 账龄 &gt; 60天 或 金额 &gt; 50万 → YELLOW
     * - 其他 → GREEN
     *
     * @param agingDays 账龄天数
     * @param amount    应收金额
     * @return 预警级别
     */
    AlertLevel calculateReceivableAlertLevel(int agingDays, BigDecimal amount);

    /**
     * 计算成本预警级别
     *
     * 根据成本率和预算偏差计算预警级别：
     * - 成本超预算 &gt; 20% → RED
     * - 成本超预算 &gt; 10% → YELLOW
     * - 其他 → GREEN
     *
     * @param costRate        成本率（百分比）
     * @param budgetVariance  预算偏差（百分比，正值表示超支）
     * @return 预警级别
     */
    AlertLevel calculateCostAlertLevel(BigDecimal costRate, BigDecimal budgetVariance);

    /**
     * 计算人均产出预警级别
     *
     * 根据人均销售额计算预警级别：
     * - 人均 &lt; 50,000 → RED
     * - 人均 &lt; 80,000 → YELLOW
     * - 其他 → GREEN
     *
     * @param perCapitaSales 人均销售额
     * @return 预警级别
     */
    AlertLevel calculatePerCapitaAlertLevel(BigDecimal perCapitaSales);

    // ==================== AI洞察生成 ====================

    /**
     * 生成AI洞察摘要
     *
     * 基于仪表盘数据生成智能洞察列表，包括：
     * - 关键指标异常分析
     * - 趋势变化分析
     * - 排名变化分析
     * - 综合建议
     *
     * @param dashboard 仪表盘响应数据
     * @return AI洞察列表（按重要程度排序）
     */
    List<AIInsight> generateInsightSummary(DashboardResponse dashboard);

    /**
     * 生成基于预警的AI洞察
     *
     * 将预警信息转换为AI洞察格式。
     *
     * @param alerts 预警列表
     * @return AI洞察列表
     */
    List<AIInsight> generateInsightsFromAlerts(List<Alert> alerts);

    /**
     * 生成基于建议的AI洞察
     *
     * 将建议信息转换为AI洞察格式。
     *
     * @param recommendations 建议列表
     * @return AI洞察列表
     */
    List<AIInsight> generateInsightsFromRecommendations(List<Recommendation> recommendations);
}
