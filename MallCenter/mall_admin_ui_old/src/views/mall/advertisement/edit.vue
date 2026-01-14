<!--
  广告创建/编辑页
-->
<template>
  <div class="app-container advertisement-form">
    <!-- 页面头部 -->
    <div class="page-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="page-title">{{ isEdit ? '编辑广告' : '新增广告' }}</span>
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
            <el-form-item label="广告类型" prop="type">
              <el-select v-model="form.type" placeholder="请选择广告类型" style="width: 100%">
                <el-option label="启动广告" value="splash_ad" />
                <el-option label="首页Banner" value="home_banner" />
                <el-option label="详情底部" value="detail_bottom" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="广告标题" prop="title">
              <el-input v-model="form.title" placeholder="请输入广告标题" maxlength="50" show-word-limit />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="广告描述" prop="description">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="3"
                placeholder="请输入广告描述（可选）"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 素材上传 -->
        <el-divider content-position="left">素材内容</el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="广告图片" prop="imageUrl">
              <div class="upload-area">
                <el-input v-model="form.imageUrl" placeholder="请输入图片URL或上传图片">
                  <template #append>
                    <el-button @click="showUploadDialog('image')">上传</el-button>
                  </template>
                </el-input>
                <div class="preview-area" v-if="form.imageUrl">
                  <el-image
                    :src="form.imageUrl"
                    fit="contain"
                    style="width: 200px; height: 100px; margin-top: 10px"
                  />
                </div>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="广告视频" prop="videoUrl">
              <el-input v-model="form.videoUrl" placeholder="视频URL（可选，启动广告可用）">
                <template #append>
                  <el-button @click="showUploadDialog('video')">上传</el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 链接设置 -->
        <el-divider content-position="left">链接设置</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="链接类型" prop="linkType">
              <el-select v-model="form.linkType" placeholder="请选择" style="width: 100%">
                <el-option label="无链接" value="none" />
                <el-option label="跳转商品" value="product" />
                <el-option label="外部链接" value="url" />
                <el-option label="小程序页面" value="miniprogram" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="链接值" prop="linkValue" v-if="form.linkType && form.linkType !== 'none'">
              <template v-if="form.linkType === 'product'">
                <el-select
                  v-model="form.linkValue"
                  placeholder="搜索并选择商品"
                  filterable
                  remote
                  :remote-method="searchProducts"
                  style="width: 100%"
                >
                  <el-option
                    v-for="item in productOptions"
                    :key="item.id"
                    :label="item.name"
                    :value="String(item.id)"
                  />
                </el-select>
              </template>
              <template v-else>
                <el-input
                  v-model="form.linkValue"
                  :placeholder="linkPlaceholder"
                />
              </template>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 展示设置 -->
        <el-divider content-position="left">展示设置</el-divider>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="排序位置" prop="position">
              <el-input-number
                v-model="form.position"
                :min="0"
                :max="999"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="开始时间" prop="startTime">
              <el-date-picker
                v-model="form.startTime"
                type="datetime"
                placeholder="留空立即生效"
                value-format="YYYY-MM-DDTHH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="结束时间" prop="endTime">
              <el-date-picker
                v-model="form.endTime"
                type="datetime"
                placeholder="留空永久有效"
                value-format="YYYY-MM-DDTHH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio :label="1">上线</el-radio>
                <el-radio :label="0">下线</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- 底部操作栏 -->
    <div class="footer-actions">
      <el-button @click="goBack">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        {{ isEdit ? '保存修改' : '创建广告' }}
      </el-button>
    </div>

    <!-- 图片上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" :title="uploadType === 'image' ? '上传图片' : '上传视频'" width="500px">
      <el-upload
        class="upload-demo"
        drag
        action="/api/common/upload"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
        :accept="uploadType === 'image' ? 'image/*' : 'video/*'"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            {{ uploadType === 'image' ? '支持 JPG/PNG/GIF，建议尺寸 750x400' : '支持 MP4/MOV，最大 50MB' }}
          </div>
        </template>
      </el-upload>
      <div style="margin-top: 20px">
        <el-input
          v-model="uploadUrl"
          placeholder="或直接输入URL地址"
        >
          <template #append>
            <el-button @click="confirmUploadUrl">确认</el-button>
          </template>
        </el-input>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="AdvertisementEdit">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { getObj, addObj, putObj } from '@/api/mall/advertisement'
