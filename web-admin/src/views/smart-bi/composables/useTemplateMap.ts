/**
 * Week 6 — static mapping: which templates show on which page + their display labels.
 *
 * Why hardcoded instead of backend-driven:
 * - Page layout is a UI concern; backend shouldn't own UX decisions.
 * - Template codes evolve via PR; FE changes in lockstep.
 * - CI would catch a rename when all requested codes return as
 *   never_materialized_codes (100% miss rate).
 */

/** Pages → template_code[] (order matters, renders top-to-bottom left-to-right) */
export const PAGE_TEMPLATE_MAP: Record<string, readonly string[]> = {
  dashboard: [
    'monthly_trend',
    'top_n_by_dim',
    'category_distribution',
    'anomaly_detection',
  ],
  finance: [
    'profit_loss_statement',
    'revenue_management_report',
    'stored_value_card_consumption',
    'groupon_channel_breakdown',
  ],
  trend: [
    'monthly_trend',
    'period_comparison_trend',
    'weekday_weekend_pattern',
    'monthly_anomaly',
  ],
  restaurantv2: [
    'dish_sales_top_n',
    'dish_slow_movers',
    'dish_category_breakdown',
    'combo_usage_rate',
    'time_slot_revenue',
  ],
} as const;

export type TemplatePageKey = keyof typeof PAGE_TEMPLATE_MAP;

/** Stable 中文 display titles — do NOT use AI-generated titles, they drift. */
export const TEMPLATE_TITLES: Record<string, string> = {
  monthly_trend: '时间趋势',
  top_n_by_dim: '维度 Top N',
  category_distribution: '分类分布',
  anomaly_detection: '异常检测',
  pareto_analysis: '帕累托分析',
  profit_loss_statement: '利润表',
  revenue_management_report: '营收管理报表',
  stored_value_card_consumption: '储值卡消费分析',
  groupon_channel_breakdown: '团购渠道明细',
  period_comparison_trend: '同比环比趋势',
  weekday_weekend_pattern: '工作日/周末规律',
  monthly_anomaly: '月度异常',
  dish_sales_top_n: '热销菜品 Top N',
  dish_slow_movers: '滞销菜品',
  dish_category_breakdown: '菜品分类明细',
  combo_usage_rate: '套餐使用率',
  time_slot_revenue: '时段营业额',
  dish_by_table_type: '桌位类型消费',
  dish_time_slot_matrix: '菜品 × 时段矩阵',
};

/** What fields must be present in the source Excel for this template to match.
 * Used in empty-state copy only — no runtime enforcement. */
export const TEMPLATE_REQUIRED_FIELDS: Record<string, string> = {
  profit_loss_statement: '营业收入 / 成本 / 毛利',
  revenue_management_report: '营业额 / 渠道 / 门店',
  stored_value_card_consumption: '储值卡消费金额 / 会员ID',
  groupon_channel_breakdown: '渠道 / 代金券类型 / 消费金额',
  dish_sales_top_n: '菜品名称 / 销量 / 金额',
  dish_slow_movers: '菜品名称 / 销量',
  dish_category_breakdown: '菜品分类 / 销售数据',
  combo_usage_rate: '套餐使用记录',
  time_slot_revenue: '时间 / 营业额',
  monthly_trend: '时间字段 + 数值指标',
  period_comparison_trend: '时间字段 + 数值指标 (≥2 月)',
  weekday_weekend_pattern: '每日营业数据',
  monthly_anomaly: '月度数值序列 (≥3 月)',
  top_n_by_dim: '类别维度 + 数值指标',
  category_distribution: '分类维度 + 数值指标',
  anomaly_detection: '数值序列',
};

export function getPageCodes(pageKey: string): readonly string[] {
  return PAGE_TEMPLATE_MAP[pageKey] || [];
}

export function getTemplateTitle(code: string): string {
  return TEMPLATE_TITLES[code] || code;
}

export function getRequiredFields(code: string): string {
  return TEMPLATE_REQUIRED_FIELDS[code] || '对应业务数据';
}
