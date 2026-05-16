<template>
  <div class="wf-node parallel-node" :class="{ selected }">
    <Handle type="target" :position="Position.Top" />
    <div class="node-content">
      <div class="node-icon">⇉</div>
      <div class="node-label">{{ data?.label || '并行' }}</div>
      <div class="node-desc">同时启动所有分支</div>
    </div>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data?: { label?: string; nodeType?: string; config?: { description?: string } }
  selected?: boolean
}>()
</script>

<style scoped>
.wf-node {
  min-width: 140px; padding: 8px 14px; background: #fff;
  border: 2px solid #909399; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.15s;
}
.wf-node.selected { box-shadow: 0 0 0 3px #909399, 0 2px 12px rgba(0, 0, 0, 0.2); }
.node-content { display: flex; flex-direction: column; align-items: center; }
.node-icon { font-size: 24px; color: #909399; font-weight: bold; line-height: 1; }
.node-label { font-size: 13px; font-weight: 600; color: #303133; margin-top: 2px; }
.node-desc { font-size: 10px; color: #909399; margin-top: 1px; }
</style>
