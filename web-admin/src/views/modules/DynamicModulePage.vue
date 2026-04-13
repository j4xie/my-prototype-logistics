<script setup lang="ts">
/**
 * DynamicModulePage — 通用动态模块页面
 * 根据路由 /modules/:moduleCode 加载对应配置，渲染列表/表单
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/store/modules/auth'
import { useConfigStore } from '@/store/modules/config'
import request from '@/api/request'
import type { EffectiveModuleConfig, WorkflowTransition } from '@/types/config'
import { MODULE_API_PATHS } from '@/types/config'
import SchemaFormRenderer from './components/SchemaFormRenderer.vue'
import SchemaTableRenderer from './components/SchemaTableRenderer.vue'
import TabLayoutRenderer from './components/TabLayoutRenderer.vue'

// R22 Fix Bug 2: accept moduleCode as prop (from CanvasAwareWrapper)
// AND from route.params (from /modules/:moduleCode route). Prop takes priority.
const props = defineProps<{
  moduleCode?: string
}>()

const route = useRoute()
const authStore = useAuthStore()
const configStore = useConfigStore()

const moduleCode = computed(() => props.moduleCode || String(route.params.moduleCode || ''))
const factoryId = computed(() => authStore.factoryId || '')
const apiPath = computed(() => MODULE_API_PATHS[moduleCode.value] || moduleCode.value)

// 状态
const config = ref<EffectiveModuleConfig | null>(null)
const currentView = ref<'list' | 'create' | 'edit' | 'detail'>('list')
const tableData = ref<Record<string, unknown>[]>([])
const selectedRow = ref<Record<string, unknown> | null>(null)

// R28: push browser history on view change so back button works
import { watch as vueWatch, onMounted as onMountedHook } from 'vue'
vueWatch(currentView, (newView, oldView) => {
  if (newView !== oldView && newView !== 'list') {
    history.pushState({ view: newView }, '', location.href)
  }
})
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { currentView.value = 'list' })
}
const loading = ref(false)
const pagination = ref({ page: 1, size: 20, total: 0 })

// Tab 布局配置（来自 layoutConfig.tabs）
const layoutTabs = computed(() => {
  if (!config.value) return []
  const layout = (config.value as any).layoutConfig
  if (layout && typeof layout === 'object' && 'tabs' in layout) {
    return (layout as { tabs: unknown[] }).tabs as any[]
  }
  return []
})

// 加载配置
async function loadConfig() {
  if (!factoryId.value || !moduleCode.value) return
  config.value = await configStore.loadEffectiveConfig(factoryId.value, moduleCode.value)
}

// 加载列表数据
async function loadTableData() {
  if (!factoryId.value || !apiPath.value) return
  loading.value = true
  try {
    const res = await request.get(`/${factoryId.value}/${apiPath.value}`, {
      params: { page: pagination.value.page, size: pagination.value.size },
    })
    const data = res.data
    if (Array.isArray(data)) {
      tableData.value = data
      pagination.value.total = data.length
    } else if (data?.content) {
      tableData.value = data.content
      pagination.value.total = data.totalElements || 0
    } else {
      tableData.value = []
    }
  } catch (e) {
    console.error('加载列表失败:', e)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 创建
async function handleCreate(formData: Record<string, unknown>) {
  try {
    await request.post(`/${factoryId.value}/${apiPath.value}`, formData)
    ElMessage.success('创建成功')
    currentView.value = 'list'
    loadTableData()
  } catch (e: any) {
    ElMessage.error(e?.message || '创建失败')
  }
}

// 更新
async function handleUpdate(formData: Record<string, unknown>) {
  if (!selectedRow.value) return
  const id = selectedRow.value.id
  try {
    await request.put(`/${factoryId.value}/${apiPath.value}/${id}`, formData)
    ElMessage.success('保存成功')
    currentView.value = 'list'
    loadTableData()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

// 工作流操作
async function handleAction(row: Record<string, unknown>, transition: WorkflowTransition) {
  try {
    await ElMessageBox.confirm(
      `确定执行"${transition.label}"操作？`,
      '操作确认',
      { type: 'warning' },
    )
    await request.post(`/${factoryId.value}/${apiPath.value}/${row.id}/${transition.action}`)
    ElMessage.success(`${transition.label}成功`)
    loadTableData()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '操作失败')
    }
  }
}

// 行点击 → 详情
function handleRowClick(row: Record<string, unknown>) {
  selectedRow.value = row
  currentView.value = 'detail'
}

// 分页
function handlePageChange(page: number) {
  pagination.value.page = page
  loadTableData()
}
function handleSizeChange(size: number) {
  pagination.value.size = size
  pagination.value.page = 1
  loadTableData()
}

// 切换模块时重新加载
watch(moduleCode, () => {
  currentView.value = 'list'
  selectedRow.value = null
  loadConfig()
  loadTableData()
})

onMounted(() => {
  loadConfig()
  loadTableData()
})
</script>

<template>
  <div class="dynamic-module-page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="page-title">
        <span v-if="currentView !== 'list'" class="back-btn" @click="currentView = 'list'">
          ← 返回列表
        </span>
        <h2>{{ config?.moduleName || moduleCode }}</h2>
        <el-tag v-if="config" size="small" type="info" style="margin-left: 8px">
          {{ config.renderingMode }}
        </el-tag>
      </div>
      <div class="page-actions" v-if="currentView === 'list'">
        <el-button type="primary" @click="currentView = 'create'">新建</el-button>
        <el-button @click="loadTableData">刷新</el-button>
      </div>
    </div>

    <!-- 列表视图 -->
    <template v-if="currentView === 'list' && config">
      <SchemaTableRenderer
        :fields="config.fields"
        :workflow-transitions="config.workflowTransitions"
        :data="tableData"
        :loading="loading"
        :pagination="pagination"
        @row-click="handleRowClick"
        @action="handleAction"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </template>

    <!-- 创建视图 -->
    <template v-if="currentView === 'create' && config">
      <TabLayoutRenderer
        v-if="layoutTabs.length > 0"
        :tabs="layoutTabs"
        :module-code="moduleCode"
        mode="create"
        :factory-id="factoryId"
        @submit="handleCreate"
        @cancel="currentView = 'list'"
      />
      <SchemaFormRenderer
        v-else
        :module-code="moduleCode"
        mode="create"
        @submit="handleCreate"
        @cancel="currentView = 'list'"
      />
    </template>

    <!-- 编辑视图 -->
    <template v-if="currentView === 'edit' && config && selectedRow">
      <TabLayoutRenderer
        v-if="layoutTabs.length > 0"
        :tabs="layoutTabs"
        :module-code="moduleCode"
        mode="edit"
        :initial-data="selectedRow"
        :factory-id="factoryId"
        :record-id="(selectedRow.id as string) || undefined"
        @submit="handleUpdate"
        @cancel="currentView = 'list'"
      />
      <SchemaFormRenderer
        v-else
        :module-code="moduleCode"
        mode="edit"
        :initial-data="selectedRow"
        @submit="handleUpdate"
        @cancel="currentView = 'list'"
      />
    </template>

    <!-- 详情视图 -->
    <template v-if="currentView === 'detail' && config && selectedRow">
      <TabLayoutRenderer
        v-if="layoutTabs.length > 0"
        :tabs="layoutTabs"
        :module-code="moduleCode"
        mode="view"
        :initial-data="selectedRow"
        :factory-id="factoryId"
        :record-id="(selectedRow.id as string) || undefined"
        @cancel="currentView = 'list'"
      />
      <SchemaFormRenderer
        v-else
        :module-code="moduleCode"
        mode="view"
        :initial-data="selectedRow"
        @cancel="currentView = 'list'"
      />
      <div style="margin-top: 16px">
        <el-button type="primary" @click="currentView = 'edit'">编辑</el-button>
        <el-button @click="currentView = 'list'">返回</el-button>
      </div>
    </template>

    <!-- 无配置 -->
    <el-empty v-if="!config && !loading" description="未找到模块配置" />
  </div>
</template>

<style scoped>
.dynamic-module-page {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-title h2 {
  margin: 0;
  font-size: 20px;
}
.back-btn {
  color: #409eff;
  cursor: pointer;
  font-size: 14px;
}
.back-btn:hover {
  text-decoration: underline;
}
</style>
