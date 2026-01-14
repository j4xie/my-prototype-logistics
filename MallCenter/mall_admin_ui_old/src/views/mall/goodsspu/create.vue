<!--
  商品创建页面 - 多步表单
-->
<template>
  <div class="app-container goods-create">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">创建商品</span>
        </template>
      </el-page-header>
    </div>

    <!-- 步骤条 -->
    <div class="steps-container">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="基本信息" description="商品名称、分类" />
        <el-step title="价格库存" description="销售价、库存" />
        <el-step title="图片描述" description="商品图片、详情" />
        <el-step title="阶梯定价" description="批发价格（可选）" />
      </el-steps>
    </div>

    <!-- 表单内容 -->
    <el-card class="form-card" v-loading="loading">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="right"
      >
        <!-- 步骤1: 基本信息 -->
        <div v-show="currentStep === 0" class="step-content">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="商品名称" prop="name">
                <el-input
                  v-model="form.name"
                  placeholder="请输入商品名称"
                  maxlength="100"
                  show-word-limit
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="商品编码" prop="spuCode">
                <el-input
                  v-model="form.spuCode"
                  placeholder="请输入商品编码（可选）"
                  maxlength="32"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="商品分类" prop="categoryId">
                <el-cascader
                  v-model="form.categoryId"
                  :options="categoryOptions"
                  :props="{ label: 'name', value: 'id', checkStrictly: true }"
                  placeholder="请选择商品分类"
                  clearable
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="上架状态" prop="shelf">
                <el-radio-group v-model="form.shelf">
                  <el-radio label="1">立即上架</el-radio>
                  <el-radio label="0">暂不上架</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="商品卖点" prop="sellPoint">
            <el-input
              v-model="form.sellPoint"
              type="textarea"
              :rows="3"
              placeholder="请输入商品卖点，如：新鲜直达、有机认证等"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>

        <!-- 步骤2: 价格库存 -->
        <div v-show="currentStep === 1" class="step-content">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="销售价" prop="salesPrice">
                <el-input-number
                  v-model="form.salesPrice"
                  :precision="2"
                  :min="0"
                  :max="999999"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="市场价" prop="marketPrice">
                <el-input-number
                  v-model="form.marketPrice"
                  :precision="2"
                  :min="0"
                  :max="999999"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="成本价" prop="costPrice">
                <el-input-number
                  v-model="form.costPrice"
                  :precision="2"
                  :min="0"
                  :max="999999"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="库存数量" prop="stock">
                <el-input-number
                  v-model="form.stock"
                  :min="0"
                  :max="999999"
                  controls-position="right"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="虚拟销量" prop="saleNum">
                <el-input-number
                  v-model="form.saleNum"
                  :min="0"
                  :max="999999"
                  controls-position="right"
                  style="width: 100%"
                />
                <div class="form-tip">设置初始销量，实际销售会自动累加</div>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 价格预览 -->
          <el-card class="price-preview" shadow="never">
            <template #header>
              <span>价格预览</span>
            </template>
            <el-descriptions :column="3" border>
              <el-descriptions-item label="销售价">
                <span class="price-value">¥{{ form.salesPrice || 0 }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="市场价">
                <span class="price-original">¥{{ form.marketPrice || 0 }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="利润">
                <span :class="profit >= 0 ? 'price-profit' : 'price-loss'">
                  ¥{{ profit.toFixed(2) }}
                </span>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </div>

        <!-- 步骤3: 图片描述 -->
        <div v-show="currentStep === 2" class="step-content">
          <el-form-item label="商品图片" prop="picUrls">
            <ImageUpload
              :limit="5"
              returnType="array"
              v-model="form.picUrls"
            />
            <div class="form-tip">最多上传5张图片，第一张为主图</div>
          </el-form-item>

          <el-form-item label="商品描述" prop="description">
            <BaseEditor v-model="form.description" :minHeight="300" />
          </el-form-item>
        </div>

        <!-- 步骤4: 阶梯定价 -->
        <div v-show="currentStep === 3" class="step-content">
          <el-alert
            title="阶梯定价说明"
            type="info"
            description="设置批发价格，购买数量越多价格越优惠。此项为可选配置。"
            :closable="false"
            show-icon
            style="margin-bottom: 20px"
          />

          <el-form-item label="启用阶梯定价">
            <el-switch v-model="enablePriceTier" />
          </el-form-item>

          <div v-if="enablePriceTier">
            <el-table :data="priceTiers" border style="width: 100%">
              <el-table-column label="最小数量" width="150">
                <template #default="{ row, $index }">
                  <el-input-number
                    v-model="row.minQuantity"
                    :min="$index === 0 ? 1 : priceTiers[$index - 1].minQuantity + 1"
                    size="small"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="最大数量" width="150">
                <template #default="{ row, $index }">
                  <el-input-number
                    v-model="row.maxQuantity"
                    :min="row.minQuantity"
                    :disabled="$index === priceTiers.length - 1"
                    size="small"
                    controls-position="right"
                    :placeholder="$index === priceTiers.length - 1 ? '无上限' : ''"
                  />
                </template>
              </el-table-column>
              <el-table-column label="单价" width="150">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.price"
                    :precision="2"
                    :min="0"
                    size="small"
                    controls-position="right"
                  />
                </template>
              </el-table-column>
              <el-table-column label="折扣率" width="120">
                <template #default="{ row }">
                  <span v-if="form.salesPrice > 0">
                    {{ ((row.price / form.salesPrice) * 100).toFixed(1) }}%
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ $index }">
                  <el-button
                    type="danger"
                    size="small"
                    :icon="Delete"
                    circle
                    @click="removePriceTier($index)"
                    :disabled="priceTiers.length <= 1"
                  />
                </template>
              </el-table-column>
            </el-table>

            <el-button
              type="primary"
              :icon="Plus"
              @click="addPriceTier"
              style="margin-top: 10px"
            >
              添加阶梯
            </el-button>
          </div>
        </div>
      </el-form>
    </el-card>

    <!-- 底部操作栏 -->
    <div class="footer-actions">
      <el-button @click="goBack">取消</el-button>
      <el-button v-if="currentStep > 0" @click="prevStep">上一步</el-button>
      <el-button v-if="currentStep < 3" type="primary" @click="nextStep">
        下一步
      </el-button>
      <el-button
        v-if="currentStep === 3"
        type="success"
        @click="submitForm"
        :loading="submitting"
      >
        提交创建
      </el-button>
    </div>
  </div>
</template>

<script setup name="GoodsSpuCreate">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { addObj } from '@/api/mall/goodsspu'
import { saveTiers } from '@/api/mall/goodspricetier'
import request from '@/utils/request'
import BaseEditor from '@/components/Editor/index.vue'

const router = useRouter()

// 响应式数据
const currentStep = ref(0)
const loading = ref(false)
const submitting = ref(false)
const formRef = ref(null)
const categoryOptions = ref([])
const enablePriceTier = ref(false)

// 表单数据
const form = reactive({
  name: '',
  spuCode: '',
  categoryId: [],
  shelf: '0',
  sellPoint: '',
  salesPrice: 0,
  marketPrice: 0,
  costPrice: 0,
  stock: 0,
  saleNum: 0,
  picUrls: [],
  description: ''
})

// 阶梯定价数据
const priceTiers = ref([
  { minQuantity: 10, maxQuantity: 49, price: 0, sortOrder: 1 },
  { minQuantity: 50, maxQuantity: 99, price: 0, sortOrder: 2 },
  { minQuantity: 100, maxQuantity: null, price: 0, sortOrder: 3 }
])

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { max: 100, message: '商品名称不能超过100个字符', trigger: 'blur' }
  ],
  categoryId: [
    { required: true, message: '请选择商品分类', trigger: 'change' }
  ],
  shelf: [
    { required: true, message: '请选择上架状态', trigger: 'change' }
  ],
  salesPrice: [
    { required: true, message: '请输入销售价', trigger: 'blur' }
  ],
  stock: [
    { required: true, message: '请输入库存数量', trigger: 'blur' }
  ],
  picUrls: [
    { required: true, message: '请上传商品图片', trigger: 'change' }
  ]
}

