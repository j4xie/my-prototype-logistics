<script setup lang="ts">
/**
 * 数据完整度查看页面
 * 展示各业务模块的数据填充率和字段级别完整度明细
 *
 * Data source: Python service POST /api/client-requirement/completeness/compute
 * Requires: asyncpg + PostgreSQL with the relevant entity tables
 * Fallback: Shows friendly "service unavailable" message instead of error
 */
import { ref, onMounted, computed } from 'vue'
import { Refresh, DataAnalysis } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/modules/auth'
import { pythonFetch } from '@/api/smartbi/common'

const authStore = useAuthStore()
const factoryId = computed(() => authStore.factoryId)
const loading = ref(false)

// Service availability state
const serviceAvailable = ref(true)
const errorMessage = ref('')

interface FieldCompleteness {
  [field: string]: number
}

interface CompletenessItem {
  entityType: string
  overallCompleteness: number
  totalRecords: number
  fieldCompleteness: FieldCompleteness
}

const completenessData = ref<CompletenessItem[]>([])
const selectedModule = ref<CompletenessItem | null>(null)

const fieldTableData = computed(() => {
  if (!selectedModule.value?.fieldCompleteness) return []
  return Object.entries(selectedModule.value.fieldCompleteness)
    .map(([field, val]) => ({
      field: fieldLabel(field),
      fieldRaw: field,
      completeness: val as number
    }))
    .sort((a, b) => a.completeness - b.completeness)
})

// Overall average completeness across all modules
const overallAverage = computed(() => {
  if (completenessData.value.length === 0) return 0
  const sum = completenessData.value.reduce((acc, item) => acc + item.overallCompleteness, 0)
  return Math.round(sum / completenessData.value.length * 10) / 10
})

function entityLabel(type: string): string {
  const map: Record<string, string> = {
    PROCESSING_BATCH: '生产批次',
    WORK_SESSION: '工时记录',
    MATERIAL_BATCH: '物料批次',
    QUALITY_INSPECTION: '质量检验',
    EQUIPMENT: '设备管理'
  }
  return map[type] || type
}

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    batch_number: '批次号',
    product_name: '产品名称',
    planned_quantity: '计划数量',
    actual_quantity: '实际数量',
    good_quantity: '合格数量',
    defect_quantity: '缺陷数量',
    yield_rate: '良品率',
    material_cost: '物料成本',
    labor_cost: '人工成本',
    equipment_cost: '设备成本',
    total_cost: '总成本',
    unit_cost: '单位成本',
    equipment_id: '设备编号',
    supervisor_id: '主管编号',
    worker_count: '工人数量',
    start_time: '开始时间',
    end_time: '结束时间',
    completed_time: '完成时间',
    user_id: '用户编号',
    work_type_id: '工种编号',
    break_minutes: '休息时长',
    actual_work_minutes: '实际工时',
    hourly_rate: '时薪',
    material_type_id: '物料类型',
    quantity: '数量',
    unit_price: '单价',
    supplier_id: '供应商',
    expiry_date: '过期日期',
    storage_location: '存储位置',
    batch_id: '批次编号',
    inspector_id: '检验员',
    inspection_type: '检验类型',
    result: '检验结果',
    defect_count: '缺陷数',
    defect_type: '缺陷类型',
    equipment_name: '设备名称',
    equipment_type: '设备类型',
    operating_hours: '运行时长',
    last_maintenance_date: '上次维护日期',
    status: '状态',
  }
  return map[field] || field.replace(/_/g, ' ')
}

