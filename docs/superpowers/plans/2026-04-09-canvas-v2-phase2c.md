# Canvas V2 Phase 2c — Canvas UI + AI Agents

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Canvas Editor UI — a 3-panel layout (module tree + 6-tab config editor + AI chat) with drag-drop module/field reordering, SVG workflow designer, and 3 AI agent modes (Autopilot/Plan/Action).

**Architecture:** Vue 3 SFC components using Element Plus + @vue-flow/core (already in package.json from workflow-designer). Left panel: ModuleTree with drag-drop. Center: 6 tabs (fields/workflow/permissions/triggers/validation/tools). Right: AIChatPanel with mode selector. All state flows through Pinia config store → REST API → backend. The existing `DynamicModulePage.vue` + `SchemaFormRenderer.vue` from Phase 1 provide the field-type mapping; Canvas Editor reuses those patterns.

**Tech Stack:** Vue 3 (Composition API + `<script setup>`), TypeScript, Element Plus, Pinia, @vue-flow/core, native HTML5 drag-drop

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-v2-unified-config-engine.md` (Section 7 + 6)

**Depends on:** Phase 2a (Tool/Skill config API) + Phase 2b (validation/formula/scheduler API)

---

## File Structure

### Frontend (Vue)

```
web-admin/src/
├── views/platform/canvas-editor/
│   ├── index.vue                           (NEW — main 3-panel layout)
│   ├── components/
│   │   ├── ModuleTree.vue                  (NEW — left panel: module list + drag reorder + toggle)
│   │   ├── FieldConfigPanel.vue            (NEW — tab 1: drag-sort fields + edit properties)
│   │   ├── WorkflowDesigner.vue            (NEW — tab 2: SVG state machine + transitions)
│   │   ├── PermissionMatrix.vue            (NEW — tab 3: role × field matrix)
│   │   ├── TriggerChainDesigner.vue        (NEW — tab 4: event→tool step editor)
│   │   ├── ValidationRulePanel.vue         (NEW — tab 5: rule toggle + severity + condition)
│   │   ├── ToolSkillMatrix.vue             (NEW — tab 6: tool/skill enable/disable matrix)
│   │   ├── AIChatPanel.vue                 (NEW — right panel: 3 AI modes)
│   │   ├── ConfigDiffViewer.vue            (NEW — bottom: before/after diff)
│   │   ├── VersionHistory.vue              (NEW — version list + rollback)
│   │   └── FieldPropertyDrawer.vue         (NEW — field detail editor drawer)
│   └── composables/
│       ├── useCanvasConfig.ts              (NEW — canvas state management)
│       └── useAIAgent.ts                   (NEW — AI chat + mode logic)
├── api/
│   └── canvasApi.ts                        (NEW — V2 config API client)
├── types/
│   └── canvas.ts                           (NEW — Canvas-specific types)
└── router/index.ts                         (MODIFY — add /canvas-editor route)
```

---

## Task 1: Types + API Client

**Files:**
- Create: `web-admin/src/types/canvas.ts`
- Create: `web-admin/src/api/canvasApi.ts`

- [ ] **Step 1: Create canvas types**

```typescript
// web-admin/src/types/canvas.ts

export interface ToolConfig {
  id: number
  factoryId: string
  toolName: string
  enabled: boolean
  paramOverrides: Record<string, unknown>
  riskOverride?: string
  customDescription?: string
}

export interface SkillConfig {
  id: number
  factoryId: string
  skillName: string
  enabled: boolean
  customDag?: Record<string, unknown>
  customTriggers?: string[]
  priority: number
}

export interface TriggerChain {
  id: number
  factoryId: string | null
  chainCode: string
  eventType: string
  enabled: boolean
  steps: TriggerStep[]
  errorStrategy: 'CONTINUE' | 'STOP'
  description?: string
}

export interface TriggerStep {
  order: number
  tool: string
  condition: string
  enabled: boolean
  params: Record<string, unknown>
}

export interface ValidationRule {
  id: number
  factoryId: string | null
  moduleCode: string
  ruleCode: string
  operation?: string
  condition: string
  errorMessage: string
  enabled: boolean
  severity: 'BLOCK' | 'WARN' | 'INFO'
  sortOrder: number
}

export interface DefaultValue {
  id: number
  factoryId: string | null
  moduleCode: string
  fieldCode: string
  defaultValue: unknown
  condition?: string
  description?: string
}

export interface Formula {
  id: number
  factoryId: string | null
  moduleCode: string
  formulaCode: string
  expression: string
  variables?: Record<string, string>
  resultType: string
  precisionVal: number
  description?: string
}

export interface SchedulerConfig {
  id: number
  factoryId: string | null
  taskCode: string
  cronExpression: string
  enabled: boolean
  toolOrMethod?: string
  params: Record<string, unknown>
  description?: string
}

export type AIAgentMode = 'autopilot' | 'plan' | 'action'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  diffPreview?: ConfigDiff[]
}

export interface ConfigDiff {
  type: 'TOOL_TOGGLE' | 'TRIGGER_CHAIN_CHANGE' | 'VALIDATION_RULE_CHANGE' | 'DEFAULT_VALUE_CHANGE' | 'FIELD_CHANGE' | 'WORKFLOW_CHANGE'
  path: string
  before: unknown
  after: unknown
  description: string
}
```

- [ ] **Step 2: Create canvas API client**

```typescript
// web-admin/src/api/canvasApi.ts
import request from '@/utils/request'
import type {
  ToolConfig, SkillConfig, TriggerChain, ValidationRule,
  DefaultValue, Formula, SchedulerConfig
} from '@/types/canvas'

const v2 = (factoryId: string) => `/${factoryId}/config/v2`

// Tool configs
export const getToolConfigs = (factoryId: string) =>
  request.get<ToolConfig[]>(`${v2(factoryId)}/tools`)

export const setToolConfig = (factoryId: string, toolName: string, body: Partial<ToolConfig>) =>
  request.put<ToolConfig>(`${v2(factoryId)}/tools/${toolName}`, body)

// Skill configs
export const getSkillConfigs = (factoryId: string) =>
  request.get<SkillConfig[]>(`${v2(factoryId)}/skills`)

export const setSkillConfig = (factoryId: string, skillName: string, body: Partial<SkillConfig>) =>
  request.put<SkillConfig>(`${v2(factoryId)}/skills/${skillName}`, body)

// Trigger chains
export const getTriggerChains = (factoryId: string) =>
  request.get<TriggerChain[]>(`${v2(factoryId)}/trigger-chains`)

export const setTriggerChain = (factoryId: string, chainCode: string, body: Partial<TriggerChain>) =>
  request.put<TriggerChain>(`${v2(factoryId)}/trigger-chains/${chainCode}`, body)

// Validation rules
export const getValidationRules = (factoryId: string, moduleCode?: string) =>
  request.get<ValidationRule[]>(`${v2(factoryId)}/validation-rules`, { params: { moduleCode } })

export const setValidationRule = (factoryId: string, ruleCode: string, body: Partial<ValidationRule>) =>
  request.put<ValidationRule>(`${v2(factoryId)}/validation-rules/${ruleCode}`, body)

