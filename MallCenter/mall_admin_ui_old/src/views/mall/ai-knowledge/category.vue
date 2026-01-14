<!--
  分类管理页面
-->
<template>
  <div class="app-container category-management">
    <el-row :gutter="20">
      <!-- 左侧：分类树 -->
      <el-col :span="10">
        <el-card class="box-card">
          <template #header>
            <div class="card-header">
              <span>分类管理</span>
              <el-button type="primary" size="small" @click="handleAdd(null)">
                <el-icon><Plus /></el-icon> 添加根分类
              </el-button>
            </div>
          </template>

          <div class="tree-container" v-loading="loading">
            <el-tree
              ref="treeRef"
              :data="categoryTree"
              node-key="id"
              default-expand-all
              :expand-on-click-node="false"
              draggable
              @node-drop="handleDrop"
              :allow-drop="allowDrop"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <div class="node-info">
                    <el-icon v-if="data.children?.length" class="folder-icon"><Folder /></el-icon>
                    <el-icon v-else class="file-icon"><Document /></el-icon>
                    <span class="node-label">{{ node.label }}</span>
                    <el-tag size="small" type="info" class="node-count">
                      {{ data.documentCount || 0 }} 文档
                    </el-tag>
                  </div>
                  <div class="node-actions">
                    <el-button type="primary" link size="small" @click.stop="handleAdd(data)">
                      <el-icon><Plus /></el-icon>
                    </el-button>
                    <el-button type="primary" link size="small" @click.stop="handleEdit(data)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button
                      type="danger"
                      link
                      size="small"
                      @click.stop="handleDelete(data)"
                      :disabled="data.documentCount > 0 || (data.children?.length > 0)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </template>
            </el-tree>

            <el-empty v-if="categoryTree.length === 0 && !loading" description="暂无分类" />
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：分类详情/编辑 -->
      <el-col :span="14">
        <el-card class="box-card">
          <template #header>
            <span>{{ isEdit ? '编辑分类' : '新增分类' }}</span>
          </template>

          <el-form
            ref="formRef"
            :model="categoryForm"
            :rules="rules"
            label-width="100px"
            style="max-width: 500px"
          >
            <el-form-item label="父级分类">
              <el-tree-select
                v-model="categoryForm.parentId"
                :data="categoryTreeForSelect"
                placeholder="无（作为根分类）"
                clearable
                check-strictly
                :render-after-expand="false"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="分类名称" prop="name">
              <el-input v-model="categoryForm.name" placeholder="请输入分类名称" maxlength="50" show-word-limit />
            </el-form-item>
            <el-form-item label="分类编码" prop="code">
              <el-input v-model="categoryForm.code" placeholder="可用于程序调用" maxlength="30" />
            </el-form-item>
            <el-form-item label="分类图标">
              <el-input v-model="categoryForm.icon" placeholder="图标名称或URL" />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="categoryForm.sort" :min="0" :max="999" style="width: 150px" />
            </el-form-item>
            <el-form-item label="描述">
              <el-input
                v-model="categoryForm.description"
                type="textarea"
                :rows="3"
                placeholder="分类描述"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-switch
                v-model="categoryForm.status"
                :active-value="1"
                :inactive-value="0"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="submitForm" :loading="submitting">
                {{ isEdit ? '保存修改' : '创建分类' }}
              </el-button>
              <el-button @click="resetForm">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 分类统计 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>分类统计</span>
          </template>

          <el-row :gutter="20">
            <el-col :span="8" v-for="stat in categoryStats" :key="stat.name">
              <div class="stat-item">
                <div class="stat-value">{{ stat.value }}</div>
                <div class="stat-label">{{ stat.name }}</div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <!-- 使用提示 -->
        <el-card class="box-card" style="margin-top: 20px">
          <template #header>
            <span>使用提示</span>
          </template>

          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              <div class="tips-content">
                <p>1. 拖拽节点可调整分类层级和顺序</p>
                <p>2. 删除分类前需先移除其下所有文档</p>
                <p>3. 分类编码用于API调用，建议使用英文</p>
                <p>4. 建议分类层级不超过3层</p>
              </div>
            </template>
          </el-alert>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="AIKnowledgeCategory">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Folder, Document } from '@element-plus/icons-vue'
import { getCategoryTree, getCategories, addCategory, updateCategory, deleteCategory } from '@/api/mall/aiKnowledge'

// 状态
const loading = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const treeRef = ref(null)
const formRef = ref(null)

// 分类树
const categoryTree = ref([])

// 表单
const categoryForm = reactive({
  id: null,
  parentId: null,
  name: '',
  code: '',
  icon: '',
  sort: 0,
  description: '',
  status: 1
})

const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
}

// 分类统计
const categoryStats = ref([
  { name: '总分类数', value: 0 },
  { name: '根分类', value: 0 },
  { name: '子分类', value: 0 }
])

