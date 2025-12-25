<!--
  Banner内容管理页
-->
<template>
  <div class="app-container banner-management">
    <!-- 搜索区域 -->
    <el-form :inline="true" :model="queryParams" class="search-form">
      <el-form-item label="Banner位置">
        <el-select v-model="queryParams.position" placeholder="全部" clearable style="width: 140px">
          <el-option label="首页顶部" value="home_top" />
          <el-option label="首页中部" value="home_middle" />
          <el-option label="分类页" value="category" />
          <el-option label="活动页" value="activity" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="上线中" :value="1" />
          <el-option label="已下线" :value="0" />
          <el-option label="待审核" :value="2" />
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

    <!-- 操作按钮 -->
    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain @click="handleAdd">
          <el-icon><Plus /></el-icon> 新增Banner
        </el-button>
      </el-col>
    </el-row>

    <!-- Banner预览区 -->
    <el-row :gutter="20">
      <el-col :span="8" v-for="banner in bannerList" :key="banner.id">
        <el-card class="banner-card" :class="{ 'is-offline': banner.status === 0, 'is-pending': banner.status === 2 }">
          <div class="banner-image">
            <el-image :src="banner.imageUrl" fit="cover" style="width: 100%; height: 150px">
              <template #error>
                <div class="image-placeholder">
                  <el-icon size="32"><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <div class="banner-status">
              <el-tag :type="statusMap[banner.status]?.tag" size="small">
                {{ statusMap[banner.status]?.label }}
              </el-tag>
            </div>
          </div>
          <div class="banner-info">
            <div class="banner-title">{{ banner.title }}</div>
            <div class="banner-meta">
              <span>{{ positionMap[banner.position] }}</span>
              <span>排序: {{ banner.sort }}</span>
            </div>
            <div class="banner-time">
              {{ formatDate(banner.startTime) }} ~ {{ formatDate(banner.endTime) || '永久' }}
            </div>
          </div>
          <div class="banner-actions">
            <el-button type="primary" link size="small" @click="handleEdit(banner)">
              编辑
            </el-button>
            <el-button
              :type="banner.status === 1 ? 'warning' : 'success'"
              link
              size="small"
              @click="toggleStatus(banner)"
            >
              {{ banner.status === 1 ? '下线' : '上线' }}
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(banner)">
              删除
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 空状态 -->
    <el-empty v-if="bannerList.length === 0 && !loading" description="暂无Banner" />

    <!-- 分页 -->
    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.current"
      v-model:limit="queryParams.size"
      @pagination="getList"
    />

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑Banner' : '新增Banner'" width="600px">
      <el-form :model="bannerForm" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="Banner标题" prop="title">
          <el-input v-model="bannerForm.title" placeholder="请输入标题" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="展示位置" prop="position">
          <el-select v-model="bannerForm.position" placeholder="请选择" style="width: 100%">
            <el-option label="首页顶部" value="home_top" />
            <el-option label="首页中部" value="home_middle" />
            <el-option label="分类页" value="category" />
            <el-option label="活动页" value="activity" />
          </el-select>
        </el-form-item>
        <el-form-item label="Banner图片" prop="imageUrl">
          <el-input v-model="bannerForm.imageUrl" placeholder="请输入图片URL">
            <template #append>
              <el-button>上传</el-button>
            </template>
          </el-input>
          <div class="upload-preview" v-if="bannerForm.imageUrl">
            <el-image :src="bannerForm.imageUrl" fit="contain" style="max-height: 100px; margin-top: 10px" />
          </div>
          <div class="form-tip">建议尺寸: 750 x 320 像素</div>
        </el-form-item>
        <el-form-item label="跳转链接" prop="linkUrl">
          <el-input v-model="bannerForm.linkUrl" placeholder="点击后跳转的URL或页面路径" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startTime">
              <el-date-picker
                v-model="bannerForm.startTime"
                type="datetime"
                placeholder="选择开始时间"
                value-format="YYYY-MM-DDTHH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endTime">
              <el-date-picker
                v-model="bannerForm.endTime"
                type="datetime"
                placeholder="留空永久有效"
                value-format="YYYY-MM-DDTHH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="排序" prop="sort">
              <el-input-number v-model="bannerForm.sort" :min="0" :max="999" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="bannerForm.status">
                <el-radio :label="1">上线</el-radio>
                <el-radio :label="0">下线</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="BannerManagement">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Picture } from '@element-plus/icons-vue'
