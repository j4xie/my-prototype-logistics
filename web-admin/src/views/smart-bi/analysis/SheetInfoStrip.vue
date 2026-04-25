<template>
  <div class="sheet-info">
    <el-descriptions :column="3" border>
      <el-descriptions-item label="数据类型">
        <el-tag>{{ dataTypeLabel }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="推荐图表">
        <el-tag type="success">{{ chartTypeLabel }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="保存行数">
        {{ savedRows }}
      </el-descriptions-item>
    </el-descriptions>

    <!-- 显示编制说明（如有） -->
    <el-alert
      v-if="description"
      title="编制说明"
      type="info"
      :description="description"
      show-icon
      :closable="false"
      style="margin-top: 16px"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  detectedDataType?: string;
  recommendedChartType?: string;
  savedRows: number;
  description: string;
}>();

const dataTypeLabel = computed(() =>
  props.detectedDataType && props.detectedDataType !== 'UNKNOWN'
    ? props.detectedDataType
    : '通用数据'
);

const chartTypeLabel = computed(() =>
  props.recommendedChartType && props.recommendedChartType !== 'N/A'
    ? props.recommendedChartType
    : '自动推荐'
);
</script>
