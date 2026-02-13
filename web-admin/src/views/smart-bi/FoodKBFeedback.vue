<template>
  <div class="food-kb-feedback">
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div>
          <h2>食品知识库反馈管理</h2>
          <p class="subtitle">用户反馈收集与质量监控</p>
        </div>
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadData">
          刷新数据
        </el-button>
      </div>
    </el-card>

    <!-- Stats Overview -->
    <div class="stats-grid" v-if="stats">
      <el-card shadow="hover" class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">反馈总数</div>
      </el-card>
      <el-card shadow="hover" class="stat-card">
        <div class="stat-value" :class="avgRatingClass">{{ stats.avg_rating.toFixed(2) }}</div>
        <div class="stat-label">平均评分</div>
      </el-card>
      <el-card shadow="hover" class="stat-card">
        <div class="stat-value positive">{{ positiveCount }}</div>
        <div class="stat-label">正面评价 (4-5)</div>
      </el-card>
      <el-card shadow="hover" class="stat-card">
        <div class="stat-value negative">{{ negativeCount }}</div>
        <div class="stat-label">负面评价 (1-2)</div>
      </el-card>
    </div>

    <!-- Distribution Charts -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>评分分布</template>
          <div ref="ratingChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>反馈类型分布</template>
          <div ref="typeChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Low Rating Feedback Table -->
    <el-card shadow="hover" class="table-card">
      <template #header>
        <div class="table-header">
          <span>低评分反馈 (需要关注)</span>
          <el-tag type="danger" v-if="stats && stats.recent_low_ratings.length">
            {{ stats.recent_low_ratings.length }} 条待处理
          </el-tag>
        </div>
      </template>
      <el-table :data="stats?.recent_low_ratings || []" stripe style="width: 100%"
                empty-text="暂无低评分反馈">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="query" label="用户查询" min-width="200" show-overflow-tooltip />
        <el-table-column prop="rating" label="评分" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.rating <= 2 ? 'danger' : 'warning'" size="small">
              {{ row.rating }}/5
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="反馈类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.feedback_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="反馈详情" min-width="200">
          <template #default="{ row }">
            <div v-if="row.feedback_detail">
              <el-tag v-if="row.feedback_detail.category" size="small" type="info" class="detail-tag">
                {{ categoryLabels[row.feedback_detail.category] || row.feedback_detail.category }}
              </el-tag>
              <span v-if="row.feedback_detail.comment" class="comment-text">
                {{ row.feedback_detail.comment }}
              </span>
              <el-tag v-if="row.feedback_detail.auto_detected" size="small" type="warning" class="detail-tag">
                自动检测
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Feedback Export -->
    <el-card shadow="hover" class="export-card">
      <template #header>数据导出</template>
      <el-form :inline="true">
        <el-form-item label="开始日期">
          <el-date-picker v-model="exportSince" type="date" placeholder="选择日期"
                          value-format="YYYY-MM-DD" clearable />
        </el-form-item>
        <el-form-item label="反馈类型">
          <el-select v-model="exportType" clearable placeholder="全部">
            <el-option label="显式反馈" value="explicit" />
            <el-option label="隐式反馈" value="implicit" />
            <el-option label="专家评审" value="expert" />
          </el-select>
        </el-form-item>
        <el-form-item label="评分范围">
          <el-slider v-model="exportRatingRange" range :min="1" :max="5" :step="1"
                     style="width: 200px" :marks="{ 1: '1', 3: '3', 5: '5' }" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Download" :loading="exporting" @click="exportData">
            导出 JSON
          </el-button>
        </el-form-item>
      </el-form>
      <el-table v-if="exportResults.length" :data="exportResults" stripe max-height="400"
                style="margin-top: 12px">
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="query" label="查询" min-width="180" show-overflow-tooltip />
        <el-table-column prop="rating" label="评分" width="70" align="center" />
        <el-table-column prop="feedback_type" label="类型" width="90" />
        <el-table-column prop="response_time_ms" label="响应(ms)" width="90" align="center" />
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Refresh, Download } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

const PYTHON_BASE = import.meta.env.VITE_SMARTBI_URL || '/smartbi-api'

interface FeedbackStats {
  success: boolean
  total: number
  avg_rating: number
  by_type: Record<string, number>
  by_rating: Record<string, number>
  recent_low_ratings: Array<{
    id: number
    query: string
    answer?: string
    rating: number
    feedback_type: string
    feedback_detail?: {
      category?: string
      comment?: string
      tags?: string[]
      auto_detected?: boolean
    }
    created_at: string
  }>
}

