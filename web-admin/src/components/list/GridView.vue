<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * U-VIEW-1 — grid view (responsive card layout, 2-4 cards per row).
 * Used as a presentational fallback for any list using ViewModeSwitcher.
 * Default rendering shows {titleField, subtitleField, statusField} + slot for custom body.
 */
defineProps<{
  rows: T[];
  titleField?: keyof T;
  subtitleField?: keyof T;
  statusField?: keyof T;
  rowKey?: keyof T;
  emptyText?: string;
}>();
</script>

<template>
  <div v-if="!rows.length" class="grid-view-empty">{{ emptyText ?? '暂无数据' }}</div>
  <div v-else class="grid-view">
    <el-card
      v-for="row in rows"
      :key="(rowKey ? String(row[rowKey]) : JSON.stringify(row))"
      class="grid-view-card"
      shadow="hover"
    >
      <div class="grid-view-card-title">
        <span>{{ titleField ? row[titleField] : '' }}</span>
        <el-tag v-if="statusField && row[statusField]" size="small" type="info">
          {{ row[statusField] }}
        </el-tag>
      </div>
      <div v-if="subtitleField" class="grid-view-card-subtitle">
        {{ row[subtitleField] }}
      </div>
      <slot name="body" :row="row" />
      <div class="grid-view-card-footer">
        <slot name="actions" :row="row" />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 8px 0;
}
.grid-view-empty {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 32px;
}
.grid-view-card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 8px;
}
.grid-view-card-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.grid-view-card-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