import { getPage as getProducts } from '@/api/mall/goodsspu'

const router = useRouter()
const route = useRoute()

// 是否编辑模式
const adId = ref(null)
const isEdit = computed(() => !!adId.value)

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 表单引用
const formRef = ref(null)

// 表单数据
const form = reactive({
  id: null,
  type: 'home_banner',
  title: '',
  description: '',
  imageUrl: '',
  videoUrl: '',
  linkType: 'none',
  linkValue: '',
  position: 0,
  startTime: '',
  endTime: '',
  status: 1
})

// 表单验证规则
const rules = {
  type: [{ required: true, message: '请选择广告类型', trigger: 'change' }],
  title: [{ required: true, message: '请输入广告标题', trigger: 'blur' }],
  imageUrl: [{ required: true, message: '请上传广告图片', trigger: 'blur' }]
}

// 商品选项
const productOptions = ref([])

// 链接占位符
const linkPlaceholder = computed(() => {
  switch (form.linkType) {
    case 'url':
      return '请输入完整的URL地址，如 https://example.com'
    case 'miniprogram':
      return '请输入小程序页面路径，如 /pages/goods/detail?id=123'
    default:
      return ''
  }
})

// 上传对话框
const uploadDialogVisible = ref(false)
const uploadType = ref('image')
const uploadUrl = ref('')

// 加载广告数据（编辑模式）
const loadAdvertisement = async () => {
  if (!adId.value) return

  loading.value = true
  try {
    const res = await getObj(adId.value)
    const data = res.data || res || {}

    Object.keys(form).forEach(key => {
      if (data[key] !== undefined) {
        form[key] = data[key]
      }
    })
  } catch (error) {
    console.error('获取广告详情失败:', error)
    ElMessage.error('获取广告详情失败')
  } finally {
    loading.value = false
  }
}

// 搜索商品
const searchProducts = async (query) => {
  if (!query) return
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

// 显示上传对话框
const showUploadDialog = (type) => {
  uploadType.value = type
  uploadUrl.value = ''
  uploadDialogVisible.value = true
}

// 上传成功
const handleUploadSuccess = (res) => {
  if (res.code === 200 && res.data) {
    if (uploadType.value === 'image') {
      form.imageUrl = res.data.url
    } else {
      form.videoUrl = res.data.url
    }
    uploadDialogVisible.value = false
    ElMessage.success('上传成功')
  } else {
    ElMessage.error(res.msg || '上传失败')
  }
}

// 上传失败
const handleUploadError = () => {
  ElMessage.error('上传失败，请重试')
}

// 确认URL
const confirmUploadUrl = () => {
  if (!uploadUrl.value) {
    ElMessage.warning('请输入URL地址')
    return
  }
  if (uploadType.value === 'image') {
    form.imageUrl = uploadUrl.value
  } else {
    form.videoUrl = uploadUrl.value
  }
  uploadDialogVisible.value = false
}

// 返回列表
const goBack = () => {
  router.push('/mall/advertisement')
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
    if (isEdit.value) {
      await putObj(form)
      ElMessage.success('保存成功')
    } else {
      await addObj(form)
      ElMessage.success('创建成功')
    }
    goBack()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 初始化
onMounted(() => {
  adId.value = route.params.id || null

  if (isEdit.value) {
    loadAdvertisement()
  }
})
</script>

<style lang="scss" scoped>
.advertisement-form {
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

  .upload-area {
    .preview-area {
      margin-top: 10px;
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

.hideSidebar .advertisement-form .footer-actions {
  left: 54px;
}
</style>