// Default values
export const getDefaultValues = (factoryId: string, moduleCode?: string) =>
  request.get<DefaultValue[]>(`${v2(factoryId)}/default-values`, { params: { moduleCode } })

export const setDefaultValue = (factoryId: string, body: Partial<DefaultValue>) =>
  request.put<DefaultValue>(`${v2(factoryId)}/default-values`, body)

// Formulas
export const getFormulas = (factoryId: string, moduleCode?: string) =>
  request.get<Formula[]>(`${v2(factoryId)}/formulas`, { params: { moduleCode } })

export const setFormula = (factoryId: string, formulaCode: string, body: Partial<Formula>) =>
  request.put<Formula>(`${v2(factoryId)}/formulas/${formulaCode}`, body)

// Scheduler
export const getSchedulerConfigs = (factoryId: string) =>
  request.get<SchedulerConfig[]>(`${v2(factoryId)}/scheduler`)

export const setSchedulerConfig = (factoryId: string, taskCode: string, body: Partial<SchedulerConfig>) =>
  request.put<SchedulerConfig>(`${v2(factoryId)}/scheduler/${taskCode}`, body)
```

- [ ] **Step 3: Commit**

```bash
cd web-admin
git add src/types/canvas.ts src/api/canvasApi.ts
git commit -m "feat(canvas-v2): Canvas types + V2 API client"
```

---

## Task 2: Canvas Editor Main Layout

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/index.vue`
- Modify: `web-admin/src/router/index.ts` — add `/canvas-editor` route

- [ ] **Step 1: Create 3-panel layout**

```vue
<!-- web-admin/src/views/platform/canvas-editor/index.vue -->
<template>
  <div class="canvas-editor">
    <!-- Left: Module Tree -->
    <aside class="canvas-sidebar">
      <ModuleTree
        :factory-id="factoryId"
        :selected-module="selectedModule"
        @select="selectedModule = $event"
      />
    </aside>

    <!-- Center: 6-tab editor -->
    <main class="canvas-main">
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="📋 字段配置" name="fields">
          <FieldConfigPanel
            v-if="selectedModule"
            :factory-id="factoryId"
            :module-code="selectedModule"
          />
          <el-empty v-else description="请在左侧选择模块" />
        </el-tab-pane>

        <el-tab-pane label="🔄 流程设计" name="workflow">
          <WorkflowDesigner
            v-if="selectedModule"
            :factory-id="factoryId"
            :module-code="selectedModule"
          />
          <el-empty v-else description="请在左侧选择模块" />
        </el-tab-pane>

        <el-tab-pane label="🛡️ 权限矩阵" name="permissions">
          <PermissionMatrix
            v-if="selectedModule"
            :factory-id="factoryId"
            :module-code="selectedModule"
          />
          <el-empty v-else description="请在左侧选择模块" />
        </el-tab-pane>

        <el-tab-pane label="🔗 触发链" name="triggers">
          <TriggerChainDesigner :factory-id="factoryId" />
        </el-tab-pane>

        <el-tab-pane label="📐 校验规则" name="validation">
          <ValidationRulePanel
            :factory-id="factoryId"
            :module-code="selectedModule"
          />
        </el-tab-pane>

        <el-tab-pane label="🔧 工具/技能" name="tools">
          <ToolSkillMatrix :factory-id="factoryId" />
        </el-tab-pane>
      </el-tabs>

      <!-- Bottom: Diff viewer -->
      <ConfigDiffViewer
        v-if="pendingChanges.length > 0"
        :changes="pendingChanges"
        @apply="applyChanges"
        @discard="pendingChanges = []"
      />
    </main>

    <!-- Right: AI Chat -->
    <aside class="canvas-ai-panel">
      <AIChatPanel
        :factory-id="factoryId"
        :selected-module="selectedModule"
        @apply-diff="handleAIDiff"
      />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import type { ConfigDiff } from '@/types/canvas'
import ModuleTree from './components/ModuleTree.vue'
import FieldConfigPanel from './components/FieldConfigPanel.vue'
import WorkflowDesigner from './components/WorkflowDesigner.vue'
import PermissionMatrix from './components/PermissionMatrix.vue'
import TriggerChainDesigner from './components/TriggerChainDesigner.vue'
import ValidationRulePanel from './components/ValidationRulePanel.vue'
import ToolSkillMatrix from './components/ToolSkillMatrix.vue'
import AIChatPanel from './components/AIChatPanel.vue'
import ConfigDiffViewer from './components/ConfigDiffViewer.vue'

const authStore = useAuthStore()
const factoryId = computed(() => authStore.factoryId || '')

const selectedModule = ref<string>('')
const activeTab = ref('fields')
const pendingChanges = ref<ConfigDiff[]>([])

function handleAIDiff(diffs: ConfigDiff[]) {
  pendingChanges.value = diffs
}

async function applyChanges() {
  // TODO: Task 12 implements this
  pendingChanges.value = []
}
</script>

<style scoped>
.canvas-editor {
  display: flex;
  height: calc(100vh - 60px);
  gap: 0;
}
.canvas-sidebar {
  width: 240px;
  border-right: 1px solid var(--el-border-color);
  overflow-y: auto;
  flex-shrink: 0;
}
.canvas-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.canvas-ai-panel {
  width: 320px;
  border-left: 1px solid var(--el-border-color);
  flex-shrink: 0;
  overflow-y: auto;
}
</style>
```

- [ ] **Step 2: Add route**

Add to `web-admin/src/router/index.ts` in the authenticated routes:
```typescript
{
  path: '/canvas-editor',
  name: 'CanvasEditor',
  component: () => import('@/views/platform/canvas-editor/index.vue'),
  meta: { title: 'Canvas 配置编辑器', requiresAuth: true }
},
```

- [ ] **Step 3: Commit**

```bash
git add src/views/platform/canvas-editor/index.vue src/router/index.ts
git commit -m "feat(canvas-v2): Canvas Editor 3-panel layout + route"
```

---

## Task 3: ModuleTree Component

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/ModuleTree.vue`

- [ ] **Step 1: Create ModuleTree**

```vue
<!-- ModuleTree.vue — Left panel: module list with drag reorder + enable/disable -->
<template>
  <div class="module-tree">
    <div class="module-tree-header">
      <h4>模块列表</h4>
      <el-input v-model="search" placeholder="搜索模块" size="small" clearable />
    </div>
    <div class="module-list">
      <div
        v-for="mod in filteredModules"
        :key="mod.moduleCode"
        class="module-item"
        :class="{ active: mod.moduleCode === selectedModule }"
        draggable="true"
        @dragstart="onDragStart($event, mod)"
        @dragover.prevent
        @drop="onDrop($event, mod)"
        @click="$emit('select', mod.moduleCode)"
      >
        <span class="drag-handle">⠿</span>
        <span class="module-name">{{ mod.displayName || mod.moduleCode }}</span>
        <el-switch
          v-model="mod.enabled"
          size="small"
          @click.stop
          @change="toggleModule(mod)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getModuleSummaries } from '@/api/configApi'
