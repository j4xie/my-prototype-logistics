<script setup lang="ts">
/**
 * ChartConfigPanel - 轴配置弹出面板
 * Allows user to select X/Y axis fields, grouping field, and aggregation method.
 * Appears as el-popover next to chart settings icon.
 */
import { ref, computed, watch } from 'vue';
import { Setting } from '@element-plus/icons-vue';

interface Props {
  /** Available columns with types */
  columns: Array<{ name: string; type: 'numeric' | 'categorical' | 'date' }>;
  /** Current chart configuration */
  currentConfig: {
    chartType: string;
    xField?: string;
    yFields?: string[];
    seriesField?: string;
  };
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  apply: [config: { xField: string; yFields: string[]; seriesField?: string; aggregation?: string }];
}>();

const popoverVisible = ref(false);

// Local editing state
const selectedX = ref(props.currentConfig.xField || '');
const selectedY = ref<string[]>(props.currentConfig.yFields || []);
const selectedSeries = ref(props.currentConfig.seriesField || '');
const aggregation = ref('sum');

// Reset on prop change
watch(() => props.currentConfig, (cfg) => {
  selectedX.value = cfg.xField || '';
  selectedY.value = cfg.yFields || [];
  selectedSeries.value = cfg.seriesField || '';
}, { deep: true });

const categoricalColumns = computed(() =>
  props.columns.filter(c => c.type === 'categorical' || c.type === 'date')
);

const numericColumns = computed(() =>
  props.columns.filter(c => c.type === 'numeric')
);

const aggregationOptions = [
  { value: 'sum', label: '求和' },
  { value: 'avg', label: '平均值' },
  { value: 'count', label: '计数' },
  { value: 'max', label: '最大值' },
  { value: 'min', label: '最小值' },
];

function applyConfig() {
  emit('apply', {
    xField: selectedX.value,
    yFields: selectedY.value,
    seriesField: selectedSeries.value || undefined,
    aggregation: aggregation.value,
  });
  popoverVisible.value = false;
}

function resetToDefault() {
  selectedX.value = props.currentConfig.xField || '';
  selectedY.value = props.currentConfig.yFields || [];
  selectedSeries.value = props.currentConfig.seriesField || '';
  aggregation.value = 'sum';
}
</script>

<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-end"
    :width="320"
    trigger="click"
  >
    <template #reference>
      <el-button size="small" :icon="Setting" circle class="config-btn" :loading="loading" />
    </template>

    <div class="config-panel">
      <h4 class="config-title">图表配置</h4>

      <!-- X Axis -->
      <div class="config-row">
        <label>X 轴 (分类/时间)</label>
        <el-select v-model="selectedX" size="small" placeholder="选择字段" clearable>
          <el-option
            v-for="col in categoricalColumns"
            :key="col.name"
            :label="col.name"
            :value="col.name"
          />
        </el-select>
      </div>

      <!-- Y Axis (multi-select) -->
      <div class="config-row">
        <label>Y 轴 (数值)</label>
        <el-select v-model="selectedY" size="small" placeholder="选择字段" multiple :multiple-limit="4" collapse-tags>
          <el-option
            v-for="col in numericColumns"
            :key="col.name"
            :label="col.name"
            :value="col.name"
          />
        </el-select>
      </div>

      <!-- Series / Group -->
      <div class="config-row">
        <label>分组 (可选)</label>
        <el-select v-model="selectedSeries" size="small" placeholder="无分组" clearable>
          <el-option
            v-for="col in categoricalColumns"
            :key="col.name"
            :label="col.name"
            :value="col.name"
          />
        </el-select>
      </div>

      <!-- Aggregation -->
      <div class="config-row">
        <label>聚合方式</label>
        <el-radio-group v-model="aggregation" size="small">
          <el-radio-button v-for="opt in aggregationOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <!-- Actions -->
      <div class="config-actions">
        <el-button size="small" @click="resetToDefault">重置</el-button>
        <el-button size="small" type="primary" @click="applyConfig" :disabled="!selectedX || selectedY.length === 0">
          应用
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.config-panel {
  padding: 4px 0;
}

.config-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.config-row {
  margin-bottom: 12px;
}

.config-row label {
  display: block;
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.config-row .el-select {
  width: 100%;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.config-btn {
  padding: 4px;
}
</style>
