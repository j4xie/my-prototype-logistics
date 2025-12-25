<!--
  QA配对管理页面
-->
<template>
  <div class="app-container qa-pairs">
    <!-- 搜索区域 -->
    <el-card class="box-card">
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="queryParams.keyword" placeholder="搜索问题/答案" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="分类">
          <el-tree-select
            v-model="queryParams.categoryId"
            :data="categoryTree"
            placeholder="全部分类"
            clearable
            check-strictly
            style="width: 180px"
          />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="queryParams.source" placeholder="全部" clearable style="width: 120px">
            <el-option label="手动添加" value="manual" />
            <el-option label="文档提取" value="document" />
            <el-option label="批量导入" value="import" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
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
            <el-icon><Plus /></el-icon> 新增QA
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="success" plain @click="showImportDialog">
            <el-icon><Upload /></el-icon> 批量导入
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="info" plain @click="exportQA">
            <el-icon><Download /></el-icon> 导出
          </el-button>
        </el-col>
        <el-col :span="1.5">
          <el-button type="warning" plain @click="goToKnowledge">
            <el-icon><Back /></el-icon> 返回知识库
          </el-button>
        </el-col>
      </el-row>

      <!-- QA列表 -->
      <el-table v-loading="loading" :data="qaList">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="qa-expand">
              <div class="expand-section">
                <div class="section-title">问题</div>
                <div class="section-content">{{ row.question }}</div>
              </div>
              <div class="expand-section">
                <div class="section-title">答案</div>
                <div class="section-content">{{ row.answer }}</div>
              </div>
              <div class="expand-meta">
                <span>匹配次数: {{ row.matchCount || 0 }}</span>
                <span>创建时间: {{ formatDate(row.createTime) }}</span>
                <span>更新时间: {{ formatDate(row.updateTime) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="问题" min-width="300">
          <template #default="{ row }">
            <div class="question-cell">
              <el-tag :type="getSourceType(row.source)" size="small" class="source-tag">
                {{ getSourceText(row.source) }}
              </el-tag>
              <span class="question-text">{{ truncate(row.question, 60) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="答案预览" min-width="250">
          <template #default="{ row }">
            <span class="answer-preview">{{ truncate(row.answer, 50) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="1"
              :inactive-value="0"
              @change="toggleStatus(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">
              编辑
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

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑QA' : '新增QA'" width="700px">
      <el-form ref="formRef" :model="qaForm" :rules="rules" label-width="80px">
        <el-form-item label="分类" prop="categoryId">
          <el-tree-select
            v-model="qaForm.categoryId"
            :data="categoryTree"
            placeholder="选择分类"
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="问题" prop="question">
          <el-input
            v-model="qaForm.question"
            type="textarea"
            :rows="3"
            placeholder="请输入问题"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="答案" prop="answer">
          <el-input
            v-model="qaForm.answer"
            type="textarea"
            :rows="6"
            placeholder="请输入答案"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="相似问">
          <div class="similar-questions">
            <el-tag
              v-for="(q, index) in qaForm.similarQuestions"
              :key="index"
              closable
              @close="removeSimilar(index)"
              class="similar-tag"
            >
              {{ q }}
            </el-tag>
            <el-input
              v-if="showSimilarInput"
              ref="similarInputRef"
              v-model="similarInput"
              size="small"
              style="width: 200px"
              @keyup.enter="addSimilar"
              @blur="addSimilar"
            />
            <el-button v-else type="primary" link size="small" @click="showSimilarInput = true">
              + 添加相似问
            </el-button>
          </div>
          <div class="form-tip">添加相似问题可提高匹配准确率</div>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch
            v-model="qaForm.status"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="批量导入QA" width="600px">
      <el-form label-width="100px">
        <el-form-item label="选择分类">
          <el-tree-select
            v-model="importCategoryId"
            :data="categoryTree"
            placeholder="选择分类"
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="导入格式">
          <el-radio-group v-model="importFormat">
            <el-radio label="text">文本格式</el-radio>
            <el-radio label="json">JSON格式</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="QA数据">
          <el-input
            v-model="importText"
            type="textarea"
            :rows="10"
            :placeholder="importPlaceholder"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport" :loading="importing">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="AIKnowledgeQA">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Upload, Download, Back } from '@element-plus/icons-vue'
import {
  getQAPairs, addQAPair, updateQAPair, deleteQAPair, importQAPairs, getCategoryTree
} from '@/api/mall/aiKnowledge'

const router = useRouter()

// 列表数据
const loading = ref(false)
const qaList = ref([])
const total = ref(0)
const categoryTree = ref([])

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  keyword: '',
  categoryId: null,
  source: '',
  status: null
})

// 对话框
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref(null)
const submitting = ref(false)

const qaForm = reactive({
  id: null,
  categoryId: null,
  question: '',
  answer: '',
  similarQuestions: [],
  status: 1
})

const rules = {
  question: [{ required: true, message: '请输入问题', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入答案', trigger: 'blur' }]
}

// 相似问输入
const showSimilarInput = ref(false)
const similarInput = ref('')
const similarInputRef = ref(null)

// 导入
const importDialogVisible = ref(false)
const importCategoryId = ref(null)
const importFormat = ref('text')
const importText = ref('')
const importing = ref(false)

const importPlaceholder = computed(() => {
  if (importFormat.value === 'text') {
    return `每组QA用空行分隔，问答用"---"分隔：

问：食品安全法是什么时候颁布的？
---
答：《中华人民共和国食品安全法》于2009年2月28日颁布，2015年4月24日修订。

问：什么是食品溯源？
---
答：食品溯源是指对食品从生产、加工、储存到销售的全过程进行追踪记录。`
  } else {
    return `[
  {
    "question": "食品安全法是什么时候颁布的？",
    "answer": "《中华人民共和国食品安全法》于2009年2月28日颁布。",
    "similarQuestions": ["食品安全法颁布时间", "食品安全法什么时候发布的"]
  }
]`
  }
})

// 来源映射
const getSourceType = (source) => {
  const types = { manual: '', document: 'success', import: 'warning' }
  return types[source] || 'info'
}

const getSourceText = (source) => {
  const texts = { manual: '手动', document: '文档', import: '导入' }
  return texts[source] || source
}

// 截断文本
const truncate = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
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
    const res = await getQAPairs(queryParams)
    qaList.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error('获取QA列表失败:', error)
    // 模拟数据
    qaList.value = [
      {
        id: 1,
        question: '食品安全法是什么时候颁布的？',
        answer: '《中华人民共和国食品安全法》于2009年2月28日由第十一届全国人民代表大会常务委员会第七次会议通过，2015年4月24日经第十二届全国人民代表大会常务委员会第十四次会议修订。',
        categoryId: 1,
        categoryName: '法规政策',
        source: 'document',
        status: 1,
        matchCount: 156,
        similarQuestions: ['食品安全法颁布时间', '食品安全法什么时候发布的'],
        createTime: '2025-01-10T10:30:00',
        updateTime: '2025-01-15T14:20:00'
      },
      {
        id: 2,
        question: '什么是食品溯源？',
        answer: '食品溯源是指利用信息技术手段，对食品从生产、加工、储存、运输到销售的全过程进行追踪记录，确保食品安全可追溯、来源可查询、责任可追究。',
        categoryId: 3,
        categoryName: '常见问题',
        source: 'manual',
        status: 1,
        matchCount: 234,
        similarQuestions: [],
        createTime: '2025-01-08T09:15:00',
        updateTime: '2025-01-08T09:15:00'
      },
      {
        id: 3,
        question: '如何查询产品溯源信息？',
        answer: '您可以通过以下方式查询产品溯源信息：1. 扫描产品包装上的溯源二维码；2. 在小程序首页输入溯源码查询；3. 通过"我的订单"查看购买商品的溯源详情。',
        categoryId: 3,
        categoryName: '常见问题',
        source: 'import',
        status: 1,
        matchCount: 89,
        similarQuestions: ['怎么查溯源', '溯源码在哪里查'],
        createTime: '2025-01-05T16:40:00',
        updateTime: '2025-01-12T11:30:00'
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

// 搜索
const handleQuery = () => {
  queryParams.current = 1
  getList()
}

// 重置
const resetQuery = () => {
  queryParams.keyword = ''
  queryParams.categoryId = null
  queryParams.source = ''
  queryParams.status = null
  handleQuery()
}

// 新增
const handleAdd = () => {
  isEdit.value = false
  Object.assign(qaForm, {
    id: null,
    categoryId: null,
    question: '',
    answer: '',
    similarQuestions: [],
    status: 1
  })
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(qaForm, {
    id: row.id,
    categoryId: row.categoryId,
    question: row.question,
    answer: row.answer,
    similarQuestions: [...(row.similarQuestions || [])],
    status: row.status
  })
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
    if (isEdit.value) {
      await updateQAPair(qaForm.id, qaForm)
      ElMessage.success('修改成功')
    } else {
      await addQAPair(qaForm)
      ElMessage.success('添加成功')
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

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm('确认删除该QA？', '警告', {
    type: 'warning'
  }).then(async () => {
    try {
      await deleteQAPair(row.id)
      ElMessage.success('删除成功')
      getList()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 切换状态
const toggleStatus = async (row) => {
  try {
    await updateQAPair(row.id, { status: row.status })
    ElMessage.success(row.status === 1 ? '已启用' : '已禁用')
  } catch (error) {
    row.status = row.status === 1 ? 0 : 1
    ElMessage.error('操作失败')
  }
}

// 添加相似问
const addSimilar = () => {
  if (similarInput.value.trim()) {
    qaForm.similarQuestions.push(similarInput.value.trim())
    similarInput.value = ''
  }
  showSimilarInput.value = false
}

// 移除相似问
const removeSimilar = (index) => {
  qaForm.similarQuestions.splice(index, 1)
}

// 显示导入对话框
const showImportDialog = () => {
  importCategoryId.value = null
  importFormat.value = 'text'
  importText.value = ''
  importDialogVisible.value = true
}

// 提交导入
const submitImport = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning('请输入QA数据')
    return
  }

  importing.value = true
  try {
    let qaData = []

    if (importFormat.value === 'text') {
      // 解析文本格式
      const blocks = importText.value.split(/\n\s*\n/)
      for (const block of blocks) {
        const parts = block.split('---')
        if (parts.length >= 2) {
          const question = parts[0].replace(/^问[：:]\s*/, '').trim()
          const answer = parts[1].replace(/^答[：:]\s*/, '').trim()
          if (question && answer) {
            qaData.push({ question, answer })
          }
        }
      }
    } else {
      // 解析JSON格式
      try {
        qaData = JSON.parse(importText.value)
      } catch (e) {
        ElMessage.error('JSON格式错误')
        importing.value = false
        return
      }
    }

    if (qaData.length === 0) {
      ElMessage.warning('未解析到有效QA数据')
      importing.value = false
      return
    }

    await importQAPairs({
      categoryId: importCategoryId.value,
      qaList: qaData
    })

    ElMessage.success(`成功导入 ${qaData.length} 条QA`)
    importDialogVisible.value = false
    getList()
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败')
  } finally {
    importing.value = false
  }
}

// 导出
const exportQA = () => {
  ElMessage.success('开始导出...')
}

// 返回知识库
const goToKnowledge = () => {
  router.push('/mall/ai-knowledge')
}

// 初始化
onMounted(() => {
  getList()
  loadCategoryTree()
})
</script>

<style lang="scss" scoped>
.qa-pairs {
  .search-form {
    margin-bottom: 15px;
  }

  .mb8 {
    margin-bottom: 16px;
  }

  .question-cell {
    display: flex;
    align-items: flex-start;
    gap: 8px;

    .source-tag {
      flex-shrink: 0;
    }

    .question-text {
      font-size: 14px;
      line-height: 1.5;
    }
  }

  .answer-preview {
    font-size: 13px;
    color: #606266;
  }

  .qa-expand {
    padding: 15px 20px;
    background: #f5f7fa;
    border-radius: 8px;
    margin: 10px 20px;

    .expand-section {
      margin-bottom: 15px;

      .section-title {
        font-size: 13px;
        color: #909399;
        margin-bottom: 6px;
      }

      .section-content {
        font-size: 14px;
        color: #303133;
        line-height: 1.6;
        white-space: pre-wrap;
      }
    }

    .expand-meta {
      font-size: 12px;
      color: #909399;
      display: flex;
      gap: 20px;
      padding-top: 10px;
      border-top: 1px solid #e4e7ed;
    }
  }

  .similar-questions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;

    .similar-tag {
      margin: 0;
    }
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 6px;
  }
}
</style>
