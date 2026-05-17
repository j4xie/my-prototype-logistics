// C-WIDGET-1 — widget registry. Maps WidgetKind to component + defaults.
//
// Sprint 4 Chat L shipped 3 raw kinds (kpi/chart/list).
// P1 #65 graduates 7 previously coming-soon kinds to live endpoint-bound
// widgets that fetch data themselves. 7 reserved kinds remain coming-soon.
import type { WidgetKind, WidgetRegistration } from '@/types/dashboardWidget';
import KPICardWidget from './KPICardWidget.vue';
import ChartWidget from './ChartWidget.vue';
import ListWidget from './ListWidget.vue';
import KpiTodayProductionWidget from './endpoint/KpiTodayProductionWidget.vue';
import WipBatchCountWidget from './endpoint/WipBatchCountWidget.vue';
import DeliveryWarnWidget from './endpoint/DeliveryWarnWidget.vue';
import PendingRemindersWidget from './endpoint/PendingRemindersWidget.vue';
import EquipmentStatusWidget from './endpoint/EquipmentStatusWidget.vue';
import QualityRateWidget from './endpoint/QualityRateWidget.vue';
import SchedulingAlertsWidget from './endpoint/SchedulingAlertsWidget.vue';

const registrations: WidgetRegistration[] = [
  // ---------- Raw kinds (Sprint 4 Chat L) — external-config ----------
  {
    kind: 'kpi',
    defaultTitle: 'KPI 指标',
    component: KPICardWidget,
    defaultConfig: () => ({ label: '指标名称', value: 0 }),
    defaultSize: { w: 3, h: 2 },
  },
  {
    kind: 'chart',
    defaultTitle: '数据图表',
    component: ChartWidget,
    defaultConfig: () => ({ type: 'bar', series: [] }),
    defaultSize: { w: 6, h: 3 },
  },
  {
    kind: 'list',
    defaultTitle: '数据列表',
    component: ListWidget,
    defaultConfig: () => ({ items: [] }),
    defaultSize: { w: 4, h: 3 },
  },

  // ---------- Endpoint-bound kinds (P1 #65) — self-fetch ----------
  {
    kind: 'kpi-today-production',
    defaultTitle: '今日产量',
    component: KpiTodayProductionWidget,
    defaultConfig: () => ({}),
    defaultSize: { w: 3, h: 2 },
  },
  {
    kind: 'wip-batch-count',
    defaultTitle: '在制品批次',
    component: WipBatchCountWidget,
    defaultConfig: () => ({}),
    defaultSize: { w: 3, h: 2 },
  },
  {
    kind: 'delivery-warn',
    defaultTitle: '交货预警',
    component: DeliveryWarnWidget,
    defaultConfig: () => ({ windowDays: 7 }),
    defaultSize: { w: 3, h: 3 },
  },
  {
    kind: 'pending-reminders',
    defaultTitle: '待处理提醒',
    component: PendingRemindersWidget,
    defaultConfig: () => ({ maxItems: 5 }),
    defaultSize: { w: 4, h: 3 },
  },
  {
    kind: 'equipment-status',
    defaultTitle: '设备状态',
    component: EquipmentStatusWidget,
    defaultConfig: () => ({}),
    defaultSize: { w: 4, h: 3 },
  },
  {
    kind: 'quality-rate',
    defaultTitle: '质量合格率',
    component: QualityRateWidget,
    defaultConfig: () => ({}),
    defaultSize: { w: 3, h: 2 },
  },
  {
    kind: 'scheduling-alerts',
    defaultTitle: '排程告警',
    component: SchedulingAlertsWidget,
    defaultConfig: () => ({ maxItems: 5 }),
    defaultSize: { w: 4, h: 3 },
  },

  // ---------- Reserved kinds (coming-soon stubs) ----------
  { kind: 'alert',         defaultTitle: '告警卡片',     component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 3, h: 2 }, comingSoon: true },
  { kind: 'quick-action',  defaultTitle: '快捷操作',     component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 3, h: 2 }, comingSoon: true },
  { kind: 'calendar',      defaultTitle: '日历',         component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 4, h: 3 }, comingSoon: true },
  { kind: 'map',           defaultTitle: '地图',         component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 6, h: 3 }, comingSoon: true },
  { kind: 'news',          defaultTitle: '消息',         component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 4, h: 3 }, comingSoon: true },
  { kind: 'ai-assistant',  defaultTitle: 'AI 助手',      component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 4, h: 3 }, comingSoon: true },
  { kind: 'custom-html',   defaultTitle: '自定义 HTML',  component: KPICardWidget, defaultConfig: () => ({}), defaultSize: { w: 4, h: 2 }, comingSoon: true },
];

export const widgetRegistry: ReadonlyMap<WidgetKind, WidgetRegistration> = new Map(
  registrations.map((r) => [r.kind, r])
);

export function widgetRegistrationList(): WidgetRegistration[] {
  return registrations;
}
