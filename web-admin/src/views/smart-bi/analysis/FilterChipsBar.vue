<template>
  <div class="global-filter-bar">
    <el-icon class="filter-bar-icon"><Filter /></el-icon>
    <el-select
      :model-value="dimension"
      placeholder="维度筛选"
      size="small"
      clearable
      filterable
      style="width: 140px"
      @update:model-value="onDimensionChange"
    >
      <el-option
        v-for="col in availableDimensions"
        :key="col"
        :label="col"
        :value="col"
      />
    </el-select>
    <el-select
      v-if="dimension"
      :model-value="values"
      placeholder="选择值"
      size="small"
      multiple
      filterable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="2"
      style="width: 240px"
      @update:model-value="onValuesChange"
    >
      <el-option
        v-for="val in dimensionValues"
        :key="val"
        :label="val"
        :value="val"
      />
    </el-select>
    <el-button
      v-if="dimension || values.length"
      size="small"
      type="info"
      link
      @click="$emit('clear')"
    >清除筛选</el-button>
    <span v-if="values.length" class="filter-count-badge">
      已筛选 {{ values.length }} 项
    </span>
    <span v-if="filteredRowCount > 0" class="filter-count-badge filter-data-badge">
      数据过滤: {{ filteredRowCount }}/{{ totalRowCount }} 行
    </span>
  </div>
</template>

<script setup lang="ts">
import { Filter } from '@element-plus/icons-vue';

defineProps<{
  dimension: string;
  values: string[];
  availableDimensions: string[];
  dimensionValues: string[];
  filteredRowCount: number;
  totalRowCount: number;
}>();

const emit = defineEmits<{
  (e: 'update:dimension', value: string): void;
  (e: 'update:values', value: string[]): void;
  (e: 'dimension-change'): void;
  (e: 'apply'): void;
  (e: 'clear'): void;
}>();

const onDimensionChange = (v: string) => {
  emit('update:dimension', v);
  // Mirror original handleGlobalFilterChange: clear values + parent resets filtered state
  emit('update:values', []);
  emit('dimension-change');
};

const onValuesChange = (v: string[]) => {
  emit('update:values', v);
  emit('apply');
};
</script>