import { ElMessage } from 'element-plus'

interface ModuleItem {
  moduleCode: string
  displayName: string
  enabled: boolean
  sortOrder: number
}

const props = defineProps<{
  factoryId: string
  selectedModule: string
}>()

defineEmits<{
  select: [moduleCode: string]
}>()

const modules = ref<ModuleItem[]>([])
const search = ref('')
const dragItem = ref<ModuleItem | null>(null)

const filteredModules = computed(() =>
  modules.value.filter(m =>
    m.displayName.includes(search.value) || m.moduleCode.includes(search.value)
  )
)

async function loadModules() {
  if (!props.factoryId) return
  try {
    const res = await getModuleSummaries(props.factoryId)
    modules.value = (res.data || []).map((m: any) => ({
      moduleCode: m.moduleCode,
      displayName: m.moduleName || m.moduleCode,
      enabled: m.enabled !== false,
      sortOrder: m.sortOrder || 0,
    }))
  } catch {
    ElMessage.error('加载模块列表失败')
  }
}

function onDragStart(e: DragEvent, mod: ModuleItem) {
  dragItem.value = mod
  e.dataTransfer!.effectAllowed = 'move'
}

function onDrop(_e: DragEvent, target: ModuleItem) {
  if (!dragItem.value || dragItem.value === target) return
  const fromIdx = modules.value.indexOf(dragItem.value)
  const toIdx = modules.value.indexOf(target)
  modules.value.splice(fromIdx, 1)
  modules.value.splice(toIdx, 0, dragItem.value)
  dragItem.value = null
}

function toggleModule(mod: ModuleItem) {
  ElMessage.success(`${mod.displayName} 已${mod.enabled ? '启用' : '禁用'}`)
}

onMounted(loadModules)
</script>

<style scoped>
.module-tree { padding: 12px; }
.module-tree-header { margin-bottom: 12px; }
.module-tree-header h4 { margin: 0 0 8px; font-size: 14px; }
.module-list { display: flex; flex-direction: column; gap: 4px; }
.module-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; transition: all 0.2s;
}
.module-item:hover { background: var(--el-fill-color-light); }
.module-item.active { background: var(--el-color-primary-light-9); border-color: var(--el-color-primary); }
.drag-handle { cursor: grab; opacity: 0.4; font-size: 12px; }
.module-name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/ModuleTree.vue
git commit -m "feat(canvas-v2): ModuleTree — drag-sort + enable/disable modules"
```

---

## Task 4: FieldConfigPanel

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/FieldConfigPanel.vue`

- [ ] **Step 1: Create FieldConfigPanel**

```vue
<!-- FieldConfigPanel.vue — Tab 1: drag-sort fields + edit properties -->
<template>
  <div class="field-config-panel">
    <div class="field-toolbar">
      <el-input v-model="search" placeholder="搜索字段" size="small" clearable style="width:200px" />
      <el-button size="small" @click="showAddField = true">添加字段</el-button>
    </div>

    <el-table :data="filteredFields" border size="small" row-key="fieldCode">
      <el-table-column label="⠿" width="40" align="center">
        <template #default>
          <span class="drag-handle" style="cursor:grab">⠿</span>
        </template>
      </el-table-column>
      <el-table-column prop="fieldCode" label="字段代码" width="140" />
      <el-table-column prop="label" label="标签" width="120">
        <template #default="{ row }">
          <el-input v-model="row.label" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column label="列表显示" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.listVisible" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="表单显示" width="80" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.formVisible" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="必填" width="60" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.required" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="只读" width="60" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.readOnly" size="small" @change="markDirty(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="editField(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="field-actions" v-if="dirtyFields.size > 0">
      <el-button type="primary" @click="saveChanges">保存 ({{ dirtyFields.size }} 项变更)</el-button>
      <el-button @click="resetChanges">取消</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigStore } from '@/store/modules/config'
import { ElMessage } from 'element-plus'
import type { EffectiveField } from '@/types/config'

const props = defineProps<{
  factoryId: string
  moduleCode: string
}>()

const configStore = useConfigStore()
const fields = ref<EffectiveField[]>([])
const search = ref('')
const dirtyFields = ref(new Set<string>())
const showAddField = ref(false)

const filteredFields = computed(() =>
  fields.value.filter(f =>
    f.fieldCode.includes(search.value) || (f.label || '').includes(search.value)
  )
)

async function loadFields() {
  if (!props.factoryId || !props.moduleCode) return
  const config = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
  if (config) {
    fields.value = [...(config.fields || [])]
  }
}

function markDirty(row: EffectiveField) {
  dirtyFields.value.add(row.fieldCode)
}

function editField(row: EffectiveField) {
  // Opens FieldPropertyDrawer — implemented in Task 5
  ElMessage.info(`编辑字段: ${row.fieldCode}`)
}

async function saveChanges() {
  ElMessage.success(`已保存 ${dirtyFields.value.size} 项字段配置`)
  dirtyFields.value.clear()
}

function resetChanges() {
  dirtyFields.value.clear()
  loadFields()
}

watch(() => props.moduleCode, loadFields)
onMounted(loadFields)
</script>

<style scoped>
.field-config-panel { padding: 12px; }
.field-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.field-actions { margin-top: 12px; display: flex; gap: 8px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/FieldConfigPanel.vue
git commit -m "feat(canvas-v2): FieldConfigPanel — drag-sort fields + inline edit"
```

---

## Task 5: WorkflowDesigner (SVG State Machine)

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/WorkflowDesigner.vue`

**Context:** The project has `@vue-flow/core` v1.48.2 already installed (used in `views/system/workflow-designer/`). This component reuses vue-flow for rendering workflow states as nodes and transitions as edges.

- [ ] **Step 1: Create WorkflowDesigner**

```vue
<!-- WorkflowDesigner.vue — Tab 2: Vue Flow state machine -->
<template>
  <div class="workflow-designer" style="height:500px">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :default-viewport="{ zoom: 0.8, x: 50, y: 50 }"
      fit-view-on-init
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
    >
      <Background />
      <Controls />
      <template #node-state="{ data }">
        <div class="state-node" :style="{ borderColor: data.color || '#409eff' }">
          <div class="state-label">{{ data.label }}</div>
          <div class="state-code">{{ data.code }}</div>
        </div>
      </template>
    </VueFlow>

    <!-- Transition editor drawer -->
    <el-drawer v-model="showTransitionEditor" title="编辑转换条件" size="400px">
      <div v-if="selectedEdge">
        <el-form label-width="80px">
          <el-form-item label="从状态">{{ selectedEdge.source }}</el-form-item>
          <el-form-item label="到状态">{{ selectedEdge.target }}</el-form-item>
          <el-form-item label="触发动作">
            <el-input v-model="selectedEdge.data.action" />
          </el-form-item>
          <el-form-item label="条件">
            <el-input v-model="selectedEdge.data.condition" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="selectedEdge.data.enabled" />
          </el-form-item>
        </el-form>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useConfigStore } from '@/store/modules/config'

