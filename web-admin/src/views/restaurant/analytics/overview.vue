<template>
  <div class="page-wrapper" ref="containerRef">
    <el-card class="page-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="page-title">餐饮运营分析</span>
          </div>
          <div class="header-right">
            <el-select
              v-model="selectedUploadId"
              placeholder="选择数据源"
              filterable
              style="width: 320px"
              @change="handleSelectUpload"
            >
              <el-option
                v-for="u in uploads"
                :key="u.id"
                :label="`${u.fileName}${u.sheetName ? ' / ' + u.sheetName : ''} (${u.rowCount}行)`"
                :value="u.id"
              />
            </el-select>
            <el-button :icon="Refresh" :loading="loading" @click="handleRefresh">刷新分析</el-button>
          </div>
        </div>
      </template>

      <!-- Data quality warnings -->
      <el-alert
        v-if="dataQualityWarnings.length > 0"
        type="warning"
        :closable="true"
        show-icon
        style="margin-bottom: 12px"
      >
        <template #title>数据质量提示</template>
        <div v-for="(w, i) in dataQualityWarnings" :key="i" style="font-size: 12px">{{ w }}</div>
      </el-alert>

      <!-- Empty state -->
      <el-empty v-if="!loading && !data && uploads.length === 0" description="请先在智能BI中上传POS销售数据">
        <el-button type="primary" @click="$router.push('/smart-bi/upload')">前往上传</el-button>
      </el-empty>

      <el-empty v-else-if="!loading && !data && uploads.length > 0" description="请从上方选择一个餐饮数据源" />

      <!-- Loading -->
      <div v-if="loading" v-loading="true" style="min-height: 300px" />

      <!-- Analytics content -->
      <template v-if="data && !loading">
        <!-- KPI Cards -->
        <el-row :gutter="16" class="kpi-row">
          <el-col :xs="12" :sm="8" :md="4">
            <div class="kpi-card">
              <div class="kpi-label">总营收</div>
              <div class="kpi-value success">{{ formatMoney(totalRevenue) }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="kpi-card">
              <div class="kpi-label">菜品数</div>
              <div class="kpi-value">{{ data.menuQuadrant.items.length }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="kpi-card">
              <div class="kpi-label">门店数</div>
              <div class="kpi-value">{{ data.storeComparison.stores.length }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="kpi-card">
              <div class="kpi-label">明星菜品</div>
              <div class="kpi-value success">{{ data.menuQuadrant.summary.starCount }}</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="kpi-card">
              <div class="kpi-label">折扣预警</div>
              <div class="kpi-value" :class="data.discountAlerts.length > 0 ? 'danger' : ''">
                {{ data.discountAlerts.length }}
              </div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="kpi-card">
              <div class="kpi-label">子行业</div>
              <div class="kpi-value info">{{ data.benchmarksUsed }}</div>
            </div>
          </el-col>
        </el-row>

        <!-- Charts row -->
        <el-row :gutter="16" style="margin-top: 16px">
          <!-- Quadrant mini scatter -->
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card" @click="$router.push('/restaurant/analytics/menu')">
              <template #header>
                <div class="chart-title clickable">
                  菜品四象限
                  <el-tag size="small" type="info">点击查看详情</el-tag>
                </div>
              </template>
              <div id="chart-quadrant-mini" style="height: 280px" />
            </el-card>
          </el-col>

          <!-- Store ranking bar -->
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card" @click="$router.push('/restaurant/analytics/stores')">
              <template #header>
                <div class="chart-title clickable">
                  门店营收 Top 5
                  <el-tag size="small" type="info">点击查看详情</el-tag>
                </div>
              </template>
              <div id="chart-store-top5" style="height: 280px" />
            </el-card>
          </el-col>
        </el-row>

        <!-- Category breakdown -->
        <el-row :gutter="16" style="margin-top: 16px">
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card">
              <template #header><div class="chart-title">品类结构</div></template>
              <div id="chart-category-pie" style="height: 280px" />
            </el-card>
          </el-col>

          <!-- Operations metrics radar -->
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card" @click="$router.push('/restaurant/analytics/dianping')">
              <template #header>
                <div class="chart-title clickable">
                  经营指标 & 平台准入
                  <el-tag size="small" type="info">点击查看详情</el-tag>
                </div>
              </template>
              <div id="chart-ops-radar-mini" style="height: 280px" />
            </el-card>
          </el-col>
        </el-row>

        <!-- Trend analysis -->
        <el-row :gutter="16" style="margin-top: 16px" v-if="data.trendAnalysis">
          <el-col :xs="24" :md="16">
            <el-card shadow="hover" class="chart-card">
              <template #header>
                <div class="chart-title">
                  营收趋势
                  <el-tag v-if="data.trendAnalysis.popGrowth !== null" size="small"
                    :type="data.trendAnalysis.popGrowth >= 0 ? 'success' : 'danger'">
                    {{ data.trendAnalysis.popGrowth >= 0 ? '+' : '' }}{{ data.trendAnalysis.popGrowth }}% 环比
                  </el-tag>
                </div>
              </template>
              <div id="chart-trend-line" style="height: 280px" />
              <div class="chart-footer">
                共 {{ data.trendAnalysis.totalDays }} 天
                · 日均 ¥{{ formatMoney(data.trendAnalysis.avgDailyRevenue) }}
                · 峰值 {{ data.trendAnalysis.peakDay.date }} (¥{{ formatMoney(data.trendAnalysis.peakDay.revenue) }})
              </div>
            </el-card>
          </el-col>
          <el-col :xs="24" :md="8" v-if="data.trendAnalysis.weeklyTrend">
            <el-card shadow="hover" class="chart-card">
              <template #header><div class="chart-title">周度汇总</div></template>
              <div id="chart-weekly-bar" style="height: 280px" />
            </el-card>
          </el-col>
        </el-row>

        <!-- Time period analysis (hourly heatmap + meal periods) -->
        <el-row :gutter="16" style="margin-top: 16px" v-if="data.timePeriodAnalysis">
          <el-col :xs="24" :md="14">
            <el-card shadow="hover" class="chart-card">
              <template #header>
                <div class="chart-title">
                  时段分布
                  <el-tag size="small" type="success">高峰 {{ data.timePeriodAnalysis.peakHourLabel }}</el-tag>
                </div>
              </template>
              <div id="chart-hourly-bar" style="height: 280px" />
            </el-card>
          </el-col>
          <el-col :xs="24" :md="10">
            <el-card shadow="hover" class="chart-card">
              <template #header>
                <div class="chart-title">
                  餐段营收
                  <el-tag size="small">{{ data.timePeriodAnalysis.mainMealPeriod }} {{ data.timePeriodAnalysis.mainMealPct }}%</el-tag>
                </div>
              </template>
              <div id="chart-meal-pie" style="height: 240px" />
              <div class="chart-footer">
                工作日均 ¥{{ formatMoney(data.timePeriodAnalysis.weekdayAvg) }}
                · 周末均 ¥{{ formatMoney(data.timePeriodAnalysis.weekendAvg) }}
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- Dimension hints (missing columns) -->
        <el-row :gutter="16" style="margin-top: 12px" v-if="missingDimensions.length > 0">
          <el-col :span="24">
            <el-alert type="info" :closable="true" show-icon>
              <template #title>数据增强建议</template>
              <div style="font-size: 12px; line-height: 1.8">
                <div v-for="d in missingDimensions" :key="d.key">
                  <el-tag size="small" type="info" style="margin-right: 6px">{{ d.label }}</el-tag>
                  {{ d.hint }}
                </div>
              </div>
            </el-alert>
          </el-col>
        </el-row>

        <!-- Phase C: Extended analytics row -->
        <el-row :gutter="16" style="margin-top: 16px" v-if="data.priceBandAnalysis || data.categoryConcentration || data.storeEfficiencyMatrix">
          <!-- Price band distribution -->
          <el-col :xs="24" :md="8" v-if="data.priceBandAnalysis">
            <el-card shadow="hover" class="chart-card">
              <template #header>
                <div class="chart-title">
                  价格带分布
                  <el-tag size="small" :type="data.priceBandAnalysis.pricePositioning === '适中' ? 'success' : 'warning'">
                    {{ data.priceBandAnalysis.pricePositioning }}
                  </el-tag>
                </div>
              </template>
              <div id="chart-price-band" style="height: 240px" />
              <div class="chart-footer">
                主力价格带: <strong>{{ data.priceBandAnalysis.mainBand }}</strong>
                · 品均价 ¥{{ data.priceBandAnalysis.avgUnitPrice.toFixed(0) }}
              </div>
            </el-card>
          </el-col>

          <!-- Category concentration HHI -->
          <el-col :xs="24" :md="8" v-if="data.categoryConcentration">
            <el-card shadow="hover" class="chart-card">
              <template #header>
                <div class="chart-title">
                  品类集中度
                  <el-tag size="small" :type="data.categoryConcentration.concentrationLevel === '分散' ? 'success' : data.categoryConcentration.concentrationLevel === '中度集中' ? 'warning' : 'danger'">
                    {{ data.categoryConcentration.concentrationLevel }}
                  </el-tag>
                </div>
              </template>
              <div id="chart-hhi-gauge" style="height: 240px" />
              <div class="chart-footer">
                Top 3 占比: <strong>{{ data.categoryConcentration.top3Pct }}%</strong>
                · HHI: {{ data.categoryConcentration.hhi.toFixed(0) }}
                · 长尾品类: {{ data.categoryConcentration.longTailCount }}个 ({{ data.categoryConcentration.longTailPct }}%)
              </div>
            </el-card>
          </el-col>

          <!-- Store efficiency matrix -->
          <el-col :xs="24" :md="8" v-if="data.storeEfficiencyMatrix">
            <el-card shadow="hover" class="chart-card">
              <template #header><div class="chart-title">门店效率矩阵</div></template>
              <div id="chart-store-efficiency" style="height: 240px" />
              <div class="chart-footer">
                高效精简: {{ data.storeEfficiencyMatrix.summary.highEfficiency }}
                · 规模领先: {{ data.storeEfficiencyMatrix.summary.scaleLeader }}
                · 低效臃肿: {{ data.storeEfficiencyMatrix.summary.bloated }}
                · 潜力不足: {{ data.storeEfficiencyMatrix.summary.underperforming }}
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- Supply chain / traceability linkage -->
        <el-row :gutter="16" style="margin-top: 16px" v-if="data.supplyChainAnalysis">
          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card">
              <template #header>
                <div class="chart-title">
                  供应链健康度
                  <el-tag size="small" :type="data.supplyChainAnalysis.overallRiskScore === '低' ? 'success' : data.supplyChainAnalysis.overallRiskScore === '中' ? 'warning' : 'danger'">
                    风险{{ data.supplyChainAnalysis.overallRiskScore }}
                  </el-tag>
                </div>
              </template>
              <div id="chart-supplier-pie" style="height: 240px" />
              <div class="chart-footer">
                供应商: <strong>{{ data.supplyChainAnalysis.supplierConcentration.supplierCount }}家</strong>
                · Top 1 占比: {{ data.supplyChainAnalysis.supplierConcentration.top1Pct }}%
                · HHI: {{ data.supplyChainAnalysis.supplierConcentration.hhi.toFixed(0) }}
                <el-tag v-if="data.supplyChainAnalysis.supplierConcentration.singleSourceRisk" type="danger" size="small" style="margin-left: 8px">单一来源风险</el-tag>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :md="12">
            <el-card shadow="hover" class="chart-card">
              <template #header><div class="chart-title">供应链风险提示</div></template>
              <div v-if="data.supplyChainAnalysis.risks.length === 0" style="padding: 20px; text-align: center; color: var(--el-text-color-secondary)">
                供应链健康，暂无风险项
              </div>
              <div v-else class="roadmap">
                <div v-for="(risk, idx) in data.supplyChainAnalysis.risks" :key="idx" class="roadmap-item">
                  <div class="roadmap-header">
                    <el-tag :type="risk.severity === 'high' ? 'danger' : risk.severity === 'medium' ? 'warning' : 'info'" size="small">
                      {{ risk.severity === 'high' ? '高风险' : risk.severity === 'medium' ? '中风险' : '低风险' }}
                    </el-tag>
                    <span class="roadmap-label">{{ risk.description }}</span>
                  </div>
                  <div class="roadmap-action">{{ risk.action }}</div>
                </div>
              </div>
              <!-- Menu-ingredient linkage -->
              <div v-if="data.supplyChainAnalysis.menuIngredientLinkage" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--el-border-color-lighter)">
                <div class="chart-footer">
                  菜品-原料关联: <strong>{{ data.supplyChainAnalysis.menuIngredientLinkage.linkedItems }}</strong> /
                  {{ data.supplyChainAnalysis.menuIngredientLinkage.totalMenuItems }} 菜品可溯源
                  (覆盖率 {{ data.supplyChainAnalysis.menuIngredientLinkage.coverage }}%)
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import echarts from '@/utils/echarts'
import { useChartResize } from '@/composables/useChartResize'
import { useRestaurantAnalytics } from '@/composables/useRestaurantAnalytics'
import type { RestaurantAnalyticsResult } from '@/types/restaurant-analytics'

const containerRef = ref<HTMLElement>()
useChartResize(containerRef)

const {
  uploads, selectedUploadId, data, loading, dataQualityWarnings,
  handleSelectUpload, handleRefresh,
} = useRestaurantAnalytics<RestaurantAnalyticsResult>((result) => result)

// Re-render charts when data changes
watch(data, (val) => {
  if (val) nextTick(() => setTimeout(renderCharts, 300))
})

const missingDimensions = computed(() => {
  if (!data.value?.dimensionHints) return []
  return data.value.dimensionHints.filter(d => !d.available && d.hint)
})

const totalRevenue = computed(() => {
  if (!data.value) return 0
  const storeSum = data.value.storeComparison.stores.reduce((s, st) => s + st.revenue, 0)
  if (storeSum > 0) return storeSum
  return data.value.menuQuadrant.items.reduce((s, item) => s + item.revenue, 0)
})

function formatMoney(val: number): string {
  if (Math.abs(val) >= 1e8) return (val / 1e8).toFixed(1) + '亿'
  if (Math.abs(val) >= 1e4) return (val / 1e4).toFixed(1) + '万'
  return val.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

// ── Chart rendering ──

function renderCharts() {
  if (!data.value) return
  renderQuadrantMini()
  renderStoreTop5()
  renderCategoryPie()
  renderOpsRadarMini()
  renderTrendLine()
  renderWeeklyBar()
  renderHourlyBar()
  renderMealPie()
  renderPriceBand()
  renderHHIGauge()
  renderStoreEfficiency()
  renderSupplierPie()
}

function renderQuadrantMini() {
  const el = document.getElementById('chart-quadrant-mini')
  if (!el || !data.value) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)

  const colorMap: Record<string, string> = {
    Star: '#67C23A', Plow: '#E6A23C', Puzzle: '#409EFF', Dog: '#F56C6C',
  }
  const items = data.value.menuQuadrant.items

  // Clip axes to P95 to prevent outlier compression
  const profits = items.map(i => i.unitProfit).sort((a, b) => a - b)
  const qtys = items.map(i => i.quantity).sort((a, b) => a - b)
  const yMax = (profits[Math.floor(profits.length * 0.95)] || 100) * 1.3
  const xMax = (qtys[Math.floor(qtys.length * 0.95)] || 100) * 1.3

  const series = Object.keys(colorMap).map(q => ({
    name: q === 'Star' ? '明星' : q === 'Plow' ? '耕牛' : q === 'Puzzle' ? '谜题' : '瘦狗',
    type: 'scatter' as const,
    data: items.filter(i => i.quadrant === q).map(i => ({ value: [Math.min(i.quantity, xMax), Math.min(i.unitProfit, yMax)], _raw: [i.quantity, i.unitProfit] })),
    itemStyle: { color: colorMap[q] },
    symbolSize: 8,
  }))

  chart.setOption({
    tooltip: { trigger: 'item', formatter: (p: any) => { const raw = p.data._raw || p.value; return `销量: ${raw[0]}, 品均收入: ¥${raw[1].toFixed(1)}` } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { name: '销量', type: 'value', max: xMax, splitLine: { show: false } },
    yAxis: { name: '品均收入', type: 'value', max: yMax, splitLine: { lineStyle: { type: 'dashed' } } },
    series,
  })
}

function renderStoreTop5() {
  const el = document.getElementById('chart-store-top5')
  if (!el || !data.value) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)

  const top5 = data.value.storeComparison.stores.slice(0, 5).reverse()
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : String(v) } },
    yAxis: { type: 'category', data: top5.map(s => s.name), axisLabel: { width: 100, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      data: top5.map(s => s.revenue),
      itemStyle: { color: '#409EFF', borderRadius: [0, 4, 4, 0] },
      barMaxWidth: 24,
    }],
  })
}

