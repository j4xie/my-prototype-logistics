<script setup lang="ts">
/**
 * 生产异常预警看板
 * 提供告警汇总、筛选、确认/解决操作和 AI 根因分析详情
 */
import { ref, onMounted, computed } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { get, put, post } from '@/api/request'
import { useAuthStore } from '@/store/modules/auth'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const authStore = useAuthStore()
const factoryId = computed(() => authStore.factoryId)

// --- State ---
const loading = ref(false)
const loadingAlerts = ref(false)
const detecting = ref(false)
const resolving = ref(false)

interface AlertSummary {
  criticalCount?: number
  warningCount?: number
  activeCount?: number
  resolvedToday?: number
}

interface AlertRecord {
  id: number | string
  level: string
  alertType: string
  metricName: string
  description: string
  currentValue: number | null
  baselineValue: number | null
  deviationPercent: number | null
  status: string
  productName?: string
  aiAnalysis?: string
  createdAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  verifiedAt?: string
  resolutionNotes?: string
  autoVerified?: boolean
}

const summary = ref<AlertSummary>({})
const alerts = ref<AlertRecord[]>([])
const totalAlerts = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')
const filterLevel = ref('')
const resolveDialogVisible = ref(false)
const detailDrawerVisible = ref(false)
const selectedAlert = ref<AlertRecord | null>(null)
const resolutionNotes = ref('')

function statusTagType(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'danger',
    ACKNOWLEDGED: 'warning',
    RESOLVED: 'success',
    VERIFIED: 'info'
  }
  return map[status] || 'info'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: '待处理',
    ACKNOWLEDGED: '已确认',
    RESOLVED: '已解决',
    VERIFIED: '已验证'
  }
  return map[status] || status
}

async function loadData() {
  if (!factoryId.value) {
    console.error('No factoryId available')
    ElMessage.error('无法获取工厂信息，请重新登录')
    return
  }
  loading.value = true
  try {
    const res = await get<AlertSummary>(`/${factoryId.value}/alerts/summary`)
    if (res?.success !== false) {
      summary.value = res.data || {}
    }
  } catch (e) {
    console.error('Load alert summary failed:', e)
    ElMessage.error('加载告警汇总失败，请稍后重试')
  } finally {
    loading.value = false
  }
  await loadAlerts()
}

async function loadAlerts() {
  loadingAlerts.value = true
  try {
    const params: Record<string, unknown> = {
      page: currentPage.value - 1,
      size: pageSize.value
    }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterLevel.value) params.level = filterLevel.value

    const res = await get<{ content: AlertRecord[]; totalElements: number }>(
      `/${factoryId.value}/alerts`, { params }
    )
    if (res?.success !== false) {
      const data = res.data || { content: [], totalElements: 0 }
      alerts.value = data.content || []
      totalAlerts.value = data.totalElements || 0
    }
  } catch (e) {
    console.error('Load alerts failed:', e)
    ElMessage.error('加载告警列表失败，请稍后重试')
  } finally {
    loadingAlerts.value = false
  }
}

async function triggerDetection() {
  detecting.value = true
  try {
    const res = await post<{ newAlerts: number }>(`/${factoryId.value}/alerts/detect`, {})
    ElMessage.success(`检测完成，发现 ${res?.data?.newAlerts || 0} 条新告警`)
    await loadData()
  } catch (e) {
    ElMessage.error('检测失败')
  } finally {
    detecting.value = false
  }
}

