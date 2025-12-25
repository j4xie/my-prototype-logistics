<!--
  溯源批次详情页
-->
<template>
  <div class="app-container traceability-detail">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">溯源批次详情</span>
          <el-tag :type="getStatusType(batch.status)" style="margin-left: 12px" size="large">
            {{ getStatusLabel(batch.status) }}
          </el-tag>
        </template>
      </el-page-header>
    </div>

    <div v-loading="loading">
      <!-- 基本信息 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
            <div class="header-actions">
              <el-button type="primary" @click="handleEdit">编辑</el-button>
              <el-button v-if="batch.status !== 1" type="success" @click="handleComplete">
                标记完成
              </el-button>
            </div>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="批次号">
            <strong>{{ batch.batchNo }}</strong>
            <el-button link type="primary" @click="copyBatchNo" style="margin-left: 8px">
              复制
            </el-button>
          </el-descriptions-item>
          <el-descriptions-item label="产品名称">
            {{ batch.productName }}
          </el-descriptions-item>
          <el-descriptions-item label="商户">
            {{ batch.merchant?.merchantName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="生产日期">
            {{ batch.productionDate }}
          </el-descriptions-item>
          <el-descriptions-item label="过期日期">
            <span :class="{ 'text-danger': isExpired(batch.expiryDate) }">
              {{ batch.expiryDate || '-' }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="生产车间">
            {{ batch.workshop || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="数量">
            {{ batch.quantity }} {{ batch.unit }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatTime(batch.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatTime(batch.updateTime) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 溯源时间线 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>溯源时间线</span>
            <el-button type="primary" plain size="small" @click="showAddTimelineDialog">
              添加节点
            </el-button>
          </div>
        </template>

        <el-timeline v-if="timeline.length > 0">
          <el-timeline-item
            v-for="item in timeline"
            :key="item.id"
            :timestamp="formatTime(item.operateTime)"
            placement="top"
            :type="getTimelineType(item)"
          >
            <el-card shadow="hover">
              <div class="timeline-content">
                <div class="timeline-header">
                  <strong>{{ item.stage }}</strong>
                  <el-tag size="small" style="margin-left: 8px">{{ item.operatorName }}</el-tag>
                  <div class="timeline-actions">
                    <el-button type="primary" link size="small" @click="editTimelineNode(item)">
                      编辑
                    </el-button>
                    <el-button type="danger" link size="small" @click="deleteTimelineNode(item)">
                      删除
                    </el-button>
                  </div>
                </div>
                <p class="timeline-desc">{{ item.description }}</p>
                <div v-if="item.location" class="timeline-location">
                  <el-icon><Location /></el-icon> {{ item.location }}
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无时间线数据" />
      </el-card>

      <!-- 原料信息 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>原料信息</span>
            <el-button type="primary" plain size="small" @click="showAddMaterialDialog">
              添加原料
            </el-button>
          </div>
        </template>

        <el-table :data="rawMaterials" border v-if="rawMaterials.length > 0">
          <el-table-column label="原料名称" prop="materialName" />
          <el-table-column label="供应商" prop="supplierName" />
          <el-table-column label="批次号" prop="batchNo" />
          <el-table-column label="数量" align="right">
            <template #default="{ row }">
              {{ row.quantity }} {{ row.unit }}
            </template>
          </el-table-column>
          <el-table-column label="入库时间" prop="createTime">
            <template #default="{ row }">
              {{ formatTime(row.createTime) }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无原料信息" />
      </el-card>

      <!-- 质检报告 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>质检报告</span>
            <el-button type="primary" plain size="small" @click="showAddReportDialog">
              添加报告
            </el-button>
          </div>
        </template>

        <div v-if="qualityReports.length > 0" class="report-list">
          <el-card
            v-for="report in qualityReports"
            :key="report.id"
            class="report-item"
            shadow="hover"
          >
            <div class="report-header">
              <span class="report-name">{{ report.reportName }}</span>
              <el-tag :type="report.result === 'PASS' ? 'success' : 'danger'" size="small">
                {{ report.result === 'PASS' ? '合格' : '不合格' }}
              </el-tag>
            </div>
            <div class="report-content">
              <p>检测机构: {{ report.inspectionOrg || '-' }}</p>
              <p>检测日期: {{ report.inspectionDate }}</p>
              <p v-if="report.reportUrl">
                <el-link type="primary" :href="report.reportUrl" target="_blank">
                  查看报告
                </el-link>
              </p>
            </div>
          </el-card>
        </div>
        <el-empty v-else description="暂无质检报告" />
      </el-card>

      <!-- 证据材料 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>证据材料</span>
            <el-button type="primary" plain size="small" @click="showAddEvidenceDialog">
              添加证据
            </el-button>
          </div>
        </template>

        <div v-if="evidences.length > 0" class="evidence-list">
          <div v-for="evidence in evidences" :key="evidence.id" class="evidence-item">
            <el-image
              v-if="evidence.type === 'IMAGE'"
              :src="evidence.url"
              :preview-src-list="[evidence.url]"
              fit="cover"
              class="evidence-image"
            />
            <div v-else class="evidence-file">
              <el-icon :size="40"><Document /></el-icon>
              <span>{{ evidence.name }}</span>
            </div>
            <div class="evidence-info">
              <p>{{ evidence.description }}</p>
              <small>{{ formatTime(evidence.createTime) }}</small>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无证据材料" />
      </el-card>
    </div>

    <!-- 添加时间线节点对话框 -->
    <el-dialog v-model="timelineDialogVisible" :title="editingTimelineNode ? '编辑时间线节点' : '添加时间线节点'" width="500px">
      <el-form :model="timelineForm" :rules="timelineRules" ref="timelineFormRef" label-width="100px">
        <el-form-item label="阶段名称" prop="stage">
          <el-input v-model="timelineForm.stage" placeholder="如：原料采购、生产加工" />
        </el-form-item>
        <el-form-item label="操作时间" prop="operateTime">
          <el-date-picker
            v-model="timelineForm.operateTime"
            type="datetime"
            placeholder="选择操作时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="操作人" prop="operatorName">
          <el-input v-model="timelineForm.operatorName" placeholder="请输入操作人姓名" />
        </el-form-item>
        <el-form-item label="操作描述" prop="description">
          <el-input v-model="timelineForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="操作地点" prop="location">
          <el-input v-model="timelineForm.location" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="timelineDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTimelineNode" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加原料对话框 -->
    <el-dialog v-model="materialDialogVisible" title="添加原料" width="500px">
      <el-form :model="materialForm" :rules="materialRules" ref="materialFormRef" label-width="100px">
        <el-form-item label="原料名称" prop="materialName">
          <el-input v-model="materialForm.materialName" placeholder="请输入原料名称" />
        </el-form-item>
        <el-form-item label="供应商" prop="supplierName">
          <el-input v-model="materialForm.supplierName" placeholder="请输入供应商名称" />
        </el-form-item>
        <el-form-item label="批次号" prop="batchNo">
          <el-input v-model="materialForm.batchNo" placeholder="请输入原料批次号" />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number v-model="materialForm.quantity" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="materialForm.unit" placeholder="如 kg、L" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="materialDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitMaterial" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加质检报告对话框 -->
    <el-dialog v-model="reportDialogVisible" title="添加质检报告" width="500px">
      <el-form :model="reportForm" :rules="reportRules" ref="reportFormRef" label-width="100px">
        <el-form-item label="报告名称" prop="reportName">
          <el-input v-model="reportForm.reportName" placeholder="请输入报告名称" />
        </el-form-item>
        <el-form-item label="检测机构" prop="inspectionOrg">
          <el-input v-model="reportForm.inspectionOrg" placeholder="请输入检测机构" />
        </el-form-item>
        <el-form-item label="检测日期" prop="inspectionDate">
          <el-date-picker
            v-model="reportForm.inspectionDate"
            type="date"
            placeholder="选择检测日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="检测结果" prop="result">
          <el-radio-group v-model="reportForm.result">
            <el-radio label="PASS">合格</el-radio>
            <el-radio label="FAIL">不合格</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="报告链接" prop="reportUrl">
          <el-input v-model="reportForm.reportUrl" placeholder="可选，输入报告链接" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReport" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 添加证据对话框 -->
    <el-dialog v-model="evidenceDialogVisible" title="添加证据" width="500px">
      <el-form :model="evidenceForm" :rules="evidenceRules" ref="evidenceFormRef" label-width="100px">
        <el-form-item label="证据类型" prop="type">
          <el-radio-group v-model="evidenceForm.type">
            <el-radio label="IMAGE">图片</el-radio>
            <el-radio label="FILE">文件</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="证据名称" prop="name">
          <el-input v-model="evidenceForm.name" placeholder="请输入证据名称" />
        </el-form-item>
        <el-form-item label="证据链接" prop="url">
          <el-input v-model="evidenceForm.url" placeholder="请输入图片或文件链接" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="evidenceForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="evidenceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEvidence" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="TraceabilityDetail">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Location, Document } from '@element-plus/icons-vue'
import {
  getObj,
  updateStatus,
  getTimeline,
  addTimelineNode,
  updateTimelineNode,
  deleteTimelineNode as deleteNode,
  getRawMaterials,
  addRawMaterial,
  getQualityReports,
  addQualityReport,
  getEvidences,
  addEvidence
} from '@/api/mall/traceability'

const router = useRouter()
const route = useRoute()

// 批次ID
const batchId = ref(null)

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 批次数据
const batch = ref({})
const timeline = ref([])
const rawMaterials = ref([])
const qualityReports = ref([])
const evidences = ref([])

// 状态映射
const statusMap = {
  0: { label: '进行中', type: 'warning' },
  1: { label: '已完成', type: 'success' },
  2: { label: '待处理', type: 'info' }
}

const getStatusLabel = (status) => statusMap[status]?.label || '未知'
const getStatusType = (status) => statusMap[status]?.type || 'info'

const getTimelineType = (item) => {
  // 可以根据阶段类型返回不同颜色
  return ''
}

// 判断是否过期
const isExpired = (date) => {
  if (!date) return false
  return new Date(date) < new Date()
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

// 时间线表单
const timelineDialogVisible = ref(false)
const editingTimelineNode = ref(null)
const timelineFormRef = ref(null)
const timelineForm = reactive({
  batchId: null,
  stage: '',
  operateTime: '',
  operatorName: '',
  description: '',
  location: ''
})
const timelineRules = {
  stage: [{ required: true, message: '请输入阶段名称', trigger: 'blur' }],
  operateTime: [{ required: true, message: '请选择操作时间', trigger: 'change' }],
  operatorName: [{ required: true, message: '请输入操作人', trigger: 'blur' }],
  description: [{ required: true, message: '请输入描述', trigger: 'blur' }]
}

// 原料表单
const materialDialogVisible = ref(false)
const materialFormRef = ref(null)
const materialForm = reactive({
  batchId: null,
  materialName: '',
  supplierName: '',
  batchNo: '',
  quantity: 0,
  unit: ''
})
const materialRules = {
  materialName: [{ required: true, message: '请输入原料名称', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }]
}

// 质检报告表单
const reportDialogVisible = ref(false)
const reportFormRef = ref(null)
const reportForm = reactive({
  batchId: null,
  reportName: '',
  inspectionOrg: '',
  inspectionDate: '',
  result: 'PASS',
  reportUrl: ''
})
const reportRules = {
  reportName: [{ required: true, message: '请输入报告名称', trigger: 'blur' }],
  inspectionDate: [{ required: true, message: '请选择检测日期', trigger: 'change' }],
  result: [{ required: true, message: '请选择检测结果', trigger: 'change' }]
}

// 证据表单
const evidenceDialogVisible = ref(false)
const evidenceFormRef = ref(null)
const evidenceForm = reactive({
  batchId: null,
  type: 'IMAGE',
  name: '',
  url: '',
  description: ''
})
const evidenceRules = {
  type: [{ required: true, message: '请选择证据类型', trigger: 'change' }],
  name: [{ required: true, message: '请输入证据名称', trigger: 'blur' }],
  url: [{ required: true, message: '请输入证据链接', trigger: 'blur' }]
}

// 加载批次详情
const loadBatch = async () => {
  if (!batchId.value) return

  loading.value = true
  try {
    const res = await getObj(batchId.value)
    batch.value = res.data || res || {}

    // 加载关联数据
    await Promise.all([
      loadTimeline(),
      loadMaterials(),
      loadReports(),
      loadEvidences()
    ])
  } catch (error) {
    console.error('获取批次详情失败:', error)
    ElMessage.error('获取批次详情失败')
  } finally {
    loading.value = false
  }
}

const loadTimeline = async () => {
  try {
    const res = await getTimeline(batchId.value)
    timeline.value = res.data || []
  } catch (error) {
    console.error('加载时间线失败:', error)
  }
}

const loadMaterials = async () => {
  try {
    const res = await getRawMaterials(batchId.value)
    rawMaterials.value = res.data || []
  } catch (error) {
    console.error('加载原料失败:', error)
  }
}

const loadReports = async () => {
  try {
    const res = await getQualityReports(batchId.value)
    qualityReports.value = res.data || []
  } catch (error) {
    console.error('加载质检报告失败:', error)
  }
}

const loadEvidences = async () => {
  try {
    const res = await getEvidences(batchId.value)
    evidences.value = res.data || []
  } catch (error) {
    console.error('加载证据失败:', error)
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/traceability')
}

// 编辑
const handleEdit = () => {
  router.push(`/mall/traceability-edit/${batchId.value}`)
}

// 标记完成
const handleComplete = async () => {
  try {
    await ElMessageBox.confirm('确定要将此批次标记为已完成吗？', '提示', { type: 'warning' })
    await updateStatus(batchId.value, 1)
    ElMessage.success('操作成功')
    loadBatch()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

// 复制批次号
const copyBatchNo = () => {
  navigator.clipboard.writeText(batch.value.batchNo)
  ElMessage.success('批次号已复制')
}

// 时间线操作
const showAddTimelineDialog = () => {
  editingTimelineNode.value = null
  timelineForm.batchId = batchId.value
  timelineForm.stage = ''
  timelineForm.operateTime = ''
  timelineForm.operatorName = ''
  timelineForm.description = ''
  timelineForm.location = ''
  timelineDialogVisible.value = true
}

const editTimelineNode = (node) => {
  editingTimelineNode.value = node
  Object.assign(timelineForm, node)
  timelineDialogVisible.value = true
}

const submitTimelineNode = async () => {
  try {
    await timelineFormRef.value.validate()
  } catch (error) {
    return
  }

  submitting.value = true
  try {
    if (editingTimelineNode.value) {
      await updateTimelineNode(timelineForm)
    } else {
      await addTimelineNode(timelineForm)
    }
    ElMessage.success('操作成功')
    timelineDialogVisible.value = false
    loadTimeline()
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const deleteTimelineNode = async (node) => {
  try {
    await ElMessageBox.confirm('确定要删除此节点吗？', '提示', { type: 'warning' })
    await deleteNode(node.id)
    ElMessage.success('删除成功')
    loadTimeline()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 原料操作
const showAddMaterialDialog = () => {
  materialForm.batchId = batchId.value
  materialForm.materialName = ''
  materialForm.supplierName = ''
  materialForm.batchNo = ''
  materialForm.quantity = 0
  materialForm.unit = ''
  materialDialogVisible.value = true
}

const submitMaterial = async () => {
  try {
    await materialFormRef.value.validate()
  } catch (error) {
    return
  }

  submitting.value = true
  try {
    await addRawMaterial(materialForm)
    ElMessage.success('添加成功')
    materialDialogVisible.value = false
    loadMaterials()
  } catch (error) {
    ElMessage.error('添加失败')
  } finally {
    submitting.value = false
  }
}

// 质检报告操作
const showAddReportDialog = () => {
  reportForm.batchId = batchId.value
  reportForm.reportName = ''
  reportForm.inspectionOrg = ''
  reportForm.inspectionDate = ''
  reportForm.result = 'PASS'
  reportForm.reportUrl = ''
  reportDialogVisible.value = true
}

const submitReport = async () => {
  try {
    await reportFormRef.value.validate()
  } catch (error) {
    return
  }

  submitting.value = true
  try {
    await addQualityReport(reportForm)
    ElMessage.success('添加成功')
    reportDialogVisible.value = false
    loadReports()
  } catch (error) {
    ElMessage.error('添加失败')
  } finally {
    submitting.value = false
  }
}

// 证据操作
const showAddEvidenceDialog = () => {
  evidenceForm.batchId = batchId.value
  evidenceForm.type = 'IMAGE'
  evidenceForm.name = ''
  evidenceForm.url = ''
  evidenceForm.description = ''
  evidenceDialogVisible.value = true
}

const submitEvidence = async () => {
  try {
    await evidenceFormRef.value.validate()
  } catch (error) {
    return
  }

  submitting.value = true
  try {
    await addEvidence(evidenceForm)
    ElMessage.success('添加成功')
    evidenceDialogVisible.value = false
    loadEvidences()
  } catch (error) {
    ElMessage.error('添加失败')
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(() => {
  batchId.value = route.params.id || route.query.id

  if (!batchId.value) {
    ElMessage.error('缺少批次ID参数')
    goBack()
    return
  }

  loadBatch()
})
</script>

<style lang="scss" scoped>
.traceability-detail {
  .page-header {
    margin-bottom: 20px;
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .info-card {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .text-danger {
    color: #f56c6c;
  }

  .timeline-content {
    .timeline-header {
      display: flex;
      align-items: center;

      .timeline-actions {
        margin-left: auto;
      }
    }

    .timeline-desc {
      margin: 8px 0 0 0;
      color: #606266;
    }

    .timeline-location {
      margin-top: 4px;
      color: #909399;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .report-list {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .report-item {
      width: 280px;

      .report-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .report-name {
          font-weight: 600;
        }
      }

      .report-content {
        font-size: 13px;
        color: #606266;

        p {
          margin: 4px 0;
        }
      }
    }
  }

  .evidence-list {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .evidence-item {
      width: 150px;
      text-align: center;

      .evidence-image {
        width: 150px;
        height: 100px;
        border-radius: 4px;
      }

      .evidence-file {
        width: 150px;
        height: 100px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #f5f7fa;
        border-radius: 4px;
        color: #909399;

        span {
          margin-top: 8px;
          font-size: 12px;
        }
      }

      .evidence-info {
        margin-top: 8px;
        font-size: 12px;
        color: #606266;

        p {
          margin: 0;
        }

        small {
          color: #909399;
        }
      }
    }
  }
}
</style>
