package com.cretas.aims.service.smartbi;

import com.cretas.aims.dto.smartbi.ExcelParseResponse;
import com.cretas.aims.dto.smartbi.FieldMappingResult;
import com.cretas.aims.entity.smartbi.SmartBiChartTemplate;

import java.util.List;
import java.util.Map;

/**
 * 图表模板服务接口
 *
 * 提供图表模板的管理和配置构建功能，支持：
 * - 获取全局或工厂级别的模板配置
 * - 根据指标推荐模板
 * - 动态构建图表配置
 * - 缓存热重载
 *
 * 配置优先级：工厂级别配置 > 全局配置
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
public interface ChartTemplateService {

    /**
     * 获取所有激活的模板
     *
     * @return 所有激活的模板列表
     */
    List<SmartBiChartTemplate> getAllTemplates();

    /**
     * 按分类获取模板
     *
     * @param category 模板分类（如 SALES, FINANCE, PRODUCTION）
     * @return 该分类下所有激活的模板列表
     */
    List<SmartBiChartTemplate> getTemplatesByCategory(String category);

    /**
     * 获取适用于指定指标的模板
     *
     * @param metricCode 指标代码（如 SALES_AMOUNT, PROFIT_RATE）
     * @return 适用于该指标的模板列表
     */
    List<SmartBiChartTemplate> getTemplatesForMetric(String metricCode);

    /**
     * 获取单个模板（全局配置）
     *
     * @param templateCode 模板代码
     * @param factoryId    工厂ID，null 表示获取全局配置
     * @return 模板配置，如果不存在返回 null
     */
    SmartBiChartTemplate getTemplate(String templateCode, String factoryId);

    /**
     * 根据模板和数据构建图表配置
     *
     * @param templateCode 模板代码
     * @param data         图表数据
     * @return 构建好的图表配置 Map
     */
    Map<String, Object> buildChart(String templateCode, Map<String, Object> data);

    /**
     * 根据模板和数据构建图表配置（支持工厂级别配置）
     *
     * @param templateCode 模板代码
     * @param data         图表数据
     * @param factoryId    工厂ID
     * @return 构建好的图表配置 Map
     */
    Map<String, Object> buildChart(String templateCode, Map<String, Object> data, String factoryId);

    /**
     * 智能推荐图表类型
     *
     * 根据指标特性和数据特征推荐最适合的图表类型：
     * - 时间序列且数据点 > 1 → LINE
     * - 指标代码含 "ratio" 或 "rate" → RADAR 或 GAUGE
     * - 指标代码含 "structure" → PIE
     * - 默认 → BAR
     *
     * @param metricCode       指标代码
     * @param dataPointCount   数据点数量
     * @param hasTimeDimension 是否有时间维度
     * @return 推荐的图表类型
     */
    String recommendChartType(String metricCode, int dataPointCount, boolean hasTimeDimension);

    /**
     * 构建图表配置并生成 AI 分析
     *
     * 除了返回标准的图表配置外，还会调用 LLM 生成基于图表数据的分析文本。
     * 分析文本会作为 "aiAnalysis" 字段添加到返回的 Map 中。
     *
     * @param templateCode 模板代码
     * @param data         图表数据
     * @param factoryId    工厂ID（可选）
     * @return 包含图表配置和 AI 分析的 Map
     */
    Map<String, Object> buildChartWithAnalysis(String templateCode, Map<String, Object> data, String factoryId);

    /**
     * 重新加载缓存
     *
     * 清除所有缓存并从数据库重新加载模板配置
     * 用于配置更新后的热重载
     */
    void reload();

    /**
     * 获取利润表专用分析模板
     *
     * 返回专门用于利润表数据分析的图表模板，包括：
     * - profit_trend: 利润趋势分析图（收入、成本、毛利的月度趋势）
     * - budget_vs_actual: 预实对比分析图（预算完成率、差异分析）
     * - cost_structure_detail: 成本结构详细分析图（成本构成双层饼图）
     *
     * @return 利润表专用模板列表
     */
    List<SmartBiChartTemplate> getProfitStatementTemplates();

    /**
     * 获取利润表专用分析模板（支持工厂级别配置）
     *
     * @param factoryId 工厂ID
     * @return 利润表专用模板列表
     */
    List<SmartBiChartTemplate> getProfitStatementTemplates(String factoryId);

    /**
     * 创建新模板
     *
     * @param template 模板实体
     * @return 保存后的模板
     */
    SmartBiChartTemplate createTemplate(SmartBiChartTemplate template);

    /**
     * 更新模板
     *
     * @param id       模板ID
     * @param template 更新的模板内容
     * @return 更新后的模板
     */
    SmartBiChartTemplate updateTemplate(Long id, SmartBiChartTemplate template);

    /**
     * 删除模板（软删除）
     *
     * @param id 模板ID
     */
    void deleteTemplate(Long id);

    /**
     * 智能匹配最佳图表模板
     *
     * 根据字段映射结果和数据特征计算每个模板的匹配分数，返回最佳匹配的模板。
     * 匹配规则：
     * - budget_amount + actual_amount → budget_vs_actual (预实对比)
     * - revenue + cost + profit + 时间序列 → profit_trend (利润趋势)
     * - 多个成本项 + 无时间序列 → cost_structure (成本结构饼图)
     * - yoy_amount 或 mom_amount → yoy_comparison (同环比分析)
     * - quantity + amount + 时间序列 → sales_trend (销售趋势)
     *
     * @param fieldMappings 字段映射结果列表
     * @param parseResult   Excel 解析结果
     * @return 最佳匹配的图表模板，如果没有匹配返回默认模板
     */
    SmartBiChartTemplate matchBestTemplate(List<FieldMappingResult> fieldMappings, ExcelParseResponse parseResult);

    /**
     * 智能匹配最佳图表模板（支持工厂级别配置）
     *
     * @param fieldMappings 字段映射结果列表
     * @param parseResult   Excel 解析结果
     * @param factoryId     工厂ID（可选）
     * @return 最佳匹配的图表模板，如果没有匹配返回默认模板
     */
    SmartBiChartTemplate matchBestTemplate(List<FieldMappingResult> fieldMappings, ExcelParseResponse parseResult, String factoryId);
}
