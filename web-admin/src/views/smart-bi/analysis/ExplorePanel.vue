<template>
  <el-collapse-transition>
    <div v-show="visible" class="explore-panel">
      <div class="explore-panel-left">
        <div class="explore-section-title">可用维度</div>
        <div class="dimension-list available">
          <div v-for="dim in availableDimensions" :key="dim" class="dimension-chip"
               @click="$emit('add', dim)">
            <el-icon><Plus /></el-icon>
            {{ dim }}
            <span class="dim-count">{{ getDimensionValueCount(dim) }}</span>
          </div>
          <div v-if="availableDimensions.length === 0" class="explore-empty">
            所有维度已选择
          </div>
        </div>
      </div>
      <div class="explore-panel-right">
        <div class="explore-section-title">已选维度 (上下排序)</div>
        <div class="dimension-list selected">
          <div v-for="(dim, idx) in selectedDimensions" :key="dim" class="dimension-chip active">
            <div class="dim-header">
              <el-icon class="drag-handle"><Rank /></el-icon>
              <span>{{ dim }}</span>
              <div class="dim-actions">
                <el-button size="small" :icon="Top" circle text :disabled="idx === 0" @click="$emit('move', idx, -1)" />
                <el-button size="small" :icon="Bottom" circle text :disabled="idx === selectedDimensions.length - 1" @click="$emit('move', idx, 1)" />
                <el-button size="small" :icon="Close" circle text type="danger" @click="$emit('remove', idx)" />
              </div>
            </div>
            <div class="dim-values">
              <el-checkbox-group :model-value="filters[dim] || []" @update:model-value="(v: unknown) => onFilterChange(dim, v as string[])" size="small">
                <el-checkbox v-for="val in getDimensionValuesPreview(dim)" :key="val" :label="val" :value="val" />
              </el-checkbox-group>
              <span v-if="getDimensionValueCount(dim) > 20" class="dim-more">
                +{{ getDimensionValueCount(dim) - 20 }} 更多
              </span>
            </div>
          </div>
          <div v-if="!selectedDimensions.length" class="explore-empty">
            点击左侧维度添加到分析
          </div>
        </div>
        <div v-if="selectedDimensions.length" class="explore-actions">
          <el-button size="small" type="primary" @click="$emit('apply')">应用筛选</el-button>
          <el-button size="small" @click="$emit('clear')">清除</el-button>
        </div>
      </div>
    </div>
  </el-collapse-transition>
</template>

<script setup lang="ts">
import { Plus, Rank, Top, Bottom, Close } from '@element-plus/icons-vue';

const props = defineProps<{
  visible: boolean;
  availableDimensions: string[];
  selectedDimensions: string[];
  filters: Record<string, string[]>;
  /** Returns top 20 values for a given dimension. */
  getDimensionValuesPreview: (dim: string) => string[];
  /** Returns the FULL count of values (not capped at 20). */
  getDimensionValueCount: (dim: string) => number;
}>();

const emit = defineEmits<{
  (e: 'add', dim: string): void;
  (e: 'remove', index: number): void;
  (e: 'move', index: number, delta: -1 | 1): void;
  (e: 'apply'): void;
  (e: 'clear'): void;
  (e: 'filter-change', dim: string, values: string[]): void;
}>();

const onFilterChange = (dim: string, values: string[]) => {
  emit('filter-change', dim, values);
};
</script>
