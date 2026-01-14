<!--
  溯源批次列表
-->
<template>
  <div class="app-container">
    <!-- 搜索区域 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true" label-width="80px">
      <el-form-item label="批次号" prop="batchNo">
        <el-input
          v-model="queryParams.batchNo"
          placeholder="请输入批次号"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="产品名称" prop="productName">
        <el-input
          v-model="queryParams.productName"
          placeholder="请输入产品名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 150px">
          <el-option label="进行中" :value="0" />
          <el-option label="已完成" :value="1" />
          <el-option label="待处理" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item label="生产日期" prop="dateRange">
        <el-date-picker
          v-model="queryParams.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作按钮 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" icon="Plus" @click="handleAdd">新增批次</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button
          type="danger"
          icon="Delete"
          :disabled="!selectedIds.length"
          @click="handleBatchDelete"
        >
          批量删除
        </el-button>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-table
      v-loading="loading"
      :data="batchList"
      @selection-change="handleSelectionChange"
      border
    >
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="批次号" prop="batchNo" width="180">
        <template #default="{ row }">
          <el-link type="primary" @click="handleDetail(row)">{{ row.batchNo }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="产品名称" prop="productName" min-width="150" show-overflow-tooltip />
      <el-table-column label="生产日期" prop="productionDate" width="120" align="center" />
      <el-table-column label="过期日期" prop="expiryDate" width="120" align="center">
        <template #default="{ row }">
          <span :class="{ 'text-danger': isExpired(row.expiryDate) }">
            {{ row.expiryDate || '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="数量" prop="quantity" width="100" align="right">
        <template #default="{ row }">
          {{ row.quantity }} {{ row.unit }}
        </template>
      </el-table-column>
      <el-table-column label="生产车间" prop="workshop" width="120" />
      <el-table-column label="状态" prop="status" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" prop="createTime" width="170">
        <template #default="{ row }">
          {{ formatTime(row.createTime) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" link icon="View" @click="handleDetail(row)">详情</el-button>
          <el-button type="primary" link icon="Edit" @click="handleEdit(row)">编辑</el-button>
          <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, row)">
            <el-button type="primary" link>
              更多<el-icon class="el-icon--right"><arrow-down /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="timeline" icon="Clock">时间线</el-dropdown-item>
                <el-dropdown-item command="qrcode" icon="Link">溯源码</el-dropdown-item>
                <el-dropdown-item
                  v-if="row.status !== 1"
                  command="complete"
                  icon="Check"
                >
                  标记完成
                </el-dropdown-item>
                <el-dropdown-item command="delete" icon="Delete" divided>
                  删除
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-model:current-page="queryParams.current"
      v-model:page-size="queryParams.size"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="getList"
      @current-change="getList"
      style="margin-top: 20px; justify-content: flex-end"
    />

    <!-- 时间线对话框 -->
    <el-dialog v-model="timelineDialogVisible" :title="`批次 ${currentBatch?.batchNo} 时间线`" width="700px">
      <div v-loading="timelineLoading">
        <el-timeline v-if="timelineList.length > 0">
          <el-timeline-item
            v-for="item in timelineList"
            :key="item.id"
            :timestamp="formatTime(item.operateTime)"
            placement="top"
          >
            <el-card>
              <div class="timeline-header">
                <strong>{{ item.stage }}</strong>
                <el-tag size="small" style="margin-left: 8px">{{ item.operatorName }}</el-tag>
              </div>
              <p style="margin: 8px 0 0 0; color: #606266">{{ item.description }}</p>
              <div v-if="item.location" style="margin-top: 4px; color: #909399; font-size: 12px">
                <el-icon><Location /></el-icon> {{ item.location }}
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无时间线数据" />
      </div>
      <template #footer>
        <el-button @click="timelineDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="showAddTimelineDialog">添加节点</el-button>
      </template>
    </el-dialog>

    <!-- 添加时间线节点对话框 -->
    <el-dialog v-model="addTimelineDialogVisible" title="添加时间线节点" width="500px">
      <el-form :model="timelineForm" :rules="timelineRules" ref="timelineFormRef" label-width="100px">
        <el-form-item label="阶段名称" prop="stage">
          <el-input v-model="timelineForm.stage" placeholder="如：原料采购、生产加工、质检入库" />
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
          <el-input v-model="timelineForm.description" type="textarea" :rows="3" placeholder="请输入详细描述" />
        </el-form-item>
        <el-form-item label="操作地点" prop="location">
          <el-input v-model="timelineForm.location" placeholder="请输入操作地点（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addTimelineDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTimelineNode" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 溯源码对话框 -->
    <el-dialog v-model="qrcodeDialogVisible" title="溯源码" width="400px">
      <div class="qrcode-container">
        <div class="qrcode-placeholder">
          <el-icon :size="120"><Link /></el-icon>
        </div>
        <div class="qrcode-info">
          <p>批次号: <strong>{{ currentBatch?.batchNo }}</strong></p>
          <p>产品: {{ currentBatch?.productName }}</p>
          <p style="margin-top: 16px; font-size: 12px; color: #909399">
            扫描二维码可查看完整溯源信息
          </p>
        </div>
      </div>
      <template #footer>
        <el-button @click="qrcodeDialogVisible = false">关闭</el-button>
        <el-button type="primary" icon="Download">下载二维码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="TraceabilityBatch">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Location, Link } from '@element-plus/icons-vue'
import { getPage, delObj, updateStatus, getTimeline, addTimelineNode } from '@/api/mall/traceability'

const router = useRouter()

// 加载状态
const loading = ref(false)
const timelineLoading = ref(false)
const submitting = ref(false)

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  batchNo: '',
  productName: '',
  status: null,
  dateRange: []
})

// 数据列表
const batchList = ref([])
const total = ref(0)
const selectedIds = ref([])

// 当前操作批次
const currentBatch = ref(null)

// 时间线相关
const timelineDialogVisible = ref(false)
const timelineList = ref([])
const addTimelineDialogVisible = ref(false)
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
  description: [{ required: true, message: '请输入操作描述', trigger: 'blur' }]
}

