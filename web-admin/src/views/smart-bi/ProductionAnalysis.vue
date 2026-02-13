<script setup lang="ts">
/**
 * 生产数据分析页面
 * 基于 SmartBI 组件模式，提供生产 KPI、多维度图表和 AI 洞察
 */
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { get } from '@/api/request'
import { useAuthStore } from '@/store/modules/auth'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { formatNumber } from '@/utils/format-number'
import { ElMessage } from 'element-plus'

const authStore = useAuthStore()
const factoryId = computed(() => authStore.factoryId)

const period = ref('month')
const dimension = ref('date')
const loading = ref(false)
const kpiData = ref<Array<{ label: string; value: string; gradient: string; change?: string; changeType?: string }>>([])
const charts = ref<Array<{ title: string; option: Record<string, unknown> }>>([])
const chartRefs = ref<Array<HTMLDivElement | null>>([])
const chartInstances = ref<echarts.ECharts[]>([])
const aiAnalysis = ref('')
const tableData = ref<Record<string, unknown>[]>([])
const tableColumns = ref<string[]>([])
const renderedAnalysis = computed(() => aiAnalysis.value ? DOMPurify.sanitize(marked(aiAnalysis.value) as string) : '')

let refreshTimer: ReturnType<typeof setInterval> | null = null

