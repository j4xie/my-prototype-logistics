<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { usePermissionStore } from '@/store/modules/permission';
import { get } from '@/api/request';
import { ElMessage } from 'element-plus';
import { Money, TrendCharts, Coin, Download } from '@element-plus/icons-vue';

const authStore = useAuthStore();
const permissionStore = usePermissionStore();
const factoryId = computed(() => authStore.factoryId);
const canRead = computed(() => permissionStore.canRead('finance'));

const loading = ref(false);
const dateRange = ref<[Date, Date]>([
  new Date(new Date().setDate(new Date().getDate() - 30)),
  new Date()
]);

// 财务报表数据
const financeData = ref<{
  totalRevenue?: number;
  totalCost?: number;
  grossProfit?: number;
  profitMargin?: number;
  materialCost?: number;
  laborCost?: number;
  equipmentCost?: number;
  otherCost?: number;
  dailyStats?: Array<{ date: string; revenue: number; cost: number; profit: number }>;
}>({});

const statCards = computed(() => [
  {
    title: '总收入',
    value: financeData.value.totalRevenue ?? 0,
    unit: '元',
    icon: Money,
    color: '#409eff',
    format: (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  },
  {
    title: '总成本',
    value: financeData.value.totalCost ?? 0,
    unit: '元',
    icon: Coin,
    color: '#e6a23c',
    format: (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  },
  {
    title: '毛利润',
    value: financeData.value.grossProfit ?? 0,
    unit: '元',
    icon: TrendCharts,
    color: '#67c23a',
    format: (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
  },
  {
    title: '利润率',
    value: financeData.value.profitMargin ?? 0,
    unit: '%',
    icon: TrendCharts,
    color: '#f56c6c',
    format: (v: number) => v.toFixed(1)
  }
]);

// 成本分解表格
const costBreakdown = computed(() => [
  { name: '原材料成本', value: financeData.value.materialCost ?? 0, percentage: getPercentage('material') },
  { name: '人工成本', value: financeData.value.laborCost ?? 0, percentage: getPercentage('labor') },
  { name: '设备成本', value: financeData.value.equipmentCost ?? 0, percentage: getPercentage('equipment') },
  { name: '其他成本', value: financeData.value.otherCost ?? 0, percentage: getPercentage('other') }
]);

function getPercentage(type: string) {
  const total = financeData.value.totalCost ?? 1;
  const value = financeData.value[`${type}Cost` as keyof typeof financeData.value] as number ?? 0;
  return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
}

onMounted(() => {
  loadFinanceData();
});

async function loadFinanceData() {
  if (!factoryId.value) return;

  loading.value = true;
  try {
    if (!dateRange.value) return;
    const [startDate, endDate] = dateRange.value;
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const response = await get<any>(`/${factoryId.value}/smart-bi/analysis/finance?startDate=${startStr}&endDate=${endStr}`);
    if (response.success && response.data) {
      financeData.value = response.data;
    } else {
      ElMessage.error('加载财务数据失败');
    }
  } catch (error) {
    console.error('加载财务数据失败:', error);
    ElMessage.error('加载财务数据失败，请检查网络连接');
  } finally {
    loading.value = false;
  }
}

function formatDate(date: Date | null | undefined) {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

function handleDateChange() {
  loadFinanceData();
}

function handleExport() {
  const data = financeData.value;
  if (!data || (!data.totalRevenue && !data.totalCost)) {
    ElMessage.warning('暂无数据可导出');
    return;
  }
  const [startDate, endDate] = dateRange.value;
  const headers = ['项目', '金额(元)', '占比(%)'];
  const rows = [
    ['总收入', String(data.totalRevenue ?? 0), '-'],
    ['总成本', String(data.totalCost ?? 0), '100.0'],
    ['  原材料成本', String(data.materialCost ?? 0), getPercentage('material')],
    ['  人工成本', String(data.laborCost ?? 0), getPercentage('labor')],
    ['  设备成本', String(data.equipmentCost ?? 0), getPercentage('equipment')],
    ['  其他成本', String(data.otherCost ?? 0), getPercentage('other')],
    ['毛利润', String(data.grossProfit ?? 0), '-'],
    ['利润率(%)', String((data.profitMargin ?? 0).toFixed(1)), '-']
  ];
  const csvContent = '\uFEFF' + [
    [`财务报表 (${formatDate(startDate)} ~ ${formatDate(endDate)})`],
    [],
    headers,
    ...rows
  ].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `财务报表_${formatDate(startDate)}_${formatDate(endDate)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('导出成功');
}
</script>

<template>
  <div class="page-wrapper" v-loading="loading">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="page-title">财务报表</span>
          <div class="header-actions">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :shortcuts="[
                { text: '最近一周', value: () => [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()] },
                { text: '最近一月', value: () => [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()] },
                { text: '最近三月', value: () => [new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()] }
              ]"
              @change="handleDateChange"
            />
            <el-button type="primary" :icon="Download" @click="handleExport">
              导出报表
            </el-button>
          </div>
        </div>
      </template>

      <!-- 统计卡片 -->
      <div class="stat-cards">
        <el-card v-for="card in statCards" :key="card.title" class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon" :style="{ backgroundColor: `${card.color}20`, color: card.color }">
              <el-icon :size="24"><component :is="card.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-title">{{ card.title }}</div>
              <div class="stat-value" :style="{ color: card.color }">
                {{ card.format(card.value) }} <span class="stat-unit">{{ card.unit }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 成本分解 -->
      <div class="section">
        <h3 class="section-title">成本分解</h3>
        <el-table empty-text="暂无数据" :data="costBreakdown" stripe border style="width: 100%">
          <el-table-column prop="name" label="成本类型" width="180" />
          <el-table-column label="金额 (元)" min-width="200">
            <template #default="{ row }">
              <span class="cost-value">{{ row.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="占比" width="150">
            <template #default="{ row }">
              <el-progress
                :percentage="parseFloat(row.percentage)"
                :color="row.percentage > 50 ? '#f56c6c' : row.percentage > 30 ? '#e6a23c' : '#67c23a'"
                :format="() => `${row.percentage}%`"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 提示信息 -->
      <div class="info-section">
        <el-alert
          title="数据说明"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            当前显示的是所选日期范围内的财务汇总数据。详细的成本分析请前往"成本分析"页面查看。
          </template>
        </el-alert>
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
    overflow: auto;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;

  .page-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-primary, #303133);
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  :deep(.el-card__body) {
    padding: 16px;
  }
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-info {
  flex: 1;
}

.stat-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
}

.stat-unit {
  font-size: 12px;
  font-weight: normal;
  margin-left: 4px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-left: 10px;
  border-left: 3px solid #409eff;
}

.cost-value {
  font-weight: 500;
  color: #303133;
}

.info-section {
  margin-top: auto;
}
</style>
