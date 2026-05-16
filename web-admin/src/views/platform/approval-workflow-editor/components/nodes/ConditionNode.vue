<template>
  <div class="wf-node condition-node" :class="{ selected }">
    <Handle type="target" :position="Position.Top" />
    <div class="diamond">
      <div class="diamond-content">
        <div class="node-icon">?</div>
        <div class="node-label">{{ data?.label || '条件' }}</div>
        <div v-if="description" class="node-desc">{{ description }}</div>
      </div>
    </div>
    <Handle type="source" :position="Position.Bottom" id="default" />
    <Handle type="source" :position="Position.Right" id="match" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  data?: { label?: string; nodeType?: string; config?: { description?: string } }
  selected?: boolean
}>()

const description = computed(() => props.data?.config?.description ?? '')
</script>

<style scoped>
.wf-node { position: relative; width: 140px; height: 100px; }
.wf-node.selected .diamond { box-shadow: 0 0 0 3px #e6a23c, 0 2px 12px rgba(0, 0, 0, 0.2); }
.diamond {
  position: absolute; inset: 0;
  background: #fff;
  border: 2px solid #e6a23c;
  transform: rotate(45deg);
  box-shadow: 0 2px 8px rgba(230, 162, 60, 0.3);
  border-radius: 8px;
  transition: all 0.15s;
}
.diamond-content {
  position: absolute; inset: 0;
  transform: rotate(-45deg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #e6a23c;
}
.node-icon { font-size: 20px; font-weight: bold; line-height: 1; }
.node-label { font-size: 12px; font-weight: 600; margin-top: 2px; }
.node-desc { font-size: 10px; color: #909399; margin-top: 1px; max-width: 90px; text-align: center; overflow: hidden; text-overflow: ellipsis; }
</style>
