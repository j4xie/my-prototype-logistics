<template>
  <div class="page-wrapper" ref="containerRef">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button text :icon="ArrowLeft" @click="$router.push('/restaurant/analytics')">返回</el-button>
            <span class="page-title">门店对比分析</span>
            <el-tag v-if="stores.length" size="small">{{ stores.length }} 家门店</el-tag>
          </div>
          <div class="header-right">
            <el-select v-model="selectedUploadId" placeholder="选择数据源" filterable style="width: 280px" @change="handleSelectUpload">
              <el-option v-for="u in uploads" :key="u.id" :label="`${u.fileName} (${u.rowCount}行)`" :value="u.id" />
            </el-select>
          </div>
        </div>
      </template>

      <div v-if="loading" v-loading="true" style="min-height: 400px" />
      <el-empty v-else-if="stores.length === 0" description="请选择数据源" />

      <template v-if="stores.length > 0 && !loading">
        <!-- Bar chart -->
        <el-card shadow="hover">
          <template #header><div class="chart-title">门店营收排名</div></template>
          <div id="chart-store-bar" style="height: 400px" />
        </el-card>

        <!-- Table -->
        <el-card shadow="hover" style="margin-top: 16px">
          <template #header><div class="chart-title">门店明细</div></template>
          <el-table :data="stores" stripe border style="width: 100%" max-height="600" :default-sort="{ prop: 'revenue', order: 'descending' }">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="name" label="门店" min-width="160" show-overflow-tooltip />
            <el-table-column prop="revenue" label="营收(元)" width="130" align="right" sortable>
              <template #default="{ row }">
                <span :class="{ 'weak-store': isWeakStore(row.name) }">{{ row.revenue.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="orderCount" label="品项数" width="100" align="right" sortable />
            <el-table-column prop="avgTicket" label="品均收入" width="110" align="right" sortable>
              <template #default="{ row }">¥{{ row.avgTicket.toFixed(0) }}</template>
            </el-table-column>
            <el-table-column prop="discountPct" label="折扣率" width="100" align="right" sortable>
              <template #default="{ row }">
                <span :class="{ 'high-discount': row.discountPct > 20 }">{{ row.discountPct.toFixed(1) }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="isWeakStore(row.name)" type="danger" size="small">异常</el-tag>
                <el-tag v-else-if="row.discountPct > 20" type="warning" size="small">折扣高</el-tag>
                <el-tag v-else type="success" size="small">正常</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- Weak stores alert -->
        <el-alert
          v-if="weakStores.length > 0"
          style="margin-top: 16px"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            <b>{{ weakStores.length }} 家门店营收低于中位数50%</b>
          </template>
          <div>{{ weakStores.join('、') }}</div>
        </el-alert>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { useChartResize } from '@/composables/useChartResize'
import { useRestaurantAnalytics } from '@/composables/useRestaurantAnalytics'
import type { StoreComparisonData } from '@/types/restaurant-analytics'

const containerRef = ref<HTMLElement>()
useChartResize(containerRef)

const {
  uploads, selectedUploadId, data: storeData, loading,
  handleSelectUpload,
} = useRestaurantAnalytics<StoreComparisonData>((result) => result.storeComparison)

const stores = computed(() => storeData.value?.stores ?? [])
const weakStores = computed(() => storeData.value?.weakStores ?? [])

// Re-render chart when data changes
watch(storeData, (val) => {
  if (val) nextTick(() => setTimeout(renderChart, 300))
})

function isWeakStore(name: string): boolean {
  return weakStores.value.includes(name)
}

function renderChart() {
  const el = document.getElementById('chart-store-bar')
  if (!el || stores.value.length === 0) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)

  const sorted = [...stores.value].sort((a, b) => a.revenue - b.revenue)
  const displayStores = sorted.length > 20 ? sorted.slice(-20) : sorted

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0]
        const store = stores.value.find(s => s.name === p.name)
        if (!store) return p.name
        return `<b>${store.name}</b><br/>营收: ¥${store.revenue.toLocaleString()}<br/>品均收入: ¥${store.avgTicket.toFixed(0)}<br/>折扣率: ${store.discountPct.toFixed(1)}%`
      },
    },
    grid: { left: 140, right: 30, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : String(v) },
    },
    yAxis: {
      type: 'category',
      data: displayStores.map(s => s.name),
      axisLabel: { width: 120, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      data: displayStores.map(s => ({
        value: s.revenue,
        itemStyle: {
          color: weakStores.value.includes(s.name) ? '#F56C6C'
            : s.discountPct > 20 ? '#E6A23C' : '#409EFF',
          borderRadius: [0, 4, 4, 0],
        },
      })),
      barMaxWidth: 20,
    }],
  })
}

// composable handles onMounted + auto-select
</script>

<style scoped>
.page-wrapper { padding: 16px; }
.page-card { border-radius: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.header-left { display: flex; align-items: center; gap: 8px; }
.header-right { display: flex; gap: 8px; }
.page-title { font-size: 16px; font-weight: 600; }
.chart-title { font-weight: 600; }
.weak-store { color: var(--el-color-danger); font-weight: 600; }
.high-discount { color: var(--el-color-warning); font-weight: 600; }
</style>