// 二维码相关
const qrcodeDialogVisible = ref(false)

// 状态映射
const statusMap = {
  0: { label: '进行中', type: 'warning' },
  1: { label: '已完成', type: 'success' },
  2: { label: '待处理', type: 'info' }
}

const getStatusLabel = (status) => statusMap[status]?.label || '未知'
const getStatusType = (status) => statusMap[status]?.type || 'info'

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

// 加载列表
const getList = async () => {
  loading.value = true
  try {
    const params = {
      current: queryParams.current,
      size: queryParams.size,
      batchNo: queryParams.batchNo || undefined,
      productName: queryParams.productName || undefined,
      status: queryParams.status !== null ? queryParams.status : undefined,
      beginDate: queryParams.dateRange?.[0] || undefined,
      endDate: queryParams.dateRange?.[1] || undefined
    }
    const res = await getPage(params)
    const data = res.data || res || {}
    batchList.value = data.records || []
    total.value = data.total || 0
  } catch (error) {
    console.error('加载列表失败:', error)
    ElMessage.error('加载列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleQuery = () => {
  queryParams.current = 1
  getList()
}

// 重置
const resetQuery = () => {
  queryParams.batchNo = ''
  queryParams.productName = ''
  queryParams.status = null
  queryParams.dateRange = []
  handleQuery()
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

// 新增
const handleAdd = () => {
  router.push('/mall/traceability-create')
}

// 详情
const handleDetail = (row) => {
  router.push(`/mall/traceability-detail/${row.id}`)
}

// 编辑
const handleEdit = (row) => {
  router.push(`/mall/traceability-edit/${row.id}`)
}

// 更多操作命令
const handleCommand = async (command, row) => {
  currentBatch.value = row

  switch (command) {
    case 'timeline':
      showTimeline(row)
      break
    case 'qrcode':
      qrcodeDialogVisible.value = true
      break
    case 'complete':
      handleComplete(row)
      break
    case 'delete':
      handleDelete(row)
      break
  }
}

// 显示时间线
const showTimeline = async (row) => {
  timelineDialogVisible.value = true
  timelineLoading.value = true
  try {
    const res = await getTimeline(row.id)
    timelineList.value = res.data || []
  } catch (error) {
    console.error('加载时间线失败:', error)
    ElMessage.error('加载时间线失败')
  } finally {
    timelineLoading.value = false
  }
}

// 显示添加时间线对话框
const showAddTimelineDialog = () => {
  timelineForm.batchId = currentBatch.value.id
  timelineForm.stage = ''
  timelineForm.operateTime = ''
  timelineForm.operatorName = ''
  timelineForm.description = ''
  timelineForm.location = ''
  addTimelineDialogVisible.value = true
}

// 提交时间线节点
const submitTimelineNode = async () => {
  try {
    await timelineFormRef.value.validate()
  } catch (error) {
    return
  }

  submitting.value = true
  try {
    await addTimelineNode(timelineForm)
    ElMessage.success('添加成功')
    addTimelineDialogVisible.value = false
    showTimeline(currentBatch.value)
  } catch (error) {
    console.error('添加失败:', error)
    ElMessage.error('添加失败')
  } finally {
    submitting.value = false
  }
}

// 标记完成
const handleComplete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要将批次 "${row.batchNo}" 标记为已完成吗？`, '提示', {
      type: 'warning'
    })
    await updateStatus(row.id, 1)
    ElMessage.success('操作成功')
    getList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('操作失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除批次 "${row.batchNo}" 吗？`, '提示', {
      type: 'warning'
    })
    await delObj(row.id)
    ElMessage.success('删除成功')
    getList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedIds.value.length} 条记录吗？`, '提示', {
      type: 'warning'
    })
    // 循环删除
    for (const id of selectedIds.value) {
      await delObj(id)
    }
    ElMessage.success('删除成功')
    getList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 初始化
onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.text-danger {
  color: #f56c6c;
}

.timeline-header {
  display: flex;
  align-items: center;
}

.qrcode-container {
  text-align: center;
  padding: 20px;

  .qrcode-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    height: 200px;
    background: #f5f7fa;
    border: 1px dashed #dcdfe6;
    border-radius: 8px;
    color: #909399;
  }

  .qrcode-info {
    margin-top: 20px;
    p {
      margin: 4px 0;
    }
  }
}
</style>
