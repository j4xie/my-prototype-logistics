<script setup lang="ts">
import { computed } from 'vue';

/**
 * Sprint 4 W1 U-CHIP-MULTI-1: 行内多 chip 状态垂直堆.
 *
 * 用于列表行单元格展示多维度状态 (e.g. 库存/质检/采购/发货). 默认 4 chip 垂直堆,
 * 也支持 N chip. 单 chip 自动 fallback 为 inline tag.
 *
 * 用法:
 *   <MultiChipStack :chips="[
 *     { label: '库存充足', type: 'success' },
 *     { label: '质检通过', type: 'success' },
 *     { label: '采购中', type: 'warning' },
 *     { label: '待发货', type: 'info' },
 *   ]" />
 */
export type ChipType = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default';

export interface ChipDef {
  label: string;
  type?: ChipType;
  /** 自定义颜色覆盖 (优先级高于 type) */
  color?: string;
  /** 自定义文字颜色, 默认根据背景自动 */
  textColor?: string;
  /** 可选 tooltip */
  tooltip?: string;
}

const props = withDefaults(
  defineProps<{
    chips: ChipDef[];
    /** chip 之间垂直间距 (px) */
    gap?: number;
    /** chip 尺寸 */
    size?: 'small' | 'default';
  }>(),
  {
    gap: 4,
    size: 'small',
  },
);

const stackStyle = computed(() => ({ gap: `${props.gap}px` }));

function chipStyle(c: ChipDef) {
  const style: Record<string, string> = {};
  if (c.color) style.backgroundColor = c.color;
  if (c.textColor) style.color = c.textColor;
  return style;
}

function chipClass(c: ChipDef) {
  const type = c.type ?? 'default';
  return [`chip--${type}`, `chip--${props.size}`];
}
</script>

<template>
  <div class="multi-chip-stack" :style="stackStyle">
    <span
      v-for="(chip, idx) in chips"
      :key="`${chip.label}-${idx}`"
      class="chip"
      :class="chipClass(chip)"
      :style="chipStyle(chip)"
      :title="chip.tooltip || chip.label"
    >
      {{ chip.label }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.multi-chip-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}

.chip {
  display: inline-block;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1;
  user-select: none;

  &--small {
    padding: 3px 8px;
    font-size: 11px;
  }
  &--default {
    padding: 4px 10px;
    font-size: 12px;
  }

  &.chip--success {
    background-color: var(--el-color-success-light-9, #f0f9eb);
    color: var(--el-color-success, #67c23a);
    border: 1px solid var(--el-color-success-light-7, #c2e7b0);
  }
  &.chip--warning {
    background-color: var(--el-color-warning-light-9, #fdf6ec);
    color: var(--el-color-warning, #e6a23c);
    border: 1px solid var(--el-color-warning-light-7, #f5dab1);
  }
  &.chip--danger {
    background-color: var(--el-color-danger-light-9, #fef0f0);
    color: var(--el-color-danger, #f56c6c);
    border: 1px solid var(--el-color-danger-light-7, #fbc4c4);
  }
  &.chip--info {
    background-color: var(--el-color-info-light-9, #f4f4f5);
    color: var(--el-color-info, #909399);
    border: 1px solid var(--el-color-info-light-7, #dedfe0);
  }
  &.chip--primary {
    background-color: var(--el-color-primary-light-9, #ecf5ff);
    color: var(--el-color-primary, #409eff);
    border: 1px solid var(--el-color-primary-light-7, #c6e2ff);
  }
  &.chip--default {
    background-color: #f5f7fa;
    color: #606266;
    border: 1px solid #e4e7ed;
  }
}
</style>
