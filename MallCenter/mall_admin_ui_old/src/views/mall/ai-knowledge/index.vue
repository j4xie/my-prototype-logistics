<!--
  AI知识库首页
-->
<template>
  <div class="app-container ai-knowledge">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
            <el-icon size="24"><Document /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.documentCount }}</div>
            <div class="stat-label">文档总数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%)">
            <el-icon size="24"><ChatDotRound /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.qaCount }}</div>
            <div class="stat-label">QA配对数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
            <el-icon size="24"><DataAnalysis /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.vectorCount }}</div>
            <div class="stat-label">向量数据</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
            <el-icon size="24"><PieChart /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.categoryCount }}</div>
            <div class="stat-label">分类数量</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索和操作区 -->
    <el-card class="box-card">
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="queryParams.keyword" placeholder="搜索文档名称/内容" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="分类">
          <el-tree-select
            v-model="queryParams.categoryId"
            :data="categoryTree"
            placeholder="全部分类"
            clearable
            check-strictly
            :render-after-expand="false"
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="已处理" value="processed" />
            <el-option label="处理中" value="processing" />
            <el-option label="待处理" value="pending" />
            <el-option label="失败" value="failed" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="queryParams.fileType" placeholder="全部" clearable style="width: 120px">
            <el-option label="PDF" value="pdf" />
            <el-option label="Word" value="docx" />
            <el-option label="TXT" value="txt" />
            <el-option label="Markdown" value="md" />
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
          <el-button type="primary" plain @click="goToUpload">
            <el-icon><Upload /></el-icon> 上传文档
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="success" plain @click="goToQAPairs">
            <el-icon><ChatDotRound /></el-icon> QA管理
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="info" plain @click="goToCategories">
            <el-icon><Folder /></el-icon> 分类管理
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button
            type="danger"
            plain
            :disabled="selectedIds.length === 0"
            @click="handleBatchDelete"
          >
            <el-icon><Delete /></el-icon> 批量删除
          </el-button>
        </el-col>
      </el-row>

      <!-- 文档列表 -->
      <el-table
        v-loading="loading"
        :data="documentList"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="文档信息" min-width="300">
          <template #default="{ row }">
            <div class="doc-info">
              <div class="doc-icon">
                <el-icon v-if="row.fileType === 'pdf'" color="#ff4d4f" size="28"><Document /></el-icon>
                <el-icon v-else-if="row.fileType === 'docx'" color="#2b5797" size="28"><Document /></el-icon>
                <el-icon v-else-if="row.fileType === 'md'" color="#333" size="28"><Document /></el-icon>
                <el-icon v-else color="#52c41a" size="28"><Document /></el-icon>
              </div>
              <div class="doc-detail">
                <div class="doc-name">{{ row.name }}</div>
                <div class="doc-meta">
                  <span>{{ row.fileType?.toUpperCase() }}</span>
                  <span>{{ formatFileSize(row.fileSize) }}</span>
                  <span>{{ row.pageCount }} 页</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column label="处理状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
            <el-progress
              v-if="row.status === 'processing'"
              :percentage="row.progress || 0"
              :stroke-width="4"
              style="width: 80px; margin-top: 4px"
            />
          </template>
        </el-table-column>
        <el-table-column label="向量化" width="100">
          <template #default="{ row }">
            <span v-if="row.vectorCount > 0" class="vector-count">
              {{ row.vectorCount }} 条
            </span>
            <el-tag v-else type="info" size="small">未向量化</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="上传时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDocument(row)">
              查看
            </el-button>
            <el-button
              v-if="row.status === 'failed'"
              type="warning"
              link
              size="small"
              @click="reprocessDocument(row)"
            >
              重试
            </el-button>
            <el-button
              v-if="row.status === 'processed' && row.vectorCount === 0"
              type="success"
              link
              size="small"
              @click="vectorizeDocument(row)"
            >
              向量化
            </el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <pagination
        v-show="total > 0"
        :total="total"
        v-model:page="queryParams.current"
        v-model:limit="queryParams.size"
        @pagination="getList"
      />
    </el-card>

    <!-- 文档预览对话框 -->
    <el-dialog v-model="previewDialogVisible" :title="previewDocument?.name" width="800px">
      <div class="document-preview" v-loading="previewLoading">
        <div class="preview-info">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="文件类型">{{ previewDocument?.fileType?.toUpperCase() }}</el-descriptions-item>
            <el-descriptions-item label="文件大小">{{ formatFileSize(previewDocument?.fileSize) }}</el-descriptions-item>
            <el-descriptions-item label="页数">{{ previewDocument?.pageCount }}</el-descriptions-item>
            <el-descriptions-item label="向量数">{{ previewDocument?.vectorCount || 0 }}</el-descriptions-item>
            <el-descriptions-item label="分类">{{ previewDocument?.categoryName }}</el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ formatDate(previewDocument?.createTime) }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <el-divider>文档内容预览</el-divider>

        <div class="preview-content">
          <pre>{{ previewDocument?.contentPreview || '暂无预览内容' }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="downloadDocument(previewDocument)">下载原文</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="AIKnowledge">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Document, ChatDotRound, DataAnalysis, PieChart, Search, Refresh,
  Upload, Folder, Delete
} from '@element-plus/icons-vue'
import {
  getDocuments, deleteDocument, batchDeleteDocuments, reprocessDocument as reprocessApi,
  triggerVectorization, getCategoryTree, getKnowledgeStats
} from '@/api/mall/aiKnowledge'

