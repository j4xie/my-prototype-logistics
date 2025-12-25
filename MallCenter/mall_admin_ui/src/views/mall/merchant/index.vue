<!--
  商户管理列表页
-->
<template>
  <div class="app-container merchant-list">
    <!-- 搜索区域 -->
    <el-card class="search-card" shadow="never">
      <el-form :inline="true" :model="queryParams" ref="queryRef">
        <el-form-item label="商户名称" prop="merchantName">
          <el-input
            v-model="queryParams.merchantName"
            placeholder="请输入商户名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="商户编号" prop="merchantNo">
          <el-input
            v-model="queryParams.merchantNo"
            placeholder="请输入商户编号"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="请选择状态" clearable style="width: 150px">
            <el-option label="待审核" :value="0" />
            <el-option label="已认证" :value="1" />
            <el-option label="已封禁" :value="2" />
            <el-option label="已注销" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input
            v-model="queryParams.contactPhone"
            placeholder="请输入联系电话"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作按钮区域 -->
    <el-card class="table-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>商户列表</span>
          <div class="header-actions">
            <el-badge :value="pendingCount" :hidden="pendingCount === 0" class="badge-item">
              <el-button type="warning" @click="showPendingOnly">
                待审核
              </el-button>
            </el-badge>
            <el-button type="primary" icon="Refresh" @click="getList">刷新</el-button>
          </div>
        </div>
      </template>

      <!-- 数据表格 -->
      <el-table
        v-loading="loading"
        :data="merchantList"
        border
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="商户信息" min-width="250">
          <template #default="{ row }">
            <div class="merchant-info">
              <el-avatar :size="50" :src="row.logoUrl" icon="Shop" />
              <div class="info-content">
                <div class="merchant-name">{{ row.merchantName }}</div>
                <div class="merchant-no">编号: {{ row.merchantNo || '-' }}</div>
                <div class="short-name" v-if="row.shortName">简称: {{ row.shortName }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="法人信息" min-width="150">
          <template #default="{ row }">
            <div>{{ row.legalPerson || '-' }}</div>
            <div class="sub-text">{{ row.licenseNo || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="联系方式" min-width="150">
          <template #default="{ row }">
            <div>{{ row.contactName || '-' }}</div>
            <div class="sub-text">{{ row.contactPhone || '-' }}</div>
            <div class="sub-text" v-if="row.contactEmail">{{ row.contactEmail }}</div>
          </template>
        </el-table-column>
        <el-table-column label="经营数据" min-width="120" align="center">
          <template #default="{ row }">
            <div>商品: {{ row.productCount || 0 }}</div>
            <div>订单: {{ row.orderCount || 0 }}</div>
            <div class="sales-amount">¥{{ formatMoney(row.totalSales) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="100" align="center">
          <template #default="{ row }">
            <div class="rating-info">
              <span class="rating-value">{{ row.rating || '-' }}</span>
              <el-rate
                v-if="row.rating"
                v-model="row.rating"
                disabled
                :max="5"
                size="small"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160" align="center">
          <template #default="{ row }">
            {{ formatTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              text
              @click="handleDetail(row)"
            >
              详情
            </el-button>
            <el-button
              v-if="row.status === 0"
              type="warning"
              size="small"
              text
              @click="handleReview(row)"
            >
              审核
            </el-button>
            <el-dropdown @command="(cmd) => handleCommand(cmd, row)">
              <el-button type="info" size="small" text>
                更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.status === 1"
                    command="freeze"
                    divided
                  >
                    封禁
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.status === 2"
                    command="unfreeze"
                  >
                    解封
                  </el-dropdown-item>
                  <el-dropdown-item command="history">审核历史</el-dropdown-item>
                  <el-dropdown-item command="delete" divided style="color: #f56c6c">
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="queryParams.current"
          v-model:page-size="queryParams.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 审核对话框 -->
    <el-dialog
      v-model="reviewDialogVisible"
      title="商户审核"
      width="500px"
      :close-on-click-modal="false"
    >
      <div v-if="currentMerchant" class="review-content">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="商户名称">
            {{ currentMerchant.merchantName }}
          </el-descriptions-item>
          <el-descriptions-item label="法人姓名">
            {{ currentMerchant.legalPerson }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ currentMerchant.contactPhone }}
          </el-descriptions-item>
        </el-descriptions>

        <el-form :model="reviewForm" label-width="80px" style="margin-top: 20px">
          <el-form-item label="审核结果">
            <el-radio-group v-model="reviewForm.action">
              <el-radio :label="1">通过</el-radio>
              <el-radio :label="2">拒绝</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="审核备注">
            <el-input
              v-model="reviewForm.remark"
              type="textarea"
              :rows="3"
              placeholder="请输入审核备注（拒绝时必填）"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewLoading" @click="submitReview">
          确认
        </el-button>
      </template>
    </el-dialog>

    <!-- 审核历史对话框 -->
    <el-dialog
      v-model="historyDialogVisible"
      title="审核历史"
      width="600px"
    >
      <el-timeline v-if="reviewHistoryList.length > 0">
        <el-timeline-item
          v-for="(item, index) in reviewHistoryList"
          :key="index"
          :timestamp="formatTime(item.createTime)"
          :type="item.action === 1 ? 'success' : 'danger'"
        >
          <div>
            <strong>{{ item.action === 1 ? '审核通过' : '审核拒绝' }}</strong>
            <span style="margin-left: 10px; color: #909399">
              审核人: {{ item.reviewerName }}
            </span>
          </div>
          <div v-if="item.remark" style="color: #606266; margin-top: 5px">
            备注: {{ item.remark }}
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无审核记录" />
    </el-dialog>
  </div>
</template>

<script setup name="MerchantList">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import {
  getPage,
  getObj,
  delObj,
  reviewMerchant,
  updateStatus,
  getReviewHistory,
  getPendingCount
} from '@/api/mall/merchant'

const router = useRouter()

// 加载状态
const loading = ref(false)
const reviewLoading = ref(false)

// 列表数据
const merchantList = ref([])
const total = ref(0)
const pendingCount = ref(0)
const selectedRows = ref([])

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  merchantName: '',
  merchantNo: '',
  status: null,
  contactPhone: ''
})

// 当前操作的商户
const currentMerchant = ref(null)

// 审核对话框
const reviewDialogVisible = ref(false)
const reviewForm = reactive({
  action: 1,
  remark: ''
})

// 审核历史对话框
const historyDialogVisible = ref(false)
const reviewHistoryList = ref([])

// 状态映射
const statusMap = {
  0: { label: '待审核', type: 'warning' },
  1: { label: '已认证', type: 'success' },
  2: { label: '已封禁', type: 'danger' },
  3: { label: '已注销', type: 'info' }
}

const getStatusLabel = (status) => statusMap[status]?.label || '未知'
const getStatusType = (status) => statusMap[status]?.type || 'info'

// 格式化金额
const formatMoney = (value) => {
  if (!value) return '0.00'
  return Number(value).toFixed(2)
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

// 获取商户列表
const getList = async () => {
  loading.value = true
  try {
    const res = await getPage(queryParams)
    merchantList.value = res.data?.records || res.rows || []
    total.value = res.data?.total || res.total || 0
  } catch (error) {
    console.error('获取商户列表失败:', error)
    ElMessage.error('获取商户列表失败')
  } finally {
    loading.value = false
  }
}

// 获取待审核数量
const loadPendingCount = async () => {
  try {
    const res = await getPendingCount()
    pendingCount.value = res.data || 0
  } catch (error) {
    console.error('获取待审核数量失败:', error)
  }
}

// 搜索
const handleQuery = () => {
  queryParams.current = 1
  getList()
}

// 重置
const resetQuery = () => {
  queryParams.merchantName = ''
  queryParams.merchantNo = ''
  queryParams.status = null
  queryParams.contactPhone = ''
  queryParams.current = 1
  getList()
}

// 只显示待审核
const showPendingOnly = () => {
  queryParams.status = 0
  queryParams.current = 1
  getList()
}

// 分页
const handleSizeChange = (val) => {
  queryParams.size = val
  getList()
}

const handleCurrentChange = (val) => {
  queryParams.current = val
  getList()
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedRows.value = selection
}

// 查看详情
const handleDetail = (row) => {
  router.push(`/mall/merchant-detail/${row.id}`)
}

// 审核
const handleReview = (row) => {
  currentMerchant.value = row
  reviewForm.action = 1
  reviewForm.remark = ''
  reviewDialogVisible.value = true
}

// 提交审核
const submitReview = async () => {
  if (reviewForm.action === 2 && !reviewForm.remark) {
    ElMessage.warning('拒绝时请填写审核备注')
    return
  }

  reviewLoading.value = true
  try {
    await reviewMerchant(currentMerchant.value.id, reviewForm.action, reviewForm.remark)
    ElMessage.success('审核成功')
    reviewDialogVisible.value = false
    getList()
    loadPendingCount()
  } catch (error) {
    console.error('审核失败:', error)
    ElMessage.error('审核失败')
  } finally {
    reviewLoading.value = false
  }
}

// 更多操作
const handleCommand = async (command, row) => {
  switch (command) {
    case 'edit':
      router.push(`/mall/merchant-edit/${row.id}`)
      break
    case 'freeze':
      ElMessageBox.confirm('确定要封禁该商户吗？', '提示', {
        type: 'warning'
      }).then(async () => {
        await updateStatus(row.id, 2)
        ElMessage.success('已封禁')
        getList()
      }).catch(() => {})
      break
    case 'unfreeze':
      ElMessageBox.confirm('确定要解封该商户吗？', '提示', {
        type: 'warning'
      }).then(async () => {
        await updateStatus(row.id, 1)
        ElMessage.success('已解封')
        getList()
      }).catch(() => {})
      break
    case 'history':
      loadReviewHistory(row.id)
      break
    case 'delete':
      ElMessageBox.confirm('确定要删除该商户吗？此操作不可恢复！', '警告', {
        type: 'error'
      }).then(async () => {
        await delObj(row.id)
        ElMessage.success('删除成功')
        getList()
        loadPendingCount()
      }).catch(() => {})
      break
  }
}

// 加载审核历史
const loadReviewHistory = async (id) => {
  try {
    const res = await getReviewHistory(id)
    reviewHistoryList.value = res.data || []
    historyDialogVisible.value = true
  } catch (error) {
    console.error('获取审核历史失败:', error)
    ElMessage.error('获取审核历史失败')
  }
}

// 初始化
onMounted(() => {
  getList()
  loadPendingCount()
})
</script>

<style lang="scss" scoped>
.merchant-list {
  .search-card {
    margin-bottom: 15px;
  }

  .table-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-actions {
        display: flex;
        gap: 10px;
        align-items: center;

        .badge-item {
          margin-right: 10px;
        }
      }
    }
  }

  .merchant-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .info-content {
      .merchant-name {
        font-weight: 600;
        font-size: 14px;
        color: #303133;
      }
      .merchant-no, .short-name {
        font-size: 12px;
        color: #909399;
        margin-top: 2px;
      }
    }
  }

  .sub-text {
    font-size: 12px;
    color: #909399;
  }

  .sales-amount {
    color: #f56c6c;
    font-weight: 600;
    margin-top: 4px;
  }

  .rating-info {
    .rating-value {
      font-size: 18px;
      font-weight: 600;
      color: #e6a23c;
    }
  }

  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }

  .review-content {
    padding: 10px 0;
  }
}
</style>
