<!--
  创建/编辑溯源批次
-->
<template>
  <div class="app-container traceability-form">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">{{ isEdit ? '编辑溯源批次' : '新增溯源批次' }}</span>
        </template>
      </el-page-header>
    </div>

    <el-card v-loading="loading">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        label-position="right"
      >
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="批次号" prop="batchNo">
              <el-input
                v-model="form.batchNo"
                :placeholder="isEdit ? '' : '留空自动生成'"
                :disabled="isEdit"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="关联商品" prop="productId">
              <el-select
                v-model="form.productId"
                placeholder="请选择关联商品"
                filterable
                remote
                :remote-method="searchProducts"
                style="width: 100%"
                @change="handleProductChange"
              >
                <el-option
                  v-for="item in productOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="产品名称" prop="productName">
              <el-input v-model="form.productName" placeholder="请输入产品名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="关联商户" prop="merchantId">
              <el-select
                v-model="form.merchantId"
                placeholder="请选择商户"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="item in merchantOptions"
                  :key="item.id"
                  :label="item.merchantName"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 生产信息 -->
        <el-divider content-position="left">生产信息</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="生产日期" prop="productionDate">
              <el-date-picker
                v-model="form.productionDate"
                type="date"
                placeholder="选择生产日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="过期日期" prop="expiryDate">
              <el-date-picker
                v-model="form.expiryDate"
                type="date"
                placeholder="选择过期日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生产车间" prop="workshop">
              <el-input v-model="form.workshop" placeholder="请输入生产车间" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="数量" prop="quantity">
              <el-input-number
                v-model="form.quantity"
                :min="0"
                :precision="2"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单位" prop="unit">
              <el-select v-model="form.unit" placeholder="请选择单位" style="width: 100%">
                <el-option label="件" value="件" />
                <el-option label="箱" value="箱" />
                <el-option label="kg" value="kg" />
                <el-option label="g" value="g" />
                <el-option label="L" value="L" />
                <el-option label="mL" value="mL" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
                <el-option label="进行中" :value="0" />
                <el-option label="已完成" :value="1" />
                <el-option label="待处理" :value="2" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 溯源时间线 -->
        <el-divider content-position="left">溯源时间线</el-divider>
        <div class="timeline-section">
          <TimelineEditor v-model="timelineNodes" />
        </div>

        <!-- 原料信息（仅编辑模式显示） -->
        <template v-if="isEdit">
          <el-divider content-position="left">原料信息</el-divider>

          <el-table :data="rawMaterials" border style="margin-bottom: 20px">
            <el-table-column label="原料名称" prop="materialName" />
            <el-table-column label="供应商" prop="supplierName" />
            <el-table-column label="批次号" prop="batchNo" />
            <el-table-column label="数量" prop="quantity">
              <template #default="{ row }">
                {{ row.quantity }} {{ row.unit }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row, $index }">
                <el-button type="danger" link @click="removeMaterial($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-button type="primary" plain @click="showAddMaterialDialog">
            <el-icon><Plus /></el-icon> 添加原料
          </el-button>
        </template>
      </el-form>
    </el-card>

    <!-- 底部操作栏 -->
    <div class="footer-actions">
      <el-button @click="goBack">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        {{ isEdit ? '保存修改' : '创建批次' }}
      </el-button>
    </div>

    <!-- 添加原料对话框 -->
    <el-dialog v-model="addMaterialDialogVisible" title="添加原料" width="500px">
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
        <el-button @click="addMaterialDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitMaterial">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="TraceabilityCreate">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getObj, addObj, putObj, addRawMaterial, getRawMaterials, getTimeline, saveTimeline } from '@/api/mall/traceability'
import { getPage as getProducts } from '@/api/mall/goodsspu'
import { getPage as getMerchants } from '@/api/mall/merchant'
import TimelineEditor from '@/components/TimelineEditor/index.vue'

const router = useRouter()
const route = useRoute()

// 是否编辑模式
const batchId = ref(null)
const isEdit = computed(() => !!batchId.value)

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 表单引用
const formRef = ref(null)

// 表单数据
const form = reactive({
  id: null,
  batchNo: '',
  productId: null,
  merchantId: null,
  productName: '',
  productionDate: '',
  expiryDate: '',
  quantity: 0,
  unit: '件',
  workshop: '',
  status: 0
})

