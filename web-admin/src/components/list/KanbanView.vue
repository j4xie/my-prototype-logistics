<script setup lang="ts" generic="T extends Record<string, any>">
import { computed } from 'vue';

/**
 * U-VIEW-1 — kanban view (columns grouped by statusField).
 * Render each row as a card; column order matches `columns` prop or
 * discovered status values.
 */
const props = defineProps<{
  rows: T[];
  statusField: keyof T;
  titleField?: keyof T;
  subtitleField?: keyof T;
  rowKey?: keyof T;
  /** Column ordering. If omitted, derived from distinct status values. */
  columns?: Array<{ status: string; label?: string }>;
  emptyText?: string;
}>();

const discoveredColumns = computed(() => {
  if (props.columns?.length) return props.columns;
  const seen = new Set<string>();
  const out: Array<{ status: string; label?: string }> = [];
  for (const row of props.rows) {
    const s = String(row[props.statusField] ?? '');
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push({ status: s });
    }
  }
  return out;
});

const grouped = computed(() => {
  const map = new Map<string, T[]>();
  for (const col of discoveredColumns.value) {
    map.set(col.status, []);
  }
  for (const row of props.rows) {
    const s = String(row[props.statusField] ?? '');
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(row);
  }
  return map;
});
</script>

<template>
  <div v-if="!rows.length" class="kanban-view-empty">{{ emptyText ?? '暂无数据' }}</div>
  <div v-else class="kanban-view">
    <div
      v-for="col in discoveredColumns"
      :key="col.status"
      class="kanban-view-column"
    >
      <div class="kanban-view-column-header">
        <span>{{ col.label ?? col.status }}</span>
        <el-tag size="small" type="info">{{ grouped.get(col.status)?.length ?? 0 }}</el-tag>
      </div>
      <div class="kanban-view-column-body">
        <el-card
          v-for="row in grouped.get(col.status) ?? []"
          :key="(rowKey ? String(row[rowKey]) : JSON.stringify(row))"
          class="kanban-view-card"
          shadow="hover"
        >
          <div class="kanban-view-card-title">
            {{ titleField ? row[titleField] : '' }}
          </div>
          <div v-if="subtitleField" class="kanban-view-card-subtitle">
            {{ row[subtitleField] }}
          </div>
          <slot name="body" :row="row" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban-view {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0;
  min-height: 240px;
}
.kanban-view-empty {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 32px;
}
.kanban-view-column {
  flex: 0 0 280px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 12px;
}
.kanban-view-column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 12px;
}
.kanban-view-card {
  margin-bottom: 8px;
}
.kanban-view-card-title {
  font-weight: 500;
  margin-bottom: 4px;
}
.kanban-view-card-subtitle {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
