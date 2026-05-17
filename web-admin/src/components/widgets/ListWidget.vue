<script setup lang="ts">
/**
 * C-WIDGET-1 — list widget. Renders a flat list of items with optional
 * status tag and clickable navigation.
 *
 * Config: { items: Array<{ id, label, subLabel?, status?, href? }> }
 */
defineProps<{
  config: { items?: Array<{ id: string; label: string; subLabel?: string; status?: string; href?: string }> };
  title?: string;
}>();
</script>

<template>
  <el-card shadow="never" class="list-widget">
    <div class="list-widget-title">{{ title || '列表' }}</div>
    <div v-if="!config.items?.length" class="list-widget-empty">暂无数据</div>
    <ul v-else class="list-widget-items">
      <li v-for="item in config.items" :key="item.id" class="list-widget-item">
        <a v-if="item.href" :href="item.href">{{ item.label }}</a>
        <span v-else>{{ item.label }}</span>
        <span v-if="item.subLabel" class="list-widget-item-sub">{{ item.subLabel }}</span>
        <el-tag v-if="item.status" size="small" type="info" class="list-widget-item-tag">
          {{ item.status }}
        </el-tag>
      </li>
    </ul>
  </el-card>
</template>

<style scoped>
.list-widget { height: 100%; display: flex; flex-direction: column; }
.list-widget-title { font-weight: 600; margin-bottom: 12px; }
.list-widget-empty { color: var(--el-text-color-secondary); padding: 16px; text-align: center; }
.list-widget-items { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
.list-widget-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.list-widget-item:last-child { border-bottom: none; }
.list-widget-item-sub { color: var(--el-text-color-secondary); font-size: 12px; }
.list-widget-item-tag { margin-left: auto; }
</style>
