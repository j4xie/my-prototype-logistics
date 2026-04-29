<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Search, Refresh } from '@element-plus/icons-vue';
import { formatDateTimeCell } from '@/utils/tableFormatters';

// ---------- auth ----------
const authStore = useAuthStore();
const factoryId = computed(() => authStore.factoryId);

// ---------- state ----------
const loading = ref(false);
const tableData = ref<ProcessIORow[]>([]);
const dateRange = ref<[string, string] | null>(null);
const selectedProduct = ref('');
const productTypes = ref<ProductType[]>([]);

// ---------- types ----------
interface ProcessIORow {
  processName: string;
  processCategory: string;
  inputQuantity: number;
  outputQuantity: number;
  conversionRate: number;
  wastageRate: number;
  unit: string;
  batchCount: number;
}

interface ProductType {
  id: string;
  name: string;
}

interface ProcessTaskItem {
  id: string;
  processName?: string;
  productName?: string;
  productTypeId?: string;
  plannedQuantity: number;
  completedQuantity: number;
  unit: string;
  status: string;
  createdAt: string;
}

// ---------- KPI ----------
const kpi = computed(() => {
  const rows = tableData.value;
  if (rows.length === 0) return { processCount: 0, avgConversion: 0, avgWastage: 0, lowEfficiencyCount: 0 };

  const avgConversion = rows.reduce((s, r) => s + r.conversionRate, 0) / rows.length;
  const avgWastage = rows.reduce((s, r) => s + r.wastageRate, 0) / rows.length;
  const lowEfficiency = rows.filter(r => r.conversionRate < 80).length;

  return {
    processCount: rows.length,
    avgConversion: Math.round(avgConversion * 10) / 10,
    avgWastage: Math.round(avgWastage * 10) / 10,
    lowEfficiencyCount: lowEfficiency,
  };
});

// ---------- load ----------
onMounted(() => {
  loadProductTypes();
  loadData();
});

async function loadProductTypes() {
  if (!factoryId.value) return;
  try {
    const response = await get<{ content: ProductType[] } | ProductType[]>(
      `/${factoryId.value}/product-types`
    );
    if (response.success && response.data) {
      const data = response.data;
      productTypes.value = Array.isArray(data) ? data : (data.content || []);
    }
  } catch (error: any) {
    console.error('加载产品类型失败:', error);
  }
}

