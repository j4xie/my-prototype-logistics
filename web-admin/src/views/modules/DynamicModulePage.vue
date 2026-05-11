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
import { usePermissionStore, ModuleName } from '@/store/modules/permission'
import request from '@/api/request'
import type { EffectiveModuleConfig, WorkflowTransition } from '@/types/config'
import { MODULE_API_PATHS } from '@/types/config'
import SchemaFormRenderer from './components/SchemaFormRenderer.vue'
import SchemaTableRenderer from './components/SchemaTableRenderer.vue'
import TabLayoutRenderer from './components/TabLayoutRenderer.vue'
import type { TableRow } from '@/types/api';

// R22 Fix Bug 2: accept moduleCode as prop (from CanvasAwareWrapper)
// AND from route.params (from /modules/:moduleCode route). Prop takes priority.
const props = defineProps<{
  moduleCode?: string
}>()

const route = useRoute()
const authStore = useAuthStore()
const configStore = useConfigStore()
const permissionStore = usePermissionStore()

const moduleCode = computed(() => props.moduleCode || String(route.params.moduleCode || ''))
const factoryId = computed(() => authStore.factoryId || '')
const apiPath = computed(() => MODULE_API_PATHS[moduleCode.value] || moduleCode.value)

// RBAC UI: 映射 moduleCode (e.g., sales_order) → sidebar permission module (e.g., sales)
// 使 viewer / read-only 角色不看到启用的 "新建" 按钮 (之前只后端 403, FE 让用户填完才发现)
const MODULE_CODE_TO_PERMISSION: Record<string, ModuleName> = {
  sales_order: 'sales', purchase_order: 'procurement', production_plan: 'production',
  production_batch: 'production', bom_item: 'production',
  quality_inspection: 'quality', hr_employee: 'hr', equipment: 'equipment',
  finance_ar: 'finance', finance_ap: 'finance', material_batch: 'warehouse',
  scheduling: 'scheduling', restaurant: 'restaurant',
}
const canWrite = computed(() => {
  const mod = MODULE_CODE_TO_PERMISSION[moduleCode.value]
  if (!mod) return true  // 无映射的保守允许, 后端仍 403 兜底
  return permissionStore.canWrite(mod)
})

// 状态
const config = ref<EffectiveModuleConfig | null>(null)
const currentView = ref<'list' | 'create' | 'edit' | 'detail'>('list')
const tableData = ref<TableRow[]>([])
const selectedRow = ref<TableRow | null>(null)

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

// Bug G fix (qa-prompt v2.3 Rule 12.1): keyword search input
const searchKeyword = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(val: string) {
  searchKeyword.value = val
  // debounce 300ms
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.value.page = 1
    loadTableData()
  }, 300)
}
function resetSearch() {
  searchKeyword.value = ''
  pagination.value.page = 1
  loadTableData()
}

// Tab 布局配置（来自 layoutConfig.tabs）
interface LayoutConfig { tabs?: unknown[] }
const layoutTabs = computed<unknown[]>(() => {
  if (!config.value) return []
  const layout = (config.value as { layoutConfig?: LayoutConfig }).layoutConfig
  if (layout && typeof layout === 'object' && Array.isArray(layout.tabs)) {
    return layout.tabs
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
    // Bug G: include keyword for search-supporting endpoints
    const params: TableRow = { page: pagination.value.page, size: pagination.value.size }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    const res = await request.get(`/${factoryId.value}/${apiPath.value}`, { params })
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
async function handleCreate(formData: TableRow) {
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
async function handleUpdate(formData: TableRow) {
  if (!selectedRow.value) return
  const id = selectedRow.value.id
  // Optimistic lock: forward the version snapshot from the row FE loaded.
  // Backend compares req.version vs db.version → 409 if stale (Customer/Supplier/SO/PO/Equipment).
  const version = (selectedRow.value as TableRow).version
  if (version !== undefined && version !== null && (formData as TableRow).version === undefined) {
    (formData as TableRow).version = version
  }
  try {
    await request.put(`/${factoryId.value}/${apiPath.value}/${id}`, formData)
    ElMessage.success('保存成功')
    currentView.value = 'list'
    loadTableData()
  } catch (e: any) {
    // R24 P2 follow-up: only treat 409 as optimistic-lock when actionHint is null.
    // Business 409 (BusinessException withHint) is already rich-toasted by interceptor —
    // firing "并发编辑冲突" dialog on top of an invariant-violation toast confuses the user.
    if (e?.status === 409 && !e?.actionHint) {
      try {
        await ElMessageBox.confirm(
          '此记录已被其他用户修改。点击"确定"将刷新列表并放弃当前编辑。',
          '并发编辑冲突',
          { type: 'warning', confirmButtonText: '刷新列表', cancelButtonText: '取消' }
        )
        currentView.value = 'list'
        loadTableData()
      } catch { /* user cancelled */ }
      return
    }
    if (e?.status === 409) {
      // Business 409 — interceptor already toasted; nothing to add. (Don't fall through
      // to the generic ElMessage.error below or we'd double-toast.)
      return
    }
    ElMessage.error(e?.message || '保存失败')
  }
}

// 工作流操作
async function handleAction(row: TableRow, transition: WorkflowTransition) {
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
    // R40 BUG-6 fix (sister to R26): axios interceptor already toasts BusinessException
    // 409+actionHint. Only fall through to generic toast when there's no actionHint
    // (raw network/unknown errors). Avoids double toast on 404/409 from invariants.
    if (e !== 'cancel' && !e?.actionHint) {
      ElMessage.error(e?.message || '操作失败')
    }
  }
}

// 行点击 → 详情
function handleRowClick(row: TableRow) {
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
        <!-- RBAC UI fix: canWrite=false 时隐藏 "新建" (viewer 不再误看到) -->
        <el-button v-if="canWrite" type="primary" @click="currentView = 'create'">新建</el-button>
        <el-button @click="loadTableData">刷新</el-button>
      </div>
    </div>

    <!-- 列表视图 -->
    <template v-if="currentView === 'list' && config">
      <!-- Bug G fix: keyword search bar (qa-prompt v2.3 Rule 12.1) -->
      <div class="dynamic-search-bar">
        <el-input
          :model-value="searchKeyword"
          placeholder="搜索关键字 (订单号/客户/编号 等)"
          clearable
          style="width: 320px"
          @update:model-value="onSearchInput"
          @clear="resetSearch"
        >
          <template #prefix>
            <el-icon><svg viewBox="0 0 1024 1024" width="14" height="14"><path fill="currentColor" d="M795.904 750.72l124.992 124.928a32 32 0 01-45.248 45.248L750.656 795.904a416 416 0 1145.248-45.248zM480 832a352 352 0 100-704 352 352 0 000 704z"/></svg></el-icon>
          </template>
        </el-input>
        <el-button v-if="searchKeyword" @click="resetSearch">重置</el-button>
      </div>
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
.dynamic-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
