<!--
  文档上传页面
-->
<template>
  <div class="app-container document-upload">
    <el-row :gutter="20">
      <!-- 左侧：上传区域 -->
      <el-col :span="16">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>上传文档</span>
              <el-button link @click="goBack">
                <el-icon><Back /></el-icon> 返回列表
              </el-button>
            </div>
          </template>

          <!-- 拖拽上传区 -->
          <el-upload
            ref="uploadRef"
            class="upload-dragger"
            drag
            action="#"
            :auto-upload="false"
            :multiple="true"
            :file-list="fileList"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :accept="acceptTypes"
          >
            <div class="upload-content">
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <div class="upload-text">
                将文件拖到此处，或<em>点击上传</em>
              </div>
              <div class="upload-tip">
                支持 PDF、Word、TXT、Markdown 格式，单个文件不超过 50MB
              </div>
            </div>
          </el-upload>

          <!-- 待上传文件列表 -->
          <div class="pending-files" v-if="pendingFiles.length > 0">
            <div class="pending-header">
              <span>待上传文件 ({{ pendingFiles.length }})</span>
              <el-button type="danger" link size="small" @click="clearAll">清空</el-button>
            </div>

            <el-table :data="pendingFiles" size="small" max-height="300">
              <el-table-column label="文件名" min-width="200">
                <template #default="{ row }">
                  <div class="file-name">
                    <el-icon v-if="row.type === 'pdf'" color="#ff4d4f"><Document /></el-icon>
                    <el-icon v-else-if="row.type === 'docx'" color="#2b5797"><Document /></el-icon>
                    <el-icon v-else color="#52c41a"><Document /></el-icon>
                    <span>{{ row.name }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="size" label="大小" width="100">
                <template #default="{ row }">
                  {{ formatFileSize(row.size) }}
                </template>
              </el-table-column>
              <el-table-column label="分类" width="150">
                <template #default="{ row }">
                  <el-tree-select
                    v-model="row.categoryId"
                    :data="categoryTree"
                    placeholder="选择分类"
                    size="small"
                    check-strictly
                    style="width: 120px"
                  />
                </template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag v-if="row.status === 'pending'" type="info" size="small">待上传</el-tag>
                  <el-tag v-else-if="row.status === 'uploading'" type="warning" size="small">
                    上传中 {{ row.progress }}%
                  </el-tag>
                  <el-tag v-else-if="row.status === 'success'" type="success" size="small">成功</el-tag>
                  <el-tag v-else-if="row.status === 'error'" type="danger" size="small">失败</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="{ row, $index }">
                  <el-button
                    type="danger"
                    link
                    size="small"
                    @click="removeFile($index)"
                    :disabled="row.status === 'uploading'"
                  >
                    移除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>

            <!-- 批量设置 -->
            <div class="batch-settings">
              <el-form :inline="true" size="small">
                <el-form-item label="批量设置分类">
                  <el-tree-select
                    v-model="batchCategoryId"
                    :data="categoryTree"
                    placeholder="选择分类"
                    check-strictly
                    style="width: 150px"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" plain @click="applyBatchCategory">应用到全部</el-button>
                </el-form-item>
              </el-form>
            </div>

            <!-- 上传按钮 -->
            <div class="upload-actions">
              <el-button @click="clearAll">取消</el-button>
              <el-button
                type="primary"
                @click="startUpload"
                :loading="uploading"
                :disabled="pendingFiles.length === 0"
              >
                开始上传 ({{ pendingFiles.length }} 个文件)
              </el-button>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：上传说明和最近上传 -->
      <el-col :span="8">
        <!-- 支持的格式 -->
        <el-card class="box-card">
          <template #header>
            <span>支持的格式</span>
          </template>

          <div class="format-list">
            <div class="format-item">
              <div class="format-icon pdf">
                <el-icon><Document /></el-icon>
              </div>
              <div class="format-info">
                <div class="format-name">PDF</div>
                <div class="format-desc">自动提取文本和表格</div>
              </div>
            </div>
            <div class="format-item">
              <div class="format-icon word">
                <el-icon><Document /></el-icon>
              </div>
              <div class="format-info">
                <div class="format-name">Word (.docx)</div>
                <div class="format-desc">支持 Office 2007+ 格式</div>
              </div>
            </div>
            <div class="format-item">
              <div class="format-icon txt">
                <el-icon><Document /></el-icon>
              </div>
              <div class="format-info">
                <div class="format-name">TXT</div>
                <div class="format-desc">纯文本文件</div>
              </div>
            </div>
            <div class="format-item">
              <div class="format-icon md">
                <el-icon><Document /></el-icon>
              </div>
              <div class="format-info">
                <div class="format-name">Markdown</div>
                <div class="format-desc">支持标准 Markdown 语法</div>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 上传须知 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>上传须知</span>
          </template>

          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              <div class="tips-content">
                <p>1. 单个文件大小限制 50MB</p>
                <p>2. 建议将相关文档归类上传</p>
                <p>3. 上传后系统将自动解析和向量化</p>
                <p>4. 处理时间取决于文档大小</p>
                <p>5. 敏感文档请勿上传</p>
              </div>
            </template>
          </el-alert>
        </el-card>

        <!-- 最近上传 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>最近上传</span>
          </template>

          <div class="recent-uploads" v-loading="loadingRecent">
            <div
              class="recent-item"
              v-for="item in recentUploads"
              :key="item.id"
              @click="viewDocument(item)"
            >
              <div class="recent-icon">
                <el-icon><Document /></el-icon>
              </div>
              <div class="recent-info">
                <div class="recent-name">{{ item.name }}</div>
                <div class="recent-time">{{ formatDate(item.createTime) }}</div>
              </div>
              <div class="recent-status">
                <el-tag :type="getStatusType(item.status)" size="small">
                  {{ getStatusText(item.status) }}
                </el-tag>
              </div>
            </div>

            <el-empty v-if="recentUploads.length === 0" description="暂无上传记录" :image-size="60" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="AIKnowledgeUpload">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document, Back } from '@element-plus/icons-vue'
