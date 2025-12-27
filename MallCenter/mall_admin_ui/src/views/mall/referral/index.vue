<!--
  推荐管理首页
-->
<template>
  <div class="app-container referral-management">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card total" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="28"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总推荐数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card pending" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="28"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pending }}</div>
              <div class="stat-label">待确认</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card confirmed" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="28"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.confirmed }}</div>
              <div class="stat-label">已确认</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card rewarded" shadow="hover">
          <div class="stat-content">
            <div class="stat-icon">
              <el-icon size="28"><Present /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.rewarded }}</div>
              <div class="stat-label">已奖励</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索和操作区 -->
    <el-card class="filter-card">
      <el-form :inline="true" :model="queryParams">
        <el-form-item label="推荐人">
          <el-input v-model="queryParams.referrerName" placeholder="推荐人名称" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="待确认" :value="0" />
            <el-option label="已确认" :value="1" />
            <el-option label="已奖励" :value="2" />
            <el-option label="已失效" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="推荐类型">
          <el-select v-model="queryParams.referralType" placeholder="全部" clearable style="width: 140px">
            <el-option label="新用户注册" :value="1" />
            <el-option label="首单购买" :value="2" />
            <el-option label="累计消费" :value="3" />
          </el-select>
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
          <el-button type="success" plain @click="handleProcessPending">
            <el-icon><Promotion /></el-icon> 批量发放奖励
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="primary" plain @click="goToConfig">
            <el-icon><Setting /></el-icon> 奖励配置
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 推荐记录列表 -->
    <el-card class="list-card">
      <el-table v-loading="loading" :data="referralList">
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="推荐码" prop="referralCode" width="120" />
        <el-table-column label="推荐人" min-width="150">
          <template #default="{ row }">
            <div class="user-info">
              <span class="user-name">{{ row.referrerName || '-' }}</span>
              <span class="user-id text-gray">ID: {{ row.referrerId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="被推荐人" min-width="150">
          <template #default="{ row }">
            <div class="user-info">
              <span class="user-name">{{ row.refereeName || '-' }}</span>
              <span class="user-phone text-gray">{{ row.refereePhone || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="推荐类型" prop="referralType" width="120">
          <template #default="{ row }">
            <el-tag :type="referralTypeMap[row.referralType]?.tag || 'info'">
              {{ referralTypeMap[row.referralType]?.label || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" prop="orderAmount" width="100">
          <template #default="{ row }">
            {{ row.orderAmount ? '¥' + row.orderAmount : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="奖励金额" prop="rewardAmount" width="100">
          <template #default="{ row }">
            <span class="reward-amount" v-if="row.rewardAmount">¥{{ row.rewardAmount }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.tag || 'info'">
              {{ statusMap[row.status]?.label || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="160" />
        <el-table-column label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <el-button v-if="row.status === 0" type="primary" link @click="handleConfirm(row)">
              确认
            </el-button>
            <el-button v-if="row.status === 1" type="success" link @click="handleReward(row)">
              发放奖励
            </el-button>
            <el-button type="info" link @click="handleDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="queryParams.current"
        v-model:limit="queryParams.size"
        @pagination="getList"
      />
    </el-card>

    <!-- 发放奖励对话框 -->
    <el-dialog v-model="rewardDialogVisible" title="发放奖励" width="400px">
      <el-form :model="rewardForm" label-width="100px">
        <el-form-item label="推荐人">
          {{ currentRow?.referrerName }}
        </el-form-item>
        <el-form-item label="被推荐人">
          {{ currentRow?.refereeName }}
        </el-form-item>
        <el-form-item label="奖励金额" required>
          <el-input-number v-model="rewardForm.amount" :min="0" :precision="2" style="width: 200px" />
        </el-form-item>
        <el-form-item label="奖励类型" required>
          <el-select v-model="rewardForm.type" style="width: 200px">
            <el-option label="现金" :value="1" />
            <el-option label="积分" :value="2" />
            <el-option label="优惠券" :value="3" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rewardDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReward">确定发放</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ReferralIndex">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Clock, CircleCheck, Present, Search, Refresh, Promotion, Setting } from '@element-plus/icons-vue'
import { getPage, confirmReferral, grantReward, processPending } from '@/api/mall/referral'

const loading = ref(false)
const referralList = ref([])
const total = ref(0)

const queryParams = reactive({
  current: 1,
  size: 10,
  referrerName: '',
  status: null,
  referralType: null
})

const stats = reactive({
  total: 0,
  pending: 0,
  confirmed: 0,
  rewarded: 0
})

const referralTypeMap = {
  1: { label: '新用户注册', tag: 'primary' },
  2: { label: '首单购买', tag: 'success' },
  3: { label: '累计消费', tag: 'warning' }
}

const statusMap = {
  0: { label: '待确认', tag: 'info' },
  1: { label: '已确认', tag: 'warning' },
  2: { label: '已奖励', tag: 'success' },
  3: { label: '已失效', tag: 'danger' }
}

const rewardDialogVisible = ref(false)
const currentRow = ref(null)
const rewardForm = reactive({
  amount: 0,
  type: 1
})

const getList = async () => {
  loading.value = true
  try {
    const res = await getPage(queryParams)
    referralList.value = res.data?.records || res.records || []
    total.value = res.data?.total || res.total || 0
    
    // 更新统计
    stats.total = total.value
    stats.pending = referralList.value.filter(r => r.status === 0).length
    stats.confirmed = referralList.value.filter(r => r.status === 1).length
    stats.rewarded = referralList.value.filter(r => r.status === 2).length
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryParams.current = 1
  getList()
}

const resetQuery = () => {
  queryParams.referrerName = ''
  queryParams.status = null
  queryParams.referralType = null
  handleQuery()
}

const handleConfirm = async (row) => {
  await ElMessageBox.confirm('确认该推荐记录有效吗？', '提示', { type: 'warning' })
  await confirmReferral(row.id)
  ElMessage.success('确认成功')
  getList()
}

const handleReward = (row) => {
  currentRow.value = row
  rewardForm.amount = 10 // 默认金额
  rewardForm.type = 1
  rewardDialogVisible.value = true
}

const submitReward = async () => {
  if (!rewardForm.amount) {
    ElMessage.warning('请输入奖励金额')
    return
  }
  await grantReward(currentRow.value.id, rewardForm.amount, rewardForm.type)
  ElMessage.success('奖励发放成功')
  rewardDialogVisible.value = false
  getList()
}

const handleDetail = (row) => {
  ElMessage.info('查看详情: ' + row.id)
}

const handleProcessPending = async () => {
  await ElMessageBox.confirm('确认批量处理所有待发放奖励吗？', '提示', { type: 'warning' })
  const res = await processPending()
  ElMessage.success(`成功处理 ${res.data || 0} 条记录`)
  getList()
}

const goToConfig = () => {
  // 跳转到奖励配置页面
  ElMessage.info('奖励配置页面开发中')
}

onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.referral-management {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      padding: 10px 0;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      color: #fff;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #303133;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-top: 4px;
    }

    &.total .stat-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    &.pending .stat-icon { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    &.confirmed .stat-icon { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    &.rewarded .stat-icon { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
  }

  .filter-card {
    margin-bottom: 20px;
  }

  .list-card {
    .user-info {
      display: flex;
      flex-direction: column;
      
      .user-name {
        font-weight: 500;
      }
      
      .user-id, .user-phone {
        font-size: 12px;
      }
    }

    .reward-amount {
      color: #f56c6c;
      font-weight: 600;
    }

    .text-gray {
      color: #909399;
    }
  }
}
</style>







