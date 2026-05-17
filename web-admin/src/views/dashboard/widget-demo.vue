<script setup lang="ts">
/**
 * Widget Demo Dashboard (P1 #65 C-WIDGET-1).
 *
 * Showcases the pluggable widget framework. User can add/remove/persist
 * widgets via DashboardGrid; this view seeds 5 endpoint-bound widgets
 * as a starting layout (persists into localStorage so user customizations
 * survive reload).
 *
 * Accessible at /dashboard/widgets — does not replace the role-based
 * dashboards in /dashboard (DashboardAdmin/Production/etc), which remain
 * the canonical landing page. This view is opt-in via sidebar navigation.
 */
import { DashboardGrid } from '@/components/widgets';
import type { DashboardWidget } from '@/types/dashboardWidget';
import { newWidget } from '@/types/dashboardWidget';
import { widgetRegistry } from '@/components/widgets/widgetRegistry';

// Seed layout — 5 endpoint-bound widgets so the dashboard is useful immediately.
// User can add/remove via the "+ 添加 widget" palette; localStorage persists.
const seedWidgets: DashboardWidget[] = [
  newWidget('kpi-today-production', widgetRegistry),
  newWidget('wip-batch-count', widgetRegistry),
  newWidget('quality-rate', widgetRegistry),
  newWidget('delivery-warn', widgetRegistry),
  newWidget('pending-reminders', widgetRegistry),
];
</script>

<template>
  <div class="widget-demo-page">
    <div class="widget-demo-header">
      <h2>自定义看板</h2>
      <p class="widget-demo-hint">
        从右上角 "添加 widget" 选择卡片;拖入后会自动从对应接口拉取数据。布局会自动保存到本地浏览器。
      </p>
    </div>
    <DashboardGrid persist-key="dashboard:widget-demo" :default-widgets="seedWidgets" />
  </div>
</template>

<style scoped>
.widget-demo-page {
  min-height: calc(100vh - 144px);
}
.widget-demo-header {
  padding: 16px 16px 0;
}
.widget-demo-header h2 {
  font-size: 20px;
  margin: 0 0 4px;
  color: var(--el-text-color-primary);
}
.widget-demo-hint {
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