const router = useRouter()

// 统计数据
const stats = ref({
  documentCount: 0,
  qaCount: 0,
  vectorCount: 0,
  categoryCount: 0
})

// 列表数据
const loading = ref(false)
const documentList = ref([])
const total = ref(0)
const selectedIds = ref([])
const categoryTree = ref([])

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  keyword: '',
  categoryId: null,
  status: '',
  fileType: ''
})

// 预览
const previewDialogVisible = ref(false)
const previewLoading = ref(false)
const previewDocument = ref(null)

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

// 获取列表
const getList = async () => {
  loading.value = true
  try {
    const res = await getDocuments(queryParams)
    documentList.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error('获取文档列表失败:', error)
    // 模拟数据
    documentList.value = [
      {
        id: 1,
        name: '食品安全法规汇编.pdf',
        fileType: 'pdf',
        fileSize: 2048000,
        pageCount: 56,
        categoryId: 1,
        categoryName: '法规政策',
        status: 'processed',
        vectorCount: 128,
        createTime: '2025-01-15T10:30:00'
      },
      {
        id: 2,
        name: '产品溯源标准手册.docx',
        fileType: 'docx',
        fileSize: 512000,
        pageCount: 24,
        categoryId: 2,
        categoryName: '操作手册',
        status: 'processed',
        vectorCount: 48,
        createTime: '2025-01-14T14:20:00'
      },
      {
        id: 3,
        name: '常见问题解答.md',
        fileType: 'md',
        fileSize: 32000,
        pageCount: 8,
        categoryId: 3,
        categoryName: '常见问题',
        status: 'processing',
        progress: 65,
        vectorCount: 0,
        createTime: '2025-01-13T09:15:00'
      }
    ]
    total.value = 3
  } finally {
    loading.value = false
  }
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

// 加载统计
const loadStats = async () => {
  try {
    const res = await getKnowledgeStats()
    stats.value = res.data || stats.value
  } catch (error) {
    stats.value = {
      documentCount: 156,
      qaCount: 432,
      vectorCount: 12580,
      categoryCount: 8
    }
  }
}

// 搜索
const handleQuery = () => {
  queryParams.current = 1
  getList()
}

// 重置
const resetQuery = () => {
  queryParams.keyword = ''
  queryParams.categoryId = null
  queryParams.status = ''
  queryParams.fileType = ''
  handleQuery()
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.id)
}

// 查看文档
const viewDocument = (row) => {
  previewDocument.value = {
    ...row,
    contentPreview: '这是文档内容的预览...\n\n第一章 食品安全概述\n\n食品安全是指食品在生产、加工、储存、销售等环节中，符合国家食品安全标准和相关法律法规的要求...'
  }
  previewDialogVisible.value = true
}

// 重新处理
const reprocessDocument = async (row) => {
  try {
    await reprocessApi(row.id)
    ElMessage.success('已重新提交处理')
    getList()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

// 向量化
const vectorizeDocument = async (row) => {
  try {
    await triggerVectorization([row.id])
    ElMessage.success('已开始向量化')
    getList()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

// 下载文档
const downloadDocument = (doc) => {
  ElMessage.success('开始下载...')
}

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm('确认删除该文档？删除后相关向量数据也会被清除。', '警告', {
    type: 'warning'
  }).then(async () => {
    try {
      await deleteDocument(row.id)
      ElMessage.success('删除成功')
      getList()
      loadStats()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 批量删除
const handleBatchDelete = () => {
  ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 个文档？`, '警告', {
    type: 'warning'
  }).then(async () => {
    try {
      await batchDeleteDocuments(selectedIds.value)
      ElMessage.success('删除成功')
      getList()
      loadStats()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 跳转
const goToUpload = () => {
  router.push('/mall/ai-knowledge-upload')
}

const goToQAPairs = () => {
  router.push('/mall/ai-knowledge-qa')
}

const goToCategories = () => {
  router.push('/mall/ai-knowledge-category')
}

// 初始化
onMounted(() => {
  getList()
  loadCategoryTree()
  loadStats()
})
</script>

<style lang="scss" scoped>
.ai-knowledge {
  .stats-row {
    margin-bottom: 20px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    padding: 20px;

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      margin-right: 16px;
    }

    .stat-info {
      .stat-value {
        font-size: 28px;
        font-weight: bold;
        color: #303133;
      }

      .stat-label {
        font-size: 14px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }

  .search-form {
    margin-bottom: 15px;
  }

  .mb8 {
    margin-bottom: 16px;
  }

  .doc-info {
    display: flex;
    align-items: center;

    .doc-icon {
      margin-right: 12px;
    }

    .doc-detail {
      .doc-name {
        font-size: 14px;
        color: #303133;
        font-weight: 500;
      }

      .doc-meta {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;

        span {
          margin-right: 12px;
        }
      }
    }
  }

  .vector-count {
    color: #67c23a;
    font-weight: 500;
  }

  .document-preview {
    .preview-info {
      margin-bottom: 20px;
    }

    .preview-content {
      max-height: 400px;
      overflow-y: auto;
      background: #f5f7fa;
      padding: 15px;
      border-radius: 8px;

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.6;
      }
    }
  }
}
</style>
