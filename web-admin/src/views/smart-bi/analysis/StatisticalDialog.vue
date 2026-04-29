<template>
  <el-dialog v-model="modelVisible" title="因果分析" width="90%" top="3vh" destroy-on-close @close="onClose">
    <!-- Sheet 选择器 -->
    <div v-if="!loading && !result" class="yoy-sheet-selector">
      <p style="margin-bottom: 12px; color: var(--color-text-regular, #606266);">选择要分析的报表：</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <el-button
          v-for="sheet in availableSheets"
          :key="sheet.uploadId"
          @click="onRunForSheet(sheet)"
          size="default"
        >
          {{ getSheetDisplayName(sheet) }}
        </el-button>
      </div>
    </div>

    <div v-else-if="loading" class="cross-sheet-loading">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <p>正在进行统计分析...</p>
    </div>

    <div v-else-if="result && result.success">
      <!-- 相关性热力图 (composable mounts ECharts into id 'stat-heatmap-chart') -->
      <div v-if="result.correlations?.matrix && Object.keys(result.correlations.matrix).length >= 2" class="stat-section">
        <h3>相关性热力图</h3>
        <div id="stat-heatmap-chart" class="stat-chart-container" style="height: 450px;"></div>

        <!-- 强相关 pairs -->
        <div v-if="result.correlations.strongPositive?.length || result.correlations.strongNegative?.length" class="stat-pairs">
          <h4>关键相关性发现</h4>
          <div class="stat-pair-list">
            <el-tag v-for="(pair, i) in result.correlations.strongPositive" :key="'pos-'+i" type="success" effect="light" size="default" style="margin: 4px;">
              {{ pair.var1 }} &harr; {{ pair.var2 }} (r={{ pair.correlation.toFixed(2) }}, 强正相关)
            </el-tag>
            <el-tag v-for="(pair, i) in result.correlations.strongNegative" :key="'neg-'+i" type="danger" effect="light" size="default" style="margin: 4px;">
              {{ pair.var1 }} &harr; {{ pair.var2 }} (r={{ pair.correlation.toFixed(2) }}, 强负相关)
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 分布分析 -->
      <div v-if="Object.keys(result.distributions || {}).length" class="stat-section">
        <h3>分布分析</h3>
        <el-table :data="distributionTableData" border stripe size="small" max-height="350">
          <el-table-column prop="column" label="指标" min-width="150" fixed />
          <el-table-column prop="mean" label="均值" min-width="100" />
          <el-table-column prop="median" label="中位数" min-width="100" />
          <el-table-column prop="std" label="标准差" min-width="100" />
          <el-table-column prop="min" label="最小值" min-width="100" />
          <el-table-column prop="max" label="最大值" min-width="100" />
          <el-table-column prop="distributionType" label="分布类型" min-width="120">
            <template #default="{ row }">
              <el-tag :type="row.isNormal ? 'success' : 'warning'" size="small">
                {{ distributionTypeLabel(row.distributionType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="cv" label="变异系数" min-width="100" />
        </el-table>
      </div>

      <!-- 对比分析 (Pareto, 集中度) -->
      <div v-if="Object.keys(result.comparisons || {}).length" class="stat-section">
        <h3>集中度分析</h3>
        <div v-for="(comp, dim) in result.comparisons" :key="dim" class="stat-comparison-card">
          <el-descriptions :title="`维度: ${dim}`" :column="3" border size="small">
            <el-descriptions-item label="CR3 (前3集中度)">{{ (comp.cr3 ?? 0).toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="CR5 (前5集中度)">{{ (comp.cr5 ?? 0).toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="基尼系数">{{ (comp.giniCoefficient ?? 0).toFixed(3) }}</el-descriptions-item>
            <el-descriptions-item label="帕累托数量">{{ comp.paretoCount ?? 0 }} / {{ comp.totalItems ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="帕累托比例">{{ (comp.paretoRatio ?? 0).toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="度量">{{ comp.measure }}</el-descriptions-item>
          </el-descriptions>
          <div class="stat-top-bottom">
            <div>
              <h5>Top 3</h5>
              <el-tag v-for="(val, key) in comp.top3" :key="'top-'+key" type="success" effect="plain" style="margin: 2px;">
                {{ key }}: {{ Number(val).toLocaleString() }}
              </el-tag>
            </div>
            <div>
              <h5>Bottom 3</h5>
              <el-tag v-for="(val, key) in comp.bottom3" :key="'bot-'+key" type="info" effect="plain" style="margin: 2px;">
                {{ key }}: {{ Number(val).toLocaleString() }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 异常值 -->
      <div v-if="Object.keys(result.outlierSummary || {}).length" class="stat-section">
        <h3>异常值检测</h3>
        <div class="stat-outlier-list">
          <el-tag v-for="(info, col) in result.outlierSummary" :key="col" type="warning" effect="light" style="margin: 4px;">
            {{ col }}: {{ info.count }} 个异常值
          </el-tag>
        </div>
      </div>

      <div style="margin-top: 12px; color: var(--color-text-secondary, #909399); font-size: 12px;">
        分析耗时: {{ result.processingTimeMs }}ms
      </div>
    </div>

    <div v-else-if="result && !result.success">
      <el-empty :description="result.error || '分析失败'" />
    </div>

    <template #footer>
      <div v-if="result">
        <el-button @click="onReset">返回选择</el-button>
        <el-button v-if="result.success" type="primary" @click="modelVisible = false">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import type { StatisticalResult, SheetResult } from '@/api/smartbi';

interface DistributionRow {
  column: string;
  mean: string;
  median: string;
  std: string;
  min: string;
  max: string;
  distributionType: string;
  isNormal: boolean;
  cv: string;
}

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  result: StatisticalResult | null;
  distributionTableData: DistributionRow[];
  distributionTypeLabel: (type: string) => string;
  availableSheets: SheetResult[];
  getSheetDisplayName: (sheet: SheetResult) => string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'run-for-sheet', sheet: SheetResult): void;
  (e: 'reset'): void;
  (e: 'close'): void;
}>();

const modelVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});

const onRunForSheet = (sheet: SheetResult) => emit('run-for-sheet', sheet);
const onReset = () => emit('reset');
const onClose = () => emit('close');
</script>