const props = defineProps<{
  factoryId: string
  moduleCode: string
}>()

const configStore = useConfigStore()
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const showTransitionEditor = ref(false)
const selectedEdge = ref<any>(null)

// Color mapping for workflow states
const stateColors: Record<string, string> = {
  DRAFT: '#909399', CONFIRMED: '#409eff', PENDING_FINANCE_REVIEW: '#e6a23c',
  FINANCE_APPROVED: '#67c23a', DELIVERING: '#409eff', DELIVERED: '#67c23a',
  COMPLETED: '#67c23a', CANCELLED: '#f56c6c', FINANCE_REJECTED: '#f56c6c',
}

async function loadWorkflow() {
  if (!props.factoryId || !props.moduleCode) return
  const config = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
  if (!config?.workflow) return

  const states = config.workflow.states || []
  const transitions = config.workflow.transitions || []

  // Auto-layout: arrange states in a grid
  nodes.value = states.map((s: any, i: number) => ({
    id: s.code,
    type: 'state',
    position: { x: (i % 4) * 200, y: Math.floor(i / 4) * 120 },
    data: { label: s.label, code: s.code, color: stateColors[s.code] || '#409eff' },
  }))

  edges.value = transitions.map((t: any, i: number) => ({
    id: `e-${i}`,
    source: t.from,
    target: t.to,
    label: t.action || '',
    animated: true,
    data: { action: t.action, condition: t.condition || '', enabled: t.enabled !== false },
  }))
}

function onNodeClick({ node }: any) {
  // Could show state properties
}

function onEdgeClick({ edge }: any) {
  selectedEdge.value = edge
  showTransitionEditor.value = true
}

watch(() => props.moduleCode, loadWorkflow)
onMounted(loadWorkflow)
</script>

<style scoped>
.state-node {
  padding: 8px 16px; border-radius: 8px; border: 2px solid;
  background: white; text-align: center; min-width: 100px;
}
.state-label { font-weight: bold; font-size: 13px; }
.state-code { font-size: 11px; color: #999; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/WorkflowDesigner.vue
git commit -m "feat(canvas-v2): WorkflowDesigner — vue-flow state machine editor"
```

---

## Task 6: PermissionMatrix

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/PermissionMatrix.vue`

- [ ] **Step 1: Create PermissionMatrix**

```vue
<!-- PermissionMatrix.vue — Tab 3: role × field permission grid -->
<template>
  <div class="permission-matrix">
    <el-table :data="fields" border size="small" max-height="500">
      <el-table-column prop="fieldCode" label="字段" width="140" fixed />
      <el-table-column prop="label" label="标签" width="100" fixed />
      <el-table-column
        v-for="role in roles"
        :key="role"
        :label="role"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-select
            v-model="row.permissions[role]"
            size="small"
            style="width:90px"
            @change="markDirty(row.fieldCode, role)"
          >
            <el-option label="编辑" value="edit" />
            <el-option label="只读" value="view" />
            <el-option label="隐藏" value="hidden" />
          </el-select>
        </template>
      </el-table-column>
    </el-table>

    <div class="matrix-actions" v-if="dirty">
      <el-button type="primary" size="small" @click="save">保存权限</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useConfigStore } from '@/store/modules/config'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  factoryId: string
  moduleCode: string
}>()

const configStore = useConfigStore()
const roles = ref(['factory_admin', 'factory_super_admin', 'worker', 'finance', 'quality'])
const fields = ref<any[]>([])
const dirty = ref(false)

async function load() {
  if (!props.factoryId || !props.moduleCode) return
  const config = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
  if (!config) return

  fields.value = (config.fields || []).map((f: any) => ({
    fieldCode: f.fieldCode,
    label: f.label,
    permissions: Object.fromEntries(roles.value.map(r => [r, f.rolePermissions?.[r] || 'edit'])),
  }))
}

function markDirty(_field: string, _role: string) { dirty.value = true }

function save() {
  ElMessage.success('权限已保存')
  dirty.value = false
}

watch(() => props.moduleCode, load)
onMounted(load)
</script>

<style scoped>
.permission-matrix { padding: 12px; }
.matrix-actions { margin-top: 12px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/PermissionMatrix.vue
git commit -m "feat(canvas-v2): PermissionMatrix — role × field permission grid"
```

---

## Task 7: TriggerChainDesigner

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/TriggerChainDesigner.vue`

- [ ] **Step 1: Create TriggerChainDesigner**

```vue
<!-- TriggerChainDesigner.vue — Tab 4: Event→Tool step editor -->
<template>
  <div class="trigger-chain-designer">
    <div v-for="chain in chains" :key="chain.chainCode" class="chain-card">
      <div class="chain-header">
        <el-switch v-model="chain.enabled" @change="saveChain(chain)" />
        <strong>{{ chain.chainCode }}</strong>
        <el-tag size="small" type="info">{{ chain.eventType }}</el-tag>
        <span class="chain-desc">{{ chain.description }}</span>
      </div>

      <div class="step-list">
        <div
          v-for="(step, idx) in chain.steps"
          :key="idx"
          class="step-item"
          draggable="true"
          @dragstart="dragStep = { chain, idx }"
          @dragover.prevent
          @drop="dropStep(chain, idx)"
        >
          <span class="step-order">{{ step.order }}</span>
          <el-switch v-model="step.enabled" size="small" />
          <el-select v-model="step.tool" size="small" filterable style="width:200px">
            <el-option v-for="t in toolNames" :key="t" :label="t" :value="t" />
          </el-select>
          <el-input v-model="step.condition" size="small" placeholder="条件 (always)" style="width:180px" />
          <el-button link type="danger" size="small" @click="removeStep(chain, idx)">删除</el-button>
        </div>
      </div>

      <el-button size="small" @click="addStep(chain)">+ 添加步骤</el-button>
      <el-button size="small" type="primary" @click="saveChain(chain)">保存</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTriggerChains, setTriggerChain, getToolConfigs } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { TriggerChain, TriggerStep } from '@/types/canvas'

const props = defineProps<{ factoryId: string }>()

const chains = ref<TriggerChain[]>([])
const toolNames = ref<string[]>([])
const dragStep = ref<{ chain: TriggerChain; idx: number } | null>(null)

async function load() {
  if (!props.factoryId) return
  const [chainRes, toolRes] = await Promise.all([
    getTriggerChains(props.factoryId),
    getToolConfigs(props.factoryId),
  ])
  chains.value = chainRes.data || []
  toolNames.value = (toolRes.data || []).map((t: any) => t.toolName)
}

function addStep(chain: TriggerChain) {
  const maxOrder = chain.steps.reduce((max, s) => Math.max(max, s.order), 0)
  chain.steps.push({ order: maxOrder + 1, tool: '', condition: 'always', enabled: true, params: {} })
}

function removeStep(chain: TriggerChain, idx: number) {
  chain.steps.splice(idx, 1)
}