async function loadData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    const params: Record<string, unknown> = {
      page: 1,
      size: 200, // Fetch enough tasks to aggregate by process
    };
    if (dateRange.value && dateRange.value[0]) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    if (selectedProduct.value) {
      params.productTypeId = selectedProduct.value;
    }

    const response = await get<{ content: ProcessTaskItem[]; totalElements: number }>(
      `/${factoryId.value}/process-tasks`, { params }
    );

    if (response.success && response.data) {
      const tasks = response.data.content || [];
      tableData.value = aggregateByProcess(tasks);
    } else {
      tableData.value = [];
    }
  } catch (error: any) {
    console.error('加载工序数据失败:', error);
    if (!error?.actionHint) ElMessage.error('加载数据失败');
    // TODO: If process-tasks API doesn't return enough data, consider using sample data
    tableData.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * Aggregate process tasks by processName to compute input/output comparison.
 * Input = plannedQuantity (what goes into the process)
 * Output = completedQuantity (what comes out)
 */
function aggregateByProcess(tasks: ProcessTaskItem[]): ProcessIORow[] {
  const map = new Map<string, {
    processName: string;
    processCategory: string;
    totalInput: number;
    totalOutput: number;
    unit: string;
    count: number;
  }>();

  for (const task of tasks) {
    const name = task.processName || '未知工序';
    const existing = map.get(name);

    if (existing) {
      existing.totalInput += task.plannedQuantity || 0;
      existing.totalOutput += task.completedQuantity || 0;
      existing.count += 1;
    } else {
      map.set(name, {
        processName: name,
        processCategory: '',
        totalInput: task.plannedQuantity || 0,
        totalOutput: task.completedQuantity || 0,
        unit: task.unit || '',
        count: 1,
      });
    }
  }

  return Array.from(map.values()).map(item => {
    const conversionRate = item.totalInput > 0
      ? Math.round((item.totalOutput / item.totalInput) * 1000) / 10
      : 0;
    const wastageRate = item.totalInput > 0
      ? Math.round(((item.totalInput - item.totalOutput) / item.totalInput) * 1000) / 10
      : 0;

    return {
      processName: item.processName,
      processCategory: item.processCategory,
      inputQuantity: Math.round(item.totalInput * 100) / 100,
      outputQuantity: Math.round(item.totalOutput * 100) / 100,
      conversionRate,
      wastageRate: Math.max(0, wastageRate),
      unit: item.unit,
      batchCount: item.count,
    };
  });
}

// ---------- helpers ----------
function getConversionTagType(rate: number): string {
  if (rate >= 90) return 'success';
  if (rate >= 80) return 'warning';
  return 'danger';
}

function getConversionColor(rate: number): string {
  if (rate >= 90) return '#67C23A';
  if (rate >= 80) return '#E6A23C';
  return '#F56C6C';
}

function getWastageTagType(rate: number): string {
  if (rate <= 5) return 'success';
  if (rate <= 15) return 'warning';
  return 'danger';
}

function handleSearch() {
  loadData();
}

function handleReset() {
  dateRange.value = null;
  selectedProduct.value = '';
  loadData();
}
</script>

<template>
  <div class="page-wrapper">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">工序级投入产出对比</span>
            <span class="data-count">共 {{ tableData.length }} 个工序</span>
          </div>
          <div class="header-right">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 280px"
              @change="handleSearch"
            />
          </div>
        </div>
      </template>

      <!-- KPI Row -->
      <div class="kpi-row">
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-value">{{ kpi.processCount }}</div>
          <div class="kpi-label">工序数量</div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-value" :style="{ color: getConversionColor(kpi.avgConversion) }">
            {{ kpi.avgConversion }}%
          </div>
          <div class="kpi-label">平均转化率</div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-value" style="color: #E6A23C">{{ kpi.avgWastage }}%</div>
          <div class="kpi-label">平均损耗率</div>
        </el-card>
        <el-card shadow="hover" class="kpi-card">
          <div class="kpi-value" style="color: #F56C6C">{{ kpi.lowEfficiencyCount }}</div>
          <div class="kpi-label">低效工序数 (&lt;80%)</div>
        </el-card>
      </div>

      <!-- Filter Bar -->
      <div class="search-bar">
        <el-select
          v-model="selectedProduct"
          placeholder="按产品筛选"
          clearable
          style="width: 220px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in productTypes"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- Main Table -->
      <el-table
        :data="tableData"
        v-loading="loading"
        empty-text="暂无工序数据"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="processName" label="工序名称" min-width="150" show-overflow-tooltip />
        <el-table-column label="投入量" width="130" align="right">
          <template #default="{ row }">
            {{ row.inputQuantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="产出量" width="130" align="right">
          <template #default="{ row }">
            {{ row.outputQuantity }} {{ row.unit }}
          </template>
        </el-table-column>
        <el-table-column label="转化率" width="130" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getConversionTagType(row.conversionRate)"
              size="small"
              effect="light"
            >
              {{ row.conversionRate }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="损耗率" width="130" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getWastageTagType(row.wastageRate)"
              size="small"
              effect="light"
            >
              {{ row.wastageRate }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="转化率进度" min-width="180">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(row.conversionRate, 100)"
              :color="getConversionColor(row.conversionRate)"
              :stroke-width="10"
              :show-text="false"
            />
          </template>
        </el-table-column>
        <el-table-column prop="batchCount" label="任务数" width="90" align="center" />
      </el-table>

      <!-- Legend -->
      <div class="rate-legend">
        <span class="legend-item">
          <span class="legend-dot success" />
          &ge;90% 优良
        </span>
        <span class="legend-item">
          <span class="legend-dot warning" />
          80%-90% 一般
        </span>
        <span class="legend-item">
          <span class="legend-dot danger" />
          &lt;80% 需改进
        </span>
      </div>
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
  flex-wrap: wrap;
  gap: 12px;

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

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.kpi-card {
  text-align: center;

  :deep(.el-card__body) {
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .kpi-value {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 4px;
  }

  .kpi-label {
    font-size: 13px;
    color: var(--text-color-secondary, #909399);
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

.rate-legend {
  display: flex;
  gap: 20px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color-lighter, #ebeef5);
  font-size: 12px;
  color: #909399;

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;

    &.success { background-color: #67C23A; }
    &.warning { background-color: #E6A23C; }
    &.danger { background-color: #F56C6C; }
  }
}

@media (max-width: 768px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
