<template>
  <div class="wf-node start-node" :class="{ selected }">
    <div class="node-icon">▶</div>
    <div class="node-label">{{ data?.label || '开始' }}</div>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data?: { label?: string; nodeType?: string; config?: Record<string, unknown> }
  selected?: boolean
}>()
</script>

<style scoped>
.wf-node {
  width: 80px; height: 80px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #67c23a; color: #fff;
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.4);
  border: 3px solid transparent;
  transition: all 0.15s;
}
.wf-node.selected { border-color: #fff; box-shadow: 0 0 0 3px #67c23a, 0 2px 12px rgba(0, 0, 0, 0.2); }
.node-icon { font-size: 20px; line-height: 1; }
.node-label { font-size: 11px; margin-top: 2px; font-weight: 600; }
</style>
