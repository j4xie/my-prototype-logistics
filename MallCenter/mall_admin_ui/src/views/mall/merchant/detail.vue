<!--
  商户详情页
-->
<template>
  <div class="app-container merchant-detail">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">商户详情</span>
        </template>
      </el-page-header>
    </div>

    <div v-loading="loading">
      <!-- 商户基本信息 -->
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
            <div class="header-actions">
              <el-tag :type="getStatusType(merchant.status)" size="large">
                {{ getStatusLabel(merchant.status) }}
              </el-tag>
              <el-button
                v-if="merchant.status === 0"
                type="warning"
                @click="handleReview"
              >
                审核
              </el-button>
              <el-button type="primary" @click="handleEdit">编辑</el-button>
            </div>
          </div>
        </template>

        <div class="merchant-profile">
          <el-avatar :size="80" :src="merchant.logoUrl" icon="Shop" />
          <div class="profile-content">
            <h2 class="merchant-name">{{ merchant.merchantName }}</h2>
            <p class="merchant-no">商户编号: {{ merchant.merchantNo || '-' }}</p>
            <p class="short-name" v-if="merchant.shortName">简称: {{ merchant.shortName }}</p>
          </div>
        </div>

        <el-descriptions :column="3" border style="margin-top: 20px">
          <el-descriptions-item label="法人姓名">
            {{ merchant.legalPerson || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="法人身份证">
            {{ merchant.legalIdCard || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="营业执照号">
            {{ merchant.licenseNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ merchant.contactName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ merchant.contactPhone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系邮箱">
            {{ merchant.contactEmail || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="经营地址" :span="3">
            {{ merchant.address || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="经营年限">
            {{ merchant.operatingYears || 0 }} 年
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatTime(merchant.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatTime(merchant.updateTime) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 证件信息 -->
      <el-card class="info-card">
        <template #header>
          <span>证件信息</span>
        </template>
        <div class="license-images">
          <div class="image-item">
            <p class="image-label">营业执照</p>
            <el-image
              v-if="merchant.licenseImage"
              :src="merchant.licenseImage"
              :preview-src-list="[merchant.licenseImage]"
              fit="cover"
              class="license-img"
            />
            <el-empty v-else description="暂无图片" :image-size="60" />
          </div>
          <div class="image-item">
            <p class="image-label">身份证正面</p>
            <el-image
              v-if="merchant.legalIdFront"
              :src="merchant.legalIdFront"
              :preview-src-list="[merchant.legalIdFront]"
              fit="cover"
              class="license-img"
            />
            <el-empty v-else description="暂无图片" :image-size="60" />
          </div>
          <div class="image-item">
            <p class="image-label">身份证反面</p>
            <el-image
              v-if="merchant.legalIdBack"
              :src="merchant.legalIdBack"
              :preview-src-list="[merchant.legalIdBack]"
              fit="cover"
              class="license-img"
            />
            <el-empty v-else description="暂无图片" :image-size="60" />
          </div>
        </div>
      </el-card>

      <!-- 银行信息 -->
      <el-card class="info-card">
        <template #header>
          <span>银行信息</span>
        </template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="开户银行">
            {{ merchant.bankName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="支行名称">
            {{ merchant.bankBranch || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="银行账户">
            {{ merchant.bankAccount || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 经营数据 -->
      <el-card class="info-card">
        <template #header>
          <span>经营数据</span>
        </template>
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-value">{{ merchant.productCount || 0 }}</div>
              <div class="stat-label">商品数量</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-value">{{ merchant.orderCount || 0 }}</div>
              <div class="stat-label">订单数量</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-value sales">¥{{ formatMoney(merchant.totalSales) }}</div>
              <div class="stat-label">总销售额</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-value rating">{{ merchant.rating || '-' }}</div>
              <div class="stat-label">商户评分</div>
              <el-rate
                v-if="merchant.rating"
                v-model="merchant.rating"
                disabled
                :max="5"
              />
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- 审核历史 -->
      <el-card class="info-card">
        <template #header>
          <span>审核历史</span>
        </template>
        <el-timeline v-if="reviewHistory.length > 0">
          <el-timeline-item
            v-for="(item, index) in reviewHistory"
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
      </el-card>
    </div>

    <!-- 审核对话框 -->
    <el-dialog
      v-model="reviewDialogVisible"
      title="商户审核"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="reviewForm" label-width="80px">
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
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewLoading" @click="submitReview">
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="MerchantDetail">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getObj, reviewMerchant, getReviewHistory } from '@/api/mall/merchant'

const router = useRouter()
const route = useRoute()

// 商户ID
const merchantId = ref(null)

// 加载状态
const loading = ref(false)
const reviewLoading = ref(false)

// 商户数据
const merchant = ref({})
const reviewHistory = ref([])

// 审核对话框
const reviewDialogVisible = ref(false)
const reviewForm = reactive({
  action: 1,
  remark: ''
})

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

// 加载商户详情
const loadMerchant = async () => {
  if (!merchantId.value) return

  loading.value = true
  try {
    const res = await getObj(merchantId.value)
    merchant.value = res.data || res || {}
  } catch (error) {
    console.error('获取商户详情失败:', error)
    ElMessage.error('获取商户详情失败')
  } finally {
    loading.value = false
  }
}

// 加载审核历史
const loadReviewHistory = async () => {
  try {
    const res = await getReviewHistory(merchantId.value)
    reviewHistory.value = res.data || []
  } catch (error) {
    console.error('获取审核历史失败:', error)
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/merchant')
}

// 编辑
const handleEdit = () => {
  router.push(`/mall/merchant-edit/${merchantId.value}`)
}

// 审核
const handleReview = () => {
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
    await reviewMerchant(merchantId.value, reviewForm.action, reviewForm.remark)
    ElMessage.success('审核成功')
    reviewDialogVisible.value = false
    loadMerchant()
    loadReviewHistory()
  } catch (error) {
    console.error('审核失败:', error)
    ElMessage.error('审核失败')
  } finally {
    reviewLoading.value = false
  }
}

// 初始化
onMounted(() => {
  merchantId.value = route.params.id || route.query.id

  if (!merchantId.value) {
    ElMessage.error('缺少商户ID参数')
    goBack()
    return
  }

  loadMerchant()
  loadReviewHistory()
})
</script>

<style lang="scss" scoped>
.merchant-detail {
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

      .header-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
    }
  }

  .merchant-profile {
    display: flex;
    align-items: center;
    gap: 20px;

    .profile-content {
      .merchant-name {
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 8px 0;
      }
      .merchant-no, .short-name {
        color: #909399;
        margin: 4px 0;
      }
    }
  }

  .license-images {
    display: flex;
    gap: 30px;

    .image-item {
      text-align: center;

      .image-label {
        margin-bottom: 10px;
        color: #606266;
        font-weight: 500;
      }

      .license-img {
        width: 200px;
        height: 130px;
        border-radius: 8px;
        border: 1px solid #e4e7ed;
      }
    }
  }

  .stat-item {
    text-align: center;
    padding: 20px;
    background: #f5f7fa;
    border-radius: 8px;

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #303133;

      &.sales {
        color: #f56c6c;
      }
      &.rating {
        color: #e6a23c;
      }
    }

    .stat-label {
      margin-top: 8px;
      color: #909399;
    }
  }
}
</style>