import { uploadDocument, getDocuments, getCategoryTree } from '@/api/mall/aiKnowledge'

const router = useRouter()

// 支持的文件类型
const acceptTypes = '.pdf,.doc,.docx,.txt,.md'

// 分类树
const categoryTree = ref([])
const batchCategoryId = ref(null)

// 待上传文件
const fileList = ref([])
const pendingFiles = ref([])
const uploading = ref(false)
const uploadRef = ref(null)

// 最近上传
const loadingRecent = ref(false)
const recentUploads = ref([])

// 文件变化
const handleFileChange = (file, files) => {
  const type = getFileType(file.name)
  if (!['pdf', 'doc', 'docx', 'txt', 'md'].includes(type)) {
    ElMessage.warning('不支持的文件格式')
    return false
  }

  if (file.size > 50 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 50MB')
    return false
  }

  pendingFiles.value.push({
    uid: file.uid,
    name: file.name,
    size: file.size,
    type: type,
    file: file.raw,
    categoryId: null,
    status: 'pending',
    progress: 0
  })
}

// 移除文件
const handleFileRemove = (file) => {
  const index = pendingFiles.value.findIndex(f => f.uid === file.uid)
  if (index > -1) {
    pendingFiles.value.splice(index, 1)
  }
}

const removeFile = (index) => {
  pendingFiles.value.splice(index, 1)
}

// 清空所有
const clearAll = () => {
  pendingFiles.value = []
  fileList.value = []
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
}

// 应用批量分类
const applyBatchCategory = () => {
  if (!batchCategoryId.value) {
    ElMessage.warning('请先选择分类')
    return
  }
  pendingFiles.value.forEach(f => {
    f.categoryId = batchCategoryId.value
  })
  ElMessage.success('已应用到全部文件')
}

// 开始上传
const startUpload = async () => {
  uploading.value = true

  for (const file of pendingFiles.value) {
    if (file.status === 'success') continue

    file.status = 'uploading'
    file.progress = 0

    try {
      const formData = new FormData()
      formData.append('file', file.file)
      if (file.categoryId) {
        formData.append('categoryId', file.categoryId)
      }

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        if (file.progress < 90) {
          file.progress += 10
        }
      }, 200)

      await uploadDocument(formData)

      clearInterval(progressInterval)
      file.progress = 100
      file.status = 'success'
    } catch (error) {
      file.status = 'error'
      console.error('上传失败:', error)
    }
  }

  uploading.value = false

  const successCount = pendingFiles.value.filter(f => f.status === 'success').length
  const failCount = pendingFiles.value.filter(f => f.status === 'error').length

  if (failCount === 0) {
    ElMessage.success(`全部 ${successCount} 个文件上传成功`)
    setTimeout(() => {
      router.push('/mall/ai-knowledge')
    }, 1500)
  } else {
    ElMessage.warning(`${successCount} 个成功，${failCount} 个失败`)
  }

  loadRecentUploads()
}

