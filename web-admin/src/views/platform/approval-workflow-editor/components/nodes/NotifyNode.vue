<template>
  <div class="wf-node notify-node" :class="{ selected }">
    <Handle type="target" :position="Position.Top" />
    <div class="node-content">
      <div class="node-icon">✉</div>
      <div class="node-label">{{ data?.label || '通知' }}</div>
      <div v-if="notifyRoles.length" class="node-roles">
        → {{ notifyRoles.join(', ') }}
      </div>
    </div>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  data?: {
    label?: string
    nodeType?: string
    config?: { notifyRoles?: string[]; notifyTemplate?: string }
  }
  selected?: boolean
}>()

const notifyRoles = computed(() => props.data?.config?.notifyRoles ?? [])
</script>

<style scoped>
.wf-node {
  min-width: 150px; padding: 8px 12px; background: #fff;
  border: 2px dashed #909399; border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  transition: all 0.15s;
}
.wf-node.selected { box-shadow: 0 0 0 3px #909399, 0 2px 12px rgba(0, 0, 0, 0.2); }
.node-content { display: flex; flex-direction: column; align-items: center; }
.node-icon { font-size: 20px; color: #909399; line-height: 1; }
.node-label { font-size: 13px; font-weight: 600; color: #303133; margin-top: 2px; }
.node-roles { font-size: 10px; color: #909399; margin-top: 2px; max-width: 130px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