// 计算利润
const profit = computed(() => {
  return (form.salesPrice || 0) - (form.costPrice || 0)
})

// 加载分类数据
const loadCategories = async () => {
  try {
    const res = await request({
      url: '/goodscategory/tree',
      method: 'get'
    })
    categoryOptions.value = res.data || []
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/goodsspu')
}

// 上一步
const prevStep = () => {
  currentStep.value--
}

// 下一步
const nextStep = async () => {
  // 验证当前步骤的字段
  let fieldsToValidate = []
  switch (currentStep.value) {
    case 0:
      fieldsToValidate = ['name', 'categoryId', 'shelf']
      break
    case 1:
      fieldsToValidate = ['salesPrice', 'stock']
      break
    case 2:
      fieldsToValidate = ['picUrls']
      break
  }

  try {
    await formRef.value.validateField(fieldsToValidate)
    currentStep.value++
  } catch (error) {
    ElMessage.warning('请完善当前步骤的必填信息')
  }
}

// 添加阶梯
const addPriceTier = () => {
  const lastTier = priceTiers.value[priceTiers.value.length - 1]
  priceTiers.value.push({
    minQuantity: (lastTier.maxQuantity || lastTier.minQuantity) + 1,
    maxQuantity: null,
    price: 0,
    sortOrder: priceTiers.value.length + 1
  })
  // 更新上一个阶梯的最大数量
  if (priceTiers.value.length > 1) {
    priceTiers.value[priceTiers.value.length - 2].maxQuantity =
      priceTiers.value[priceTiers.value.length - 1].minQuantity - 1
  }
}

// 删除阶梯
const removePriceTier = (index) => {
  if (priceTiers.value.length > 1) {
    priceTiers.value.splice(index, 1)
    // 重新计算排序
    priceTiers.value.forEach((tier, i) => {
      tier.sortOrder = i + 1
    })
  }
}

// 提交表单
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch (error) {
    ElMessage.warning('请完善所有必填信息')
    return
  }

  submitting.value = true
  try {
    // 处理分类数据
    const submitData = {
      ...form,
      categoryFirst: form.categoryId[0],
      categorySecond: form.categoryId[1] || ''
    }

    // 创建商品
    const res = await addObj(submitData)
    const spuId = res.data?.id || res.data

    // 如果启用阶梯定价，保存定价配置
    if (enablePriceTier.value && priceTiers.value.length > 0 && spuId) {
      await saveTiers(spuId, priceTiers.value)
    }

    ElMessage.success('商品创建成功')
    goBack()
  } catch (error) {
    console.error('创建商品失败:', error)
    ElMessage.error('创建商品失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(() => {
  loadCategories()
})
</script>

<style lang="scss" scoped>
.goods-create {
  .page-header {
    margin-bottom: 20px;
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .steps-container {
    padding: 20px 40px;
    background: #fff;
    margin-bottom: 20px;
    border-radius: 4px;
  }

  .form-card {
    min-height: 400px;
    margin-bottom: 60px;
  }

  .step-content {
    padding: 20px 40px;
    min-height: 300px;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .price-preview {
    margin-top: 20px;
    .price-value {
      color: #f56c6c;
      font-size: 18px;
      font-weight: 600;
    }
    .price-original {
      color: #909399;
      text-decoration: line-through;
    }
    .price-profit {
      color: #67c23a;
      font-weight: 600;
    }
    .price-loss {
      color: #f56c6c;
      font-weight: 600;
    }
  }

  .footer-actions {
    position: fixed;
    bottom: 0;
    left: 210px;
    right: 0;
    padding: 12px 20px;
    background: #fff;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    z-index: 100;
  }
}

// 适配侧边栏收起状态
.hideSidebar .goods-create .footer-actions {
  left: 54px;
}
</style>
