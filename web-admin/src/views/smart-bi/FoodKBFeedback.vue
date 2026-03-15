<template>
  <div ref="rootRef" class="food-kb-feedback">
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

    <!-- Error Alert -->
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon closable style="margin-bottom: 16px" />

    <!-- Stats Overview -->
    <div v-loading="loading" class="stats-grid" v-if="stats || loading">
      <el-card shadow="hover" class="stat-card">
        <div class="stat-value">{{ stats?.total ?? '-' }}</div>
        <div class="stat-label">反馈总数</div>
      </el-card>
      <el-card shadow="hover" class="stat-card">
        <div class="stat-value" :class="avgRatingClass">{{ stats?.avgRating != null ? stats.avgRating.toFixed(2) : '-' }}</div>
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
      <el-col :span="12" :xs="24">
        <el-card shadow="hover">
          <template #header>评分分布</template>
          <div ref="ratingChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12" :xs="24">
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
          <el-tag type="danger" v-if="filteredFeedbacks.length">
            {{ filteredFeedbacks.length }} 条待处理
          </el-tag>
        </div>
      </template>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <el-select v-model="filterType" clearable placeholder="反馈类型" style="width: 140px">
          <el-option label="显式反馈" value="explicit" />
          <el-option label="隐式反馈" value="implicit" />
          <el-option label="专家评审" value="expert" />
        </el-select>
        <el-select v-model="filterStatus" clearable placeholder="审核状态" style="width: 130px">
          <el-option label="待审核" value="pending" />
          <el-option label="已采纳" value="accepted" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
          style="width: 260px"
        />
        <el-input
          v-model="filterKeyword"
          :prefix-icon="Search"
          placeholder="搜索查询/评论内容"
          clearable
          style="width: 220px"
        />
      </div>

      <!-- Batch Action Bar -->
      <transition name="el-fade-in">
        <div v-if="selectedRows.length > 0" class="batch-action-bar">
          <span class="batch-info">已选 {{ selectedRows.length }} 条</span>
          <el-button type="success" size="small" @click="batchUpdateStatus('accepted')">
            批量采纳
          </el-button>
          <el-button type="danger" size="small" @click="batchUpdateStatus('rejected')">
            批量拒绝
          </el-button>
          <el-button size="small" @click="clearSelection">清除选择</el-button>
        </div>
      </transition>

      <el-table
        ref="feedbackTableRef"
        :data="filteredFeedbacks"
        stripe
        style="width: 100%"
        empty-text="暂无低评分反馈"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="query" label="用户查询" min-width="180" show-overflow-tooltip />
        <el-table-column prop="rating" label="评分" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.rating <= 2 ? 'danger' : 'warning'" size="small">
              {{ row.rating }}/5
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="反馈类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ feedbackTypeLabels[row.feedbackType] || row.feedbackType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="reviewStatusTagType(getReviewStatus(row.id))"
              size="small"
            >
              {{ reviewStatusLabels[getReviewStatus(row.id)] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="反馈详情" min-width="180">
          <template #default="{ row }">
            <div v-if="row.feedbackDetail">
              <el-tag v-if="row.feedbackDetail.category" size="small" type="info" class="detail-tag">
                {{ categoryLabels[row.feedbackDetail.category] || row.feedbackDetail.category }}
              </el-tag>
              <span v-if="row.feedbackDetail.comment" class="comment-text">
                {{ row.feedbackDetail.comment }}
              </span>
              <el-tag v-if="row.feedbackDetail.autoDetected" size="small" type="warning" class="detail-tag">
                自动检测
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openKBDialog(row)">
              查看知识
            </el-button>
            <el-button
              v-if="getReviewStatus(row.id) !== 'accepted'"
              link type="success" size="small"
              @click="updateSingleStatus(row.id, 'accepted')"
            >
              采纳
            </el-button>
            <el-button
              v-if="getReviewStatus(row.id) !== 'rejected'"
              link type="danger" size="small"
              @click="updateSingleStatus(row.id, 'rejected')"
            >
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Knowledge Base Entry Dialog -->
    <el-dialog
      v-model="kbDialogVisible"
      title="知识库条目详情"
      width="680px"
      destroy-on-close
    >
      <div v-if="kbDialogRow" class="kb-dialog-content">
        <div class="kb-section">
          <div class="kb-section-title">用户查询</div>
          <div class="kb-section-body query-text">{{ kbDialogRow.query }}</div>
        </div>
        <el-divider />
        <div class="kb-section">
          <div class="kb-section-title">知识库回答</div>
          <div class="kb-section-body answer-text">
            {{ kbDialogRow.answer || '(无回答记录)' }}
          </div>
        </div>
        <el-divider />
        <div class="kb-section">
          <div class="kb-section-title">反馈信息</div>
          <div class="kb-section-body">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="评分">
                <el-tag :type="kbDialogRow.rating <= 2 ? 'danger' : 'warning'" size="small">
                  {{ kbDialogRow.rating }}/5
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="类型">
                {{ feedbackTypeLabels[kbDialogRow.feedbackType] || kbDialogRow.feedbackType }}
              </el-descriptions-item>
              <el-descriptions-item label="分类" v-if="kbDialogRow.feedbackDetail?.category">
                {{ categoryLabels[kbDialogRow.feedbackDetail.category] || kbDialogRow.feedbackDetail.category }}
              </el-descriptions-item>
              <el-descriptions-item label="评论" v-if="kbDialogRow.feedbackDetail?.comment" :span="2">
                {{ kbDialogRow.feedbackDetail.comment }}
              </el-descriptions-item>
              <el-descriptions-item label="审核状态">
                <el-tag :type="reviewStatusTagType(getReviewStatus(kbDialogRow.id))" size="small">
                  {{ reviewStatusLabels[getReviewStatus(kbDialogRow.id)] }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="时间">
                {{ formatTime(kbDialogRow.createdAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="kbDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="navigateToKnowledgeBase">
          前往知识库
        </el-button>
      </template>
    </el-dialog>

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
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            {{ feedbackTypeLabels[row.feedbackType] || row.feedbackType }}
          </template>
        </el-table-column>
        <el-table-column prop="responseTimeMs" label="响应(ms)" width="90" align="center" />
        <el-table-column prop="createdAt" label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh, Download, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTable } from 'element-plus'
import echarts from '@/utils/echarts'
import { pythonFetch } from '@/api/smartbi/common'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeedbackRow {
  id: number
  query: string
  answer?: string
  rating: number
  feedbackType: string
  feedbackDetail?: {
    category?: string
    comment?: string
    tags?: string[]
    autoDetected?: boolean
  }
  createdAt: string
}

interface FeedbackStats {
  success: boolean
  total: number
  avgRating: number
  byType: Record<string, number>
  byRating: Record<string, number>
  recentLowRatings: FeedbackRow[]
}

interface ExportedFeedback {
  id: number
  query: string
  rating: number
  feedbackType: string
  responseTimeMs?: number
  createdAt: string
}

type ReviewStatus = 'pending' | 'accepted' | 'rejected'

// ─── Core State ──────────────────────────────────────────────────────────────

const router = useRouter()
const loading = ref(false)
const loadError = ref('')
const exporting = ref(false)
const stats = ref<FeedbackStats | null>(null)
const exportResults = ref<ExportedFeedback[]>([])
const exportSince = ref('')
const exportType = ref('')
const exportRatingRange = ref<[number, number]>([1, 5])

const rootRef = ref<HTMLDivElement>()
const ratingChartRef = ref<HTMLDivElement>()
const typeChartRef = ref<HTMLDivElement>()

let ratingChart: echarts.ECharts | null = null
let typeChart: echarts.ECharts | null = null

// ─── Filter State ────────────────────────────────────────────────────────────

const filterType = ref('')
const filterStatus = ref<ReviewStatus | ''>('')
const filterDateRange = ref<[string, string] | null>(null)
const filterKeyword = ref('')

// ─── Batch Selection ─────────────────────────────────────────────────────────

const feedbackTableRef = ref<InstanceType<typeof ElTable>>()
const selectedRows = ref<FeedbackRow[]>([])

function handleSelectionChange(rows: FeedbackRow[]) {
  selectedRows.value = rows
}

function clearSelection() {
  feedbackTableRef.value?.clearSelection()
  selectedRows.value = []
}

// ─── Review Status (localStorage) ───────────────────────────────────────────

const STORAGE_KEY = 'food-kb-feedback-status'

function loadStatusMap(): Record<number, ReviewStatus> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<number, ReviewStatus>
  } catch { /* ignore */ }
  return {}
}

const reviewStatusMap = ref<Record<number, ReviewStatus>>(loadStatusMap())

function persistStatusMap() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewStatusMap.value))
}