function renderCategoryPie() {
  const el = document.getElementById('chart-category-pie')
  if (!el || !data.value) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)

  const all = data.value.categoryBreakdown
  const top6 = all.slice(0, 6)
  const rest = all.slice(6)
  const pieData = top6.map(c => ({ name: c.category, value: c.revenue }))
  if (rest.length > 0) {
    const otherRevenue = rest.reduce((s, c) => s + c.revenue, 0)
    pieData.push({ name: '其他', value: otherRevenue })
  }

  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['50%', '45%'],
      data: pieData,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13 } },
    }],
  })
}

function renderOpsRadarMini() {
  const el = document.getElementById('chart-ops-radar-mini')
  if (!el || !data.value) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)

  const ops = data.value.operationsMetrics ?? data.value.dianpingGaps
  chart.setOption({
    tooltip: {},
    radar: {
      indicator: [
        { name: '招牌集中度', max: 100 },
        { name: '退货率(反)', max: 10 },
        { name: '价格定位', max: Math.max(ops.priceVsBenchmark.actual * 1.5, ops.priceVsBenchmark.benchmarkMedian * 2, 200) },
        { name: '稳定性', max: 100 },
      ],
      radius: '60%',
    },
    series: [{
      type: 'radar',
      data: [{
        value: [
          ops.signatureConcentration,
          Math.max(0, 10 - ops.returnRate),
          ops.priceVsBenchmark.actual,
          ops.consistencyScore,
        ],
        name: '当前水平',
        areaStyle: { opacity: 0.2 },
        lineStyle: { color: '#409EFF' },
        itemStyle: { color: '#409EFF' },
      }],
    }],
  })
}

