<template>
  <el-drawer v-model="modelVisible" title="深度分析" size="55%" direction="rtl" @close="onClose">
    <template #header>
      <div class="drill-down-header">
        <span class="drill-title">深度分析</span>
        <el-tag v-if="context.dimension" type="info" size="small">
          {{ context.dimension }}: {{ context.filterValue }}
        </el-tag>
        <el-tag v-if="result?.hierarchy" type="success" size="small" style="margin-left: 4px;">
          {{ result.hierarchy.type }} 层级
        </el-tag>
      </div>
    </template>

    <!-- P4: 面包屑导航 -->
    <div v-if="stack.length > 0" class="drill-breadcrumb">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>
          <el-button type="primary" link size="small" @click="onBackToRoot">全部数据</el-button>
        </el-breadcrumb-item>
        <el-breadcrumb-item v-for="(level, i) in stack" :key="i">
          <el-button type="primary" link size="small" @click="onBackTo(i)">
            {{ level.dimension }}: {{ level.filterValue }}
          </el-button>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div v-if="loading" class="drill-loading">
      <el-icon class="is-loading" :size="40"><Loading /></el-icon>
      <p>正在分析 "{{ context.filterValue }}" 的详细数据...</p>
    </div>

    <div v-else-if="result">
      <!-- P4: 可用下钻维度按钮组 -->
      <div v-if="result.available_dimensions?.length" class="drill-dimensions">
        <span class="drill-dim-label">可继续下钻:</span>
        <el-button v-for="dim in result.available_dimensions" :key="dim" size="small" @click="onDrillByDimension(dim)">
          {{ getColumnLabel(dim) }}
        </el-button>
      </div>

      <!-- 下钻图表 (composable's callback writes ECharts into id 'drill-down-chart') -->
      <div v-if="result.chartConfig" class="drill-chart-section">
        <h4>数据分布 <span class="drill-hint-inline">(点击柱状图可继续下钻)</span></h4>
        <div id="drill-down-chart" class="drill-chart-container"></div>
      </div>

      <!-- 下钻数据摘要 -->
      <div v-if="result.result?.summary" class="drill-summary-section">
        <h4>数据摘要</h4>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="维度">{{ result.result.dimension }}</el-descriptions-item>
          <el-descriptions-item label="筛选值">{{ result.result.filterValue }}</el-descriptions-item>
          <template v-for="(val, key) in result.result.summary" :key="key">
            <el-descriptions-item v-if="key !== 'dimension'" :label="getColumnLabel(String(key))">
              {{ typeof val === 'number' ? val.toLocaleString() : val }}
            </el-descriptions-item>
          </template>
        </el-descriptions>
      </div>

      <!-- AI 洞察 -->
      <div v-if="result.aiInsight" class="drill-ai-section">
        <h4>AI 洞察</h4>
        <el-card shadow="never" class="drill-insight-card">
          <div class="analysis-content" v-html="formatAnalysis(result.aiInsight)"></div>
        </el-card>
      </div>

      <!-- 下钻数据表格 -->
      <div v-if="result.result?.data?.length" class="drill-table-section">
        <h4>详细数据 ({{ result.result.data.length }} 条)</h4>
        <el-table :data="result.result.data.slice(0, 20)" border stripe size="small" max-height="300">
          <el-table-column v-for="col in Object.keys(result.result.data[0] || {})" :key="col"
            :prop="col" :label="getColumnLabel(col)" min-width="100" show-overflow-tooltip />
        </el-table>
      </div>

      <!-- 错误态：API 返回失败 -->
      <div v-if="!result.success" class="drill-error">
        <el-empty :description="result.error || '下钻分析失败，请稍后重试'" />
      </div>
      <!-- 空数据态：成功但无任何可展示内容 -->
      <div v-else-if="!result.chartConfig && !result.result?.summary && !result.aiInsight && !result.result?.data?.length" class="drill-empty">
        <el-empty description="该数据点暂无可展开的明细数据" />
      </div>
    </div>

    <el-empty v-else description="暂无分析结果" />
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import type { DrillDownResult } from '@/api/smartbi';

interface DrillStackLevel {
  dimension: string;
  filterValue: string;
}

interface DrillContext {
  dimension?: string;
  filterValue?: string;
}

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  result: DrillDownResult | null;
  context: DrillContext;
  stack: DrillStackLevel[];
  formatAnalysis: (raw: string) => string;
  getColumnLabel: (col: string) => string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'drill-by-dimension', dim: string): void;
  (e: 'back-to-root'): void;
  (e: 'back-to', index: number): void;
  (e: 'close'): void;
}>();

const modelVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});

const onDrillByDimension = (dim: string) => emit('drill-by-dimension', dim);
const onBackToRoot = () => emit('back-to-root');
const onBackTo = (i: number) => emit('back-to', i);
const onClose = () => emit('close');
</script>