function getReviewStatus(id: number): ReviewStatus {
  return reviewStatusMap.value[id] || 'pending'
}

function updateSingleStatus(id: number, status: ReviewStatus) {
  reviewStatusMap.value[id] = status
  persistStatusMap()
  ElMessage.success(status === 'accepted' ? '已采纳' : '已拒绝')
}

function batchUpdateStatus(status: ReviewStatus) {
  const label = status === 'accepted' ? '采纳' : '拒绝'
  ElMessageBox.confirm(
    `确定要批量${label} ${selectedRows.value.length} 条反馈吗？`,
    `批量${label}`,
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    for (const row of selectedRows.value) {
      reviewStatusMap.value[row.id] = status
    }
    persistStatusMap()
    clearSelection()
    ElMessage.success(`已批量${label} ${selectedRows.value.length || ''}条反馈`)
  }).catch(() => { /* cancelled */ })
}

// ─── Knowledge Base Dialog ──────────────────────────────────────────────────

const kbDialogVisible = ref(false)
const kbDialogRow = ref<FeedbackRow | null>(null)

function openKBDialog(row: FeedbackRow) {
  kbDialogRow.value = row
  kbDialogVisible.value = true
}

function navigateToKnowledgeBase() {
  kbDialogVisible.value = false
  router.push('/smart-bi/query')
}

