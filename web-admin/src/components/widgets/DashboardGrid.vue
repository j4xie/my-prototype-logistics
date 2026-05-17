<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, Delete } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import {
  type DashboardWidget,
  type WidgetKind,
  loadLayout,
  saveLayout,
  newWidget,
} from '@/types/dashboardWidget';
import { widgetRegistry, widgetRegistrationList } from './widgetRegistry';

/**
 * C-WIDGET-1 — dashboard grid container.
 *
 * 12-column CSS grid. Widgets persist in localStorage per route.name. Pickers:
 *   - "+ 添加 widget": opens el-popover with 10 widget kinds (3 active, 7 coming-soon)
 *   - per-widget × button: remove
 *
 * Drag-drop reorder via grid swap on click intentionally simple; native HTML5
 * drag-and-drop deferred to Sprint 5 (full DashboardBuilder.vue reuse).
 */
const props = withDefaults(
  defineProps<{
    /** Override persistence key. Default: route.name. */
    persistKey?: string;
    /** Initial widgets if nothing saved. */
    defaultWidgets?: DashboardWidget[];
  }>(),
  {
    defaultWidgets: () => [],
  }
);

const route = useRoute();
const persistKey = computed(() => props.persistKey ?? String(route.name ?? 'dashboard'));

const widgets = ref<DashboardWidget[]>([]);
const paletteVisible = ref(false);

onMounted(() => {
  widgets.value = loadLayout(persistKey.value, props.defaultWidgets);
});

watch(widgets, (v) => saveLayout(persistKey.value, v), { deep: true });

function addWidget(kind: WidgetKind): void {
  const reg = widgetRegistry.get(kind);
  if (!reg) return;
  if (reg.comingSoon) {
    ElMessage.info(`${reg.defaultTitle} 将在 Sprint 5 上线`);
    return;
  }
  widgets.value = [...widgets.value, newWidget(kind, widgetRegistry)];
  paletteVisible.value = false;
}

function removeWidget(id: string): void {
  widgets.value = widgets.value.filter((w) => w.id !== id);
}

function widgetComponent(kind: WidgetKind) {
  return widgetRegistry.get(kind)?.component;
}

function widgetSpanStyle(w: DashboardWidget): Record<string, string> {
  return {
    gridColumn: `span ${Math.min(12, Math.max(1, w.w))}`,
    gridRow: `span ${Math.max(1, w.h)}`,
  };
}
</script>

<template>
  <div class="dashboard-grid-wrapper">
    <div class="dashboard-grid-toolbar">
      <el-popover v-model:visible="paletteVisible" placement="bottom-end" :width="360" trigger="click">
        <template #reference>
          <el-button type="primary" :icon="Plus">添加 widget</el-button>
        </template>
        <div class="dashboard-grid-palette">
          <button
            v-for="reg in widgetRegistrationList()"
            :key="reg.kind"
            type="button"
            class="dashboard-grid-palette-item"
            :class="{ disabled: reg.comingSoon }"
            @click="addWidget(reg.kind)"
          >
            <span>{{ reg.defaultTitle }}</span>
            <el-tag v-if="reg.comingSoon" size="small" type="info">Sprint 5</el-tag>
          </button>
        </div>
      </el-popover>
      <span class="dashboard-grid-hint">布局自动保存到本地</span>
    </div>

    <div v-if="!widgets.length" class="dashboard-grid-empty">
      <el-empty description="还没有 widget — 点击 添加 widget 开始" :image-size="120" />
    </div>
    <div v-else class="dashboard-grid">
      <div
        v-for="w in widgets"
        :key="w.id"
        class="dashboard-grid-cell"
        :style="widgetSpanStyle(w)"
      >
        <div class="dashboard-grid-cell-chrome">
          <el-button
            text
            size="small"
            :icon="Delete"
            title="移除"
            @click="removeWidget(w.id)"
          />
        </div>
        <component
          :is="widgetComponent(w.kind)"
          :config="w.config"
          :title="w.title"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-grid-wrapper { padding: 16px; }
.dashboard-grid-toolbar {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
}
.dashboard-grid-hint { font-size: 12px; color: var(--el-text-color-secondary); }
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 80px;
  gap: 12px;
}
.dashboard-grid-cell {
  position: relative;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dashboard-grid-cell-chrome {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.dashboard-grid-cell:hover .dashboard-grid-cell-chrome { opacity: 1; }
.dashboard-grid-empty { padding: 32px; }
.dashboard-grid-palette {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.dashboard-grid-palette-item {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dashboard-grid-palette-item:hover:not(.disabled) {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.dashboard-grid-palette-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