async function loadData() {
  if (!factoryId.value) {
    console.error('No factoryId available')
    ElMessage.error('无法获取工厂信息，请重新登录')
    return
  }
  loading.value = true
  try {
    const res = await get<Record<string, unknown>>(`/${factoryId.value}/smart-bi/production-analysis/dashboard`, {
      params: { period: period.value }
    })
    if (res?.success !== false) {
      const data = (res.data || res) as Record<string, unknown>
      processKPIs((data.dailySummary as Record<string, unknown>[]) || [])
      buildCharts(data)
      await loadDimensionData()
    }
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status === 404) {
      console.info('Production analysis endpoint not available yet')
    } else {
      console.error('Load production analysis failed:', e)
      ElMessage.error('加载生产分析数据失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

async function loadDimensionData() {
  try {
    const res = await get<Record<string, unknown>[]>(`/${factoryId.value}/smart-bi/production-analysis/data`, {
      params: { dimension: dimension.value, period: period.value }
    })
    if (res?.success !== false) {
      const rows = (res.data || res || []) as Record<string, unknown>[]
      tableData.value = rows
      tableColumns.value = rows.length > 0 ? Object.keys(rows[0]) : []
    }
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status !== 404) {
      console.error('Load dimension data failed:', e)
    }
  }
}

function processKPIs(dailySummary: Record<string, unknown>[]) {
  if (!dailySummary || dailySummary.length === 0) {
    kpiData.value = []
    return
  }
  const totalOutput = dailySummary.reduce((s: number, r) => s + (Number(r['totalOutput'] || r['totalQuantity'] || 0)), 0)
  const avgYield = dailySummary.reduce((s: number, r) => s + (Number(r['avgYieldRate'] || r['yieldRate'] || 0)), 0) / dailySummary.length
  const totalCost = dailySummary.reduce((s: number, r) => s + (Number(r['totalCost'] || 0)), 0)
  const totalBatches = dailySummary.reduce((s: number, r) => s + (Number(r['batchCount'] || 0)), 0)

  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  ]

  kpiData.value = [
    { label: '总产量', value: formatNumber(totalOutput), gradient: gradients[0] },
    { label: '平均良率', value: avgYield.toFixed(1) + '%', gradient: gradients[1] },
    { label: '总成本', value: '¥' + formatNumber(totalCost), gradient: gradients[2] },
    { label: '总批次数', value: totalBatches.toString(), gradient: gradients[3] },
  ]
}

// formatNumber imported from @/utils/format-number

function buildCharts(data: Record<string, unknown>) {
  const chartConfigs: Array<{ title: string; option: Record<string, unknown> }> = []
  const dailySummary = (data.dailySummary || []) as Record<string, unknown>[]
  const byProduct = (data.byProduct || []) as Record<string, unknown>[]
  const byEquipment = (data.byEquipment || []) as Record<string, unknown>[]
  const byPersonnel = (data.byPersonnel || []) as Record<string, unknown>[]

  // Chart 1: Daily output trend (line)
  if (dailySummary.length > 0) {
    chartConfigs.push({
      title: '日产量趋势',
      option: {
        tooltip: { trigger: 'axis' },
        legend: { data: ['总产量', '合格产量', '缺陷数'] },
        xAxis: { type: 'category', data: dailySummary.map(r => String(r['date'] || r['日期'] || '')) },
        yAxis: { type: 'value', name: '数量' },
        series: [
          { name: '总产量', type: 'line', data: dailySummary.map(r => Number(r['totalOutput'] || r['totalQuantity'] || 0)), smooth: true, areaStyle: { opacity: 0.1 } },
          { name: '合格产量', type: 'line', data: dailySummary.map(r => Number(r['qualifiedOutput'] || r['qualifiedQuantity'] || 0)), smooth: true },
          { name: '缺陷数', type: 'line', data: dailySummary.map(r => Number(r['defectCount'] || 0)), smooth: true, lineStyle: { type: 'dashed' } },
        ]
      }
    })
  }

  // Chart 2: Yield rate trend (line + markLine)
  if (dailySummary.length > 0) {
    chartConfigs.push({
      title: '良率趋势',
      option: {
        tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
        xAxis: { type: 'category', data: dailySummary.map(r => String(r['date'] || r['日期'] || '')) },
        yAxis: { type: 'value', name: '良率(%)', min: 0, max: 100 },
        series: [{
          name: '良率', type: 'line',
          data: dailySummary.map(r => Number(r['avgYieldRate'] || r['yieldRate'] || 0)),
          smooth: true, areaStyle: { opacity: 0.15 },
          markLine: { data: [{ yAxis: 95, name: '目标', lineStyle: { color: '#E6A23C', type: 'dashed' } }] },
          markPoint: { data: [{ type: 'min', name: '最低' }, { type: 'max', name: '最高' }] }
        }]
      }
    })
  }

  // Chart 3: Product output comparison (bar)
  if (byProduct.length > 0) {
    chartConfigs.push({
      title: '产品产量对比',
      option: {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: byProduct.map(r => String(r['productName'] || '')), axisLabel: { rotate: 30 } },
        yAxis: { type: 'value', name: '产量' },
        series: [{
          type: 'bar',
          data: byProduct.map(r => Number(r['totalOutput'] || r['totalQuantity'] || 0)),
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }]
      }
    })
  }

  // Chart 4: Equipment efficiency (horizontal bar)
  if (byEquipment.length > 0) {
    chartConfigs.push({
      title: '设备效率排行',
      option: {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', name: '效率(%)' },
        yAxis: { type: 'category', data: byEquipment.map(r => String(r['equipmentName'] || r['equipmentId'] || '')) },
        series: [{ type: 'bar', data: byEquipment.map(r => Number(r['avgEfficiency'] || 0)) }]
      }
    })
  }

  // Chart 5: Personnel ranking (horizontal bar)
  if (byPersonnel.length > 0) {
    chartConfigs.push({
      title: '人员产出排行',
      option: {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'value', name: '产量' },
        yAxis: { type: 'category', data: byPersonnel.map(r => String(r['operatorName'] || r['personnelName'] || '')) },
        series: [{ type: 'bar', data: byPersonnel.map(r => Number(r['totalOutput'] || r['totalQuantity'] || 0)) }]
      }
    })
  }

  charts.value = chartConfigs

  // AI analysis (if included in response)
  if (typeof data.aiAnalysis === 'string') {
    aiAnalysis.value = data.aiAnalysis
  }

  nextTick(() => {
    // Dispose old instances
    chartInstances.value.forEach(c => c?.dispose())
    chartInstances.value = []

    chartConfigs.forEach((cfg, idx) => {
      const el = chartRefs.value[idx]
      if (el) {
        const instance = echarts.init(el, 'cretas')
        instance.setOption(cfg.option)
        chartInstances.value.push(instance)
      }
    })
  })
}