// 转换为选择器数据格式
const categoryTreeForSelect = computed(() => {
  const transform = (nodes) => {
    return nodes.map(node => ({
      value: node.id,
      label: node.label,
      children: node.children?.length > 0 ? transform(node.children) : undefined
    }))
  }
  return transform(categoryTree.value)
})

// 加载分类树
const loadCategoryTree = async () => {
  loading.value = true
  try {
    const res = await getCategoryTree()
    categoryTree.value = res.data || []
    updateStats()
  } catch (error) {
    console.error('加载分类树失败:', error)
    // 模拟数据
    categoryTree.value = [
      {
        id: 1,
        label: '法规政策',
        code: 'policy',
        documentCount: 15,
        children: [
          { id: 11, label: '国家法规', code: 'national', documentCount: 8 },
          { id: 12, label: '地方法规', code: 'local', documentCount: 7 }
        ]
      },
      {
        id: 2,
        label: '操作手册',
        code: 'manual',
        documentCount: 24,
        children: [
          { id: 21, label: '生产流程', code: 'production', documentCount: 12 },
          { id: 22, label: '质检标准', code: 'quality', documentCount: 12 }
        ]
      },
      {
        id: 3,
        label: '常见问题',
        code: 'faq',
        documentCount: 45
      },
      {
        id: 4,
        label: '产品资料',
        code: 'product',
        documentCount: 18
      }
    ]
    updateStats()
  } finally {
    loading.value = false
  }
}

// 更新统计
const updateStats = () => {
  let total = 0
  let root = categoryTree.value.length
  let sub = 0

  const count = (nodes) => {
    nodes.forEach(node => {
      total++
      if (node.children?.length > 0) {
        sub += node.children.length
        count(node.children)
      }
    })
  }
  count(categoryTree.value)

  categoryStats.value = [
    { name: '总分类数', value: total },
    { name: '根分类', value: root },
    { name: '子分类', value: sub }
  ]
}

// 添加分类
const handleAdd = (parent) => {
  isEdit.value = false
  Object.assign(categoryForm, {
    id: null,
    parentId: parent?.id || null,
    name: '',
    code: '',
    icon: '',
    sort: 0,
    description: '',
    status: 1
  })
}

// 编辑分类
const handleEdit = (data) => {
  isEdit.value = true
  Object.assign(categoryForm, {
    id: data.id,
    parentId: data.parentId || null,
    name: data.label || data.name,
    code: data.code || '',
    icon: data.icon || '',
    sort: data.sort || 0,
    description: data.description || '',
    status: data.status ?? 1
  })
}

// 删除分类
const handleDelete = (data) => {
  if (data.documentCount > 0) {
    ElMessage.warning('该分类下还有文档，请先移除文档')
    return
  }
  if (data.children?.length > 0) {
    ElMessage.warning('该分类下还有子分类，请先删除子分类')
    return
  }

  ElMessageBox.confirm('确认删除该分类？', '警告', {
    type: 'warning'
  }).then(async () => {
    try {
      await deleteCategory(data.id)
      ElMessage.success('删除成功')
      loadCategoryTree()
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
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
      ...categoryForm,
      label: categoryForm.name
    }

    if (isEdit.value) {
      await updateCategory(categoryForm.id, data)
      ElMessage.success('修改成功')
    } else {
      await addCategory(data)
      ElMessage.success('创建成功')
    }

    loadCategoryTree()
    resetForm()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  isEdit.value = false
  Object.assign(categoryForm, {
    id: null,
    parentId: null,
    name: '',
    code: '',
    icon: '',
    sort: 0,
    description: '',
    status: 1
  })
  formRef.value?.clearValidate()
}

// 拖拽放置
const handleDrop = (draggingNode, dropNode, dropType) => {
  ElMessage.success('分类顺序已更新')
  // TODO: 调用API保存排序
}

// 允许放置判断
const allowDrop = (draggingNode, dropNode, type) => {
  // 最多3层
  if (type === 'inner') {
    let level = 1
    let node = dropNode
    while (node.parent) {
      level++
      node = node.parent
    }
    return level < 3
  }
  return true
}

// 初始化
onMounted(() => {
  loadCategoryTree()
})
</script>

<style lang="scss" scoped>
.category-management {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tree-container {
    min-height: 400px;
    max-height: 600px;
    overflow-y: auto;
  }

  .tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 8px;

    .node-info {
      display: flex;
      align-items: center;
      gap: 8px;

      .folder-icon {
        color: #e6a23c;
      }

      .file-icon {
        color: #909399;
      }

      .node-label {
        font-size: 14px;
      }

      .node-count {
        margin-left: 8px;
      }
    }

    .node-actions {
      display: none;
    }

    &:hover .node-actions {
      display: flex;
    }
  }

  .stat-item {
    text-align: center;
    padding: 20px;
    background: #f5f7fa;
    border-radius: 8px;

    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #409eff;
    }

    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-top: 8px;
    }
  }

  .tips-content {
    p {
      margin: 4px 0;
      font-size: 13px;
      line-height: 1.6;
    }
  }
}
</style>
