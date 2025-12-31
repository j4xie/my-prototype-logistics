<!--
  商户状态管理页面
  批量管理商户状态：冻结、解冻、注销等
-->
<template>
  <div class="app-container merchant-status-management">
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card pending" shadow="hover" @click="filterByStatus(0)">
          <div class="stats-content">
            <div class="stats-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-value">{{ stats.pending }}</div>
              <div class="stats-label">待审核</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card active" shadow="hover" @click="filterByStatus(1)">
          <div class="stats-content">
            <div class="stats-icon">
              <el-icon><CircleCheck /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-value">{{ stats.active }}</div>
              <div class="stats-label">已认证</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card frozen" shadow="hover" @click="filterByStatus(2)">
          <div class="stats-content">
            <div class="stats-icon">
              <el-icon><Lock /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-value">{{ stats.frozen }}</div>
              <div class="stats-label">已封禁</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card cancelled" shadow="hover" @click="filterByStatus(3)">
          <div class="stats-content">
            <div class="stats-icon">
              <el-icon><CircleClose /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-value">{{ stats.cancelled }}</div>
              <div class="stats-label">已注销</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作区域 -->
    <el-card class="action-card" shadow="never">
      <div class="action-bar">
        <div class="action-left">
          <el-select v-model="filterStatus" placeholder="筛选状态" clearable @change="handleFilter">
            <el-option label="全部" :value="null" />
            <el-option label="待审核" :value="0" />
            <el-option label="已认证" :value="1" />
            <el-option label="已封禁" :value="2" />
            <el-option label="已注销" :value="3" />
          </el-select>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索商户名称/编号"
            clearable
            style="width: 250px"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
        </div>
        <div class="action-right">
          <el-button 
            type="success" 
            :disabled="selectedRows.length === 0"
            @click="batchAction('unfreeze')"
          >
            <el-icon><Unlock /></el-icon> 批量解冻
          </el-button>
          <el-button 
            type="warning" 
            :disabled="selectedRows.length === 0"
            @click="batchAction('freeze')"
          >
            <el-icon><Lock /></el-icon> 批量冻结
          </el-button>
          <el-button 
            type="danger" 
            :disabled="selectedRows.length === 0"
            @click="batchAction('cancel')"
          >
            <el-icon><Delete /></el-icon> 批量注销
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 商户列表 -->
    <el-card class="table-card" shadow="never">
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
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="联系人" prop="contactName" width="120" />
        <el-table-column label="联系电话" prop="contactPhone" width="140" />
        <el-table-column label="当前状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" effect="dark">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="100" align="center">
          <template #default="{ row }">
            <el-rate v-model="row.rating" disabled show-score text-color="#ff9900" />
          </template>
        </el-table-column>
        <el-table-column label="订单数" prop="orderCount" width="100" align="center" />
        <el-table-column label="创建时间" prop="createTime" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 2" 
              type="success" 
              link 
              @click="changeStatus(row, 1)"
            >解冻</el-button>
            <el-button 
              v-if="row.status === 1" 
              type="warning" 
              link 
              @click="changeStatus(row, 2)"
            >冻结</el-button>
            <el-button 
              v-if="row.status !== 3" 
              type="danger" 
              link 
              @click="changeStatus(row, 3)"
            >注销</el-button>
            <el-button type="primary" link @click="viewHistory(row)">
              操作历史
            </el-button>
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

    <!-- 状态变更对话框 -->
    <el-dialog v-model="statusDialogVisible" title="变更商户状态" width="500px">
      <el-form :model="statusForm" label-width="100px">
        <el-form-item label="商户名称">
          <span>{{ statusForm.merchantName }}</span>
        </el-form-item>
        <el-form-item label="当前状态">
          <el-tag :type="getStatusType(statusForm.currentStatus)">
            {{ getStatusLabel(statusForm.currentStatus) }}
          </el-tag>
        </el-form-item>
        <el-form-item label="变更为">
          <el-tag :type="getStatusType(statusForm.newStatus)" effect="dark">
            {{ getStatusLabel(statusForm.newStatus) }}
          </el-tag>
        </el-form-item>
        <el-form-item label="变更原因" required>
          <el-input
            v-model="statusForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入变更原因"
          />
        </el-form-item>
        <el-form-item label="通知商户">
          <el-switch v-model="statusForm.notify" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmStatusChange" :loading="submitting">
          确认变更
        </el-button>
      </template>
    </el-dialog>

    <!-- 操作历史对话框 -->
    <el-dialog v-model="historyDialogVisible" title="操作历史" width="700px">
      <el-timeline>
        <el-timeline-item
          v-for="item in historyList"
          :key="item.id"
          :timestamp="item.createTime"
          :type="getTimelineType(item.action)"
          placement="top"
        >
          <el-card shadow="never">
            <div class="history-item">
              <div class="history-action">
                <el-tag :type="getTimelineType(item.action)" size="small">
                  {{ item.actionLabel }}
                </el-tag>
                <span class="operator">操作人: {{ item.operatorName }}</span>
              </div>
              <div class="history-reason" v-if="item.reason">
                原因: {{ item.reason }}
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="historyList.length === 0" description="暂无操作历史" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { 
  Clock, CircleCheck, Lock, CircleClose, 
  Search, Unlock, Delete 
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 统计数据
const stats = reactive({
  pending: 0,
  active: 0,
  frozen: 0,
  cancelled: 0
})

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  status: null,
  keyword: ''
})