async function acknowledgeAlert(alert: AlertRecord) {
  try {
    const userId = authStore.user?.id || authStore.user?.userId
    await put<unknown>(`/${factoryId.value}/alerts/${alert.id}/acknowledge`, { userId })
    ElMessage.success('已确认')
    await loadData()
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

function openResolveDialog(alert: AlertRecord) {
  selectedAlert.value = alert
  resolutionNotes.value = ''
  resolveDialogVisible.value = true
}

async function resolveAlert() {
  if (!selectedAlert.value) return
  resolving.value = true
  try {
    const userId = authStore.user?.id || authStore.user?.userId
    await put<unknown>(`/${factoryId.value}/alerts/${selectedAlert.value.id}/resolve`, {
      userId,
      resolutionNotes: resolutionNotes.value
    })
    ElMessage.success('已解决')
    resolveDialogVisible.value = false
    await loadData()
  } catch (e) {
    ElMessage.error('操作失败')
  } finally {
    resolving.value = false
  }
}

function showDetail(alert: AlertRecord) {
  selectedAlert.value = alert
  detailDrawerVisible.value = true
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadAlerts()
}

onMounted(() => loadData())
</script>

<template>
  <div class="alert-dashboard">
    <div class="page-header">
      <h2>生产异常预警</h2>
      <div class="controls">
        <el-button type="primary" @click="triggerDetection" :loading="detecting">
          手动检测
        </el-button>
        <el-button @click="loadData" :icon="Refresh">刷新</el-button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-row" v-loading="loading">
      <div class="summary-card critical">
        <div class="summary-count">{{ summary.criticalCount || 0 }}</div>
        <div class="summary-label">严重告警</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-count">{{ summary.warningCount || 0 }}</div>
        <div class="summary-label">警告</div>
      </div>
      <div class="summary-card active">
        <div class="summary-count">{{ summary.activeCount || 0 }}</div>
        <div class="summary-label">待处理</div>
      </div>
      <div class="summary-card resolved">
        <div class="summary-count">{{ summary.resolvedToday || 0 }}</div>
        <div class="summary-label">今日已解决</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable @change="loadAlerts" style="width: 140px">
        <el-option label="待处理" value="ACTIVE" />
        <el-option label="已确认" value="ACKNOWLEDGED" />
        <el-option label="已解决" value="RESOLVED" />
        <el-option label="已验证" value="VERIFIED" />
      </el-select>
      <el-select v-model="filterLevel" placeholder="级别筛选" clearable @change="loadAlerts" style="width: 140px; margin-left: 12px">
        <el-option label="严重" value="CRITICAL" />
        <el-option label="警告" value="WARNING" />
        <el-option label="信息" value="INFO" />
      </el-select>
    </div>

    <!-- Alert List -->
    <el-table :data="alerts" stripe v-loading="loadingAlerts" style="margin-top: 16px">
      <el-table-column prop="level" label="级别" width="80">
        <template #default="{ row }">
          <el-tag :type="row.level === 'CRITICAL' ? 'danger' : row.level === 'WARNING' ? 'warning' : 'info'" size="small">
            {{ row.level }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="alertType" label="类型" width="120" />
      <el-table-column prop="metricName" label="指标" width="120" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="currentValue" label="当前值" width="100">
        <template #default="{ row }">
          {{ row.currentValue != null ? Number(row.currentValue).toFixed(1) : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="baselineValue" label="基线值" width="100">
        <template #default="{ row }">
          {{ row.baselineValue != null ? Number(row.baselineValue).toFixed(1) : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="时间" width="160" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'ACTIVE'" type="warning" size="small" @click="acknowledgeAlert(row)">确认</el-button>
          <el-button v-if="row.status === 'ACTIVE' || row.status === 'ACKNOWLEDGED'" type="success" size="small" @click="openResolveDialog(row)">解决</el-button>
          <el-button type="primary" size="small" link @click="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <el-pagination
      v-if="totalAlerts > pageSize"
      :current-page="currentPage"
      :page-size="pageSize"
      :total="totalAlerts"
      layout="total, prev, pager, next"
      @current-change="handlePageChange"
      style="margin-top: 16px; justify-content: flex-end"
    />

    <!-- Resolve Dialog -->
    <el-dialog v-model="resolveDialogVisible" title="解决告警" width="500px">
      <el-input v-model="resolutionNotes" type="textarea" :rows="4" placeholder="请输入解决说明..." />
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="resolveAlert" :loading="resolving">确认解决</el-button>
      </template>
    </el-dialog>

    <!-- Detail Drawer -->
    <el-drawer v-model="detailDrawerVisible" title="告警详情" size="500px">
      <div v-if="selectedAlert" class="alert-detail">
        <div class="detail-row">
          <span class="detail-label">告警类型:</span>
          <span>{{ selectedAlert.alertType }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">级别:</span>
          <el-tag :type="selectedAlert.level === 'CRITICAL' ? 'danger' : 'warning'" size="small">{{ selectedAlert.level }}</el-tag>
        </div>
        <div class="detail-row">
          <span class="detail-label">指标:</span>
          <span>{{ selectedAlert.metricName }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">当前值:</span>
          <span class="value-bad">{{ selectedAlert.currentValue }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">基线值:</span>
          <span>{{ selectedAlert.baselineValue }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">偏差:</span>
          <span class="value-bad">{{ selectedAlert.deviationPercent != null ? selectedAlert.deviationPercent.toFixed(1) + '%' : '-' }}</span>
        </div>
        <div class="detail-row" v-if="selectedAlert.productName">
          <span class="detail-label">产品:</span>
          <span>{{ selectedAlert.productName }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">描述:</span>
          <span>{{ selectedAlert.description }}</span>
        </div>
        <div v-if="selectedAlert.aiAnalysis" class="ai-analysis-section">
          <h4>AI 根因分析</h4>
          <div v-html="DOMPurify.sanitize(marked(selectedAlert.aiAnalysis) as string)"></div>
        </div>
        <div class="status-timeline">
          <h4>状态时间线</h4>
          <el-timeline>
            <el-timeline-item :timestamp="selectedAlert.createdAt" type="danger">创建告警</el-timeline-item>
            <el-timeline-item v-if="selectedAlert.acknowledgedAt" :timestamp="selectedAlert.acknowledgedAt" type="warning">已确认</el-timeline-item>
            <el-timeline-item v-if="selectedAlert.resolvedAt" :timestamp="selectedAlert.resolvedAt" type="success">
              已解决{{ selectedAlert.resolutionNotes ? ': ' + selectedAlert.resolutionNotes : '' }}
            </el-timeline-item>
            <el-timeline-item v-if="selectedAlert.verifiedAt" :timestamp="selectedAlert.verifiedAt" type="primary">
              {{ selectedAlert.autoVerified ? '自动验证通过' : '人工验证通过' }}
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
.alert-dashboard {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 20px;
    color: #303133;
  }
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.summary-card {
  padding: 20px;
  border-radius: 12px;
  color: #fff;
  text-align: center;

  &.critical {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }
  &.warning {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }
  &.active {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
  }
  &.resolved {
    background: linear-gradient(135deg, #10b981, #059669);
  }
}

.summary-count {
  font-size: 32px;
  font-weight: 700;
}

.summary-label {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
}

.filter-bar {
  display: flex;
  align-items: center;
}

.alert-detail {
  .detail-row {
    display: flex;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
  }
}

.detail-label {
  color: #666;
  width: 80px;
  flex-shrink: 0;
}

.value-bad {
  color: #ef4444;
  font-weight: 600;
}

.ai-analysis-section {
  margin-top: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;

  h4 {
    margin: 0 0 8px 0;
    color: #303133;
  }
}

.status-timeline {
  margin-top: 20px;

  h4 {
    margin: 0 0 12px 0;
    color: #303133;
  }
}
</style>
