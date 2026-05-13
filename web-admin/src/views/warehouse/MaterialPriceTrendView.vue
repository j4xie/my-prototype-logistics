<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';
import echarts from '@/utils/echarts';
import type { ECharts } from 'echarts/core';

// ---------- auth ----------
const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canViewPrice = computed(() => permissionStore.canViewPrice);

// ---------- state ----------
const loading = ref(false);
const tableData = ref<MaterialRow[]>([]);
const searchKeyword = ref('');

// Chart instances keyed by materialTypeId
const chartInstances = ref<Record<string, ECharts>>({});
const expandLoading = ref<Record<string, boolean>>({});
const expandBatches = ref<Record<string, BatchData[]>>({});

// ---------- types ----------
interface MaterialRow {
  id: string;
  name: string;
  code?: string;
  category?: string;
  unit?: string;
  movingAvgPrice?: number;
  unitPrice?: number;
  currentStock?: number;
  totalStock?: number;
}

interface BatchData {
  id: string;
  batchNumber: string;
  unitPrice: number | null;
  receivedDate: string;
  quantity: number;
}

// ---------- computed ----------
const filteredData = computed(() => {
  if (!searchKeyword.value) return tableData.value;
  const kw = searchKeyword.value.toLowerCase();
  return tableData.value.filter(
    r => (r.name || '').toLowerCase().includes(kw)
      || (r.code || '').toLowerCase().includes(kw)
      || (r.category || '').toLowerCase().includes(kw)
  );
});

// ---------- load ----------
onMounted(() => {
  loadMaterials();
});

onBeforeUnmount(() => {
  // Dispose all chart instances
  Object.values(chartInstances.value).forEach(c => {
    if (c && !c.isDisposed?.()) c.dispose();
  });
  chartInstances.value = {};
});

async function loadMaterials() {
  if (!factoryId.value) return;
  loading.value = true;
  try {
    const response = await get<MaterialRow[]>(
      `/${factoryId.value}/raw-material-types/active`
    );
    if (response.success && response.data) {
      tableData.value = Array.isArray(response.data) ? response.data : [];
    }
  } catch (error) {
    console.error('Failed to load materials:', error);
    ElMessage.error('加载物料列表失败');
  } finally {
    loading.value = false;
  }
}

// ---------- expand & chart ----------
async function handleExpandChange(row: MaterialRow, expandedRows: MaterialRow[]) {
  const isExpanded = expandedRows.some(r => r.id === row.id);
  if (!isExpanded) {
    // Dispose chart when collapsing
    const chart = chartInstances.value[row.id];
    if (chart && !chart.isDisposed?.()) chart.dispose();
    delete chartInstances.value[row.id];
    return;
  }

  if (expandBatches.value[row.id]) {
    // Already loaded, just re-init chart
    await nextTick();
    initChart(row.id);
    return;
  }

  expandLoading.value[row.id] = true;
  try {
    const res = await get<{ content: BatchData[] } | BatchData[]>(
      `/${factoryId.value}/material-batches`,
      { params: { materialTypeId: row.id, size: 50, sort: 'receivedDate,asc' } }
    );
    if (res.success && res.data) {
      const batches = Array.isArray(res.data)
        ? res.data
        : (res.data as { content: BatchData[] }).content || [];
      expandBatches.value[row.id] = batches;
    } else {
      expandBatches.value[row.id] = [];
    }
  } catch {
    expandBatches.value[row.id] = [];
  } finally {
    expandLoading.value[row.id] = false;
  }

  await nextTick();
  initChart(row.id);
}