// 表单验证规则
const rules = {
  productName: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  productionDate: [{ required: true, message: '请选择生产日期', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  unit: [{ required: true, message: '请选择单位', trigger: 'change' }]
}

// 下拉选项
const productOptions = ref([])
const merchantOptions = ref([])

// 原料列表
const rawMaterials = ref([])

// 溯源时间线
const timelineNodes = ref([])

// 添加原料对话框
const addMaterialDialogVisible = ref(false)
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

// 加载批次数据（编辑模式）
const loadBatch = async () => {
  if (!batchId.value) return

  loading.value = true
  try {
    const res = await getObj(batchId.value)
    const data = res.data || res || {}

    Object.keys(form).forEach(key => {
      if (data[key] !== undefined) {
        form[key] = data[key]
      }
    })

    // 加载原料
    const materialsRes = await getRawMaterials(batchId.value)
    rawMaterials.value = materialsRes.data || []

    // 加载时间线
    try {
      const timelineRes = await getTimeline(batchId.value)
      timelineNodes.value = (timelineRes.data || []).map(item => ({
        id: item.id,
        title: item.title || '',
        timestamp: item.operateTime || item.timestamp || '',
        content: item.description || item.content || '',
        color: item.color || '#0bbd87'
      }))
    } catch (err) {
      console.warn('加载时间线失败:', err)
    }
  } catch (error) {
    console.error('获取批次详情失败:', error)
    ElMessage.error('获取批次详情失败')
  } finally {
    loading.value = false
  }
}

// 搜索商品
const searchProducts = async (query) => {
  try {
    const res = await getProducts({ name: query, current: 1, size: 20 })
    productOptions.value = (res.data?.records || []).map(item => ({
      id: item.id,
      name: item.name
    }))
  } catch (error) {
    console.error('搜索商品失败:', error)
  }
}

// 加载商户列表
const loadMerchants = async () => {
  try {
    const res = await getMerchants({ current: 1, size: 100, status: 1 })
    merchantOptions.value = res.data?.records || []
  } catch (error) {
    console.error('加载商户列表失败:', error)
  }
}

// 商品变更
const handleProductChange = (productId) => {
  const product = productOptions.value.find(p => p.id === productId)
  if (product) {
    form.productName = product.name
  }
}

// 返回列表
const goBack = () => {
  router.push('/mall/traceability')
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
  } catch (error) {
    ElMessage.warning('请完善必填信息')
    return
  }

  submitting.value = true
  try {
    let savedBatchId = batchId.value
    if (isEdit.value) {
      await putObj(form)
    } else {
      const createRes = await addObj(form)
      savedBatchId = createRes.data?.id || createRes.data
    }
    
    // 保存时间线
    if (savedBatchId && timelineNodes.value.length > 0) {
      try {
        const timelineData = timelineNodes.value.map((node, index) => ({
          id: node.id && !String(node.id).startsWith('temp-') ? node.id : null,
          batchId: savedBatchId,
          title: node.title,
          operateTime: node.timestamp,
          description: node.content,
          color: node.color,
          sortOrder: index
        }))
        await saveTimeline(savedBatchId, timelineData)
      } catch (err) {
        console.warn('保存时间线失败:', err)
      }
    }
    
    ElMessage.success(isEdit.value ? '保存成功' : '创建成功')
    goBack()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 显示添加原料对话框
const showAddMaterialDialog = () => {
  materialForm.batchId = batchId.value
  materialForm.materialName = ''
  materialForm.supplierName = ''
  materialForm.batchNo = ''
  materialForm.quantity = 0
  materialForm.unit = ''
  addMaterialDialogVisible.value = true
}

// 提交原料
const submitMaterial = async () => {
  try {
    await materialFormRef.value.validate()
  } catch (error) {
    return
  }

  try {
    await addRawMaterial(materialForm)
    ElMessage.success('添加成功')
    addMaterialDialogVisible.value = false
    // 重新加载原料列表
    const res = await getRawMaterials(batchId.value)
    rawMaterials.value = res.data || []
  } catch (error) {
    console.error('添加原料失败:', error)
    ElMessage.error('添加原料失败')
  }
}

// 删除原料
const removeMaterial = (index) => {
  rawMaterials.value.splice(index, 1)
}

// 初始化
onMounted(() => {
  batchId.value = route.params.id || route.query.id || null

  loadMerchants()

  if (isEdit.value) {
    loadBatch()
  }
})
</script>

<style lang="scss" scoped>
.traceability-form {
  .page-header {
    margin-bottom: 20px;
    .page-title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .el-card {
    margin-bottom: 80px;
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

.hideSidebar .traceability-form .footer-actions {
  left: 54px;
}

.timeline-section {
  margin-bottom: 20px;
}
</style>
