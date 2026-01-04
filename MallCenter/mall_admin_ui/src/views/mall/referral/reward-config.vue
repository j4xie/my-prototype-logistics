<!--
  推荐奖励配置页面
-->
<template>
  <div class="app-container reward-config">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>奖励规则配置</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon> 新增规则
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="configList">
        <el-table-column label="ID" prop="id" width="80" />
        <el-table-column label="配置名称" prop="configName" min-width="150" />
        <el-table-column label="推荐类型" prop="referralType" width="120">
          <template #default="{ row }">
            <el-tag :type="referralTypeMap[row.referralType]?.tag || 'info'">
              {{ referralTypeMap[row.referralType]?.label || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="奖励类型" prop="rewardType" width="100">
          <template #default="{ row }">
            {{ rewardTypeMap[row.rewardType] || '未知' }}
          </template>
        </el-table-column>
        <el-table-column label="推荐人奖励" prop="referrerReward" width="120">
          <template #default="{ row }">
            <span class="reward-value">{{ row.referrerReward || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="被推荐人奖励" prop="refereeReward" width="120">
          <template #default="{ row }">
            <span class="reward-value">{{ row.refereeReward || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最低订单金额" prop="minOrderAmount" width="120">
          <template #default="{ row }">
            {{ row.minOrderAmount ? '¥' + row.minOrderAmount : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" prop="status" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="优先级" prop="priority" width="80" />
        <el-table-column label="有效期" min-width="200">
          <template #default="{ row }">
            <div v-if="row.startTime || row.endTime">
              {{ row.startTime || '不限' }} ~ {{ row.endTime || '不限' }}
            </div>
            <span v-else>永久有效</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="150">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="配置名称" prop="configName">
          <el-input v-model="form.configName" placeholder="请输入配置名称" />
        </el-form-item>
        <el-form-item label="推荐类型" prop="referralType">
          <el-select v-model="form.referralType" style="width: 100%">
            <el-option label="新用户注册" :value="1" />
            <el-option label="首单购买" :value="2" />
            <el-option label="累计消费" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="奖励类型" prop="rewardType">
          <el-select v-model="form.rewardType" style="width: 100%">
            <el-option label="现金" :value="1" />
            <el-option label="积分" :value="2" />
            <el-option label="优惠券" :value="3" />
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="推荐人奖励" prop="referrerReward">
              <el-input-number v-model="form.referrerReward" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="被推荐人奖励" prop="refereeReward">
              <el-input-number v-model="form.refereeReward" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="最低订单金额">
          <el-input-number v-model="form.minOrderAmount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="奖励比例(%)">
          <el-input-number v-model="form.rewardRate" :min="0" :max="100" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最高奖励限制">
          <el-input-number v-model="form.maxReward" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="状态">
              <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-input-number v-model="form.priority" :min="0" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="RewardConfig">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getActiveConfigs } from '@/api/mall/referral'

const loading = ref(false)
const configList = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增配置')
const formRef = ref()

const referralTypeMap = {
  1: { label: '新用户注册', tag: 'primary' },
  2: { label: '首单购买', tag: 'success' },
  3: { label: '累计消费', tag: 'warning' }
}

const rewardTypeMap = {
  1: '现金',
  2: '积分',
  3: '优惠券'
}

const form = reactive({
  id: null,
  configName: '',
  referralType: 1,
  rewardType: 1,
  referrerReward: 0,
  refereeReward: 0,
  minOrderAmount: 0,
  rewardRate: 0,
  maxReward: 0,
  dateRange: [],
  status: 1,
  priority: 0,
  remark: ''
})

const rules = {
  configName: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  referralType: [{ required: true, message: '请选择推荐类型', trigger: 'change' }],
  rewardType: [{ required: true, message: '请选择奖励类型', trigger: 'change' }]
}

const getList = async () => {
  loading.value = true
  try {
    const res = await getActiveConfigs()
    configList.value = res.data || res || []
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  dialogTitle.value = '新增配置'
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑配置'
  Object.assign(form, row)
  if (row.startTime && row.endTime) {
    form.dateRange = [row.startTime, row.endTime]
  }
  dialogVisible.value = true
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确认删除该配置吗？', '提示', { type: 'warning' })
  ElMessage.success('删除成功')
  getList()
}

const resetForm = () => {
  form.id = null
  form.configName = ''
  form.referralType = 1
  form.rewardType = 1
  form.referrerReward = 0
  form.refereeReward = 0
  form.minOrderAmount = 0
  form.rewardRate = 0
  form.maxReward = 0
  form.dateRange = []
  form.status = 1
  form.priority = 0
  form.remark = ''
}

const submitForm = async () => {
  await formRef.value?.validate()
  ElMessage.success('保存成功')
  dialogVisible.value = false
  getList()
}

onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.reward-config {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .reward-value {
    color: #f56c6c;
    font-weight: 600;
  }
}
</style>




























