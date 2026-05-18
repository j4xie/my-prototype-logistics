// C-WIDGET-1 (Sprint 4 Wave 2 Chat L + P1 #65) — dashboard widget plug system.
export { default as Widget } from './Widget.vue';
export { default as KPICardWidget } from './KPICardWidget.vue';
export { default as ChartWidget } from './ChartWidget.vue';
export { default as ListWidget } from './ListWidget.vue';
export { default as DashboardGrid } from './DashboardGrid.vue';
export { widgetRegistry, widgetRegistrationList } from './widgetRegistry';
export { useWidgetData } from './useWidgetData';
export type { UseWidgetDataOptions, UseWidgetDataReturn } from './useWidgetData';

// Endpoint-bound widgets (P1 #65)
export { default as KpiTodayProductionWidget } from './endpoint/KpiTodayProductionWidget.vue';
export { default as WipBatchCountWidget } from './endpoint/WipBatchCountWidget.vue';
export { default as DeliveryWarnWidget } from './endpoint/DeliveryWarnWidget.vue';
export { default as PendingRemindersWidget } from './endpoint/PendingRemindersWidget.vue';
export { default as EquipmentStatusWidget } from './endpoint/EquipmentStatusWidget.vue';
export { default as QualityRateWidget } from './endpoint/QualityRateWidget.vue';
export { default as SchedulingAlertsWidget } from './endpoint/SchedulingAlertsWidget.vue';

// #835 follow-up — HR Hours Aggregator widget
export { default as TopOvertimeEmployeesWidget } from './endpoint/TopOvertimeEmployeesWidget.vue';
