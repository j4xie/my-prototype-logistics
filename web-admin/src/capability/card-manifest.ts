/**
 * Card manifest — single source of truth for capability-gated UI cards.
 *
 * Per 数据织网/02-A-能力驱动渲染.md v1.5 §2.2.3 + §6.2 + §6.3.
 *
 * Each entry MUST correspond to a `<CapabilityGate :card-id="X" :requires="[...]"`
 * usage somewhere in views/, OR be marked as TemplateGrid-rendered in description
 * (Day 10 lint suppresses warnings for entries with "TemplateGrid" in description).
 *
 * fallbackMode default = 'placeholder' (teach customer what to upload).
 * Use 'hide' for: admin pages, experiments, RBAC-restricted cards (§6.3).
 *
 * Apr 26 2026 cleanup (Phase 4.5): annotated 12 TemplateGrid-rendered entries to
 * suppress lint warnings; removed 2 stale entries (restaurant_overview_avg/traffic
 * — overview page doesn't render those KPIs, they live on Dashboard).
 */
import type { CardManifestEntry } from '@/types/capability';

export const CARD_MANIFEST: CardManifestEntry[] = [
  // === Dashboard (10) — spec §6.2 ===
  // 8 wrapped via <CapabilityGate> in Dashboard.vue (Day 8)
  { id: 'dashboard_revenue_month', page: '/smart-bi/dashboard', title: '本月销售额',
    requires: ['date', 'net_amount'] },
  { id: 'dashboard_order_count', page: '/smart-bi/dashboard', title: '订单数量',
    requires: ['date', 'source_bill_no'] },
  { id: 'dashboard_avg_bill', page: '/smart-bi/dashboard', title: '客单价',
    requires: ['source_bill_no', 'net_amount'] },
  { id: 'dashboard_active_customers', page: '/smart-bi/dashboard', title: '活跃客户',
    requires: ['customer_count'] },
  { id: 'dashboard_region_sales', page: '/smart-bi/dashboard', title: '区域销售分布',
    requires: ['store_name', 'net_amount'] },
  { id: 'dashboard_dept_ranking', page: '/smart-bi/dashboard', title: '部门排行',
    requires: ['staff_name', 'net_amount'] },
  { id: 'dashboard_sales_trend', page: '/smart-bi/dashboard', title: '销售趋势图',
    requires: ['date', 'net_amount'] },
  { id: 'dashboard_product_share', page: '/smart-bi/dashboard', title: '产品占比',
    requires: ['combo_string', 'net_amount'] },
  // 2 TemplateGrid-rendered (page-key='dashboard'), capability-aware via backend template_status
  { id: 'dashboard_inventory_alert', page: '/smart-bi/dashboard', title: '库存预警',
    requires: ['product_name'],
    description: 'TemplateGrid-rendered (page-key=dashboard); B 阶段引入 inventory_item / stock_qty 后可独立 wrap' },
  { id: 'dashboard_top_dishes', page: '/smart-bi/dashboard', title: '菜品 Top 10',
    requires: ['store_name', 'combo_string'],
    description: 'TemplateGrid-rendered (page-key=dashboard)' },

  // === Restaurant analytics overview (3) ===
  // 3 wrapped (Day 9). 2 entries removed Apr 26 (avg + traffic 在 overview 页无对应卡;
  // 客单价 实际在 Dashboard 包装为 dashboard_avg_bill, 客流量 此页无 customer_count 卡).
  { id: 'restaurant_overview_revenue', page: '/restaurant/analytics/overview', title: '总营收',
    requires: ['date', 'net_amount'] },
  { id: 'restaurant_overview_stores', page: '/restaurant/analytics/overview', title: '门店数',
    requires: ['store_name'] },
  { id: 'restaurant_overview_top_dish', page: '/restaurant/analytics/overview', title: '热销菜品',
    requires: ['combo_string', 'qty_sold'] },

  // === Restaurant analytics menu-board (6) ===
  // 2 wrapped (Day 9), 4 TemplateGrid-rendered or live in different page
  { id: 'menu_top_dishes', page: '/restaurant/analytics/menu-board', title: '菜品销量 Top',
    requires: ['combo_string'] },
  { id: 'menu_dish_revenue', page: '/restaurant/analytics/menu-board', title: '菜品营收',
    requires: ['combo_string', 'net_amount'] },
  { id: 'menu_slow_movers', page: '/restaurant/analytics/menu-board', title: '滞销菜品',
    requires: ['combo_string'],
    description: 'TemplateGrid-rendered (page-key=menu); 实际由 v-for sub-element of summary row 显示' },
  { id: 'menu_category_breakdown', page: '/restaurant/analytics/menu-board', title: '品类占比',
    requires: ['combo_string'],
    description: 'TemplateGrid-rendered; 在 overview 页而非 menu-board' },
  { id: 'menu_combo_usage', page: '/restaurant/analytics/menu-board', title: '套餐使用率',
    requires: ['combo_string'],
    description: 'TemplateGrid-rendered (page-key=menu)' },
  { id: 'menu_dish_by_table', page: '/restaurant/analytics/menu-board', title: '桌型菜品',
    requires: ['table_no', 'combo_string'],
    description: 'TemplateGrid-rendered (page-key=menu)' },

  // === Trends (4) ===
  // 1 wrapped (Day 9), 3 TemplateGrid-rendered
  { id: 'trends_monthly', page: '/smart-bi/analytics/trends', title: '月度趋势',
    requires: ['date', 'net_amount'] },
  { id: 'trends_anomaly', page: '/smart-bi/analytics/trends', title: '异常检测',
    requires: ['date', 'net_amount'],
    description: 'TemplateGrid-rendered (page-key=trend)' },
  { id: 'trends_weekday', page: '/smart-bi/analytics/trends', title: '工作日 vs 周末',
    requires: ['date', 'net_amount'],
    description: 'TemplateGrid-rendered (page-key=trend)' },
  { id: 'trends_period_comparison', page: '/smart-bi/analytics/trends', title: '周期对比',
    requires: ['date', 'net_amount'],
    description: 'TemplateGrid-rendered (page-key=trend)' },

  // === Finance (5) ===
  // 2 wrapped (Day 9), 3 TemplateGrid-rendered
  { id: 'finance_pnl', page: '/smart-bi/finance', title: '利润损益',
    requires: ['date', 'gross_amount', 'discount_amount', 'net_amount'] },
  { id: 'finance_revenue_mgmt', page: '/smart-bi/finance', title: '营收管理',
    requires: ['date', 'gross_amount'] },
  { id: 'finance_payment_mix', page: '/smart-bi/finance', title: '支付方式分布',
    requires: ['source_bill_no'],
    fallbackMode: 'placeholder',
    description: 'TemplateGrid-rendered (page-key=finance); B-stage adds payment_channel canonical for tighter requires' },
  { id: 'finance_groupon_breakdown', page: '/smart-bi/finance', title: '团购渠道',
    requires: ['channel_origin', 'gross_amount'],
    description: 'TemplateGrid-rendered (page-key=finance)' },
  { id: 'finance_svc_consumption', page: '/smart-bi/finance', title: '储值卡消费',
    requires: ['source_bill_no'],
    fallbackMode: 'placeholder',
    description: 'TemplateGrid-rendered (page-key=finance); B-stage adds SVC card canonical fields' },

  // === Phase IIa Restaurant (2) — wrapped in RestaurantSalesContent.vue / RestaurantFinanceContent.vue ===
  // Gate restaurant tenant 总营收 KPI cards behind canViewPrice + Gold field availability.
  // Mirrors finance_revenue_mgmt requires shape (POS Gold-derived revenue).
  { id: 'restaurant_sales_revenue', page: '/smart-bi/sales', title: '餐饮总营收 (销售页)',
    requires: ['date', 'gross_amount'] },
  { id: 'restaurant_finance_revenue', page: '/smart-bi/finance', title: '餐饮总营收 (财务页)',
    requires: ['date', 'gross_amount'] },

  // === Phase IIb Restaurant Kitchen Cost (4) — wrapped in RestaurantKitchenCostContent.vue ===
  // Gate restaurant kitchen-cost KPI cards behind canViewPrice + Gold field availability.
  // Cards: 食材成本占比 / 总损耗成本 / 总领料成本 / 净盘点差异
  // Requires gross_amount (POS denominator for ratio) + date (range filter); aligns with IIa pattern.
  { id: 'restaurant_kitchen_cost_ratio', page: '/smart-bi/finance', title: '食材成本占比 (厨房成本)',
    requires: ['date', 'gross_amount'] },
  { id: 'restaurant_kitchen_cost_wastage', page: '/smart-bi/finance', title: '总损耗成本 (厨房成本)',
    requires: ['date', 'gross_amount'] },
  { id: 'restaurant_kitchen_cost_requisition', page: '/smart-bi/finance', title: '总领料成本 (厨房成本)',
    requires: ['date', 'gross_amount'] },
  { id: 'restaurant_kitchen_cost_variance', page: '/smart-bi/finance', title: '净盘点差异 (厨房成本)',
    requires: ['date', 'gross_amount'] },

  // Total: 34 entries (28 pre-Phase-IIa + 2 restaurant cards 2026-05-14 + 4 Phase IIb kitchen-cost 2026-05-15)
];

// Lint helper: check duplicate IDs at module load (cheap, runs once)
const _ids = new Set<string>();
for (const c of CARD_MANIFEST) {
  if (_ids.has(c.id)) {
    console.error(`[card-manifest] duplicate card id: ${c.id}`);
  }
  _ids.add(c.id);
}

export type { CardManifestEntry };