function initChart(materialId: string) {
  const el = document.getElementById(`price-chart-${materialId}`);
  if (!el) return;

  // Dispose existing if any
  const existing = chartInstances.value[materialId];
  if (existing && !existing.isDisposed?.()) existing.dispose();

  const batches = expandBatches.value[materialId] || [];
  const withPrice = batches.filter(b => b.unitPrice != null && b.unitPrice > 0);

  if (withPrice.length === 0) return;

  const chart = echarts.init(el, 'cretas');
  chartInstances.value[materialId] = chart;

  const dates = withPrice.map(b => {
    const d = b.receivedDate || '';
    return d.length >= 10 ? d.substring(0, 10) : d;
  });
  const prices = withPrice.map(b => b.unitPrice);

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: { name: string; value: number }[]) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const p = params[0];
        return `${p.name}<br/>单价: ¥${Number(p.value).toFixed(2)}`;
      },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { fontSize: 11, rotate: dates.length > 8 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (v: number) => `¥${v}`,
      },
    },
    series: [
      {
        type: 'line',
        data: prices,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(45, 139, 87, 0.25)' },
              { offset: 1, color: 'rgba(45, 139, 87, 0.02)' },
            ],
          },
        },
      },
    ],
  });
}

// ---------- helpers ----------
function formatPrice(val: number | null | undefined): string {
  if (val == null) return '-';
  return `¥${Number(val).toFixed(2)}`;
}

function handleSearch() {
  // Client-side filtering via computed, no need to reload
}

function handleReset() {
  searchKeyword.value = '';
}

// ---------- resize ----------
function handleResize() {
  Object.values(chartInstances.value).forEach(c => {
    if (c && !c.isDisposed?.()) c.resize();
  });
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">物料移动均价趋势</span>
            <span class="data-count">共 {{ filteredData.length }} 种物料</span>
          </div>
        </div>
      </template>

      <!-- Search bar -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索物料名称 / 编号 / 类别"
          :prefix-icon="Search"
          clearable
          style="width: 300px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- Main Table -->
      <el-table
        :data="filteredData"
        v-loading="loading"
        empty-text="暂无物料数据"
        stripe
        border
        style="width: 100%"
        row-key="id"
        @expand-change="handleExpandChange"
      >
        <el-table-column v-if="canViewPrice" type="expand">
          <template #default="{ row }">
            <div class="expand-content" v-loading="expandLoading[row.id]">
              <div
                v-if="expandBatches[row.id] && expandBatches[row.id].filter((b: BatchData) => b.unitPrice != null && b.unitPrice > 0).length > 0"
                class="chart-container"
              >
                <div class="chart-title">采购单价趋势</div>
                <div :id="`price-chart-${row.id}`" class="chart-box"></div>
              </div>
              <el-empty
                v-else-if="!expandLoading[row.id]"
                description="暂无价格趋势数据"
                :image-size="60"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="物料名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="category" label="类别" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.category" size="small" type="info" effect="plain">
              {{ row.category }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column v-if="canViewPrice" label="当前均价" width="130" align="right">
          <template #default="{ row }">
            <span class="price-value">
              {{ formatPrice(row.movingAvgPrice ?? row.unitPrice) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="canViewPrice" label="最近入库价" width="130" align="right">
          <template #default="{ row }">
            {{ formatPrice(row.unitPrice) }}
          </template>
        </el-table-column>
        <el-table-column label="库存量" width="120" align="right">
          <template #default="{ row }">
            {{ row.currentStock ?? row.totalStock ?? '-' }}
            <span v-if="row.unit && (row.currentStock ?? row.totalStock) != null" class="unit-text">
              {{ row.unit }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.page-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.page-card {
  flex: 1;
  display: flex;
  flex-direction: column;

  :deep(.el-card__header) {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color-lighter, #ebeef5);
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-primary, #303133);
    }

    .data-count {
      font-size: 13px;
      color: var(--text-color-secondary, #909399);
    }
  }
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.el-table {
  flex: 1;
}

.price-value {
  font-weight: 600;
  color: var(--text-color-primary, #303133);
}

.unit-text {
  font-size: 12px;
  color: var(--text-color-secondary, #909399);
  margin-left: 2px;
}

.expand-content {
  min-height: 60px;
  padding: 12px 48px;
}

.chart-container {
  .chart-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-color-secondary, #606266);
    margin-bottom: 8px;
  }

  .chart-box {
    width: 100%;
    height: 260px;
  }
}
</style>