const loading = ref(false)
const exporting = ref(false)
const stats = ref<FeedbackStats | null>(null)
const exportResults = ref<any[]>([])
const exportSince = ref('')
const exportType = ref('')
const exportRatingRange = ref<[number, number]>([1, 5])

const ratingChartRef = ref<HTMLDivElement>()
const typeChartRef = ref<HTMLDivElement>()

let ratingChart: echarts.ECharts | null = null
let typeChart: echarts.ECharts | null = null

const categoryLabels: Record<string, string> = {
  inaccurate: '不准确',
  incomplete: '不完整',
  outdated: '已过时',
  irrelevant: '不相关',
  requery: '重复查询',
  helpful: '有帮助',
}

const avgRatingClass = computed(() => {
  if (!stats.value) return ''
  const r = stats.value.avg_rating
  if (r >= 4) return 'positive'
  if (r >= 3) return 'neutral'
  return 'negative'
})

const positiveCount = computed(() => {
  if (!stats.value?.by_rating) return 0
  return (stats.value.by_rating['4'] || 0) + (stats.value.by_rating['5'] || 0)
})

const negativeCount = computed(() => {
  if (!stats.value?.by_rating) return 0
  return (stats.value.by_rating['1'] || 0) + (stats.value.by_rating['2'] || 0)
})

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

async function loadData() {
  loading.value = true
  try {
    const resp = await fetch(`${PYTHON_BASE}/api/food-kb/feedback/stats`)
    const data = await resp.json()
    if (data.success) {
      stats.value = data
      await nextTick()
      renderCharts()
    }
  } catch (e) {
    console.error('Failed to load feedback stats:', e)
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  if (!stats.value) return

  // Rating distribution bar chart
  if (ratingChartRef.value) {
    if (ratingChart) ratingChart.dispose()
    ratingChart = echarts.init(ratingChartRef.value)
    const ratings = stats.value.by_rating || {}
    const colors = ['#F56C6C', '#E6A23C', '#909399', '#67C23A', '#409EFF']
    ratingChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['1星', '2星', '3星', '4星', '5星'],
      },
      yAxis: { type: 'value', name: '数量' },
      series: [{
        type: 'bar',
        data: [1, 2, 3, 4, 5].map((r, i) => ({
          value: ratings[String(r)] || 0,
          itemStyle: { color: colors[i] },
        })),
        barWidth: '50%',
      }],
      grid: { top: 30, bottom: 30, left: 50, right: 20 },
    })
  }

  // Feedback type pie chart
  if (typeChartRef.value) {
    if (typeChart) typeChart.dispose()
    typeChart = echarts.init(typeChartRef.value)
    const types = stats.value.by_type || {}
    const typeLabels: Record<string, string> = {
      explicit: '用户评价',
      implicit: '自动检测',
      expert: '专家审核',
    }
    const pieData = Object.entries(types).map(([k, v]) => ({
      name: typeLabels[k] || k,
      value: v,
    }))
    typeChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: pieData.length ? pieData : [{ name: '暂无数据', value: 0 }],
        label: { show: true, formatter: '{b}\n{c}' },
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      }],
    })
  }
}

async function exportData() {
  exporting.value = true
  try {
    const params = new URLSearchParams()
    if (exportSince.value) params.set('since', exportSince.value)
    if (exportType.value) params.set('type', exportType.value)
    params.set('min_rating', String(exportRatingRange.value[0]))
    params.set('max_rating', String(exportRatingRange.value[1]))

    const resp = await fetch(`${PYTHON_BASE}/api/food-kb/feedback/export?${params}`)
    exportResults.value = await resp.json()
  } catch (e) {
    console.error('Failed to export feedback:', e)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', () => {
    ratingChart?.resize()
    typeChart?.resize()
  })
})
</script>

<style scoped>
.food-kb-feedback {
  padding: 20px;
}
.header-card {
  margin-bottom: 16px;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-row h2 {
  margin: 0;
  font-size: 20px;
}
.subtitle {
  margin: 4px 0 0;
  color: #909399;
  font-size: 13px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
}
.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-value.positive { color: #67C23A; }
.stat-value.neutral { color: #E6A23C; }
.stat-value.negative { color: #F56C6C; }
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}
.chart-row {
  margin-bottom: 16px;
}
.chart-container {
  height: 280px;
}
.table-card {
  margin-bottom: 16px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.detail-tag {
  margin-right: 6px;
}
.comment-text {
  color: #606266;
  font-size: 13px;
}
.export-card {
  margin-bottom: 16px;
}
</style>