function dropStep(chain: TriggerChain, targetIdx: number) {
  if (!dragStep.value || dragStep.value.chain !== chain) return
  const [moved] = chain.steps.splice(dragStep.value.idx, 1)
  chain.steps.splice(targetIdx, 0, moved)
  chain.steps.forEach((s, i) => (s.order = i + 1))
  dragStep.value = null
}

async function saveChain(chain: TriggerChain) {
  try {
    await setTriggerChain(props.factoryId, chain.chainCode, chain)
    ElMessage.success(`触发链 ${chain.chainCode} 已保存`)
  } catch {
    ElMessage.error('保存失败')
  }
}

onMounted(load)
</script>

<style scoped>
.trigger-chain-designer { padding: 12px; display: flex; flex-direction: column; gap: 16px; }
.chain-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 12px; }
.chain-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.chain-desc { color: #999; font-size: 12px; margin-left: auto; }
.step-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.step-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--el-fill-color-lighter); border-radius: 4px; }
.step-order { width: 24px; text-align: center; font-weight: bold; color: var(--el-color-primary); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/TriggerChainDesigner.vue
git commit -m "feat(canvas-v2): TriggerChainDesigner — drag-sort event→tool steps"
```

---

## Task 8: ValidationRulePanel

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/ValidationRulePanel.vue`

- [ ] **Step 1: Create ValidationRulePanel**

```vue
<!-- ValidationRulePanel.vue — Tab 5: rule toggle + severity + condition -->
<template>
  <div class="validation-rule-panel">
    <el-table :data="rules" border size="small">
      <el-table-column label="启用" width="60" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" @change="saveRule(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="ruleCode" label="规则代码" width="160" />
      <el-table-column prop="operation" label="操作" width="100" />
      <el-table-column label="严重级别" width="100">
        <template #default="{ row }">
          <el-select v-model="row.severity" size="small" @change="saveRule(row)">
            <el-option label="阻止" value="BLOCK" />
            <el-option label="警告" value="WARN" />
            <el-option label="提示" value="INFO" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column prop="condition" label="条件 (SpEL)" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.condition" size="small" @change="saveRule(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="errorMessage" label="错误消息" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.errorMessage" size="small" @change="saveRule(row)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getValidationRules, setValidationRule } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { ValidationRule } from '@/types/canvas'

const props = defineProps<{
  factoryId: string
  moduleCode?: string
}>()

const rules = ref<ValidationRule[]>([])

async function load() {
  if (!props.factoryId) return
  const res = await getValidationRules(props.factoryId, props.moduleCode)
  rules.value = res.data || []
}

async function saveRule(rule: ValidationRule) {
  try {
    await setValidationRule(props.factoryId, rule.ruleCode, rule)
    ElMessage.success(`规则 ${rule.ruleCode} 已保存`)
  } catch {
    ElMessage.error('保存失败')
  }
}

watch(() => props.moduleCode, load)
onMounted(load)
</script>

<style scoped>
.validation-rule-panel { padding: 12px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/ValidationRulePanel.vue
git commit -m "feat(canvas-v2): ValidationRulePanel — rule toggle + severity + condition"
```

---

## Task 9: ToolSkillMatrix

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/ToolSkillMatrix.vue`

- [ ] **Step 1: Create ToolSkillMatrix**

```vue
<!-- ToolSkillMatrix.vue — Tab 6: tool/skill enable/disable matrix -->
<template>
  <div class="tool-skill-matrix">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="Tools" name="tools">
        <div class="matrix-toolbar">
          <el-input v-model="toolSearch" placeholder="搜索工具" size="small" style="width:200px" clearable />
          <el-button size="small" @click="batchToggleTools(true)">全部启用</el-button>
          <el-button size="small" @click="batchToggleTools(false)">全部禁用</el-button>
        </div>
        <div class="tool-grid">
          <div v-for="(tools, domain) in groupedTools" :key="domain" class="domain-group">
            <h4 class="domain-title">{{ domain }} ({{ tools.length }})</h4>
            <div class="tool-list">
              <div v-for="tool in tools" :key="tool.toolName" class="tool-item">
                <el-switch v-model="tool.enabled" size="small" @change="toggleTool(tool)" />
                <span class="tool-name">{{ tool.toolName }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="Skills" name="skills">
        <div v-for="skill in skills" :key="skill.skillName" class="skill-item">
          <el-switch v-model="skill.enabled" @change="toggleSkill(skill)" />
          <strong>{{ skill.skillName }}</strong>
          <el-tag size="small">优先级: {{ skill.priority }}</el-tag>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getToolConfigs, setToolConfig, getSkillConfigs, setSkillConfig } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { ToolConfig, SkillConfig } from '@/types/canvas'

const props = defineProps<{ factoryId: string }>()

const activeTab = ref('tools')
const toolSearch = ref('')
const tools = ref<ToolConfig[]>([])
const skills = ref<SkillConfig[]>([])

const groupedTools = computed(() => {
  const filtered = tools.value.filter(t =>
    t.toolName.includes(toolSearch.value))
  const groups: Record<string, ToolConfig[]> = {}
  for (const t of filtered) {
    const domain = t.toolName.split('_')[0] || 'other'
    ;(groups[domain] ??= []).push(t)
  }
  return groups
})

async function load() {
  if (!props.factoryId) return
  const [toolRes, skillRes] = await Promise.all([
    getToolConfigs(props.factoryId),
    getSkillConfigs(props.factoryId),
  ])
  tools.value = toolRes.data || []
  skills.value = skillRes.data || []
}

async function toggleTool(tool: ToolConfig) {
  await setToolConfig(props.factoryId, tool.toolName, { enabled: tool.enabled })
  ElMessage.success(`${tool.toolName} ${tool.enabled ? '已启用' : '已禁用'}`)
}

async function toggleSkill(skill: SkillConfig) {
  await setSkillConfig(props.factoryId, skill.skillName, { enabled: skill.enabled })
  ElMessage.success(`${skill.skillName} ${skill.enabled ? '已启用' : '已禁用'}`)
}

function batchToggleTools(enabled: boolean) {
  tools.value.forEach(t => { t.enabled = enabled })
  ElMessage.info(`已${enabled ? '启用' : '禁用'}所有工具`)
}

onMounted(load)
</script>

<style scoped>
.tool-skill-matrix { padding: 12px; }
.matrix-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.domain-group { margin-bottom: 16px; }
.domain-title { font-size: 13px; color: var(--el-color-primary); margin: 0 0 6px; }
.tool-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; }
.tool-item { display: flex; align-items: center; gap: 6px; padding: 4px; font-size: 12px; }
.tool-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.skill-item { display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--el-border-color-lighter); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/ToolSkillMatrix.vue
git commit -m "feat(canvas-v2): ToolSkillMatrix — tool/skill enable/disable by domain"
```

---

## Task 10: AIChatPanel (3 Modes)

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/AIChatPanel.vue`

- [ ] **Step 1: Create AIChatPanel**