function renderTrendLine() {
  const el = document.getElementById('chart-trend-line')
  if (!el || !data.value?.trendAnalysis) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const trend = data.value.trendAnalysis

  const series: any[] = [{
    name: '总营收',
    type: 'line',
    data: trend.dailyTrend.map(d => [d.date, d.revenue]),
    smooth: true,
    areaStyle: { opacity: 0.15 },
    lineStyle: { width: 2 },
    itemStyle: { color: '#409EFF' },
  }]

  // Add store trends if available (top 5)
  const colors = ['#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6']
  if (trend.storeTrends) {
    Object.entries(trend.storeTrends).forEach(([store, points], i) => {
      series.push({
        name: store,
        type: 'line',
        data: points.map(d => [d.date, d.revenue]),
        smooth: true,
        lineStyle: { width: 1, type: 'dashed' },
        itemStyle: { color: colors[i % colors.length] },
        symbol: 'none',
      })
    })
  }

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 60, right: 20, top: 10, bottom: series.length > 1 ? 40 : 20 },
    xAxis: { type: 'time', axisLabel: { formatter: '{MM}-{dd}' } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : String(v) } },
    series,
  })
}

function renderWeeklyBar() {
  const el = document.getElementById('chart-weekly-bar')
  if (!el || !data.value?.trendAnalysis?.weeklyTrend) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const weekly = data.value.trendAnalysis.weeklyTrend

  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 50, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'category', data: weekly.map(w => w.week), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : String(v) } },
    series: [{
      type: 'bar',
      data: weekly.map(w => w.revenue),
      itemStyle: { color: '#409EFF', borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 28,
    }],
  })
}

