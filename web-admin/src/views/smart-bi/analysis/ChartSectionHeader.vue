<template>
  <div class="chart-section-header">
    <h3>数据可视化</h3>
    <div class="chart-section-actions">
      <span v-if="hasData && !layoutEditMode" class="drill-hint">点击图表数据点可下钻分析</span>
      <!-- 刷新分析按钮 -->
      <el-button
        v-if="hasData"
        :icon="Refresh"
        size="small"
        :loading="refreshing"
        @click="$emit('refresh')"
        style="margin-left: 8px;"
      >刷新分析</el-button>
      <!-- Q2: Auto-refresh dropdown -->
      <el-dropdown
        v-if="hasData"
        @command="(v: number) => $emit('set-auto-refresh', v)"
        trigger="click"
        style="margin-left: 4px;"
      >
        <el-button size="small" :type="autoRefreshInterval > 0 ? 'success' : 'default'">
          <el-icon><Timer /></el-icon>
          {{ autoRefreshInterval > 0 ? `${autoRefreshInterval / 1000}s` : '自动' }}
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :command="0">关闭自动刷新</el-dropdown-item>
            <el-dropdown-item :command="30000">每 30 秒</el-dropdown-item>
            <el-dropdown-item :command="60000">每 1 分钟</el-dropdown-item>
            <el-dropdown-item :command="300000">每 5 分钟</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <!-- P6: 编排模式切换 -->
      <el-switch
        v-if="hasData"
        :model-value="layoutEditMode"
        @update:model-value="(v) => $emit('update:layoutEditMode', !!v)"
        active-text="编排"
        inactive-text="标准"
        size="small"
        style="margin-left: 12px;"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Refresh, Timer } from '@element-plus/icons-vue';

defineProps<{
  hasData: boolean;
  refreshing: boolean;
  layoutEditMode: boolean;
  autoRefreshInterval: number;
}>();

defineEmits<{
  (e: 'refresh'): void;
  (e: 'set-auto-refresh', interval: number): void;
  (e: 'update:layoutEditMode', value: boolean): void;
}>();
</script>