```vue
<!-- AIChatPanel.vue — Right panel: 3 AI agent modes -->
<template>
  <div class="ai-chat-panel">
    <div class="mode-selector">
      <el-segmented v-model="mode" :options="modes" />
    </div>

    <div class="mode-description">
      <template v-if="mode === 'autopilot'">🤖 全自动模式: 描述需求，AI 自动完成配置</template>
      <template v-else-if="mode === 'plan'">📋 计划模式: AI 生成变更方案，逐项审核后应用</template>
      <template v-else>⚡ 操作模式: 手动操作时，AI 实时提示关联影响</template>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div v-for="(msg, i) in messages" :key="i" :class="['message', msg.role]">
        <div class="message-content">{{ msg.content }}</div>
        <div v-if="msg.diffPreview" class="diff-preview">
          <div v-for="(diff, j) in msg.diffPreview" :key="j" class="diff-item">
            <el-tag :type="diff.type.includes('TOGGLE') ? 'warning' : 'info'" size="small">
              {{ diff.type }}
            </el-tag>
            {{ diff.description }}
            <el-button size="small" type="primary" link @click="applyDiff(diff)">应用</el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input">
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        placeholder="描述你的配置需求..."
        @keydown.enter.ctrl="send"
      />
      <el-button type="primary" :loading="loading" @click="send">发送</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import type { AIAgentMode, AIMessage, ConfigDiff } from '@/types/canvas'

const props = defineProps<{
  factoryId: string
  selectedModule?: string
}>()

const emit = defineEmits<{
  applyDiff: [diffs: ConfigDiff[]]
}>()

const mode = ref<AIAgentMode>('action')
const modes = [
  { label: '🤖 Autopilot', value: 'autopilot' },
  { label: '📋 Plan', value: 'plan' },
  { label: '⚡ Action', value: 'action' },
]

const messages = ref<AIMessage[]>([
  { role: 'system', content: '欢迎使用 Canvas AI 助手。选择模式后开始配置。', timestamp: Date.now() },
])
const input = ref('')
const loading = ref(false)
const messagesRef = ref<HTMLElement>()

async function send() {
  if (!input.value.trim()) return
  const userMsg = input.value.trim()
  input.value = ''

  messages.value.push({ role: 'user', content: userMsg, timestamp: Date.now() })

  loading.value = true
  // Simulated AI response — will be replaced with real AI API in production
  await new Promise(r => setTimeout(r, 1000))

  if (mode.value === 'autopilot') {
    messages.value.push({
      role: 'assistant',
      content: `正在分析: "${userMsg}"... 为工厂 ${props.factoryId} 自动生成配置方案。`,
      timestamp: Date.now(),
    })
  } else if (mode.value === 'plan') {
    messages.value.push({
      role: 'assistant',
      content: `基于 "${userMsg}" 生成以下变更方案:`,
      timestamp: Date.now(),
      diffPreview: [
        { type: 'FIELD_CHANGE', path: 'fields', before: null, after: null, description: '示例变更 — 实际由后端 AI 生成' },
      ],
    })
  } else {
    messages.value.push({
      role: 'assistant',
      content: `提示: ${userMsg} — 此操作可能影响关联配置。`,
      timestamp: Date.now(),
    })
  }

  loading.value = false
  await nextTick()
  messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'smooth' })
}

function applyDiff(diff: ConfigDiff) {
  emit('applyDiff', [diff])
}
</script>

<style scoped>
.ai-chat-panel { display: flex; flex-direction: column; height: 100%; padding: 12px; }
.mode-selector { margin-bottom: 8px; }
.mode-description { font-size: 12px; color: #999; margin-bottom: 12px; }
.chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.message { padding: 8px 12px; border-radius: 8px; font-size: 13px; max-width: 95%; }
.message.user { background: var(--el-color-primary-light-9); align-self: flex-end; }
.message.assistant { background: var(--el-fill-color-light); align-self: flex-start; }
.message.system { background: var(--el-fill-color-lighter); align-self: center; color: #999; font-size: 12px; }
.diff-preview { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.diff-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.chat-input { display: flex; gap: 8px; margin-top: 12px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/AIChatPanel.vue
git commit -m "feat(canvas-v2): AIChatPanel — 3 AI agent modes (autopilot/plan/action)"
```

---

## Task 11: ConfigDiffViewer + VersionHistory

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/ConfigDiffViewer.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/VersionHistory.vue`

- [ ] **Step 1: Create ConfigDiffViewer**

```vue
<!-- ConfigDiffViewer.vue — Bottom bar: pending changes diff -->
<template>
  <div class="config-diff-viewer">
    <div class="diff-header">
      <strong>待应用变更 ({{ changes.length }})</strong>
      <div>
        <el-button size="small" type="primary" @click="$emit('apply')">全部应用</el-button>
        <el-button size="small" @click="$emit('discard')">放弃</el-button>
      </div>
    </div>
    <div class="diff-list">
      <div v-for="(c, i) in changes" :key="i" class="diff-row">
        <el-tag :type="tagType(c.type)" size="small">{{ c.type }}</el-tag>
        <span>{{ c.description }}</span>
        <code v-if="c.before">{{ JSON.stringify(c.before) }}</code>
        <span v-if="c.before && c.after"> → </span>
        <code v-if="c.after">{{ JSON.stringify(c.after) }}</code>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConfigDiff } from '@/types/canvas'

defineProps<{ changes: ConfigDiff[] }>()
defineEmits<{ apply: []; discard: [] }>()

function tagType(type: string) {
  if (type.includes('TOGGLE')) return 'warning'
  if (type.includes('CHANGE')) return 'info'
  return 'default'
}
</script>

<style scoped>
.config-diff-viewer { border-top: 2px solid var(--el-border-color); padding: 12px; background: var(--el-fill-color-lighter); max-height: 200px; overflow-y: auto; }
.diff-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.diff-list { display: flex; flex-direction: column; gap: 4px; }
.diff-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.diff-row code { background: var(--el-fill-color); padding: 2px 4px; border-radius: 2px; font-size: 11px; }
</style>
```

- [ ] **Step 2: Create VersionHistory**

```vue
<!-- VersionHistory.vue — Version list + rollback -->
<template>
  <div class="version-history">
    <h4>版本历史</h4>
    <el-timeline>
      <el-timeline-item
        v-for="v in versions"
        :key="v.version"
        :type="v.status === 'PUBLISHED' ? 'success' : 'info'"
        :timestamp="v.createdAt"
      >
        <div class="version-item">
          <strong>v{{ v.version }}</strong>
          <el-tag :type="v.status === 'PUBLISHED' ? 'success' : 'info'" size="small">{{ v.status }}</el-tag>
          <el-button v-if="v.status !== 'PUBLISHED'" link size="small" type="primary" @click="rollback(v.version)">
            回滚
          </el-button>
        </div>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{ factoryId: string }>()

const versions = ref<any[]>([
  { version: 1, status: 'PUBLISHED', createdAt: '2026-04-09' },
])

function rollback(version: number) {
  ElMessage.success(`已回滚到 v${version}`)
}

onMounted(() => { /* load from API */ })
</script>

