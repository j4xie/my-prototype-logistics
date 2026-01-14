<!--
  订单详情页
-->
<template>
  <div class="app-container order-detail">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">订单详情</span>
          <el-tag :type="getStatusType(order.status)" style="margin-left: 12px" size="large">
            {{ order.statusDesc || getStatusLabel(order.status) }}
          </el-tag>
        </template>
      </el-page-header>
    </div>

    <div v-loading="loading">
      <!-- 订单状态流程 -->
      <el-card class="info-card">
        <template #header>
          <span>订单状态</span>
        </template>
        <el-steps :active="getStepActive(order.status)" finish-status="success">
          <el-step title="提交订单" :description="formatTime(order.createTime)" />
          <el-step title="付款成功" :description="formatTime(order.paymentTime)" />
          <el-step title="商家发货" :description="formatTime(order.deliveryTime)" />
          <el-step title="确认收货" :description="formatTime(order.receiverTime)" />
          <el-step title="交易完成" :description="formatTime(order.closingTime)" />
        </el-steps>
      </el-card>

      <!-- 订单基本信息 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>订单信息</span>
            <div class="header-actions">
              <!-- 发货按钮 -->
              <el-button
                v-if="order.status === 1"
                type="primary"
                @click="showDeliveryDialog"
              >
                发货
              </el-button>
              <!-- 取消订单 -->
              <el-button
                v-if="order.status === 0 && order.isPay === '0'"
                type="danger"
                @click="handleCancel"
              >
                取消订单
              </el-button>
            </div>
          </div>
        </template>

        <el-descriptions :column="3" border>
          <el-descriptions-item label="订单编号">
            {{ order.orderNo }}
            <el-button link type="primary" @click="copyOrderNo" style="margin-left: 8px">
              复制
            </el-button>
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ formatTime(order.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="支付状态">
            <el-tag :type="order.isPay === '1' ? 'success' : 'danger'" size="small">
              {{ order.isPay === '1' ? '已支付' : '未支付' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">
            {{ getPaymentTypeLabel(order.paymentType) }}
          </el-descriptions-item>
          <el-descriptions-item label="支付时间">
            {{ formatTime(order.paymentTime) || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="支付流水号">
            {{ order.transactionId || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="买家留言" :span="3">
            {{ order.userMessage || '无' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 商品信息 -->
      <el-card class="info-card">
        <template #header>
          <span>商品信息</span>
        </template>
        <el-table :data="order.listOrderItem" border>
          <el-table-column label="商品图片" width="100" align="center">
            <template #default="{ row }">
              <el-image :src="row.picUrl" style="width: 60px; height: 60px" fit="cover" />
            </template>
          </el-table-column>
          <el-table-column label="商品名称" prop="spuName" />
          <el-table-column label="规格" prop="specInfo" width="150">
            <template #default="{ row }">
              {{ row.specInfo || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="单价" width="100" align="right">
            <template #default="{ row }">
              ¥{{ row.salesPrice }}
            </template>
          </el-table-column>
          <el-table-column label="数量" prop="quantity" width="80" align="center" />
          <el-table-column label="小计" width="100" align="right">
            <template #default="{ row }">
              ¥{{ (row.salesPrice * row.quantity).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="退款状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === '1'" type="warning">申请退款</el-tag>
              <el-tag v-else-if="row.status === '2'" type="danger">拒绝退款</el-tag>
              <el-tag v-else-if="row.status === '3'" type="success">已同意</el-tag>
              <el-tag v-else-if="row.isRefund === '1'" type="info">已退款</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button
                v-if="row.status === '1' && order.isPay === '1'"
                type="primary"
                link
                @click="handleRefund(row)"
              >
                处理退款
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 金额汇总 -->
        <div class="price-summary">
          <div class="price-item">
            <span>商品金额：</span>
            <span>¥{{ order.salesPrice }}</span>
          </div>
          <div class="price-item">
            <span>运费：</span>
            <span>+ ¥{{ order.freightPrice }}</span>
          </div>
          <div class="price-item total">
            <span>实付金额：</span>
            <span class="amount">¥{{ order.paymentPrice }}</span>
          </div>
        </div>
      </el-card>

      <!-- 收货信息 -->
      <el-card class="info-card">
        <template #header>
          <span>收货信息</span>
        </template>
        <el-descriptions :column="2" border v-if="order.orderLogistics">
          <el-descriptions-item label="收货人">
            {{ order.orderLogistics.userName }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ order.orderLogistics.telNum }}
          </el-descriptions-item>
          <el-descriptions-item label="收货地址" :span="2">
            {{ order.orderLogistics.address }}
          </el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="暂无收货信息" />
      </el-card>

      <!-- 物流信息 -->
      <el-card class="info-card" v-if="order.orderLogistics?.logisticsNo">
        <template #header>
          <span>物流信息</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="快递公司">
            {{ order.orderLogistics.logisticsDesc }}
          </el-descriptions-item>
          <el-descriptions-item label="快递单号">
            {{ order.orderLogistics.logisticsNo }}
            <el-button link type="primary" @click="copyLogisticsNo" style="margin-left: 8px">
              复制
            </el-button>
          </el-descriptions-item>
          <el-descriptions-item label="物流状态">
            {{ order.orderLogistics.statusDesc || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 买家信息 -->
      <el-card class="info-card" v-if="order.userInfo">
        <template #header>
          <span>买家信息</span>
        </template>
        <div class="user-info">
          <el-avatar :size="60" :src="order.userInfo.headimgUrl" icon="User" />
          <div class="user-content">
            <div class="user-name">{{ order.userInfo.nickName }}</div>
            <div class="user-id">用户ID: {{ order.userInfo.id }}</div>
            <div class="user-sex">
              性别: {{ order.userInfo.sex === '1' ? '男' : order.userInfo.sex === '2' ? '女' : '未知' }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 发货对话框 -->
    <el-dialog v-model="deliveryDialogVisible" title="订单发货" width="500px">
      <el-form :model="deliveryForm" :rules="deliveryRules" ref="deliveryFormRef" label-width="100px">
        <el-form-item label="收货人">
          <el-input :value="order.orderLogistics?.userName" disabled />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input :value="order.orderLogistics?.telNum" disabled />
        </el-form-item>
        <el-form-item label="收货地址">
          <el-input :value="order.orderLogistics?.address" disabled type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="快递公司" prop="logistics">
          <el-select v-model="deliveryForm.logistics" placeholder="请选择快递公司" style="width: 100%">
            <el-option label="顺丰速运" value="SF" />
            <el-option label="圆通快递" value="YTO" />
            <el-option label="中通快递" value="ZTO" />
            <el-option label="韵达快递" value="YD" />
            <el-option label="申通快递" value="STO" />
            <el-option label="邮政EMS" value="EMS" />
            <el-option label="京东物流" value="JD" />
          </el-select>
        </el-form-item>
        <el-form-item label="快递单号" prop="logisticsNo">
          <el-input v-model="deliveryForm.logisticsNo" placeholder="请输入快递单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliveryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDelivery" :loading="submitting">确认发货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="OrderDetail">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getObj, putObj, orderCancel, doOrderRefunds } from '@/api/mall/orderinfo'

const router = useRouter()
const route = useRoute()

// 订单ID
const orderId = ref(null)

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 订单数据
const order = ref({
  listOrderItem: [],
  orderLogistics: null,
  userInfo: null
})

// 发货对话框
const deliveryDialogVisible = ref(false)
const deliveryFormRef = ref(null)
const deliveryForm = reactive({
  logistics: '',
  logisticsNo: ''
})

const deliveryRules = {
  logistics: [{ required: true, message: '请选择快递公司', trigger: 'change' }],
  logisticsNo: [{ required: true, message: '请输入快递单号', trigger: 'blur' }]
}

// 状态映射
const statusMap = {
  0: { label: '待付款', type: 'warning' },
  1: { label: '待发货', type: 'info' },
  2: { label: '待收货', type: '' },
  3: { label: '已完成', type: 'success' },
  4: { label: '已完成', type: 'success' },
  5: { label: '已取消', type: 'info' }
}

const getStatusLabel = (status) => statusMap[status]?.label || '未知'
const getStatusType = (status) => statusMap[status]?.type || 'info'

const getStepActive = (status) => {
  const map = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 0 }
  return map[status] ?? 0
}

const getPaymentTypeLabel = (type) => {
  const map = {
    'WXPAY': '微信支付',
    'ALIPAY': '支付宝',
    'BALANCE': '余额支付'
  }
  return map[type] || type || '-'
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return ''
  return time.replace('T', ' ').substring(0, 19)
}

// 加载订单详情
const loadOrder = async () => {
  if (!orderId.value) return

  loading.value = true
  try {
    const res = await getObj(orderId.value)
    order.value = res.data || res || {}
  } catch (error) {
    console.error('获取订单详情失败:', error)
    ElMessage.error('获取订单详情失败')
  } finally {
    loading.value = false
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/orderinfo')
}

// 复制订单号
const copyOrderNo = () => {
  navigator.clipboard.writeText(order.value.orderNo)
  ElMessage.success('订单号已复制')
}

// 复制快递单号
const copyLogisticsNo = () => {
  navigator.clipboard.writeText(order.value.orderLogistics?.logisticsNo)
  ElMessage.success('快递单号已复制')
}

// 显示发货对话框
const showDeliveryDialog = () => {
  deliveryForm.logistics = ''
  deliveryForm.logisticsNo = ''
  deliveryDialogVisible.value = true
}

// 提交发货
const submitDelivery = async () => {
  try {
    await deliveryFormRef.value.validate()
  } catch (error) {
    return
  }

  submitting.value = true
  try {
    await putObj({
      ...order.value,
      status: 2,
      logistics: deliveryForm.logistics,
      logisticsNo: deliveryForm.logisticsNo
    })
    ElMessage.success('发货成功')
    deliveryDialogVisible.value = false
    loadOrder()
  } catch (error) {
    console.error('发货失败:', error)
    ElMessage.error('发货失败')
  } finally {
    submitting.value = false
  }
}

// 取消订单
const handleCancel = async () => {
  try {
    await ElMessageBox.confirm('确定要取消此订单吗？', '提示', {
      type: 'warning'
    })
    await orderCancel(orderId.value)
    ElMessage.success('订单已取消')
    loadOrder()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消订单失败:', error)
      ElMessage.error('取消订单失败')
    }
  }
}

// 处理退款
const handleRefund = async (item) => {
  try {
    const action = await ElMessageBox.confirm('请选择退款处理方式', '退款审核', {
      distinguishCancelAndClose: true,
      confirmButtonText: '同意退款',
      cancelButtonText: '拒绝退款',
      type: 'warning'
    })

    const status = action === 'confirm' ? '3' : '2'
    await doOrderRefunds({ id: item.id, status })
    ElMessage.success('处理成功')
    loadOrder()
  } catch (error) {
    if (error === 'cancel') {
      // 点击了拒绝按钮
      try {
        await doOrderRefunds({ id: item.id, status: '2' })
        ElMessage.success('已拒绝退款')
        loadOrder()
      } catch (e) {
        ElMessage.error('操作失败')
      }
    }
  }
}

// 初始化
onMounted(() => {
  orderId.value = route.params.id || route.query.id

  if (!orderId.value) {
    ElMessage.error('缺少订单ID参数')
    goBack()
    return
  }

  loadOrder()
})
</script>

<style lang="scss" scoped>
.order-detail {
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

  .price-summary {
    margin-top: 20px;
    text-align: right;
    padding: 20px;
    background: #f5f7fa;
    border-radius: 4px;

    .price-item {
      margin-bottom: 8px;
      font-size: 14px;

      &.total {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px dashed #dcdfe6;
        font-size: 16px;
        font-weight: 600;

        .amount {
          color: #f56c6c;
          font-size: 20px;
        }
      }
    }
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 16px;

    .user-content {
      .user-name {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .user-id, .user-sex {
        font-size: 13px;
        color: #909399;
      }
    }
  }
}
</style>
