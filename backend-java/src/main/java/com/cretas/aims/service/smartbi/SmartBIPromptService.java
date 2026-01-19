package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.DashboardResponse;

import java.util.Map;

/**
 * SmartBI Prompt 服务接口
 *
 * 提供 AI 分析所需的 Prompt 模板管理和填充功能，包括：
 * - 获取各类分析的 Prompt 模板
 * - 使用数据填充模板生成完整 Prompt
 * - 支持经营概览、销售、部门、区域、财务分析和通用问答
 *
 * Prompt 模板使用 {{variable}} 格式的占位符，支持嵌套对象和数组数据。
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 * @see DashboardResponse
 */
public interface SmartBIPromptService {

    // ==================== 模板管理 ====================

    /**
     * 获取指定分析类型的 Prompt 模板
     *
     * 支持的分析类型：
     * - OVERVIEW: 经营概览分析
     * - SALES: 销售分析
     * - DEPARTMENT: 部门分析
     * - REGION: 区域分析
     * - FINANCE: 财务分析
     * - QA: 通用问答
     *
     * @param analysisType 分析类型（不区分大小写）
     * @return Prompt 模板字符串，如果类型不存在则返回 null
     */
    String getPromptTemplate(String analysisType);

    /**
     * 使用数据填充 Prompt 模板
     *
     * 将模板中的 {{variable}} 占位符替换为实际数据值。
     * 支持嵌套对象（如 {{kpi.sales}}）和 JSON 序列化复杂对象。
     *
     * @param analysisType 分析类型
     * @param data         用于填充模板的数据映射
     * @return 填充后的完整 Prompt 字符串
     * @throws IllegalArgumentException 如果分析类型不存在
     */
    String fillPromptTemplate(String analysisType, Map<String, Object> data);

    // ==================== 经营概览分析 ====================

    /**
     * 获取经营概览分析 Prompt
     *
     * 基于仪表盘数据生成用于 AI 分析的 Prompt，包含：
     * - KPI 卡片数据（销售额、订单数、完成率等）
     * - 图表数据（趋势、分布等）
     * - 排名数据（销售员、产品、客户等）
     * - 现有的 AI 洞察和建议
     *
     * @param dashboard 仪表盘响应数据
     * @return 完整的分析 Prompt
     */
    String getOverviewAnalysisPrompt(DashboardResponse dashboard);

    // ==================== 销售分析 ====================

    /**
     * 获取销售分析 Prompt
     *
     * 基于销售数据生成用于 AI 分析的 Prompt，包含：
     * - 销售额、订单数、客单价等 KPI
     * - 销售趋势数据
     * - 销售员排名和表现
     * - 产品销售分布
     * - 客户贡献分析
     *
     * @param salesData 销售相关数据映射，应包含：
     *                  - kpiCards: KPI 指标列表
     *                  - trendData: 趋势数据
     *                  - rankings: 排名数据
     *                  - productDistribution: 产品分布
     *                  - customerData: 客户数据
     * @return 完整的分析 Prompt
     */
    String getSalesAnalysisPrompt(Map<String, Object> salesData);

    // ==================== 部门分析 ====================

    /**
     * 获取部门分析 Prompt
     *
     * 基于部门数据生成用于 AI 分析的 Prompt，包含：
     * - 部门整体业绩概况
     * - 部门间对比分析
     * - 部门内成员表现
     * - 部门目标完成情况
     *
     * @param deptData 部门相关数据映射，应包含：
     *                 - departmentList: 部门列表
     *                 - deptMetrics: 部门指标
     *                 - memberPerformance: 成员表现
     *                 - targetCompletion: 目标完成率
     * @return 完整的分析 Prompt
     */
    String getDepartmentAnalysisPrompt(Map<String, Object> deptData);

    // ==================== 区域分析 ====================

    /**
     * 获取区域分析 Prompt
     *
     * 基于区域数据生成用于 AI 分析的 Prompt，包含：
     * - 区域销售分布
     * - 区域间业绩对比
     * - 区域增长趋势
     * - 区域潜力评估
     *
     * @param regionData 区域相关数据映射，应包含：
     *                   - regionList: 区域列表
     *                   - regionMetrics: 区域指标
     *                   - distributionData: 分布数据
     *                   - opportunityScores: 机会评分
     * @return 完整的分析 Prompt
     */
    String getRegionAnalysisPrompt(Map<String, Object> regionData);

    // ==================== 财务分析 ====================

    /**
     * 获取财务分析 Prompt
     *
     * 基于财务数据生成用于 AI 分析的 Prompt，包含：
     * - 收入、成本、利润概况
     * - 毛利率、净利率分析
     * - 费用结构分析
     * - 应收账款、现金流分析
     *
     * @param financeData 财务相关数据映射，应包含：
     *                    - revenue: 收入数据
     *                    - cost: 成本数据
     *                    - profit: 利润数据
     *                    - margins: 利润率数据
     *                    - expenses: 费用数据
     *                    - cashFlow: 现金流数据
     * @return 完整的分析 Prompt
     */
    String getFinanceAnalysisPrompt(Map<String, Object> financeData);

    // ==================== 通用问答 ====================

    /**
     * 获取通用问答 Prompt
     *
     * 基于用户查询和上下文数据生成用于 AI 回答的 Prompt。
     * 用于处理用户的自然语言问题，如：
     * - "上个月销售额是多少？"
     * - "哪个销售员表现最好？"
     * - "产品 A 的销量趋势如何？"
     *
     * @param userQuery 用户的自然语言查询
     * @param context   上下文数据映射，可包含：
     *                  - currentData: 当前数据快照
     *                  - historicalData: 历史数据
     *                  - metadata: 元数据信息
     *                  - conversationHistory: 对话历史
     * @return 完整的问答 Prompt
     */
    String getQAPrompt(String userQuery, Map<String, Object> context);

    // ==================== 辅助方法 ====================

    /**
     * 检查指定分析类型的模板是否存在
     *
     * @param analysisType 分析类型
     * @return 如果模板存在返回 true，否则返回 false
     */
    boolean hasTemplate(String analysisType);

    /**
     * 获取所有支持的分析类型
     *
     * @return 支持的分析类型列表
     */
    java.util.List<String> getSupportedAnalysisTypes();

    /**
     * 刷新模板缓存
     *
     * 从资源文件重新加载所有模板，用于模板更新后的热加载。
     */
    void refreshTemplateCache();
}