function renderHourlyBar() {
  const el = document.getElementById('chart-hourly-bar')
  if (!el || !data.value?.timePeriodAnalysis) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const hourly = data.value.timePeriodAnalysis.hourlyDistribution

  // Fill all 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const revenueData = hours.map(h => {
    const item = hourly.find(d => d.hour === h)
    return item ? item.revenue : 0
  })
  const peakHour = data.value.timePeriodAnalysis.peakHour

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const p = params[0]
        const item = hourly.find((d: any) => d.hour === p.dataIndex)
        return `${p.dataIndex}:00-${p.dataIndex + 1}:00<br/>营收: ¥${p.value.toLocaleString()}${item ? '<br/>订单: ' + item.orderCount + '笔' : ''}`
      },
    },
    grid: { left: 50, right: 20, top: 10, bottom: 20 },
    xAxis: {
      type: 'category',
      data: hours.map(h => `${h}:00`),
      axisLabel: { fontSize: 10, interval: 2 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : String(v) },
    },
    series: [{
      type: 'bar',
      data: revenueData.map((v, i) => ({
        value: v,
        itemStyle: { color: i === peakHour ? '#E6A23C' : '#409EFF', borderRadius: [3, 3, 0, 0] },
      })),
      barMaxWidth: 18,
    }],
  })
}

