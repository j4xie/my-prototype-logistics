<script setup lang="ts">
import { computed } from 'vue';
import { Edit, Lightning, Grid, Histogram } from '@element-plus/icons-vue';
import {
  type CreateMode,
  CREATE_MODE_LABELS,
  CREATE_MODE_DESCRIPTIONS,
  DEFAULT_CREATE_MODES,
} from '@/types/createMode';

/**
 * U-NEW-1 — pre-creation mode selector dialog.
 *
 * Shown after the user clicks 新建 button. Presents 4 mode cards;
 * user picks one and the parent dispatches:
 *   - normal → existing full-form dialog
 *   - quick  → inline single-row quick-add
 *   - batch  → BatchCreateDialog (二维表格)
 *   - bom    → BOM expansion flow (Sprint 5 wired with BomVersion)
 *
 * Available modes can be restricted per entity (e.g. omit `bom` if no
 * BOM defined for the entity).
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Subset of DEFAULT_CREATE_MODES exposed. Default: all 4. */
    modes?: CreateMode[];
    /** Entity name shown in title (e.g. "销售订单"). */
    entityLabel?: string;
    /** Modes to disable (show but un-clickable). For e.g. quick mode not wired yet. */
    disabledModes?: CreateMode[];
  }>(),
  {
    modes: () => DEFAULT_CREATE_MODES,
    entityLabel: '记录',
    disabledModes: () => [],
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void;
  (e: 'mode-selected', mode: CreateMode): void;
}>();

const iconMap = { normal: Edit, quick: Lightning, batch: Grid, bom: Histogram };

const disabledSet = computed(() => new Set(props.disabledModes));

function pick(mode: CreateMode): void {
  if (disabledSet.value.has(mode)) return;
  emit('mode-selected', mode);
  emit('update:modelValue', false);
}

function close(): void {
  emit('update:modelValue', false);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`新建 ${entityLabel} — 选择录入方式`"
    width="640px"
    :show-close="true"
    @update:model-value="close"
  >
    <div class="create-mode-grid">
      <div
        v-for="mode in modes"
        :key="mode"
        class="create-mode-card"
        :class="{ disabled: disabledSet.has(mode) }"
        :tabindex="disabledSet.has(mode) ? -1 : 0"
        :aria-disabled="disabledSet.has(mode)"
        :role="'button'"
        @click="pick(mode)"
        @keyup.enter="pick(mode)"
      >
        <el-icon :size="32" class="create-mode-card-icon">
          <component :is="iconMap[mode]" />
        </el-icon>
        <div class="create-mode-card-label">{{ CREATE_MODE_LABELS[mode] }}</div>
        <div class="create-mode-card-desc">{{ CREATE_MODE_DESCRIPTIONS[mode] }}</div>
        <el-tag v-if="disabledSet.has(mode)" size="small" type="info" style="margin-top: 6px">
          即将推出
        </el-tag>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.create-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 0;
}
.create-mode-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 20px 16px;
  cursor: pointer;
  transition: all 0.18s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: var(--el-bg-color);
}
.create-mode-card:hover:not(.disabled) {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px 0 rgba(64, 158, 255, 0.12);
  transform: translateY(-1px);
}
.create-mode-card.disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.create-mode-card-icon {
  color: var(--el-color-primary);
  margin-bottom: 12px;
}
.create-mode-card-label {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 6px;
}
.create-mode-card-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
