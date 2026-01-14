<!--
  审核队列页面
-->
<template>
  <div class="app-container review-queue">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in statsCards" :key="stat.key">
        <div class="stat-card" :class="stat.type">
          <div class="stat-icon">
            <el-icon size="28"><component :is="stat.icon" /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 筛选和操作 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="queryParams">
        <el-form-item label="内容类型">
          <el-select v-model="queryParams.contentType" placeholder="全部" clearable style="width: 140px">
            <el-option label="商品" value="product" />
            <el-option label="评价" value="review" />
            <el-option label="商户信息" value="merchant" />
            <el-option label="Banner" value="banner" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="待审核" :value="0" />
            <el-option label="已通过" :value="1" />
            <el-option label="已拒绝" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="提交时间">
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
          <el-button type="primary" @click="handleQuery">
            <el-icon><Search /></el-icon> 搜索
          </el-button>
          <el-button @click="resetQuery">
            <el-icon><Refresh /></el-icon> 重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-row :gutter="10">
        <el-col :span="1.5">
          <el-button type="success" plain :disabled="selectedIds.length === 0" @click="batchApprove">
            <el-icon><Select /></el-icon> 批量通过
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="danger" plain :disabled="selectedIds.length === 0" @click="batchReject">
            <el-icon><CloseBold /></el-icon> 批量拒绝
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 审核列表 -->
    <el-card class="list-card">
      <el-table v-loading="loading" :data="reviewList" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="内容类型" prop="contentType" width="100">
          <template #default="{ row }">
            <el-tag :type="contentTypeMap[row.contentType]?.tag || 'info'">
              {{ contentTypeMap[row.contentType]?.label || row.contentType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容预览" min-width="250">
          <template #default="{ row }">
            <div class="content-preview">
              <el-image
                v-if="row.imageUrl"
                :src="row.imageUrl"
                fit="cover"
                class="preview-image"
                :preview-src-list="[row.imageUrl]"
              />
              <div class="preview-text">
                <div class="preview-title">{{ row.title }}</div>
                <div class="preview-desc" v-if="row.content">{{ row.content }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="提交人" prop="submitter" width="120" />
        <el-table-column label="提交时间" prop="submitTime" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.submitTime) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.tag">
              {{ statusMap[row.status]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleView(row)">
              查看
            </el-button>
            <template v-if="row.status === 0">
              <el-button type="success" link @click="handleApprove(row)">
                通过
              </el-button>
              <el-button type="danger" link @click="handleReject(row)">
                拒绝
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="queryParams.current"
        v-model:limit="queryParams.size"
        @pagination="getList"
      />
    </el-card>

    <!-- 审核详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="内容审核" width="700px">
      <div class="review-detail" v-if="currentReview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="内容类型">
            <el-tag :type="contentTypeMap[currentReview.contentType]?.tag">
              {{ contentTypeMap[currentReview.contentType]?.label }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交人">{{ currentReview.submitter }}</el-descriptions-item>
          <el-descriptions-item label="提交时间" :span="2">{{ formatDateTime(currentReview.submitTime) }}</el-descriptions-item>
          <el-descriptions-item label="标题" :span="2">{{ currentReview.title }}</el-descriptions-item>
        </el-descriptions>

        <div class="content-area">
          <h4>内容详情</h4>
          <div class="content-box">
            <el-image
              v-if="currentReview.imageUrl"
              :src="currentReview.imageUrl"
              fit="contain"
              style="max-width: 100%; max-height: 300px"
              :preview-src-list="[currentReview.imageUrl]"
            />
            <div class="text-content" v-if="currentReview.content">
              {{ currentReview.content }}
            </div>
          </div>
        </div>

        <!-- AI检测结果 -->
        <div class="ai-result" v-if="currentReview.aiResult">
          <h4>AI检测结果</h4>
          <el-alert
            :type="currentReview.aiResult.risk === 'high' ? 'error' : currentReview.aiResult.risk === 'medium' ? 'warning' : 'success'"
            :closable="false"
          >
            <template #title>
              风险等级: {{ riskLevelMap[currentReview.aiResult.risk] }}
            </template>
            <div class="ai-reasons" v-if="currentReview.aiResult.reasons?.length">
              <div v-for="(reason, idx) in currentReview.aiResult.reasons" :key="idx">
                • {{ reason }}
              </div>
            </div>
          </el-alert>
        </div>

        <!-- 审核操作 -->
        <div class="review-actions" v-if="currentReview.status === 0">
          <el-form :model="reviewForm" label-width="80px">
            <el-form-item label="审核意见">
              <el-input
                v-model="reviewForm.remark"
                type="textarea"
                :rows="3"
                placeholder="请输入审核意见（拒绝时必填）"
              />
            </el-form-item>
          </el-form>
        </div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">取消</el-button>
        <template v-if="currentReview?.status === 0">
          <el-button type="danger" @click="submitReject">拒绝</el-button>
          <el-button type="success" @click="submitApprove">通过</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 拒绝原因对话框 -->
    <el-dialog v-model="rejectDialogVisible" title="拒绝原因" width="500px">
      <el-form :model="rejectForm" label-width="100px">
        <el-form-item label="拒绝原因" required>
          <el-select v-model="rejectForm.reasonType" placeholder="请选择" style="width: 100%">
            <el-option label="包含敏感词" value="sensitive" />
            <el-option label="内容违规" value="violation" />
            <el-option label="虚假信息" value="false_info" />
            <el-option label="侵权内容" value="infringement" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细说明">
          <el-input
            v-model="rejectForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入拒绝的详细说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ReviewQueue">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Select, CloseBold, Document, Picture, ChatDotRound, Shop } from '@element-plus/icons-vue'

// 状态
const loading = ref(false)
const reviewList = ref([])
const total = ref(0)
const selectedIds = ref([])

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  contentType: '',
  status: null,
  dateRange: []
})

// 映射
const contentTypeMap = {
  product: { label: '商品', tag: 'primary' },
  review: { label: '评价', tag: 'success' },
  merchant: { label: '商户', tag: 'warning' },
  banner: { label: 'Banner', tag: 'info' }
}

const statusMap = {
  0: { label: '待审核', tag: 'warning' },
  1: { label: '已通过', tag: 'success' },
  2: { label: '已拒绝', tag: 'danger' }
}

const riskLevelMap = {
  high: '高风险',
  medium: '中风险',
  low: '低风险'
}

// 统计卡片
const statsCards = ref([
  { key: 'pending', label: '待审核', value: 12, type: 'warning', icon: 'Document' },
  { key: 'today', label: '今日已审', value: 45, type: 'primary', icon: 'Select' },
  { key: 'passed', label: '通过率', value: '92%', type: 'success', icon: 'CircleCheck' },
  { key: 'rejected', label: '今日拒绝', value: 3, type: 'danger', icon: 'CircleClose' }
])

// 详情对话框
const detailDialogVisible = ref(false)
const currentReview = ref(null)
const reviewForm = reactive({
  remark: ''
})

// 拒绝对话框
const rejectDialogVisible = ref(false)
const rejectForm = reactive({
  ids: [],
  reasonType: '',
  remark: ''
})

// 获取列表
const getList = async () => {
  loading.value = true
  try {
    // TODO: 调用真实API
    // const res = await getPendingList(queryParams)
    // reviewList.value = res.data?.records || []
    // total.value = res.data?.total || 0

    // 模拟数据
    await new Promise(resolve => setTimeout(resolve, 300))
    reviewList.value = [
      {
        id: 1,
        contentType: 'product',
        title: '有机蔬菜礼盒',
        content: '精选当季有机蔬菜，新鲜直达',
        imageUrl: 'https://via.placeholder.com/100',
        submitter: '商户A',
        submitTime: '2025-12-25T10:30:00',
        status: 0,
        aiResult: { risk: 'low', reasons: [] }
      },
      {
        id: 2,
        contentType: 'review',
        title: '用户评价',
        content: '商品质量很好，物流也快，下次还会购买！',
        imageUrl: '',
        submitter: '用户张三',
        submitTime: '2025-12-25T09:15:00',
        status: 0,
        aiResult: { risk: 'low', reasons: [] }
      },
      {
        id: 3,
        contentType: 'banner',
        title: '新年促销Banner',
        content: '',
        imageUrl: 'https://via.placeholder.com/300x100',
        submitter: '运营小李',
        submitTime: '2025-12-24T16:00:00',
        status: 0,
        aiResult: { risk: 'medium', reasons: ['图片可能包含促销敏感词'] }
      }
    ]
    total.value = 3
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
  queryParams.contentType = ''
  queryParams.status = null
  queryParams.dateRange = []
  handleQuery()
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

// 查看详情
const handleView = (row) => {
  currentReview.value = row
  reviewForm.remark = ''
  detailDialogVisible.value = true
}

// 通过
const handleApprove = (row) => {
  ElMessageBox.confirm('确认通过该内容审核？', '提示', {
    type: 'success'
  }).then(() => {
    // TODO: 调用通过API
    ElMessage.success('审核通过')
    row.status = 1
  }).catch(() => {})
}

// 拒绝
const handleReject = (row) => {
  rejectForm.ids = [row.id]
  rejectForm.reasonType = ''
  rejectForm.remark = ''
  rejectDialogVisible.value = true
}

// 确认拒绝
const confirmReject = () => {
  if (!rejectForm.reasonType) {
    ElMessage.warning('请选择拒绝原因')
    return
  }
  // TODO: 调用拒绝API
  ElMessage.success('已拒绝')
  rejectDialogVisible.value = false
  // 更新列表中的状态
  rejectForm.ids.forEach(id => {
    const item = reviewList.value.find(r => r.id === id)
    if (item) item.status = 2
  })
}

// 详情页通过
const submitApprove = () => {
  // TODO: 调用通过API
  ElMessage.success('审核通过')
  currentReview.value.status = 1
  detailDialogVisible.value = false
}

// 详情页拒绝
const submitReject = () => {
  if (!reviewForm.remark) {
    ElMessage.warning('请输入审核意见')
    return
  }
  // TODO: 调用拒绝API
  ElMessage.success('已拒绝')
  currentReview.value.status = 2
  detailDialogVisible.value = false
}

// 批量通过
const batchApprove = () => {
  ElMessageBox.confirm(`确认通过选中的 ${selectedIds.value.length} 条内容？`, '批量通过', {
    type: 'success'
  }).then(() => {
    // TODO: 调用批量通过API
    ElMessage.success('批量通过成功')
    selectedIds.value.forEach(id => {
      const item = reviewList.value.find(r => r.id === id)
      if (item) item.status = 1
    })
  }).catch(() => {})
}

// 批量拒绝
const batchReject = () => {
  rejectForm.ids = [...selectedIds.value]
  rejectForm.reasonType = ''
  rejectForm.remark = ''
  rejectDialogVisible.value = true
}

// 格式化时间
const formatDateTime = (str) => {
  if (!str) return ''
  return str.replace('T', ' ').substring(0, 16)
}

// 初始化
onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.review-queue {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    padding: 20px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    gap: 16px;

    &.warning {
      border-left: 4px solid #e6a23c;
      .stat-icon { color: #e6a23c; }
    }
    &.primary {
      border-left: 4px solid #409eff;
      .stat-icon { color: #409eff; }
    }
    &.success {
      border-left: 4px solid #67c23a;
      .stat-icon { color: #67c23a; }
    }
    &.danger {
      border-left: 4px solid #f56c6c;
      .stat-icon { color: #f56c6c; }
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #303133;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
    }
  }

  .filter-card {
    margin-bottom: 20px;
  }

  .content-preview {
    display: flex;
    align-items: center;
    gap: 12px;

    .preview-image {
      width: 60px;
      height: 60px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .preview-text {
      flex: 1;
      min-width: 0;

      .preview-title {
        font-weight: 500;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .preview-desc {
        font-size: 12px;
        color: #909399;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }
  }

  .review-detail {
    .content-area {
      margin: 20px 0;

      h4 {
        margin-bottom: 10px;
        color: #303133;
      }

      .content-box {
        padding: 15px;
        background: #f5f7fa;
        border-radius: 8px;

        .text-content {
          margin-top: 10px;
          line-height: 1.6;
        }
      }
    }

    .ai-result {
      margin: 20px 0;

      h4 {
        margin-bottom: 10px;
        color: #303133;
      }

      .ai-reasons {
        margin-top: 10px;
        font-size: 13px;
      }
    }

    .review-actions {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #ebeef5;
    }
  }
}
</style>
