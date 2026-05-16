<template>
  <div class="wf-node join-node" :class="{ selected }">
    <Handle type="target" :position="Position.Top" />
    <div class="node-content">
      <div class="node-icon">⇇</div>
      <div class="node-label">{{ data?.label || '汇聚' }}</div>
      <div class="node-mode">{{ modeLabel }}</div>
    </div>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  data?: { label?: string; nodeType?: string; config?: { mode?: string; n?: number } }
  selected?: boolean
}>()

const modeLabel = computed(() => {
  const m = props.data?.config?.mode ?? 'ALL'
  const n = props.data?.config?.n
  if (m === 'ALL') return 'mode: ALL (全部到达)'
  if (m === 'ANY') return 'mode: ANY (任一)'
  if (m === 'N_OF_M' && typeof n === 'number') return `mode: ${n}-of-M`
  return `mode: ${m}`
})
</script>

<style scoped>
.wf-node {
  min-width: 140px; padding: 8px 14px; background: #fff;
  border: 2px solid #909399; border-radius: 8px;
  border-left: 6px solid #909399;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.15s;
}
.wf-node.selected { box-shadow: 0 0 0 3px #909399, 0 2px 12px rgba(0, 0, 0, 0.2); }
.node-content { display: flex; flex-direction: column; align-items: center; }
.node-icon { font-size: 22px; color: #909399; font-weight: bold; line-height: 1; }
.node-label { font-size: 13px; font-weight: 600; color: #303133; margin-top: 2px; }
.node-mode { font-size: 10px; color: #909399; margin-top: 1px; font-family: monospace; }
</style>
