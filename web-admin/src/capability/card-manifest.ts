/**
 * Card manifest — single source of truth for capability-gated UI cards.
 *
 * Per 数据织网/02-A-能力驱动渲染.md v1.5 §2.2.3 + §6.2 + §6.3.
 *
 * Each entry MUST correspond to a `<CapabilityGate :card-id="X" :requires="[...]"`
 * usage somewhere in views/. CI lint (Day 10) verifies bidirectional consistency.
 *
 * fallbackMode default = 'placeholder' (teach customer what to upload).
 * Use 'hide' for: admin pages, experiments, RBAC-restricted cards (§6.3).
 */
import type { CardManifestEntry } from '@/types/capability';

export const CARD_MANIFEST: CardManifestEntry[] = [
  // === Dashboard (~10) — spec §6.2 ===
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
  { id: 'dashboard_inventory_alert', page: '/smart-bi/dashboard', title: '库存预警',
    requires: ['product_name'],   // B-stage adds inventory_item; for now product_name is sufficient
    description: '需 B 阶段引入 inventory_item / stock_qty 才能完整支持' },
  { id: 'dashboard_top_dishes', page: '/smart-bi/dashboard', title: '菜品 Top 10',
    requires: ['store_name', 'combo_string'] },

  // === Restaurant analytics overview (~5) ===
  { id: 'restaurant_overview_revenue', page: '/restaurant/analytics/overview', title: '总营收',
    requires: ['date', 'net_amount'] },
  { id: 'restaurant_overview_avg', page: '/restaurant/analytics/overview', title: '客单价',
    requires: ['source_bill_no', 'net_amount'] },
  { id: 'restaurant_overview_traffic', page: '/restaurant/analytics/overview', title: '客流量',
    requires: ['customer_count'] },
  { id: 'restaurant_overview_stores', page: '/restaurant/analytics/overview', title: '门店数',
    requires: ['store_name'] },
  { id: 'restaurant_overview_top_dish', page: '/restaurant/analytics/overview', title: '热销菜品',
    requires: ['combo_string', 'qty_sold'] },

  // === Restaurant analytics menu-board (~6) ===
  { id: 'menu_top_dishes', page: '/restaurant/analytics/menu-board', title: '菜品销量 Top',
    requires: ['combo_string'] },
  { id: 'menu_slow_movers', page: '/restaurant/analytics/menu-board', title: '滞销菜品',
    requires: ['combo_string'] },
  { id: 'menu_category_breakdown', page: '/restaurant/analytics/menu-board', title: '品类占比',
    requires: ['combo_string'] },
  { id: 'menu_dish_revenue', page: '/restaurant/analytics/menu-board', title: '菜品营收',
    requires: ['combo_string', 'net_amount'] },
  { id: 'menu_combo_usage', page: '/restaurant/analytics/menu-board', title: '套餐使用率',
    requires: ['combo_string'] },
  { id: 'menu_dish_by_table', page: '/restaurant/analytics/menu-board', title: '桌型菜品',
    requires: ['table_no', 'combo_string'] },

  // === Trends (~4) ===
  { id: 'trends_monthly', page: '/smart-bi/analytics/trends', title: '月度趋势',
    requires: ['date', 'net_amount'] },
  { id: 'trends_anomaly', page: '/smart-bi/analytics/trends', title: '异常检测',
    requires: ['date', 'net_amount'] },
  { id: 'trends_weekday', page: '/smart-bi/analytics/trends', title: '工作日 vs 周末',
    requires: ['date', 'net_amount'] },
  { id: 'trends_period_comparison', page: '/smart-bi/analytics/trends', title: '周期对比',
    requires: ['date', 'net_amount'] },

  // === Finance (~5) ===
  { id: 'finance_pnl', page: '/smart-bi/finance', title: '利润损益',
    requires: ['date', 'gross_amount', 'discount_amount', 'net_amount'] },
  { id: 'finance_revenue_mgmt', page: '/smart-bi/finance', title: '营收管理',
    requires: ['date', 'gross_amount'] },
  { id: 'finance_payment_mix', page: '/smart-bi/finance', title: '支付方式分布',
    requires: ['source_bill_no'],
    fallbackMode: 'placeholder',
    description: 'B-stage adds payment_channel; current shows source bill counts only' },
  { id: 'finance_groupon_breakdown', page: '/smart-bi/finance', title: '团购渠道',
    requires: ['channel_origin', 'gross_amount'] },
  { id: 'finance_svc_consumption', page: '/smart-bi/finance', title: '储值卡消费',
    requires: ['source_bill_no'],
    fallbackMode: 'placeholder',
    description: 'B-stage adds SVC card fields' },

  // Total: ~30 cards
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