function handleResize() {
  chartInstances.value.forEach(c => c?.resize())
}

onMounted(() => {
  loadData()
  refreshTimer = setInterval(loadData, 60000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  window.removeEventListener('resize', handleResize)
  chartInstances.value.forEach(c => c?.dispose())
})
</script>

<template>
  <div class="production-analysis" role="main" aria-label="生产数据分析">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi/dashboard' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>生产数据分析</el-breadcrumb-item>
        </el-breadcrumb>
        <h2>生产数据分析</h2>
      </div>
      <div class="controls">
        <el-select v-model="period" placeholder="选择周期" @change="loadData" style="width: 120px">
          <el-option label="本周" value="week" />
          <el-option label="本月" value="month" />
          <el-option label="本季度" value="quarter" />
          <el-option label="本年" value="year" />
        </el-select>
        <el-select v-model="dimension" placeholder="分析维度" @change="loadDimensionData" style="width: 120px; margin-left: 12px">
          <el-option label="按日期" value="date" />
          <el-option label="按产品" value="product" />
          <el-option label="按设备" value="equipment" />
          <el-option label="按人员" value="personnel" />
        </el-select>
        <el-button type="primary" :icon="Refresh" @click="loadData" :loading="loading" style="margin-left: 12px">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Empty state -->
    <el-empty v-if="!loading && kpiData.length === 0 && charts.length === 0" description="暂无生产分析数据" />

    <!-- KPI Cards -->
    <div class="kpi-row" v-if="kpiData.length > 0" aria-label="KPI指标" aria-live="polite" :aria-busy="loading">
      <div v-for="kpi in kpiData" :key="kpi.label" class="kpi-card" :style="{ background: kpi.gradient }">
        <div class="kpi-value">{{ kpi.value }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
        <div class="kpi-change" v-if="kpi.change">
          <span :class="kpi.changeType === 'up' ? 'change-up' : 'change-down'">
            {{ kpi.changeType === 'up' ? '\u2191' : '\u2193' }} {{ kpi.change }}
          </span>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="charts-grid" v-loading="loading" aria-label="图表区域" :aria-busy="loading">
      <div class="chart-card" v-for="(chart, idx) in charts" :key="idx">
        <h3 class="chart-title">{{ chart.title }}</h3>
        <div :ref="el => chartRefs[idx] = (el as HTMLDivElement)" class="chart-container" style="height: 350px"></div>
      </div>
    </div>

    <!-- AI Analysis -->
    <div class="ai-section" v-if="aiAnalysis" aria-label="AI分析洞察" aria-live="polite">
      <h3><span class="ai-icon">AI</span> 生产分析洞察</h3>
      <div class="ai-content" v-html="renderedAnalysis"></div>
    </div>

    <!-- Data Table -->
    <div class="data-section" v-if="tableData.length > 0" aria-label="详细数据">
      <h3>详细数据</h3>
      <el-table :data="tableData" stripe border style="width: 100%" max-height="400">
        <el-table-column v-for="col in tableColumns" :key="col" :prop="col" :label="col" min-width="120" />
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.production-analysis {
  padding: var(--page-padding);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.controls {
  display: flex;
  align-items: center;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  padding: 20px;
  border-radius: var(--radius-lg);
  color: #fff;
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
}

.kpi-label {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
}

.kpi-change {
  margin-top: 8px;
  font-size: 13px;
}

.change-up {
  color: #dcfce7;
}

.change-down {
  color: #fecaca;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #303133;
}

.ai-section {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);

  h3 {
    margin: 0 0 12px 0;
    color: #303133;
  }
}

.ai-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  margin-right: 6px;
  vertical-align: middle;
}

.ai-content {
  line-height: 1.7;
  color: #333;
}

.data-section {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);

  h3 {
    margin: 0 0 12px 0;
    color: #303133;
  }
}

.header-left {
  h2 {
    margin: 12px 0 0;
    font-size: 20px;
    color: #303133;
  }
}

@media (max-width: 1024px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 300px;
  }
}

@media (max-width: 768px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }

  .production-analysis {
    padding: 12px;
  }

  .chart-container {
    height: 250px;
  }

  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>
