package com.cretas.aims.service.smartbi;

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
     * 重新加载缓存
     *
     * 清除所有缓存并从数据库重新加载模板配置
     * 用于配置更新后的热重载
     */
    void reload();

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
}