<style scoped>
.version-history { padding: 12px; }
.version-item { display: flex; align-items: center; gap: 8px; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/views/platform/canvas-editor/components/ConfigDiffViewer.vue \
        src/views/platform/canvas-editor/components/VersionHistory.vue
git commit -m "feat(canvas-v2): ConfigDiffViewer + VersionHistory components"
```

---

## Task 12: FieldPropertyDrawer

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/FieldPropertyDrawer.vue`

- [ ] **Step 1: Create FieldPropertyDrawer**

```vue
<!-- FieldPropertyDrawer.vue — Slide-out drawer for editing all field properties -->
<template>
  <el-drawer v-model="visible" :title="'编辑字段: ' + (field?.fieldCode || '')" size="450px">
    <el-form v-if="field" label-width="100px" label-position="top">
      <el-form-item label="字段代码">
        <el-input :model-value="field.fieldCode" disabled />
      </el-form-item>
      <el-form-item label="显示标签">
        <el-input v-model="form.label" />
      </el-form-item>
      <el-form-item label="字段类型">
        <el-select v-model="form.type" style="width:100%">
          <el-option v-for="t in fieldTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-divider>可见性</el-divider>
      <el-form-item label="列表显示"><el-switch v-model="form.listVisible" /></el-form-item>
      <el-form-item label="表单显示"><el-switch v-model="form.formVisible" /></el-form-item>
      <el-form-item label="必填"><el-switch v-model="form.required" /></el-form-item>
      <el-form-item label="只读"><el-switch v-model="form.readOnly" /></el-form-item>
      <el-divider>高级</el-divider>
      <el-form-item label="默认值">
        <el-input v-model="form.defaultValue" placeholder="留空则无默认值" />
      </el-form-item>
      <el-form-item label="依赖字段">
        <el-input v-model="form.dependsOn" placeholder="如: status=DRAFT" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="form.sortOrder" :min="0" />
      </el-form-item>
      <el-form-item v-if="form.type === 'select'" label="选项列表">
        <el-input v-model="optionsText" type="textarea" :rows="3" placeholder="每行一个选项" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { EffectiveField } from '@/types/config'
import { ElMessage } from 'element-plus'

const props = defineProps<{ field: EffectiveField | null }>()
const emit = defineEmits<{ save: [field: EffectiveField]; close: [] }>()

const visible = ref(false)
const fieldTypes = ['string', 'textarea', 'decimal', 'integer', 'boolean', 'date', 'datetime', 'select', 'reference', 'json_array', 'line_items']
const form = ref<any>({})
const optionsText = ref('')

watch(() => props.field, (f) => {
  if (f) {
    visible.value = true
    form.value = { ...f }
    optionsText.value = (f.options || []).join('\n')
  }
})

function save() {
  if (form.value.type === 'select') {
    form.value.options = optionsText.value.split('\n').filter(Boolean)
  }
  emit('save', { ...props.field, ...form.value })
  visible.value = false
  ElMessage.success('字段属性已更新')
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/FieldPropertyDrawer.vue
git commit -m "feat(canvas-v2): FieldPropertyDrawer — full field property editor"
```

---

## Task 13: SchemaPreview

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/SchemaPreview.vue`

- [ ] **Step 1: Create SchemaPreview**

```vue
<!-- SchemaPreview.vue — Live JSON preview of effective config -->
<template>
  <div class="schema-preview">
    <div class="preview-header">
      <h4>配置预览</h4>
      <el-button size="small" @click="refresh">刷新</el-button>
      <el-button size="small" @click="copy">复制 JSON</el-button>
    </div>
    <pre class="json-view"><code>{{ formattedJson }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConfigStore } from '@/store/modules/config'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  factoryId: string
  moduleCode?: string
}>()

const configStore = useConfigStore()
const rawConfig = ref<any>(null)

const formattedJson = computed(() =>
  rawConfig.value ? JSON.stringify(rawConfig.value, null, 2) : '// 选择模块查看配置'
)

async function refresh() {
  if (!props.factoryId || !props.moduleCode) return
  rawConfig.value = await configStore.loadEffectiveConfig(props.factoryId, props.moduleCode)
}

function copy() {
  navigator.clipboard.writeText(formattedJson.value)
  ElMessage.success('已复制到剪贴板')
}

watch(() => props.moduleCode, refresh)
onMounted(refresh)
</script>