import { getPage, addObj, putObj, updateStatus, delObj } from '@/api/mall/advertisement'

// 状态映射
const statusMap = {
  0: { label: '已下线', tag: 'info' },
  1: { label: '上线中', tag: 'success' },
  2: { label: '待审核', tag: 'warning' }
}

const positionMap = {
  home_top: '首页顶部',
  home_middle: '首页中部',
  category: '分类页',
  activity: '活动页'
}

// 状态
const loading = ref(false)
const bannerList = ref([])
const total = ref(0)
const submitting = ref(false)

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 12,
  type: 'home_banner',
  position: '',
  status: null
})

// 对话框
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const bannerForm = reactive({
  id: null,
  title: '',
  position: 'home_top',
  imageUrl: '',
  linkUrl: '',
  startTime: '',
  endTime: '',
  sort: 0,
  status: 1
})

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  position: [{ required: true, message: '请选择位置', trigger: 'change' }],
  imageUrl: [{ required: true, message: '请上传图片', trigger: 'blur' }]
}

// 获取列表
const getList = async () => {
  loading.value = true
  try {
    const res = await getPage(queryParams)
    bannerList.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error('获取Banner列表失败:', error)
    // 模拟数据
    bannerList.value = [
      { id: 1, title: '新年大促', position: 'home_top', imageUrl: 'https://via.placeholder.com/750x320', linkUrl: '/activity/newyear', startTime: '2025-01-01T00:00:00', endTime: '2025-01-31T23:59:59', sort: 1, status: 1 },
      { id: 2, title: '品质好物', position: 'home_top', imageUrl: 'https://via.placeholder.com/750x320', linkUrl: '/category/quality', startTime: '', endTime: '', sort: 2, status: 1 },
      { id: 3, title: '溯源专区', position: 'home_middle', imageUrl: 'https://via.placeholder.com/750x320', linkUrl: '/traceability', startTime: '', endTime: '', sort: 1, status: 0 }
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
  queryParams.position = ''
  queryParams.status = null
  handleQuery()
}

// 新增
const handleAdd = () => {
  isEdit.value = false
  Object.assign(bannerForm, {
    id: null,
    title: '',
    position: 'home_top',
    imageUrl: '',
    linkUrl: '',
    startTime: '',
    endTime: '',
    sort: 0,
    status: 1
  })
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(bannerForm, row)
  dialogVisible.value = true
}

// 提交表单
const submitForm = async () => {
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    const data = {
      ...bannerForm,
      type: 'home_banner'
    }
    if (isEdit.value) {
      await putObj(data)
      ElMessage.success('保存成功')
    } else {
      await addObj(data)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    getList()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

// 切换状态
const toggleStatus = async (row) => {
  const newStatus = row.status === 1 ? 0 : 1
  const text = newStatus === 1 ? '上线' : '下线'
  try {
    await updateStatus(row.id, newStatus)
    row.status = newStatus
    ElMessage.success(`${text}成功`)
  } catch (error) {
    console.error('状态更新失败:', error)
    ElMessage.error('操作失败')
  }
}

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm('确认删除该Banner？', '警告', {
    type: 'warning'
  }).then(async () => {
    try {
      await delObj(row.id)
      ElMessage.success('删除成功')
      getList()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 格式化日期
const formatDate = (str) => {
  if (!str) return ''
  return str.substring(0, 10)
}

// 初始化
onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.banner-management {
  .search-form {
    margin-bottom: 20px;
  }

  .mb8 {
    margin-bottom: 16px;
  }

  .banner-card {
    margin-bottom: 20px;
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.is-offline {
      opacity: 0.6;
    }

    &.is-pending {
      border: 1px solid #e6a23c;
    }

    .banner-image {
      position: relative;

      .banner-status {
        position: absolute;
        top: 8px;
        right: 8px;
      }
    }

    .banner-info {
      padding: 12px 0;

      .banner-title {
        font-size: 15px;
        font-weight: 500;
        color: #303133;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .banner-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #909399;
        margin-bottom: 4px;
      }

      .banner-time {
        font-size: 12px;
        color: #909399;
      }
    }

    .banner-actions {
      padding-top: 12px;
      border-top: 1px solid #ebeef5;
      display: flex;
      justify-content: center;
      gap: 16px;
    }
  }

  .image-placeholder {
    width: 100%;
    height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    color: #c0c4cc;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}
</style>
