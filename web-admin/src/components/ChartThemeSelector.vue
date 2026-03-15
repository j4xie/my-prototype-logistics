<script setup lang="ts">
import { useChartTheme, type ThemeName } from '@/composables/useChartTheme';

const { theme, themeList, setTheme } = useChartTheme();

const emit = defineEmits<{
  (e: 'change', theme: ThemeName): void;
}>();

function selectTheme(name: ThemeName) {
  setTheme(name);
  emit('change', name);
}
</script>

<template>
  <div class="theme-selector">
    <span class="theme-label">图表主题</span>
    <div class="theme-options">
      <div
        v-for="t in themeList"
        :key="t.name"
        class="theme-option"
        :class="{ active: theme.name === t.name }"
        :title="t.label"
        @click="selectTheme(t.name)"
      >
        <div class="theme-preview">
          <span
            v-for="(color, i) in t.colors.slice(0, 4)"
            :key="i"
            class="color-dot"
            :style="{ backgroundColor: color }"
          />
        </div>
        <span class="theme-name">{{ t.label }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.theme-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}
.theme-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.theme-options {
  display: flex;
  gap: 8px;
}
.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: var(--el-fill-color-light); }
  &.active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}
.theme-preview {
  display: flex;
  gap: 3px;
}
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.1);
}
.theme-name {
  font-size: 11px;
  color: var(--el-text-color-regular);
}
</style>
