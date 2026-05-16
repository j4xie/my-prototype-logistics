<script setup lang="ts">
import { computed } from 'vue';
import type { WorkflowNode } from '@/types/workflow';
import { formatWorkflowCount, getWorkflowPalette } from './tokens';

const props = withDefaults(
  defineProps<{
    node: WorkflowNode;
    size?: 'sm' | 'md';
  }>(),
  { size: 'md' },
);

const emit = defineEmits<{
  (event: 'click', nodeId: string): void;
  (event: 'long-press', nodeId: string): void;
}>();

const palette = computed(() => getWorkflowPalette(props.node.status));
const displayCount = computed(() => formatWorkflowCount(props.node.count));
const circlePx = computed(() => (props.size === 'sm' ? 48 : 64));

let pressTimer: number | undefined;

function startPress() {
  if (pressTimer) window.clearTimeout(pressTimer);
  pressTimer = window.setTimeout(() => {
    emit('long-press', props.node.id);
    pressTimer = undefined;
  }, 500);
}

function endPress(triggerClick: boolean) {
  if (pressTimer) {
    window.clearTimeout(pressTimer);
    pressTimer = undefined;
    if (triggerClick) emit('click', props.node.id);
  }
}
</script>

<template>
  <div class="workflow-node" :aria-label="`${node.label}, ${node.count} 项`">
    <button
      type="button"
      class="circle"
      :style="{
        width: circlePx + 'px',
        height: circlePx + 'px',
        backgroundColor: palette.bg,
        borderColor: palette.border,
        color: palette.text,
      }"
      :aria-label="node.label"
      @mousedown="startPress"
      @mouseup="endPress(true)"
      @mouseleave="endPress(false)"
      @touchstart.passive="startPress"
      @touchend="endPress(true)"
      @touchcancel="endPress(false)"
    >
      <span class="count">{{ displayCount }}</span>
    </button>
    <span class="label">{{ node.label }}</span>
  </div>
</template>

<style scoped>
.workflow-node {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  min-width: 64px;
}

.circle {
  border-radius: 50%;
  border-width: 1px;
  border-style: solid;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  user-select: none;
}

.circle:active {
  opacity: 0.75;
  transform: scale(0.97);
}

.circle:focus-visible {
  outline: 2px solid var(--el-color-primary, #1890ff);
  outline-offset: 2px;
}

.count {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.label {
  margin-top: 4px;
  max-width: 88px;
  text-align: center;
  font-size: 12px;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