// ─── Labels ──────────────────────────────────────────────────────────────────

const categoryLabels: Record<string, string> = {
  inaccurate: '不准确',
  incomplete: '不完整',
  outdated: '已过时',
  irrelevant: '不相关',
  requery: '重复查询',
  helpful: '有帮助',
}

const feedbackTypeLabels: Record<string, string> = {
  explicit: '用户评价',
  implicit: '自动检测',
  expert: '专家审核',
}

const reviewStatusLabels: Record<ReviewStatus, string> = {
  pending: '待审核',
  accepted: '已采纳',
  rejected: '已拒绝',
}

function reviewStatusTagType(status: ReviewStatus): 'warning' | 'success' | 'danger' {
  if (status === 'accepted') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

// ─── Computed ────────────────────────────────────────────────────────────────

const avgRatingClass = computed(() => {
  if (!stats.value) return ''
  const r = stats.value.avgRating
  if (r >= 4) return 'positive'
  if (r >= 3) return 'neutral'
  return 'negative'
})

const positiveCount = computed(() => {
  if (!stats.value?.byRating) return 0
  return (stats.value.byRating['4'] || 0) + (stats.value.byRating['5'] || 0)
})

const negativeCount = computed(() => {
  if (!stats.value?.byRating) return 0
  return (stats.value.byRating['1'] || 0) + (stats.value.byRating['2'] || 0)
})

const filteredFeedbacks = computed(() => {
  let list = stats.value?.recentLowRatings || []

  // Type filter
  if (filterType.value) {
    list = list.filter(row => row.feedbackType === filterType.value)
  }

  // Status filter (client-side reviewStatus)
  if (filterStatus.value) {
    list = list.filter(row => getReviewStatus(row.id) === filterStatus.value)
  }

  // Date range filter
  if (filterDateRange.value && filterDateRange.value[0] && filterDateRange.value[1]) {
    const start = new Date(filterDateRange.value[0])
    start.setHours(0, 0, 0, 0)
    const end = new Date(filterDateRange.value[1])
    end.setHours(23, 59, 59, 999)
    list = list.filter(row => {
      const d = new Date(row.createdAt)
      return d >= start && d <= end
    })
  }

  // Keyword search (query + comment)
  if (filterKeyword.value.trim()) {
    const kw = filterKeyword.value.trim().toLowerCase()
    list = list.filter(row => {
      const queryMatch = row.query?.toLowerCase().includes(kw)
      const commentMatch = row.feedbackDetail?.comment?.toLowerCase().includes(kw)
      return queryMatch || commentMatch
    })
  }

  return list
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Data Loading ────────────────────────────────────────────────────────────

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await pythonFetch('/api/food-kb/feedback/stats') as FeedbackStats
    if (data.success) {
      stats.value = data
      await nextTick()
      renderCharts()
    } else {
      loadError.value = '加载反馈统计失败'
    }
  } catch (e) {
    console.error('Failed to load feedback stats:', e)
    loadError.value = `加载反馈统计失败: ${e instanceof Error ? e.message : '未知错误'}`
  } finally {
    loading.value = false
  }
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function renderCharts() {
  if (!stats.value) return

  // Rating distribution bar chart
  if (ratingChartRef.value) {
    if (ratingChart) ratingChart.dispose()
    ratingChart = echarts.init(ratingChartRef.value, 'cretas')
    const ratings = stats.value.byRating || {}
    const colors = ['#F56C6C', '#E6A23C', '#909399', '#67C23A', '#1B65A8']
    ratingChart.setOption({
      tooltip: { trigger: 'axis', confine: true },
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
    typeChart = echarts.init(typeChartRef.value, 'cretas')
    const types = stats.value.byType || {}
    const pieData = Object.entries(types).map(([k, v]) => ({
      name: feedbackTypeLabels[k] || k,
      value: v,
    }))
    typeChart.setOption({
      tooltip: { trigger: 'item', confine: true, formatter: '{b}: {c} ({d}%)' },
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

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportData() {
  exporting.value = true
  try {
    const params = new URLSearchParams()
    if (exportSince.value) params.set('since', exportSince.value)
    if (exportType.value) params.set('type', exportType.value)
    params.set('min_rating', String(exportRatingRange.value[0]))
    params.set('max_rating', String(exportRatingRange.value[1]))

    exportResults.value = await pythonFetch(`/api/food-kb/feedback/export?${params}`) as ExportedFeedback[]
  } catch (e) {
    console.error('Failed to export feedback:', e)
    ElMessage.error('导出反馈数据失败')
  } finally {
    exporting.value = false
  }
}

// ─── Resize ──────────────────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0
function handleResize() {
  if (resizeRaf) return
  resizeRaf = requestAnimationFrame(() => {
    ratingChart?.resize()
    typeChart?.resize()
    resizeRaf = 0
  })
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', handleResize)
  if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0 }
  ratingChart?.dispose()
  typeChart?.dispose()
})
</script>

<style lang="scss" scoped>
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
  color: var(--el-text-color-secondary, #909399);
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
  border-top: 3px solid var(--el-color-primary, #1B65A8);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
  &:nth-child(1) { border-top-color: #1B65A8; }
  &:nth-child(2) { border-top-color: #FFAB00; }
  &:nth-child(3) { border-top-color: #36B37E; }
  &:nth-child(4) { border-top-color: #FF5630; }
}
.stat-value {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary, #303133);
  line-height: 1.2;
}
.stat-value.positive { color: var(--el-color-success, #67C23A); }
.stat-value.neutral { color: var(--el-color-warning, #E6A23C); }
.stat-value.negative { color: var(--el-color-danger, #F56C6C); }
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
  margin-top: 4px;
}
.chart-row {
  margin-bottom: 16px;
}
.chart-container {
  height: 280px;
}
.chart-row :deep(.el-card),
.table-card,
.export-card {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  }
}
.table-card {
  margin-bottom: 16px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
}

/* Batch Action Bar */
.batch-action-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 16px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  border-radius: 6px;
  border: 1px solid var(--el-color-primary-light-7, #c6e2ff);
}
.batch-info {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary, #409eff);
  margin-right: 4px;
}

.detail-tag {
  margin-right: 6px;
}
.comment-text {
  color: var(--el-text-color-regular, #606266);
  font-size: 13px;
}
.export-card {
  margin-bottom: 16px;
}

/* Knowledge Base Dialog */
.kb-dialog-content {
  max-height: 500px;
  overflow-y: auto;
}
.kb-section {
  margin-bottom: 4px;
}
.kb-section-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary, #303133);
  margin-bottom: 8px;
}
.kb-section-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-regular, #606266);
}
.query-text {
  padding: 10px 14px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 6px;
  border-left: 3px solid var(--el-color-primary, #409eff);
}
.answer-text {
  padding: 10px 14px;
  background: var(--el-fill-color-lighter, #fafafa);
  border-radius: 6px;
  border-left: 3px solid var(--el-color-success, #67c23a);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    .el-select, .el-input, .el-date-editor {
      width: 100% !important;
    }
  }
}
</style>