// 获取文件类型
const getFileType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase()
  return ext
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (str) => {
  if (!str) return ''
  return str.substring(0, 16).replace('T', ' ')
}

// 状态映射
const getStatusType = (status) => {
  const types = {
    processed: 'success',
    processing: 'warning',
    pending: 'info',
    failed: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    processed: '已处理',
    processing: '处理中',
    pending: '待处理',
    failed: '失败'
  }
  return texts[status] || status
}

// 加载分类树
const loadCategoryTree = async () => {
  try {
    const res = await getCategoryTree()
    categoryTree.value = res.data || []
  } catch (error) {
    categoryTree.value = [
      { value: 1, label: '法规政策' },
      { value: 2, label: '操作手册' },
      { value: 3, label: '常见问题' },
      { value: 4, label: '产品资料' }
    ]
  }
}

// 加载最近上传
const loadRecentUploads = async () => {
  loadingRecent.value = true
  try {
    const res = await getDocuments({ current: 1, size: 5 })
    recentUploads.value = res.data?.records || []
  } catch (error) {
    recentUploads.value = [
      { id: 1, name: '食品安全法规汇编.pdf', status: 'processed', createTime: '2025-01-15T10:30:00' },
      { id: 2, name: '产品溯源标准手册.docx', status: 'processing', createTime: '2025-01-14T14:20:00' }
    ]
  } finally {
    loadingRecent.value = false
  }
}

// 查看文档
const viewDocument = (doc) => {
  router.push('/mall/ai-knowledge')
}

// 返回
const goBack = () => {
  router.push('/mall/ai-knowledge')
}

// 初始化
onMounted(() => {
  loadCategoryTree()
  loadRecentUploads()
})
</script>

<style lang="scss" scoped>
.document-upload {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .upload-dragger {
    width: 100%;

    :deep(.el-upload-dragger) {
      padding: 40px;
      border: 2px dashed #dcdfe6;
      border-radius: 8px;
      transition: all 0.3s;

      &:hover {
        border-color: #409eff;
      }
    }

    .upload-content {
      text-align: center;

      .upload-icon {
        font-size: 48px;
        color: #c0c4cc;
        margin-bottom: 16px;
      }

      .upload-text {
        font-size: 16px;
        color: #606266;

        em {
          color: #409eff;
          font-style: normal;
        }
      }

      .upload-tip {
        font-size: 13px;
        color: #909399;
        margin-top: 8px;
      }
    }
  }

  .pending-files {
    margin-top: 20px;

    .pending-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-size: 14px;
      font-weight: 500;
    }

    .file-name {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .batch-settings {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #ebeef5;
    }

    .upload-actions {
      margin-top: 20px;
      text-align: center;
    }
  }

  .format-list {
    .format-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #ebeef5;

      &:last-child {
        border-bottom: none;
      }

      .format-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        font-size: 20px;
        color: #fff;

        &.pdf {
          background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
        }

        &.word {
          background: linear-gradient(135deg, #2b5797 0%, #4a7bb7 100%);
        }

        &.txt {
          background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
        }

        &.md {
          background: linear-gradient(135deg, #333 0%, #666 100%);
        }
      }

      .format-info {
        .format-name {
          font-size: 14px;
          color: #303133;
          font-weight: 500;
        }

        .format-desc {
          font-size: 12px;
          color: #909399;
          margin-top: 2px;
        }
      }
    }
  }

  .tips-content {
    p {
      margin: 4px 0;
      font-size: 13px;
      line-height: 1.6;
    }
  }

  .recent-uploads {
    .recent-item {
      display: flex;
      align-items: center;
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: #f5f7fa;
      }

      .recent-icon {
        width: 36px;
        height: 36px;
        background: #f0f2f5;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
        color: #909399;
      }

      .recent-info {
        flex: 1;

        .recent-name {
          font-size: 13px;
          color: #303133;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }

        .recent-time {
          font-size: 12px;
          color: #909399;
          margin-top: 2px;
        }
      }
    }
  }
}
</style>
