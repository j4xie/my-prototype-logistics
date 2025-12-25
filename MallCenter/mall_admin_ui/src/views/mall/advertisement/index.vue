<!--
  广告管理列表页
-->
<template>
  <div class="app-container">
    <!-- 搜索区域 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true" class="search-form">
      <el-form-item label="广告类型" prop="type">
        <el-select v-model="queryParams.type" placeholder="请选择" clearable style="width: 150px">
          <el-option label="启动广告" value="splash_ad" />
          <el-option label="首页Banner" value="home_banner" />
          <el-option label="详情底部" value="detail_bottom" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题" prop="title">
        <el-input v-model="queryParams.title" placeholder="请输入标题" clearable style="width: 200px" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择" clearable style="width: 120px">
          <el-option label="上线中" :value="1" />
          <el-option label="已下线" :value="0" />
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
          <el-icon><Plus /></el-icon> 新增广告
        </el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain :disabled="multiple" @click="handleDelete">
          <el-icon><Delete /></el-icon> 批量删除
        </el-button>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-table v-loading="loading" :data="dataList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="ID" prop="id" width="80" />
      <el-table-column label="预览" width="120" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.imageUrl"
            :src="row.imageUrl"
            :preview-src-list="[row.imageUrl]"
            fit="cover"
            style="width: 80px; height: 50px; border-radius: 4px"
          />
          <span v-else class="text-muted">无图片</span>
        </template>
      </el-table-column>
      <el-table-column label="标题" prop="title" min-width="150" show-overflow-tooltip />
      <el-table-column label="类型" prop="type" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="typeMap[row.type]?.tag || 'info'">
            {{ typeMap[row.type]?.label || row.type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="链接类型" prop="linkType" width="100" align="center">
        <template #default="{ row }">
          {{ linkTypeMap[row.linkType] || row.linkType }}
        </template>
      </el-table-column>
      <el-table-column label="排序" prop="position" width="80" align="center" />
      <el-table-column label="有效期" min-width="180">
        <template #default="{ row }">
          <div v-if="row.startTime || row.endTime">
            <div>{{ formatDate(row.startTime) }} ~</div>
            <div>{{ formatDate(row.endTime) }}</div>
          </div>
          <span v-else class="text-muted">永久有效</span>
        </template>
      </el-table-column>
      <el-table-column label="展示/点击" width="120" align="center">
        <template #default="{ row }">
          <span>{{ row.viewCount || 0 }} / {{ row.clickCount || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="100" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.status"
            :active-value="1"
            :inactive-value="0"
            @change="handleStatusChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleStats(row)">
            <el-icon><DataAnalysis /></el-icon> 统计
          </el-button>
          <el-button type="primary" link @click="handleEdit(row)">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-button type="danger" link @click="handleDelete(row)">
            <el-icon><Delete /></el-icon> 删除
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

    <!-- 统计对话框 -->
    <el-dialog v-model="statsDialogVisible" title="广告统计数据" width="500px">
      <el-descriptions :column="2" border v-if="statsData">
        <el-descriptions-item label="广告ID">{{ statsData.id }}</el-descriptions-item>
        <el-descriptions-item label="广告标题">{{ statsData.title }}</el-descriptions-item>
        <el-descriptions-item label="展示次数">
          <span class="stats-number">{{ statsData.viewCount || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="点击次数">
          <span class="stats-number">{{ statsData.clickCount || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="点击率" :span="2">
          <el-progress
            :percentage="clickRate"
            :stroke-width="15"
            :format="() => clickRate.toFixed(2) + '%'"
          />
        </el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">
          {{ formatDateTime(statsData.createTime) }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="statsDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="AdvertisementList">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Delete, Edit, DataAnalysis } from '@element-plus/icons-vue'
import { getPage, updateStatus, delObj, getStats } from '@/api/mall/advertisement'

const router = useRouter()

// 类型映射
const typeMap = {
  splash_ad: { label: '启动广告', tag: 'danger' },
  home_banner: { label: '首页Banner', tag: 'success' },
  detail_bottom: { label: '详情底部', tag: 'warning' }
}

const linkTypeMap = {
  product: '商品',
  url: '链接',
  miniprogram: '小程序',
  none: '无'
}

// 状态
const loading = ref(false)
const dataList = ref([])
const total = ref(0)
const ids = ref([])
const multiple = ref(true)

// 查询参数
const queryParams = reactive({
  current: 1,
  size: 10,
  type: '',
  title: '',
  status: null
})

// 统计对话框
const statsDialogVisible = ref(false)
const statsData = ref(null)
const clickRate = computed(() => {
  if (!statsData.value || !statsData.value.viewCount) return 0
  return (statsData.value.clickCount / statsData.value.viewCount) * 100
})

// 获取列表
const getList = async () => {
  loading.value = true
  try {
    const res = await getPage(queryParams)
    dataList.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error('获取广告列表失败:', error)
    ElMessage.error('获取广告列表失败')
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
  queryParams.type = ''
  queryParams.title = ''
  queryParams.status = null
  handleQuery()
}

// 选择变化
const handleSelectionChange = (selection) => {
  ids.value = selection.map(item => item.id)
  multiple.value = !selection.length
}

// 新增
const handleAdd = () => {
  router.push('/mall/advertisement-create')
}

// 编辑
const handleEdit = (row) => {
  router.push('/mall/advertisement-edit/' + row.id)
}

// 状态切换
const handleStatusChange = async (row) => {
  const text = row.status === 1 ? '上线' : '下线'
  try {
    await updateStatus(row.id, row.status)
    ElMessage.success(`${text}成功`)
  } catch (error) {
    // 恢复状态
    row.status = row.status === 1 ? 0 : 1
    console.error('状态更新失败:', error)
    ElMessage.error('状态更新失败')
  }
}

// 删除
const handleDelete = (row) => {
  const deleteIds = row.id ? [row.id] : ids.value
  if (deleteIds.length === 0) {
    ElMessage.warning('请选择要删除的广告')
    return
  }

  ElMessageBox.confirm(`确认删除选中的 ${deleteIds.length} 条广告？`, '警告', {
    type: 'warning'
  }).then(async () => {
    try {
      for (const id of deleteIds) {
        await delObj(id)
      }
      ElMessage.success('删除成功')
      getList()
    } catch (error) {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 查看统计
const handleStats = async (row) => {
  try {
    const res = await getStats(row.id)
    statsData.value = res.data || row
    statsDialogVisible.value = true
  } catch (error) {
    // 如果接口失败，使用行数据
    statsData.value = row
    statsDialogVisible.value = true
  }
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return ''
  return dateStr.replace('T', ' ').substring(0, 19)
}

// 初始化
onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.search-form {
  margin-bottom: 20px;
}

.mb8 {
  margin-bottom: 8px;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}

.stats-number {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}
</style>