function renderMealPie() {
  const el = document.getElementById('chart-meal-pie')
  if (!el || !data.value?.timePeriodAnalysis) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const periods = data.value.timePeriodAnalysis.mealPeriods.filter(p => p.revenue > 0)

  const colorMap: Record<string, string> = {
    '早餐': '#67C23A', '午市': '#409EFF', '下午茶': '#E6A23C',
    '晚市': '#F56C6C', '夜宵': '#909399',
  }

  chart.setOption({
    tooltip: {
      formatter: (p: any) => `${p.name}<br/>¥${p.value.toLocaleString()} (${p.data.pct}%)<br/>${p.data.orderCount}笔`,
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      data: periods.map(p => ({
        name: p.period,
        value: p.revenue,
        pct: p.pct,
        orderCount: p.orderCount,
        itemStyle: { color: colorMap[p.period] || '#409EFF' },
      })),
      label: { formatter: '{b}\n{d}%', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 10 } },
    }],
  })
}

function renderPriceBand() {
  const el = document.getElementById('chart-price-band')
  if (!el || !data.value?.priceBandAnalysis) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const pb = data.value.priceBandAnalysis

  chart.setOption({
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>营收占比: ${p[0].data.pct}%<br/>SKU: ${p[0].data.skuCount}` },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: pb.bands.map(b => b.band), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar',
      data: pb.bands.map(b => ({ value: b.pct, pct: b.pct, skuCount: b.skuCount })),
      itemStyle: {
        color: (p: any) => pb.bands[p.dataIndex].band === pb.mainBand ? '#67C23A' : '#409EFF',
        borderRadius: [4, 4, 0, 0],
      },
      barMaxWidth: 32,
    }],
  })
}

function renderHHIGauge() {
  const el = document.getElementById('chart-hhi-gauge')
  if (!el || !data.value?.categoryConcentration) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const cc = data.value.categoryConcentration

  chart.setOption({
    series: [{
      type: 'gauge',
      min: 0,
      max: 10000,
      splitNumber: 4,
      radius: '85%',
      axisLine: {
        lineStyle: {
          width: 15,
          color: [[0.15, '#67C23A'], [0.25, '#E6A23C'], [1, '#F56C6C']],
        },
      },
      pointer: { width: 4, length: '60%' },
      axisTick: { show: false },
      splitLine: { length: 12 },
      axisLabel: { distance: 20, fontSize: 10, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v) },
      detail: { formatter: '{value}', fontSize: 20, offsetCenter: [0, '70%'] },
      data: [{ value: Math.round(cc.hhi), name: cc.concentrationLevel }],
      title: { offsetCenter: [0, '90%'], fontSize: 13 },
    }],
  })
}

function renderStoreEfficiency() {
  const el = document.getElementById('chart-store-efficiency')
  if (!el || !data.value?.storeEfficiencyMatrix) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const sem = data.value.storeEfficiencyMatrix

  const colorMap: Record<string, string> = {
    '高效精简': '#67C23A', '规模领先': '#409EFF', '低效臃肿': '#F56C6C', '潜力不足': '#E6A23C',
  }
  const quadrants = Object.keys(colorMap)
  const series = quadrants.map(q => ({
    name: q,
    type: 'scatter' as const,
    data: sem.stores.filter(s => s.quadrant === q).map(s => [s.revenue, s.skuCount]),
    itemStyle: { color: colorMap[q] },
    symbolSize: 10,
  }))

  chart.setOption({
    tooltip: { trigger: 'item', formatter: (p: any) => `营收: ¥${p.value[0].toLocaleString()}<br/>品项数: ${p.value[1]}` },
    legend: { top: 0, textStyle: { fontSize: 10 } },
    grid: { left: 50, right: 20, top: 30, bottom: 20 },
    xAxis: { name: '营收', type: 'value', splitLine: { show: false }, axisLabel: { formatter: (v: number) => v >= 1e4 ? (v / 1e4).toFixed(0) + '万' : String(v) } },
    yAxis: { name: '品项数', type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series,
  })
}

function renderSupplierPie() {
  const el = document.getElementById('chart-supplier-pie')
  if (!el || !data.value?.supplyChainAnalysis) return
  const chart = echarts.getInstanceByDom(el) || echarts.init(el)
  const sc = data.value.supplyChainAnalysis.supplierConcentration

  const pieData = sc.suppliers.slice(0, 8).map(s => ({ name: s.name, value: s.spend || s.pct }))
  if (sc.suppliers.length > 8) {
    const rest = sc.suppliers.slice(8).reduce((sum, s) => sum + (s.spend || s.pct), 0)
    pieData.push({ name: '其他', value: rest })
  }

  chart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['50%', '45%'],
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
      data: pieData,
    }],
  })
}

// composable handles onMounted + auto-select
</script>

<style scoped>
.page-wrapper { padding: 16px; }
.page-card { border-radius: 8px; }
.card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-right { display: flex; align-items: center; gap: 8px; }
.page-title { font-size: 16px; font-weight: 600; }

.kpi-row { margin-top: 8px; }
.kpi-card {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 14px 16px;
  text-align: center;
}
.kpi-label { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.kpi-value { font-size: 22px; font-weight: 700; color: var(--el-text-color-primary); }
.kpi-value.success { color: var(--el-color-success); }
.kpi-value.danger { color: var(--el-color-danger); }
.kpi-value.info { color: var(--el-color-primary); font-size: 14px; }

.chart-card { cursor: default; }
.chart-title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.chart-title.clickable { cursor: pointer; }
.chart-footer { font-size: 12px; color: var(--el-text-color-secondary); text-align: center; padding-top: 4px; }

.roadmap { display: flex; flex-direction: column; gap: 10px; }
.roadmap-item { padding: 8px 12px; background: var(--el-fill-color-light); border-radius: 6px; }
.roadmap-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.roadmap-label { font-size: 13px; font-weight: 500; }
.roadmap-action { font-size: 12px; color: var(--el-text-color-secondary); padding-left: 4px; }

@media (max-width: 768px) {
  .card-header { flex-direction: column; align-items: flex-start; }
  .header-right { width: 100%; }
  .header-right .el-select { flex: 1; }
}
</style>
