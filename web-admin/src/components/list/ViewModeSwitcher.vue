<script setup lang="ts">
import { computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Grid, Files, Tickets, Clock, Calendar } from '@element-plus/icons-vue';
import {
  type ViewMode,
  VIEW_MODE_LABELS,
  DEFAULT_VIEW_MODES,
  loadViewMode,
  saveViewMode,
} from '@/types/viewMode';

/**
 * U-VIEW-1 — view-mode switcher (5 modes: table/grid/kanban/timeline/calendar).
 * Persists per route.name in localStorage.
 *
 * timeline + calendar render as placeholders in Sprint 4; full impl Sprint 5.
 */
const props = withDefaults(
  defineProps<{
    modelValue: ViewMode;
    /** Subset of DEFAULT_VIEW_MODES to expose. Default: all 5. */
    modes?: ViewMode[];
    /** Override route.name for persistence key (testing). */
    persistKey?: string;
    /** el-radio-group size. */
    size?: 'large' | 'default' | 'small';
  }>(),
  {
    modes: () => DEFAULT_VIEW_MODES,
    size: 'small',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', mode: ViewMode): void;
}>();

const route = useRoute();
const persistKey = computed(() => props.persistKey ?? String(route.name ?? 'default'));

const iconMap = { table: Grid, grid: Files, kanban: Tickets, timeline: Clock, calendar: Calendar };

onMounted(() => {
  const stored = loadViewMode(persistKey.value, props.modelValue);
  if (stored !== props.modelValue) {
    emit('update:modelValue', stored);
  }
});

watch(
  () => props.modelValue,
  (v) => saveViewMode(persistKey.value, v)
);

function handleChange(v: string | number | boolean | undefined): void {
  if (typeof v === 'string' && DEFAULT_VIEW_MODES.includes(v as ViewMode)) {
    emit('update:modelValue', v as ViewMode);
  }
}
</script>

<template>
  <el-radio-group
    :model-value="modelValue"
    :size="size"
    @change="handleChange"
    aria-label="视图切换"
  >
    <el-radio-button
      v-for="mode in modes"
      :key="mode"
      :value="mode"
      :label="mode"
    >
      <el-icon :size="14" style="vertical-align: -2px; margin-right: 4px">
        <component :is="iconMap[mode]" />
      </el-icon>
      {{ VIEW_MODE_LABELS[mode] }}
    </el-radio-button>
  </el-radio-group>
</template>
