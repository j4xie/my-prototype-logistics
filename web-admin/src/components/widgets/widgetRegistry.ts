// C-WIDGET-1 — widget registry. Maps WidgetKind to component + defaults.
import type { WidgetKind, WidgetRegistration } from '@/types/dashboardWidget';
import KPICardWidget from './KPICardWidget.vue';
import ChartWidget from './ChartWidget.vue';
import ListWidget from './ListWidget.vue';

const registrations: WidgetRegistration[] = [
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
  // Deferred to Sprint 5 / follow-up — registered as "coming soon" so palette shows them.
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