const loading = ref(false)
const total = ref(0)
const merchantList = ref([])
const selectedRows = ref([])
const filterStatus = ref(null)
const searchKeyword = ref('')

// 状态变更
const statusDialogVisible = ref(false)
const submitting = ref(false)
const statusForm = reactive({
  merchantId: null,
  merchantName: '',
  currentStatus: null,
  newStatus: null,
  reason: '',
  notify: true
})

// 操作历史
const historyDialogVisible = ref(false)
const historyList = ref([])

onMounted(() => {
  loadStats()
  loadMerchantList()
})

// 加载统计数据
async function loadStats() {
  // 模拟数据
  stats.pending = 12
  stats.active = 156
  stats.frozen = 8
  stats.cancelled = 3
}

// 加载商户列表
async function loadMerchantList() {
  loading.value = true
  try {
    // 模拟数据
    merchantList.value = [
      { id: 1, merchantName: '优鲜食品', merchantNo: 'M001', logoUrl: '', contactName: '张三', contactPhone: '13800138001', status: 1, rating: 4.5, orderCount: 256, createTime: '2024-01-15 10:30' },
      { id: 2, merchantName: '绿色农场', merchantNo: 'M002', logoUrl: '', contactName: '李四', contactPhone: '13800138002', status: 1, rating: 4.8, orderCount: 189, createTime: '2024-02-20 14:20' },
      { id: 3, merchantName: '海鲜直供', merchantNo: 'M003', logoUrl: '', contactName: '王五', contactPhone: '13800138003', status: 2, rating: 3.9, orderCount: 45, createTime: '2024-03-10 09:15' },
      { id: 4, merchantName: '新鲜果蔬', merchantNo: 'M004', logoUrl: '', contactName: '赵六', contactPhone: '13800138004', status: 0, rating: 0, orderCount: 0, createTime: '2024-12-25 16:45' }
    ]
    total.value = 4
  } catch (error) {
    console.error('加载商户列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取状态类型
function getStatusType(status) {
  const types = { 0: 'warning', 1: 'success', 2: 'danger', 3: 'info' }
  return types[status] || 'info'
}

// 获取状态标签
function getStatusLabel(status) {
  const labels = { 0: '待审核', 1: '已认证', 2: '已封禁', 3: '已注销' }
  return labels[status] || '未知'
}

// 获取时间线类型
function getTimelineType(action) {
  const types = { 'approve': 'success', 'freeze': 'warning', 'unfreeze': 'success', 'cancel': 'danger' }
  return types[action] || 'primary'
}

// 按状态筛选
function filterByStatus(status) {
  filterStatus.value = status
  queryParams.status = status
  loadMerchantList()
}

// 处理筛选
function handleFilter() {
  queryParams.status = filterStatus.value
  loadMerchantList()
}

// 处理搜索
function handleSearch() {
  queryParams.keyword = searchKeyword.value
  loadMerchantList()
}

// 处理选择变化
function handleSelectionChange(rows) {
  selectedRows.value = rows
}

// 分页大小变化
function handleSizeChange(val) {
  queryParams.size = val
  loadMerchantList()
}

// 页码变化
function handleCurrentChange(val) {
  queryParams.current = val
  loadMerchantList()
}

// 变更状态
function changeStatus(row, newStatus) {
  statusForm.merchantId = row.id
  statusForm.merchantName = row.merchantName
  statusForm.currentStatus = row.status
  statusForm.newStatus = newStatus
  statusForm.reason = ''
  statusForm.notify = true
  statusDialogVisible.value = true
}

// 确认状态变更
async function confirmStatusChange() {
  if (!statusForm.reason) {
    ElMessage.warning('请输入变更原因')
    return
  }
  
  submitting.value = true
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 500))
    ElMessage.success('状态变更成功')
    statusDialogVisible.value = false
    loadMerchantList()
    loadStats()
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 批量操作
function batchAction(action) {
  const actionLabels = { freeze: '冻结', unfreeze: '解冻', cancel: '注销' }
  const count = selectedRows.value.length
  
  ElMessageBox.prompt(
    `确定要${actionLabels[action]}选中的 ${count} 个商户吗？请输入操作原因：`,
    '批量操作确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入操作原因',
      inputValidator: (val) => !!val || '请输入操作原因'
    }
  ).then(async ({ value }) => {
    loading.value = true
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      ElMessage.success(`批量${actionLabels[action]}成功`)
      loadMerchantList()
      loadStats()
    } catch (error) {
      ElMessage.error('操作失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

// 查看操作历史
function viewHistory(row) {
  // 模拟历史数据
  historyList.value = [
    { id: 1, action: 'approve', actionLabel: '审核通过', operatorName: '管理员', reason: '资料完整，审核通过', createTime: '2024-01-15 10:35' },
    { id: 2, action: 'freeze', actionLabel: '冻结', operatorName: '管理员', reason: '收到用户投诉，临时冻结处理', createTime: '2024-06-20 14:20' },
    { id: 3, action: 'unfreeze', actionLabel: '解冻', operatorName: '管理员', reason: '问题已解决，恢复正常', createTime: '2024-06-25 09:15' }
  ]
  historyDialogVisible.value = true
}
</script>

<style scoped lang="scss">
.merchant-status-management {
  .stats-row {
    margin-bottom: 20px;
  }
  
  .stats-card {
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-4px);
    }
    
    .stats-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .stats-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      
      .el-icon {
        font-size: 28px;
        color: #fff;
      }
    }
    
    .stats-info {
      .stats-value {
        font-size: 28px;
        font-weight: 600;
        line-height: 1.2;
      }
      .stats-label {
        font-size: 14px;
        color: #909399;
      }
    }
    
    &.pending .stats-icon { background: linear-gradient(135deg, #e6a23c, #f5deb3); }
    &.pending .stats-value { color: #e6a23c; }
    
    &.active .stats-icon { background: linear-gradient(135deg, #67c23a, #b3e19d); }
    &.active .stats-value { color: #67c23a; }
    
    &.frozen .stats-icon { background: linear-gradient(135deg, #f56c6c, #f9b4b4); }
    &.frozen .stats-value { color: #f56c6c; }
    
    &.cancelled .stats-icon { background: linear-gradient(135deg, #909399, #c0c4cc); }
    &.cancelled .stats-value { color: #909399; }
  }
  
  .action-card {
    margin-bottom: 20px;
    
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .action-left,
      .action-right {
        display: flex;
        gap: 12px;
      }
    }
  }
  
  .table-card {
    .merchant-info {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .info-content {
        .merchant-name {
          font-weight: 600;
          color: #303133;
        }
        .merchant-no {
          font-size: 12px;
          color: #909399;
        }
      }
    }
    
    .pagination-container {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
  }
  
  .history-item {
    .history-action {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      
      .operator {
        color: #909399;
        font-size: 13px;
      }
    }
    
    .history-reason {
      color: #606266;
      font-size: 14px;
    }
  }
}
</style>
