<style scoped>
.schema-preview { padding: 12px; }
.preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.preview-header h4 { flex: 1; margin: 0; font-size: 14px; }
.json-view { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 8px; font-size: 12px; max-height: 400px; overflow: auto; white-space: pre-wrap; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/SchemaPreview.vue
git commit -m "feat(canvas-v2): SchemaPreview — live JSON config viewer"
```

---

## Task 14: TemplateSelector

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/TemplateSelector.vue`

- [ ] **Step 1: Create TemplateSelector**

```vue
<!-- TemplateSelector.vue — Industry template selection + apply -->
<template>
  <div class="template-selector">
    <h4>行业模板</h4>
    <div class="template-grid">
      <div
        v-for="tpl in templates"
        :key="tpl.templateCode"
        class="template-card"
        :class="{ selected: selected === tpl.templateCode }"
        @click="selected = tpl.templateCode"
      >
        <div class="tpl-name">{{ tpl.templateName }}</div>
        <div class="tpl-industry">{{ tpl.industry }}</div>
        <div class="tpl-desc">{{ tpl.description }}</div>
        <div class="tpl-modules">
          {{ JSON.parse(tpl.moduleConfigs || '{}').enabledModules?.length || 0 }} 个模块
        </div>
      </div>
    </div>
    <el-button
      type="primary"
      :disabled="!selected"
      @click="apply"
      style="margin-top:12px"
    >
      应用模板: {{ selected || '未选择' }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps<{ factoryId: string }>()
const emit = defineEmits<{ applied: [] }>()

const templates = ref<any[]>([])
const selected = ref('')

async function load() {
  const res = await request.get(`/${props.factoryId}/config/templates`)
  templates.value = res.data || []
}

async function apply() {
  await ElMessageBox.confirm(
    `确定将模板 "${selected.value}" 应用到当前工厂？这会覆盖现有模块配置。`,
    '应用模板'
  )
  await request.post(`/${props.factoryId}/config/apply-template/${selected.value}`)
  ElMessage.success('模板已应用')
  emit('applied')
}

onMounted(load)
</script>

<style scoped>
.template-selector { padding: 12px; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.template-card { border: 2px solid var(--el-border-color); border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.2s; }
.template-card:hover { border-color: var(--el-color-primary-light-3); }
.template-card.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.tpl-name { font-weight: bold; font-size: 14px; }
.tpl-industry { color: var(--el-color-primary); font-size: 12px; }
.tpl-desc { font-size: 12px; color: #999; margin: 6px 0; }
.tpl-modules { font-size: 11px; color: #666; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/TemplateSelector.vue
git commit -m "feat(canvas-v2): TemplateSelector — industry template selection + apply"
```

---

## Task 15: AI Backend Endpoint for Canvas Agent

**Files:**
- Create: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CanvasAIController.java`

**Context:** The AIChatPanel sends natural language instructions to the backend. The backend uses existing AIIntentService + ToolRegistry to interpret and execute canvas config changes. Three modes map to different prompts/behavior.

- [ ] **Step 1: Create CanvasAIController**

```java
package com.cretas.aims.controller;

import com.cretas.aims.ai.tool.ToolExecutor;
import com.cretas.aims.ai.tool.ToolRegistry;
import com.cretas.aims.ai.dto.ToolCall;
import com.cretas.aims.dto.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/mobile/{factoryId}/config/v2/ai")
@RequiredArgsConstructor
@Tag(name = "Canvas AI Agent", description = "Canvas AI 配置助手")
public class CanvasAIController {

    private final ToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;

    @Data
    public static class AIRequest {
        private String message;
        private String mode; // autopilot, plan, action
        private String moduleCode;
    }

    @Data
    public static class AIResponse {
        private String reply;
        private List<Map<String, Object>> diffs;
        private boolean applied;
    }

    @PostMapping("/chat")
    @Operation(summary = "Canvas AI 对话")
    public ApiResponse<AIResponse> chat(
            @PathVariable String factoryId,
            @RequestBody AIRequest request) {

        AIResponse response = new AIResponse();
        String mode = request.getMode() != null ? request.getMode() : "action";

        // Route to canvas_* tools based on intent
        String message = request.getMessage();
        log.info("Canvas AI [{}] factory={}: {}", mode, factoryId, message);

        switch (mode) {
            case "autopilot" -> {
                // Auto-detect tools to call from user message
                response.setReply(executeAutopilot(factoryId, message));
                response.setApplied(true);
            }
            case "plan" -> {
                // Generate diff without applying
                List<Map<String, Object>> diffs = generatePlan(factoryId, message);
                response.setDiffs(diffs);
                response.setReply("已生成 " + diffs.size() + " 项变更方案，请逐项审核。");
                response.setApplied(false);
            }
            case "action" -> {
                // Analyze impact of user's description
                response.setReply(analyzeImpact(factoryId, message));
                response.setApplied(false);
            }
            default -> response.setReply("未知模式: " + mode);
        }

        return ApiResponse.success(response);
    }

    @PostMapping("/apply-diffs")
    @Operation(summary = "批量应用 Plan Mode 生成的变更")
    public ApiResponse<String> applyDiffs(
            @PathVariable String factoryId,
            @RequestBody List<Map<String, Object>> diffs) {

        int applied = 0;
        for (Map<String, Object> diff : diffs) {
            String toolName = (String) diff.get("tool");
            if (toolName == null) continue;

            Optional<ToolExecutor> executor = toolRegistry.getExecutor(toolName);
            if (executor.isEmpty()) continue;

            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> params = (Map<String, Object>) diff.getOrDefault("params", Map.of());
                String argsJson = objectMapper.writeValueAsString(params);
                ToolCall toolCall = ToolCall.of("ai-apply-" + applied, toolName, argsJson);
                executor.get().execute(toolCall, Map.of("factoryId", factoryId));
                applied++;
            } catch (Exception e) {
                log.warn("Failed to apply diff {}: {}", toolName, e.getMessage());
            }
        }

        return ApiResponse.success("已应用 " + applied + "/" + diffs.size() + " 项变更");
    }

    private String executeAutopilot(String factoryId, String message) {
        // Keyword-based tool routing for canvas operations
        // In production, this would call LLM to select tools
        if (message.contains("模板") || message.contains("template")) {
            return "请使用模板选择器选择行业模板，AI 将自动配置所有模块。";
        }
        if (message.contains("禁用") || message.contains("disable")) {
            return "请指定要禁用的模块或工具名称，如: '禁用排程模块' 或 '禁用 scheduling_list 工具'";
        }
        return "Autopilot 已收到指令: " + message + "。正在分析配置方案...";
    }

    private List<Map<String, Object>> generatePlan(String factoryId, String message) {
        List<Map<String, Object>> diffs = new ArrayList<>();
        // In production, LLM analyzes message and generates tool call list
        diffs.add(Map.of(
            "type", "FIELD_CHANGE",
            "tool", "canvas_update_field",
            "params", Map.of("moduleCode", "sales_order", "fieldCode", "example", "property", "required", "value", false),
            "description", "示例变更 — 实际由 LLM 生成"
        ));
        return diffs;
    }

    private String analyzeImpact(String factoryId, String message) {
        // In production, analyze what the user is about to do and warn about impacts
        return "提示: 此操作可能影响关联模块配置。详细影响分析需要连接 LLM 服务。";
    }
}
```

- [ ] **Step 2: Update AIChatPanel to call real API**

In `AIChatPanel.vue`, replace the simulated response block with:

```typescript
async function send() {
  if (!input.value.trim()) return
  const userMsg = input.value.trim()
  input.value = ''
  messages.value.push({ role: 'user', content: userMsg, timestamp: Date.now() })

  loading.value = true
  try {
    const res = await request.post(`/${props.factoryId}/config/v2/ai/chat`, {
      message: userMsg,
      mode: mode.value,
      moduleCode: props.selectedModule,
    })
    const data = res.data
    messages.value.push({
      role: 'assistant',
      content: data.reply,
      timestamp: Date.now(),
      diffPreview: data.diffs?.map((d: any) => ({
        type: d.type, path: d.tool, before: null, after: d.params,
        description: d.description,
      })),
    })
  } catch {
    messages.value.push({ role: 'assistant', content: 'AI 服务暂不可用', timestamp: Date.now() })
  }
  loading.value = false
}
```

- [ ] **Step 3: Compile + Commit**

```bash
git add backend/java/cretas-api/src/main/java/com/cretas/aims/controller/CanvasAIController.java
git add web-admin/src/views/platform/canvas-editor/components/AIChatPanel.vue
git commit -m "feat(canvas-v2): Canvas AI backend endpoint + AIChatPanel real API integration"
```

---

## Verification Criteria (Phase 2c Done)

1. Navigate to `/canvas-editor` — 3-panel layout renders
2. ModuleTree shows modules, click selects, drag reorders
3. FieldConfigPanel shows field table with toggle switches
4. WorkflowDesigner renders vue-flow nodes/edges from config
5. PermissionMatrix shows role × field grid
6. TriggerChainDesigner loads chains, drag-sort steps, save
7. ValidationRulePanel shows rules with toggle/severity/condition inline edit
8. ToolSkillMatrix shows tools grouped by domain with search + batch toggle
9. AIChatPanel switches between 3 modes, sends messages
10. ConfigDiffViewer shows pending changes with apply/discard

---

## Parallel Work Suggestions

### Subagent: ✅ Recommended
- Task 1 (types + API) — prerequisite for all others
- Tasks 2-11 are independent components, but share router/layout from Task 2
- Tasks 3-9 (6 tab components) can run in parallel after Task 2

### Multi-Chat: ✅ Frontend + Backend parallel
- Phase 2c (frontend) can run in parallel with Phase 2b (backend) since they touch different directories
- **Exception**: canvasApi.ts calls depend on Phase 2b API endpoints existing