function getScoreClass(score: number): string {
  if (score >= 75) return 'score-good'
  if (score >= 50) return 'score-medium'
  return 'score-low'
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function selectModule(item: CompletenessItem) {
  selectedModule.value = item
}

async function loadData() {
  if (!factoryId.value) {
    errorMessage.value = '无法获取工厂信息，请重新登录'
    return
  }
  loading.value = true
  errorMessage.value = ''
  serviceAvailable.value = true

  try {
    const json = await pythonFetch('/api/client-requirement/completeness/compute', {
      method: 'POST',
      body: JSON.stringify({ factory_id: factoryId.value })
    }) as { success?: boolean; data?: CompletenessItem[] }

    if (json.success) {
      completenessData.value = json.data || []
      if (completenessData.value.length > 0 && !selectedModule.value) {
        selectedModule.value = completenessData.value[0]
      }
    } else {
      completenessData.value = []
    }
  } catch (e: unknown) {
    console.warn('Load completeness failed:', e)
    const errMsg = e instanceof Error ? e.message : String(e)

    // Check if this is a 404 or connection error (service not deployed)
    if (errMsg.includes('404') || errMsg.includes('Not Found') ||
        errMsg.includes('timed out') || errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError') || errMsg.includes('ECONNREFUSED')) {
      serviceAvailable.value = false
      errorMessage.value = ''
    } else {
      errorMessage.value = '加载完整度数据时发生错误'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="data-completeness">
    <div class="page-header">
      <div class="header-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/smart-bi/dashboard' }">Smart BI</el-breadcrumb-item>
          <el-breadcrumb-item>数据完整度</el-breadcrumb-item>
        </el-breadcrumb>
        <h2>数据完整度</h2>
      </div>
      <el-button @click="loadData" :loading="loading" :icon="Refresh">刷新</el-button>
    </div>

    <!-- Service unavailable notice (friendly, non-error) -->
    <div v-if="!serviceAvailable && !loading" class="service-notice">
      <el-card class="notice-card">
        <div class="notice-content">
          <el-icon class="notice-icon" :size="48"><DataAnalysis /></el-icon>
          <h3>数据完整度分析</h3>
          <p class="notice-desc">
            此功能需要数据分析服务支持。当数据分析服务部署并连接数据库后，将自动计算各业务模块的数据填充率。
          </p>
          <div class="notice-features">
            <div class="feature-item">
              <span class="feature-dot good"></span>
              <span>生产批次 - 17个字段完整度检测</span>
            </div>
            <div class="feature-item">
              <span class="feature-dot good"></span>
              <span>工时记录 - 8个字段完整度检测</span>
            </div>
            <div class="feature-item">
              <span class="feature-dot good"></span>
              <span>物料批次 - 7个字段完整度检测</span>
            </div>
            <div class="feature-item">
              <span class="feature-dot good"></span>
              <span>质量检验 - 6个字段完整度检测</span>
            </div>
            <div class="feature-item">
              <span class="feature-dot good"></span>
              <span>设备管理 - 5个字段完整度检测</span>
            </div>
          </div>
          <el-button type="primary" plain @click="loadData" :loading="loading" style="margin-top: 16px">
            重新检测
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- Error state -->
    <el-alert
      v-if="errorMessage && !loading"
      type="warning"
      :title="errorMessage"
      show-icon
      closable
      style="margin-bottom: 16px"
      @close="errorMessage = ''"
    >
      <el-button size="small" type="primary" @click="loadData" style="margin-top: 8px">重试</el-button>
    </el-alert>

    <!-- Overall summary bar -->
    <div v-if="completenessData.length > 0" class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">综合完整度</span>
        <span class="summary-value" :style="{ color: getScoreColor(overallAverage) }">
          {{ overallAverage }}%
        </span>
      </div>
      <div class="summary-item">
        <span class="summary-label">已检测模块</span>
        <span class="summary-value">{{ completenessData.length }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">总数据量</span>
        <span class="summary-value">
          {{ completenessData.reduce((sum, item) => sum + item.totalRecords, 0) }} 条
        </span>
      </div>
    </div>

    <!-- Module Cards -->
    <div v-if="serviceAvailable" class="module-grid" v-loading="loading">
      <div
        v-for="item in completenessData"
        :key="item.entityType"
        class="module-card"
        :class="[getScoreClass(item.overallCompleteness), { selected: selectedModule?.entityType === item.entityType }]"
        @click="selectModule(item)"
      >
        <div class="module-score" :style="{ color: getScoreColor(item.overallCompleteness) }">
          {{ item.overallCompleteness.toFixed(1) }}%
        </div>
        <div class="module-name">{{ entityLabel(item.entityType) }}</div>
        <div class="module-records">{{ item.totalRecords }} 条记录</div>
        <el-progress
          :percentage="item.overallCompleteness"
          :stroke-width="6"
          :color="getScoreColor(item.overallCompleteness)"
          :show-text="false"
        />
      </div>
    </div>

    <!-- Empty State (service available but no data) -->
    <el-empty
      v-if="serviceAvailable && !loading && completenessData.length === 0 && !errorMessage"
      description="当前工厂暂无可检测的数据记录"
    />

    <!-- Field Detail Table -->
    <div class="detail-section" v-if="selectedModule">
      <h3>{{ entityLabel(selectedModule.entityType) }} - 字段完整度</h3>
      <el-table :data="fieldTableData" stripe>
        <el-table-column prop="field" label="字段" min-width="140" />
        <el-table-column prop="completeness" label="完整度" width="120">
          <template #default="{ row }">
            <span :style="{ color: getScoreColor(row.completeness), fontWeight: 600 }">
              {{ row.completeness.toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            <el-progress
              :percentage="row.completeness"
              :stroke-width="8"
              :color="getScoreColor(row.completeness)"
              :show-text="false"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.completeness >= 75 ? 'success' : row.completeness >= 50 ? 'warning' : 'danger'"
              size="small"
            >
              {{ row.completeness >= 75 ? '良好' : row.completeness >= 50 ? '一般' : '不足' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.data-completeness {
  padding: var(--page-padding, 20px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;

  .header-left {
    h2 {
      margin: 12px 0 0;
      font-size: 20px;
      color: #303133;
    }
  }
}

// Service unavailable notice
.service-notice {
  margin-bottom: 24px;
}

.notice-card {
  border-radius: 12px;
  border-left: 4px solid #409eff;

  :deep(.el-card__body) {
    padding: 32px;
  }
}

.notice-content {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;

  .notice-icon {
    color: #409eff;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 12px;
  }

  .notice-desc {
    font-size: 14px;
    color: #606266;
    line-height: 1.6;
    margin: 0 0 20px;
  }
}

.notice-features {
  text-align: left;
  display: inline-block;

  .feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
    color: #606266;

    .feature-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;

      &.good {
        background: #10b981;
      }
    }
  }
}

// Summary bar
.summary-bar {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 20px;

  .summary-item {
    display: flex;
    align-items: center;
    gap: 8px;

    .summary-label {
      font-size: 13px;
      color: #909399;
    }

    .summary-value {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      font-variant-numeric: tabular-nums;
    }
  }
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.module-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: #409eff;
  }

  &.score-good {
    border-left: 4px solid #10b981;
  }

  &.score-medium {
    border-left: 4px solid #f59e0b;
  }

  &.score-low {
    border-left: 4px solid #ef4444;
  }
}

.module-score {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.module-name {
  font-size: 15px;
  font-weight: 600;
  margin: 4px 0;
  color: #303133;
}

.module-records {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.detail-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  h3 {
    margin: 0 0 12px 0;
    color: #303133;
  }
}
</style>
