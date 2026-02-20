package com.cretas.aims.entity.smartbi;

import com.cretas.aims.entity.BaseEntity;
import lombok.*;
import lombok.experimental.SuperBuilder;

import javax.persistence.*;

/**
 * SmartBI 图表模板配置实体
 *
 * 支持动态配置图表模板，提供可视化展示的预设模板。
 *
 * 图表类型：
 * - LINE: 折线图，适用于趋势分析
 * - BAR: 柱状图，适用于对比分析
 * - PIE: 饼图，适用于占比分析
 * - RADAR: 雷达图，适用于多维度对比
 * - SCATTER: 散点图，适用于相关性分析
 * - HEATMAP: 热力图，适用于矩阵数据展示
 * - GAUGE: 仪表盘，适用于单指标展示
 * - FUNNEL: 漏斗图，适用于转化分析
 *
 * 模板分类：
 * - GENERAL: 通用模板
 * - FINANCE: 财务相关
 * - SALES: 销售相关
 * - INVENTORY: 库存相关
 * - PRODUCTION: 生产相关
 * - QUALITY: 质量相关
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-21
 */
@Entity
@Table(name = "smart_bi_chart_templates",
       indexes = {
           @Index(name = "idx_template_code", columnList = "template_code"),
           @Index(name = "idx_template_factory", columnList = "factory_id"),
           @Index(name = "idx_template_active", columnList = "is_active"),
           @Index(name = "idx_template_chart_type", columnList = "chart_type"),
           @Index(name = "idx_template_category", columnList = "category"),
           @Index(name = "idx_template_sort", columnList = "sort_order")
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_template_factory",
                            columnNames = {"template_code", "factory_id"})
       })
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SmartBiChartTemplate extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 模板代码（唯一标识）
     * 如：sales_trend_line, inventory_pie, production_bar
     */
    @Column(name = "template_code", nullable = false, length = 64)
    private String templateCode;

    /**
     * 模板名称（用于显示）
     * 如：销售趋势图, 库存占比图, 产量对比图
     */
    @Column(name = "template_name", nullable = false, length = 128)
    private String templateName;

    /**
     * 图表类型：LINE / BAR / PIE / RADAR / SCATTER / HEATMAP / GAUGE / FUNNEL
     */
    @Column(name = "chart_type", nullable = false, length = 32)
    private String chartType;

    /**
     * 模板分类：GENERAL / FINANCE / SALES / INVENTORY / PRODUCTION / QUALITY
     */
    @Builder.Default
    @Column(name = "category", length = 32)
    private String category = CATEGORY_GENERAL;

    /**
     * 适用的指标代码列表（JSON 数组格式）
     * 如：["sales_amount", "order_count", "avg_order_value"]
     */
    @Column(name = "applicable_metrics", columnDefinition = "JSON")
    private String applicableMetrics;

    /**
     * 图表配置选项（JSON 格式）
     * 包含 ECharts 或其他图表库的配置项
     * 如：{"title": {"show": true}, "legend": {"position": "bottom"}}
     */
    @Column(name = "chart_options", columnDefinition = "JSON")
    private String chartOptions;

    /**
     * 数据映射配置（JSON 格式）
     * 定义数据字段与图表维度的映射关系
     * 如：{"xAxis": "date", "yAxis": "value", "series": "category"}
     */
    @Column(name = "data_mapping", columnDefinition = "JSON")
    private String dataMapping;

    /**
     * 布局配置（JSON 格式）
     * 定义图表在仪表板中的位置和大小
     * 如：{"width": 6, "height": 4, "minWidth": 3, "minHeight": 2}
     */
    @Column(name = "layout_config", columnDefinition = "JSON")
    private String layoutConfig;

    /**
     * 模板描述
     */
    @Column(name = "description", length = 255)
    private String description;

    /**
     * 缩略图 URL
     */
    @Column(name = "thumbnail_url", length = 255)
    private String thumbnailUrl;

    /**
     * 工厂ID，null 表示全局模板
     */
    @Column(name = "factory_id", length = 32)
    private String factoryId;

    /**
     * 是否启用
     */
    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    /**
     * 排序顺序
     */
    @Builder.Default
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /**
     * AI 分析提示词模板
     * 支持变量替换，如 {{dataJson}} 会被替换为图表数据的 JSON 格式
     */
    @Column(name = "analysis_prompt", columnDefinition = "TEXT")
    private String analysisPrompt;

    /**
     * 是否启用 AI 分析
     */
    @Builder.Default
    @Column(name = "analysis_enabled")
    private Boolean analysisEnabled = true;

    /**
     * AI 分析缓存时间（秒）
     */
    @Builder.Default
    @Column(name = "analysis_cache_ttl")
    private Integer analysisCacheTtl = 300;

    // ==================== 图表类型常量 ====================

    /** 折线图 */
    public static final String TYPE_LINE = "LINE";
    /** 柱状图 */
    public static final String TYPE_BAR = "BAR";
    /** 饼图 */
    public static final String TYPE_PIE = "PIE";
    /** 雷达图 */
    public static final String TYPE_RADAR = "RADAR";
    /** 散点图 */
    public static final String TYPE_SCATTER = "SCATTER";
    /** 热力图 */
    public static final String TYPE_HEATMAP = "HEATMAP";
    /** 仪表盘 */
    public static final String TYPE_GAUGE = "GAUGE";
    /** 漏斗图 */
    public static final String TYPE_FUNNEL = "FUNNEL";
    /** 面积图 */
    public static final String TYPE_AREA = "AREA";
    /** 堆叠柱状图 */
    public static final String TYPE_STACKED_BAR = "STACKED_BAR";
    /** 环形图 */
    public static final String TYPE_DOUGHNUT = "DOUGHNUT";
    /** 组合图 */
    public static final String TYPE_COMBO = "COMBO";

    // ==================== 模板分类常量 ====================

    /** 通用 */
    public static final String CATEGORY_GENERAL = "GENERAL";
    /** 财务 */
    public static final String CATEGORY_FINANCE = "FINANCE";
    /** 销售 */
    public static final String CATEGORY_SALES = "SALES";
    /** 库存 */
    public static final String CATEGORY_INVENTORY = "INVENTORY";
    /** 生产 */
    public static final String CATEGORY_PRODUCTION = "PRODUCTION";
    /** 质量 */
    public static final String CATEGORY_QUALITY = "QUALITY";
    /** 人力资源 */
    public static final String CATEGORY_HR = "HR";
    /** 物流 */
    public static final String CATEGORY_LOGISTICS = "LOGISTICS";

    // ==================== 利润表专用模板代码常量 ====================

    /** 利润趋势分析图 - 收入、成本、毛利的月度趋势 */
    public static final String TEMPLATE_PROFIT_TREND = "profit_trend";
    /** 预实对比分析图 - 预算完成率、差异分析 */
    public static final String TEMPLATE_BUDGET_VS_ACTUAL = "budget_vs_actual";
    /** 成本结构详细分析图 - 成本构成双层饼图 */
    public static final String TEMPLATE_COST_STRUCTURE_DETAIL = "cost_structure_detail";

    // ==================== 其他财务模板代码常量 ====================

    /** 财务健康度雷达图 */
    public static final String TEMPLATE_FINANCE_HEALTH_RADAR = "finance_health_radar";
    /** 杜邦分析图 */
    public static final String TEMPLATE_DUPONT_ANALYSIS = "dupont_analysis";
    /** 现金流量瀑布图 */
    public static final String TEMPLATE_CASHFLOW_WATERFALL = "cashflow_waterfall";
    /** 盈亏平衡分析图 */
    public static final String TEMPLATE_BREAKEVEN_ANALYSIS = "breakeven_analysis";
    /** 成本结构分析图 */
    public static final String TEMPLATE_COST_STRUCTURE_PIE = "cost_structure_pie";
    /** 财务比率趋势图 */
    public static final String TEMPLATE_FINANCE_RATIO_TREND = "finance_ratio_trend";
    /** 周转率对比分析 */
    public static final String TEMPLATE_TURNOVER_COMPARISON = "turnover_comparison";
    /** KPI 仪表盘 */
    public static final String TEMPLATE_KPI_GAUGE = "kpi_gauge";
    /** 预算达成分析图 */
    public static final String TEMPLATE_BUDGET_ACHIEVEMENT = "budget_achievement";
    /** 同比环比分析图 */
    public static final String TEMPLATE_YOY_MOM_COMPARISON = "yoy_mom_comparison";

    // ==================== 便捷方法 ====================

    /**
     * 判断是否为折线图
     */
    public boolean isLineChart() {
        return TYPE_LINE.equals(this.chartType);
    }

    /**
     * 判断是否为柱状图
     */
    public boolean isBarChart() {
        return TYPE_BAR.equals(this.chartType);
    }

    /**
     * 判断是否为饼图
     */
    public boolean isPieChart() {
        return TYPE_PIE.equals(this.chartType);
    }

    /**
     * 判断是否为雷达图
     */
    public boolean isRadarChart() {
        return TYPE_RADAR.equals(this.chartType);
    }

    /**
     * 判断是否为全局模板（无工厂ID）
     */
    public boolean isGlobalTemplate() {
        return this.factoryId == null;
    }

    /**
     * 判断是否为工厂级模板
     */
    public boolean isFactoryTemplate() {
        return this.factoryId != null;
    }

    /**
     * 判断是否为利润表专用模板
     */
    public boolean isProfitStatementTemplate() {
        return TEMPLATE_PROFIT_TREND.equals(this.templateCode)
                || TEMPLATE_BUDGET_VS_ACTUAL.equals(this.templateCode)
                || TEMPLATE_COST_STRUCTURE_DETAIL.equals(this.templateCode);
    }

    /**
     * 判断是否为财务分析模板
     */
    public boolean isFinanceTemplate() {
        return CATEGORY_FINANCE.equals(this.category);
    }

    /**
     * 获取所有利润表专用模板代码
     *
     * @return 利润表专用模板代码数组
     */
    public static String[] getProfitStatementTemplateCodes() {
        return new String[]{
                TEMPLATE_PROFIT_TREND,
                TEMPLATE_BUDGET_VS_ACTUAL,
                TEMPLATE_COST_STRUCTURE_DETAIL
        };
    }
}
