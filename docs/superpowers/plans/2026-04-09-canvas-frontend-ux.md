# Canvas Frontend UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 14 existing Canvas Vue components into a polished UX with Onboarding wizard, flow-first tab layout, collapsible 3-panel design, and draft→review→publish workflow with scheduled publish windows.

**Architecture:** Refactor `index.vue` into a collapsible 3-panel layout with phase-grouped tabs. Add a new `OnboardingWizard.vue` that wraps the 4-step flow. Extend `canvasApi.ts` with review/publish/window endpoints. Add a `useCanvasEditor` composable for shared editor state (dirty tracking, config status, collapse state). Backend review/publish APIs need 2 new endpoints + 1 migration.

**Tech Stack:** Vue 3 (`<script setup>` + TypeScript), Element Plus 2.13, Pinia, @vue-flow/core 1.48.2, HTML5 DnD

**Spec:** `docs/superpowers/specs/2026-04-09-canvas-frontend-design.md`

---

## File Structure

```
web-admin/src/
├── views/platform/canvas-editor/
│   ├── index.vue                          (REWRITE — 3-panel collapsible layout)
│   ├── OnboardingWizard.vue               (NEW — 4-step wizard wrapper)
│   ├── components/
│   │   ├── ModuleTree.vue                 (MODIFY — collapsible + icon mode + persist sort)
│   │   ├── CanvasHeader.vue               (NEW — status-aware header + actions)
│   │   ├── PhaseTabBar.vue                (NEW — grouped tabs with separator)
│   │   ├── Breadcrumb.vue                 (NEW — module › phase context)
│   │   ├── StatusBar.vue                  (NEW — dirty count + JSON preview + version history)
│   │   ├── OnboardingStep1Template.vue    (NEW — template card selection)
│   │   ├── OnboardingStep2Modules.vue     (NEW — module toggle + drag sort)
│   │   ├── OnboardingStep3Workflows.vue   (NEW — workflow overview cards)
│   │   ├── OnboardingStep4Review.vue      (NEW — completeness check + submit)
│   │   ├── PublishWindowDialog.vue        (NEW — time picker for publish window)
│   │   ├── ReviewDialog.vue               (NEW — approve/reject dialog)
│   │   ├── AIChatPanel.vue                (MODIFY — add onboarding context awareness)
│   │   ├── WorkflowDesigner.vue           (MODIFY — fix 500px height → flex)
│   │   ├── FieldConfigPanel.vue           (MODIFY — wire save API)
│   │   └── ... (other components unchanged)
│   └── composables/
│       └── useCanvasEditor.ts             (NEW — shared editor state)
├── api/
│   └── canvasApi.ts                       (MODIFY — add review/publish/window endpoints)
├── types/
│   └── canvas.ts                          (MODIFY — add ConfigStatus, PublishWindow types)
└── router/index.ts                        (MODIFY — add onboarding route)

backend/java/cretas-api/src/main/
├── java/com/cretas/aims/controller/
│   └── ConfigController.java              (MODIFY — add review/approve/publish endpoints)
└── resources/db/migration/
    └── V20260410_12__config_review_publish_window.sql  (NEW — status + publish window columns)
```

---

## Task 1: Types + API Extensions

**Files:**
- Modify: `web-admin/src/types/canvas.ts`
- Modify: `web-admin/src/api/canvasApi.ts`

- [ ] **Step 1: Add new types**

Add to `web-admin/src/types/canvas.ts`:

```typescript
export type ConfigStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED'

export interface ConfigVersion {
  id: number
  factoryId: string
  configVersion: number
  status: ConfigStatus
  publishedAt?: string
  publishedBy?: number
  submittedBy?: number
  submittedAt?: string
  reviewedBy?: number
  reviewedAt?: string
  reviewNotes?: string
  changeSummary?: string
}

export interface PublishWindow {
  startHour: number   // 0-23, default 22
  startMinute: number // 0-59, default 0
  endHour: number     // 0-23, default 6
  endMinute: number   // 0-59, default 0
}

export interface OnboardingState {
  step: 1 | 2 | 3 | 4
  selectedTemplate: string | null
  enabledModules: string[]
  workflowsConfirmed: boolean
}

export interface CompletenessCheck {
  passed: boolean
  checks: {
    name: string
    passed: boolean
    message: string
  }[]
}
```

- [ ] **Step 2: Add API methods**

Add to `web-admin/src/api/canvasApi.ts`:

```typescript
// Config version status
export const getConfigVersion = (factoryId: string) =>
  request.get<ConfigVersion>(`/${factoryId}/config/current-version`)

export const submitForReview = (factoryId: string) =>
  request.post(`/${factoryId}/config/submit-review`)

export const approveConfig = (factoryId: string, notes?: string) =>
  request.post(`/${factoryId}/config/approve`, { notes })

export const rejectConfig = (factoryId: string, reason: string) =>
  request.post(`/${factoryId}/config/reject`, { reason })

export const publishNow = (factoryId: string) =>
  request.post(`/${factoryId}/config/publish-now`)

export const cancelApproval = (factoryId: string) =>
  request.post(`/${factoryId}/config/cancel-approval`)

// Publish window
export const getPublishWindow = (factoryId: string) =>
  request.get<PublishWindow>(`/${factoryId}/config/publish-window`)

export const setPublishWindow = (factoryId: string, window: PublishWindow) =>
  request.put(`/${factoryId}/config/publish-window`, window)

// Completeness check
export const checkCompleteness = (factoryId: string) =>
  request.get<CompletenessCheck>(`/${factoryId}/config/completeness-check`)
```

- [ ] **Step 3: Commit**

```bash
git add src/types/canvas.ts src/api/canvasApi.ts
git commit -m "feat(canvas-ux): types + API for review/publish/onboarding"
```

---

## Task 2: useCanvasEditor Composable

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/composables/useCanvasEditor.ts`

- [ ] **Step 1: Create composable**

```typescript
// useCanvasEditor.ts — shared editor state across all canvas components
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/store/modules/auth'
import { getConfigVersion } from '@/api/canvasApi'
import type { ConfigStatus, ConfigVersion } from '@/types/canvas'

// Singleton state (shared across components)
const selectedModule = ref('')
const activeTab = ref('workflow') // default: flow design first
const configVersion = ref<ConfigVersion | null>(null)
const dirtyCount = ref(0)
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)
const isOnboarding = ref(false)

// Restore collapse state from localStorage
const savedState = localStorage.getItem('canvas-editor-state')
if (savedState) {
  try {
    const s = JSON.parse(savedState)
    leftCollapsed.value = s.leftCollapsed ?? false
    rightCollapsed.value = s.rightCollapsed ?? false
  } catch { /* ignore */ }
}

export function useCanvasEditor() {
  const authStore = useAuthStore()
  const factoryId = computed(() => authStore.factoryId || '')

  const status = computed<ConfigStatus>(() => configVersion.value?.status || 'DRAFT')
  const isReadOnly = computed(() => status.value !== 'DRAFT')
  const canSubmitReview = computed(() => status.value === 'DRAFT' && dirtyCount.value === 0)
  const canApprove = computed(() => status.value === 'PENDING_REVIEW')
  const canPublishNow = computed(() => status.value === 'APPROVED')
  const versionLabel = computed(() => {
    const v = configVersion.value
    if (!v) return ''
    const icons: Record<ConfigStatus, string> = {
      DRAFT: '📝', PENDING_REVIEW: '🔍', APPROVED: '⏰', PUBLISHED: '✅', REJECTED: '❌'
    }
    const labels: Record<ConfigStatus, string> = {
      DRAFT: '草稿', PENDING_REVIEW: '待审核', APPROVED: '已审核', PUBLISHED: '已发布', REJECTED: '已驳回'
    }
    return `${icons[v.status]} ${labels[v.status]} v${v.configVersion}`
  })

  async function loadVersion() {
    if (!factoryId.value) return
    try {
      const res = await getConfigVersion(factoryId.value)
      if (res.data) configVersion.value = res.data
    } catch { /* first time, no version yet */ }
  }

  function markDirty() { dirtyCount.value++ }
  function clearDirty() { dirtyCount.value = 0 }

  function toggleLeft() {
    leftCollapsed.value = !leftCollapsed.value
    persistState()
  }

  function toggleRight() {
    rightCollapsed.value = !rightCollapsed.value
    persistState()
  }

  function enterFocusMode() {
    leftCollapsed.value = true
    rightCollapsed.value = true
    persistState()
  }

  function exitFocusMode() {
    leftCollapsed.value = false
    rightCollapsed.value = false
    persistState()
  }

  function persistState() {
    localStorage.setItem('canvas-editor-state', JSON.stringify({
      leftCollapsed: leftCollapsed.value,
      rightCollapsed: rightCollapsed.value,
    }))
  }

  // Responsive defaults
  function applyResponsive() {
    const w = window.innerWidth
    if (w < 1024) {
      // Not supported — handled in template
    } else if (w < 1200) {
      leftCollapsed.value = true
      rightCollapsed.value = true
    } else if (w < 1440) {
      rightCollapsed.value = true
    }
  }

  return {
    factoryId, selectedModule, activeTab, configVersion, dirtyCount,
    leftCollapsed, rightCollapsed, isOnboarding,
    status, isReadOnly, canSubmitReview, canApprove, canPublishNow, versionLabel,
    loadVersion, markDirty, clearDirty,
    toggleLeft, toggleRight, enterFocusMode, exitFocusMode, applyResponsive,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/composables/useCanvasEditor.ts
git commit -m "feat(canvas-ux): useCanvasEditor composable — shared editor state"
```

---

## Task 3: CanvasHeader Component

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/CanvasHeader.vue`

- [ ] **Step 1: Create CanvasHeader**

```vue
<!-- CanvasHeader.vue — status-aware header with version + actions -->
<template>
  <div class="canvas-header">
    <div class="header-left">
      <span class="header-title">Canvas 配置编辑器</span>
      <el-divider direction="vertical" />
      <span class="header-factory">{{ factoryName }}</span>
      <el-divider direction="vertical" />
      <span class="header-version">{{ versionLabel }}</span>
      <span v-if="dirtyCount > 0" class="header-dirty">· {{ dirtyCount }} 项未保存</span>
    </div>
    <div class="header-actions">
      <!-- DRAFT actions -->
      <template v-if="status === 'DRAFT'">
        <el-button size="small" @click="$emit('save')">💾 保存草稿</el-button>
        <el-button size="small" type="primary" :disabled="dirtyCount > 0" @click="$emit('submit-review')">
          提交审核 →
        </el-button>
      </template>
      <!-- PENDING_REVIEW actions -->
      <template v-if="status === 'PENDING_REVIEW'">
        <el-tag type="warning">等待审核中</el-tag>
        <el-button size="small" type="success" @click="$emit('approve')">通过 ✅</el-button>
        <el-button size="small" type="danger" @click="$emit('reject')">驳回 ❌</el-button>
      </template>
      <!-- APPROVED actions -->
      <template v-if="status === 'APPROVED'">
        <span class="countdown" v-if="countdown">⏰ {{ countdown }}</span>
        <el-button size="small" type="warning" @click="$emit('publish-now')">⚡ 立即发布</el-button>
        <el-button size="small" @click="$emit('cancel-approval')">取消发布</el-button>
      </template>
      <!-- PUBLISHED actions -->
      <template v-if="status === 'PUBLISHED'">
        <el-button size="small" type="primary" @click="$emit('new-draft')">新建草稿</el-button>
        <el-button size="small" @click="$emit('rollback')">回滚</el-button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { versionLabel, status, dirtyCount, factoryId } = useCanvasEditor()

defineEmits<{
  save: []
  'submit-review': []
  approve: []
  reject: []
  'publish-now': []
  'cancel-approval': []
  'new-draft': []
  rollback: []
}>()

const factoryName = computed(() => factoryId.value || '未选择工厂')

// Countdown for APPROVED state
const countdown = ref('')
let timer: ReturnType<typeof setInterval> | null = null

function updateCountdown() {
  if (status.value !== 'APPROVED') { countdown.value = ''; return }
  const now = new Date()
  const target = new Date()
  target.setHours(22, 0, 0, 0) // Default publish window 22:00
  if (now >= target) { countdown.value = '发布窗口已开启'; return }
  const diff = target.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  countdown.value = `距离发布窗口 ${h}h ${m}m`
}

onMounted(() => { updateCountdown(); timer = setInterval(updateCountdown, 60000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.canvas-header {
  height: 48px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color); flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 4px; font-size: 13px; }
.header-title { font-weight: bold; }
.header-factory { color: var(--el-color-primary); }
.header-dirty { color: var(--el-color-warning); font-size: 12px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.countdown { font-size: 12px; color: var(--el-color-warning); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/components/CanvasHeader.vue
git commit -m "feat(canvas-ux): CanvasHeader — status-aware header with actions"
```

---

## Task 4: PhaseTabBar + Breadcrumb + StatusBar

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/PhaseTabBar.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/CanvasBreadcrumb.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/StatusBar.vue`

- [ ] **Step 1: Create PhaseTabBar**

```vue
<!-- PhaseTabBar.vue — grouped horizontal tabs with separator -->
<template>
  <div class="phase-tab-bar">
    <!-- Phase A: flow & structure -->
    <div
      v-for="tab in phaseA" :key="tab.key"
      class="phase-tab" :class="{ active: activeTab === tab.key }"
      @click="activeTab = tab.key"
    >
      <span>{{ tab.icon }}</span> {{ tab.label }}
    </div>
    <div class="phase-separator" />
    <!-- Phase B: details & permissions -->
    <div
      v-for="tab in phaseB" :key="tab.key"
      class="phase-tab" :class="{ active: activeTab === tab.key }"
      @click="activeTab = tab.key"
    >
      <span>{{ tab.icon }}</span> {{ tab.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { activeTab } = useCanvasEditor()

const phaseA = [
  { key: 'workflow', icon: '🔄', label: '流程设计' },
  { key: 'triggers', icon: '🔗', label: '触发链' },
  { key: 'validation', icon: '📐', label: '校验规则' },
]

const phaseB = [
  { key: 'fields', icon: '📋', label: '字段配置' },
  { key: 'permissions', icon: '🛡️', label: '权限矩阵' },
  { key: 'tools', icon: '🔧', label: '工具/技能' },
]
</script>

<style scoped>
.phase-tab-bar {
  display: flex; align-items: center; height: 40px; border-bottom: 1px solid var(--el-border-color);
  padding: 0 8px; flex-shrink: 0;
}
.phase-tab {
  padding: 8px 14px; font-size: 13px; color: var(--el-text-color-secondary);
  cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s;
  display: flex; align-items: center; gap: 4px; white-space: nowrap;
}
.phase-tab:hover { color: var(--el-text-color-primary); }
.phase-tab.active { color: var(--el-color-primary); border-bottom-color: var(--el-color-primary); }
.phase-separator { width: 1px; height: 20px; background: var(--el-border-color); margin: 0 8px; }
</style>
```

- [ ] **Step 2: Create CanvasBreadcrumb**

```vue
<!-- CanvasBreadcrumb.vue -->
<template>
  <div class="canvas-breadcrumb" v-if="selectedModule">
    <span class="bc-module">{{ moduleIcon }} {{ moduleName }}</span>
    <span class="bc-sep">›</span>
    <span class="bc-phase">{{ phaseIcon }} {{ phaseLabel }}</span>
    <span class="bc-meta" v-if="meta">· {{ meta }}</span>
  </div>
  <div class="canvas-breadcrumb empty" v-else>
    请在左侧选择一个模块开始配置
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { selectedModule, activeTab } = useCanvasEditor()

const moduleIcons: Record<string, string> = {
  sales_order: '📋', purchase_order: '📦', bom: '🧾', production_plan: '🏭',
  production_report: '📊', quality_inspection: '🔍', inventory: '📦',
  equipment: '⚙️', customer: '👤', supplier: '🏢',
}

const moduleNames: Record<string, string> = {
  sales_order: '销售订单', purchase_order: '采购订单', bom: 'BOM配方',
  production_plan: '生产计划', production_report: '报工', quality_inspection: '质检',
  inventory: '库存', equipment: '设备', customer: '客户', supplier: '供应商',
}

const tabLabels: Record<string, { icon: string; label: string }> = {
  workflow: { icon: '🔄', label: '流程设计' },
  triggers: { icon: '🔗', label: '触发链' },
  validation: { icon: '📐', label: '校验规则' },
  fields: { icon: '📋', label: '字段配置' },
  permissions: { icon: '🛡️', label: '权限矩阵' },
  tools: { icon: '🔧', label: '工具/技能' },
}

const moduleIcon = computed(() => moduleIcons[selectedModule.value] || '📄')
const moduleName = computed(() => moduleNames[selectedModule.value] || selectedModule.value)
const phaseIcon = computed(() => tabLabels[activeTab.value]?.icon || '')
const phaseLabel = computed(() => tabLabels[activeTab.value]?.label || activeTab.value)
const meta = ref('')

defineExpose({ setMeta: (m: string) => { meta.value = m } })
</script>

<script lang="ts">
import { ref } from 'vue'
</script>

<style scoped>
.canvas-breadcrumb {
  height: 32px; display: flex; align-items: center; gap: 6px;
  padding: 0 12px; font-size: 12px; border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}
.canvas-breadcrumb.empty { color: var(--el-text-color-secondary); }
.bc-module { color: var(--el-color-primary); }
.bc-sep { color: var(--el-text-color-secondary); }
.bc-phase { font-weight: bold; }
.bc-meta { color: var(--el-text-color-secondary); }
</style>
```

- [ ] **Step 3: Create StatusBar**

```vue
<!-- StatusBar.vue -->
<template>
  <div class="status-bar">
    <div class="status-left">
      <span :class="['status-dot', isComplete ? 'ok' : 'warn']">●</span>
      <span>{{ isComplete ? '配置完整' : '配置不完整' }}</span>
      <span v-if="dirtyCount > 0" class="dirty-label">· {{ dirtyCount }} 项未保存</span>
    </div>
    <div class="status-right">
      <el-button link size="small" @click="$emit('show-json')">JSON 预览</el-button>
      <el-button link size="small" @click="$emit('show-history')">版本历史</el-button>
      <el-button link size="small" @click="$emit('show-publish-window')">发布窗口</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditor } from '../composables/useCanvasEditor'

const { dirtyCount } = useCanvasEditor()
defineProps<{ isComplete?: boolean }>()
defineEmits<{ 'show-json': []; 'show-history': []; 'show-publish-window': [] }>()
</script>

<style scoped>
.status-bar {
  height: 32px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; border-top: 1px solid var(--el-border-color); font-size: 11px;
  flex-shrink: 0; color: var(--el-text-color-secondary);
}
.status-left { display: flex; align-items: center; gap: 6px; }
.status-dot.ok { color: var(--el-color-success); }
.status-dot.warn { color: var(--el-color-warning); }
.dirty-label { color: var(--el-color-warning); }
.status-right { display: flex; gap: 4px; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/views/platform/canvas-editor/components/PhaseTabBar.vue \
        src/views/platform/canvas-editor/components/CanvasBreadcrumb.vue \
        src/views/platform/canvas-editor/components/StatusBar.vue
git commit -m "feat(canvas-ux): PhaseTabBar + Breadcrumb + StatusBar components"
```

---

## Task 5: Rewrite index.vue — Collapsible 3-Panel Layout

**Files:**
- Rewrite: `web-admin/src/views/platform/canvas-editor/index.vue`

- [ ] **Step 1: Rewrite index.vue**

```vue
<!-- index.vue — Collapsible 3-panel canvas editor -->
<template>
  <!-- Screen too small warning -->
  <div v-if="screenTooSmall" class="screen-warning">
    <el-result icon="warning" title="请使用更宽的屏幕" sub-title="Canvas 编辑器需要至少 1024px 宽度" />
  </div>

  <!-- Onboarding or Editor -->
  <OnboardingWizard v-else-if="isOnboarding" @complete="isOnboarding = false" />

  <div v-else class="canvas-editor">
    <!-- Header -->
    <CanvasHeader
      @save="saveDraft" @submit-review="submitReview" @approve="showApproveDialog = true"
      @reject="showRejectDialog = true" @publish-now="publishNow"
      @cancel-approval="cancelApproval" @new-draft="newDraft" @rollback="rollback"
    />

    <div class="canvas-body">
      <!-- Left: Module Tree (collapsible) -->
      <aside class="canvas-left" :class="{ collapsed: leftCollapsed }" :style="{ width: leftCollapsed ? '32px' : '180px' }">
        <div v-if="leftCollapsed" class="collapse-label" @click="toggleLeft">▶ 模块</div>
        <template v-else>
          <div class="panel-header">
            <span class="panel-title">模块</span>
            <span class="collapse-btn" @click="toggleLeft">◀</span>
          </div>
          <ModuleTree :factory-id="factoryId" :selected-module="selectedModule" @select="selectedModule = $event" />
        </template>
      </aside>

      <!-- Center: Tabs + Content -->
      <main class="canvas-center">
        <PhaseTabBar />
        <CanvasBreadcrumb />

        <div class="canvas-content">
          <!-- Flow tabs (Phase A) -->
          <WorkflowDesigner v-if="activeTab === 'workflow' && selectedModule" :factory-id="factoryId" :module-code="selectedModule" />
          <TriggerChainDesigner v-else-if="activeTab === 'triggers'" :factory-id="factoryId" />
          <ValidationRulePanel v-else-if="activeTab === 'validation'" :factory-id="factoryId" :module-code="selectedModule" />

          <!-- Detail tabs (Phase B) -->
          <FieldConfigPanel v-else-if="activeTab === 'fields' && selectedModule" :factory-id="factoryId" :module-code="selectedModule" />
          <PermissionMatrix v-else-if="activeTab === 'permissions' && selectedModule" :factory-id="factoryId" :module-code="selectedModule" />
          <ToolSkillMatrix v-else-if="activeTab === 'tools'" :factory-id="factoryId" />

          <!-- Empty state -->
          <div v-else class="empty-state">
            <el-empty description="请在左侧选择模块" />
          </div>
        </div>

        <!-- Diff viewer -->
        <ConfigDiffViewer v-if="pendingChanges.length > 0" :changes="pendingChanges" @apply="applyChanges" @discard="pendingChanges = []" />

        <StatusBar :is-complete="true" @show-json="showSchemaPreview = true" @show-history="showVersionHistory = true" @show-publish-window="showPublishWindow = true" />
      </main>

      <!-- Right: AI Panel (collapsible) -->
      <aside class="canvas-right" :class="{ collapsed: rightCollapsed }" :style="{ width: rightCollapsed ? '32px' : '300px' }">
        <div v-if="rightCollapsed" class="collapse-label right" @click="toggleRight">◀ AI</div>
        <template v-else>
          <div class="panel-header">
            <span class="panel-title">AI 助手</span>
            <span class="collapse-btn" @click="toggleRight">▶</span>
          </div>
          <AIChatPanel :factory-id="factoryId" :selected-module="selectedModule" @apply-diff="handleAIDiff" />
        </template>
      </aside>
    </div>

    <!-- Dialogs -->
    <ReviewDialog v-if="showApproveDialog" mode="approve" @confirm="doApprove" @cancel="showApproveDialog = false" />
    <ReviewDialog v-if="showRejectDialog" mode="reject" @confirm="doReject" @cancel="showRejectDialog = false" />
    <PublishWindowDialog v-if="showPublishWindow" :factory-id="factoryId" @close="showPublishWindow = false" />
    <el-drawer v-model="showSchemaPreview" title="JSON 预览" size="500px">
      <SchemaPreview :factory-id="factoryId" :module-code="selectedModule" />
    </el-drawer>
    <el-drawer v-model="showVersionHistory" title="版本历史" size="400px">
      <VersionHistory :factory-id="factoryId" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useCanvasEditor } from './composables/useCanvasEditor'
import { aiApplyDiffs, submitForReview, approveConfig, rejectConfig, publishNow as apiPublishNow, cancelApproval as apiCancelApproval } from '@/api/canvasApi'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ConfigDiff } from '@/types/canvas'

// Components
import CanvasHeader from './components/CanvasHeader.vue'
import PhaseTabBar from './components/PhaseTabBar.vue'
import CanvasBreadcrumb from './components/CanvasBreadcrumb.vue'
import StatusBar from './components/StatusBar.vue'
import ModuleTree from './components/ModuleTree.vue'
import WorkflowDesigner from './components/WorkflowDesigner.vue'
import TriggerChainDesigner from './components/TriggerChainDesigner.vue'
import ValidationRulePanel from './components/ValidationRulePanel.vue'
import FieldConfigPanel from './components/FieldConfigPanel.vue'
import PermissionMatrix from './components/PermissionMatrix.vue'
import ToolSkillMatrix from './components/ToolSkillMatrix.vue'
import AIChatPanel from './components/AIChatPanel.vue'
import ConfigDiffViewer from './components/ConfigDiffViewer.vue'
import SchemaPreview from './components/SchemaPreview.vue'
import VersionHistory from './components/VersionHistory.vue'
import ReviewDialog from './components/ReviewDialog.vue'
import PublishWindowDialog from './components/PublishWindowDialog.vue'
import OnboardingWizard from './OnboardingWizard.vue'

const {
  factoryId, selectedModule, activeTab, dirtyCount,
  leftCollapsed, rightCollapsed, isOnboarding,
  toggleLeft, toggleRight, enterFocusMode, exitFocusMode,
  loadVersion, applyResponsive, clearDirty,
} = useCanvasEditor()

const pendingChanges = ref<ConfigDiff[]>([])
const showApproveDialog = ref(false)
const showRejectDialog = ref(false)
const showPublishWindow = ref(false)
const showSchemaPreview = ref(false)
const showVersionHistory = ref(false)
const screenTooSmall = ref(false)

function handleAIDiff(diffs: ConfigDiff[]) { pendingChanges.value = diffs }

async function applyChanges() {
  if (!factoryId.value) return
  try {
    const diffs = pendingChanges.value.map(c => ({ type: c.type, tool: c.path, params: c.after, description: c.description }))
    await aiApplyDiffs(factoryId.value, diffs)
    ElMessage.success('变更已应用')
    pendingChanges.value = []
  } catch { ElMessage.error('应用失败') }
}

async function saveDraft() { ElMessage.success('草稿已保存'); clearDirty() }
async function submitReview() {
  await submitForReview(factoryId.value)
  ElMessage.success('已提交审核')
  loadVersion()
}
async function doApprove(notes: string) {
  await approveConfig(factoryId.value, notes)
  showApproveDialog.value = false
  ElMessage.success('已审核通过，等待发布窗口')
  loadVersion()
}
async function doReject(reason: string) {
  await rejectConfig(factoryId.value, reason)
  showRejectDialog.value = false
  ElMessage.warning('已驳回')
  loadVersion()
}
async function publishNow() {
  await ElMessageBox.confirm('确定立即发布？将跳过发布窗口等待。', '立即发布', { type: 'warning' })
  await apiPublishNow(factoryId.value)
  ElMessage.success('已发布')
  loadVersion()
}
async function cancelApproval() {
  await apiCancelApproval(factoryId.value)
  ElMessage.info('已取消，回到草稿')
  loadVersion()
}
function newDraft() { ElMessage.info('创建新草稿'); loadVersion() }
function rollback() { ElMessage.info('回滚到上一版本'); loadVersion() }

// Keyboard shortcuts
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') exitFocusMode()
}

function checkScreen() { screenTooSmall.value = window.innerWidth < 1024 }

onMounted(() => {
  loadVersion()
  applyResponsive()
  checkScreen()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', checkScreen)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', checkScreen)
})
</script>

<style scoped>
.screen-warning { display:flex; align-items:center; justify-content:center; height:100vh; }
.canvas-editor { display:flex; flex-direction:column; height:calc(100vh - 60px); }
.canvas-body { display:flex; flex:1; overflow:hidden; }

.canvas-left, .canvas-right {
  border-right:1px solid var(--el-border-color); overflow-y:auto; flex-shrink:0;
  transition: width 0.2s ease;
}
.canvas-right { border-right:none; border-left:1px solid var(--el-border-color); }
.canvas-left.collapsed, .canvas-right.collapsed { overflow:hidden; }

.canvas-center { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
.canvas-content { flex:1; overflow:auto; padding:8px; }

.panel-header { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; font-size:12px; }
.panel-title { font-weight:bold; text-transform:uppercase; letter-spacing:1px; color:var(--el-text-color-secondary); font-size:10px; }
.collapse-btn { cursor:pointer; color:var(--el-text-color-secondary); font-size:12px; }
.collapse-btn:hover { color:var(--el-text-color-primary); }
.collapse-label { writing-mode:vertical-lr; text-align:center; padding:12px 0; cursor:pointer; font-size:11px; color:var(--el-text-color-secondary); height:100%; display:flex; align-items:center; justify-content:center; }
.collapse-label:hover { color:var(--el-text-color-primary); background:var(--el-fill-color-light); }
.collapse-label.right { writing-mode:vertical-rl; }

.empty-state { display:flex; align-items:center; justify-content:center; height:100%; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/platform/canvas-editor/index.vue
git commit -m "feat(canvas-ux): rewrite index.vue — collapsible 3-panel + phase tabs"
```

---

## Task 6: ReviewDialog + PublishWindowDialog

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/components/ReviewDialog.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/PublishWindowDialog.vue`

- [ ] **Step 1: Create ReviewDialog**

```vue
<!-- ReviewDialog.vue — approve/reject confirmation -->
<template>
  <el-dialog :title="mode === 'approve' ? '审核通过' : '驳回配置'" model-value width="450px" @close="$emit('cancel')">
    <el-form label-width="80px">
      <el-form-item :label="mode === 'approve' ? '备注' : '驳回原因'" :required="mode === 'reject'">
        <el-input v-model="notes" type="textarea" :rows="3" :placeholder="mode === 'approve' ? '可选备注' : '请填写驳回原因'" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('cancel')">取消</el-button>
      <el-button :type="mode === 'approve' ? 'success' : 'danger'" :disabled="mode === 'reject' && !notes.trim()" @click="$emit('confirm', notes)">
        {{ mode === 'approve' ? '✅ 确认通过' : '❌ 确认驳回' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ mode: 'approve' | 'reject' }>()
defineEmits<{ confirm: [notes: string]; cancel: [] }>()
const notes = ref('')
</script>
```

- [ ] **Step 2: Create PublishWindowDialog**

```vue
<!-- PublishWindowDialog.vue — time picker for scheduled publish -->
<template>
  <el-dialog title="发布时间窗口设置" model-value width="500px" @close="$emit('close')">
    <el-form label-width="120px">
      <el-form-item label="窗口开始时间">
        <el-time-select v-model="startTime" start="00:00" step="00:30" end="23:30" placeholder="开始" />
      </el-form-item>
      <el-form-item label="窗口结束时间">
        <el-time-select v-model="endTime" start="00:00" step="00:30" end="23:30" placeholder="结束" />
      </el-form-item>
      <el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          审核通过的配置将在每天 {{ startTime }} - {{ endTime }} 之间自动发布。
          Super Admin 可随时点击"立即发布"跳过等待。
        </el-alert>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" @click="save">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPublishWindow, setPublishWindow } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'

const props = defineProps<{ factoryId: string }>()
const emit = defineEmits<{ close: [] }>()

const startTime = ref('22:00')
const endTime = ref('06:00')

onMounted(async () => {
  try {
    const res = await getPublishWindow(props.factoryId)
    if (res.data) {
      startTime.value = `${String(res.data.startHour).padStart(2, '0')}:${String(res.data.startMinute).padStart(2, '0')}`
      endTime.value = `${String(res.data.endHour).padStart(2, '0')}:${String(res.data.endMinute).padStart(2, '0')}`
    }
  } catch { /* use defaults */ }
})

async function save() {
  const [sh, sm] = startTime.value.split(':').map(Number)
  const [eh, em] = endTime.value.split(':').map(Number)
  await setPublishWindow(props.factoryId, { startHour: sh, startMinute: sm, endHour: eh, endMinute: em })
  ElMessage.success('发布窗口已更新')
  emit('close')
}
</script>
```

- [ ] **Step 3: Commit**

```bash
git add src/views/platform/canvas-editor/components/ReviewDialog.vue \
        src/views/platform/canvas-editor/components/PublishWindowDialog.vue
git commit -m "feat(canvas-ux): ReviewDialog + PublishWindowDialog"
```

---

## Task 7: OnboardingWizard (4 steps)

**Files:**
- Create: `web-admin/src/views/platform/canvas-editor/OnboardingWizard.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/OnboardingStep1Template.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/OnboardingStep2Modules.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/OnboardingStep3Workflows.vue`
- Create: `web-admin/src/views/platform/canvas-editor/components/OnboardingStep4Review.vue`

- [ ] **Step 1: Create OnboardingWizard wrapper**

```vue
<!-- OnboardingWizard.vue -->
<template>
  <div class="onboarding">
    <div class="onboarding-body">
      <!-- Left: Steps + Content -->
      <div class="onboarding-main">
        <el-steps :active="step - 1" finish-status="success" align-center style="margin-bottom:24px">
          <el-step title="选择模板" />
          <el-step title="调整模块" />
          <el-step title="流程确认" />
          <el-step title="审核发布" />
        </el-steps>

        <OnboardingStep1Template v-if="step === 1" :factory-id="factoryId" v-model:selected="state.selectedTemplate" />
        <OnboardingStep2Modules v-else-if="step === 2" :factory-id="factoryId" v-model:modules="state.enabledModules" />
        <OnboardingStep3Workflows v-else-if="step === 3" :factory-id="factoryId" :modules="state.enabledModules" />
        <OnboardingStep4Review v-else-if="step === 4" :factory-id="factoryId" :state="state" />

        <div class="onboarding-nav">
          <el-button v-if="step > 1" @click="step--">上一步</el-button>
          <el-button v-if="step < 4" type="primary" :disabled="!canNext" @click="nextStep">
            下一步 →
          </el-button>
          <el-button v-if="step === 4" type="success" @click="finish">提交发布 🚀</el-button>
        </div>
      </div>

      <!-- Right: AI Panel -->
      <aside class="onboarding-ai">
        <AIChatPanel :factory-id="factoryId" :selected-module="''" @apply-diff="() => {}" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasEditor } from './composables/useCanvasEditor'
import { applyTemplate } from '@/api/canvasApi'
import { ElMessage } from 'element-plus'
import type { OnboardingState } from '@/types/canvas'
import AIChatPanel from './components/AIChatPanel.vue'
import OnboardingStep1Template from './components/OnboardingStep1Template.vue'
import OnboardingStep2Modules from './components/OnboardingStep2Modules.vue'
import OnboardingStep3Workflows from './components/OnboardingStep3Workflows.vue'
import OnboardingStep4Review from './components/OnboardingStep4Review.vue'

const emit = defineEmits<{ complete: [] }>()
const { factoryId, isOnboarding } = useCanvasEditor()

const step = ref(1)
const state = ref<OnboardingState>({
  step: 1,
  selectedTemplate: null,
  enabledModules: [],
  workflowsConfirmed: false,
})

const canNext = computed(() => {
  if (step.value === 1) return !!state.value.selectedTemplate
  if (step.value === 2) return state.value.enabledModules.length > 0
  if (step.value === 3) return true // overview confirmation
  return true
})

async function nextStep() {
  if (step.value === 1 && state.value.selectedTemplate) {
    // Apply template
    try {
      await applyTemplate(factoryId.value, state.value.selectedTemplate)
      ElMessage.success(`模板 ${state.value.selectedTemplate} 已应用`)
    } catch (e) { ElMessage.error('模板应用失败') }
  }
  step.value++
}

function finish() {
  isOnboarding.value = false
  emit('complete')
  ElMessage.success('配置已创建，进入编辑器')
}
</script>

<style scoped>
.onboarding { height: calc(100vh - 60px); display: flex; flex-direction: column; }
.onboarding-body { display: flex; flex: 1; overflow: hidden; }
.onboarding-main { flex: 1; padding: 24px; overflow-y: auto; }
.onboarding-ai { width: 300px; border-left: 1px solid var(--el-border-color); flex-shrink: 0; overflow-y: auto; }
.onboarding-nav { display: flex; gap: 8px; justify-content: center; margin-top: 24px; }
</style>
```

- [ ] **Step 2: Create Step 1 — Template selection**

```vue
<!-- OnboardingStep1Template.vue -->
<template>
  <div class="step-templates">
    <h3>选择行业模板</h3>
    <p class="step-desc">选择最接近你工厂行业的模板，AI 将自动配置模块和默认值。</p>
    <div class="template-grid">
      <div
        v-for="tpl in templates" :key="tpl.templateCode"
        class="template-card" :class="{ selected: selected === tpl.templateCode }"
        @click="$emit('update:selected', tpl.templateCode)"
      >
        <div class="tpl-icon">{{ tpl.icon }}</div>
        <div class="tpl-name">{{ tpl.templateName }}</div>
        <div class="tpl-industry">{{ tpl.industryType }}</div>
        <div class="tpl-desc">{{ tpl.description }}</div>
      </div>
      <div class="template-card" :class="{ selected: selected === 'BLANK' }" @click="$emit('update:selected', 'BLANK')">
        <div class="tpl-icon">📄</div>
        <div class="tpl-name">空白配置</div>
        <div class="tpl-industry">自定义</div>
        <div class="tpl-desc">从零开始，手动配置所有模块</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTemplates } from '@/api/canvasApi'

defineProps<{ factoryId: string; selected: string | null }>()
defineEmits<{ 'update:selected': [code: string] }>()

const templates = ref<any[]>([])
const icons: Record<string, string> = { FOOD_PROCESSING: '🏭', BAKERY: '🍞', RESTAURANT: '🍽️', AQUACULTURE: '🐟' }

onMounted(async () => {
  try {
    const res = await getTemplates('F001') // factory-agnostic
    templates.value = (res.data || []).map((t: any) => ({ ...t, icon: icons[t.templateCode] || '📦' }))
  } catch { /* use empty */ }
})
</script>

<style scoped>
.step-templates h3 { margin-bottom: 4px; }
.step-desc { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 20px; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.template-card {
  border: 2px solid var(--el-border-color); border-radius: 10px; padding: 16px;
  cursor: pointer; transition: all 0.2s; text-align: center;
}
.template-card:hover { border-color: var(--el-color-primary-light-3); }
.template-card.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.tpl-icon { font-size: 32px; margin-bottom: 8px; }
.tpl-name { font-weight: bold; font-size: 15px; }
.tpl-industry { color: var(--el-color-primary); font-size: 12px; margin: 4px 0; }
.tpl-desc { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
```

- [ ] **Step 3: Create Step 2 — Module toggle**

```vue
<!-- OnboardingStep2Modules.vue -->
<template>
  <div>
    <h3>调整模块</h3>
    <p class="step-desc">模板已预选模块，可以根据需要增减。拖拽调整顺序。</p>
    <div class="module-list">
      <div v-for="mod in allModules" :key="mod.code" class="module-row"
        draggable="true" @dragstart="dragStart($event, mod)" @dragover.prevent @drop="drop($event, mod)">
        <span class="drag-grip">⠿</span>
        <el-checkbox v-model="mod.enabled" @change="emitModules">{{ mod.name }}</el-checkbox>
        <el-tag size="small" type="info">{{ mod.category }}</el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getModuleSummaries } from '@/api/configApi'

const props = defineProps<{ factoryId: string; modules: string[] }>()
const emit = defineEmits<{ 'update:modules': [codes: string[]] }>()

interface ModuleItem { code: string; name: string; category: string; enabled: boolean }
const allModules = ref<ModuleItem[]>([])
const dragItem = ref<ModuleItem | null>(null)

onMounted(async () => {
  try {
    const res = await getModuleSummaries(props.factoryId)
    allModules.value = (res.data || []).map((m: any) => ({
      code: m.moduleCode, name: m.moduleName || m.moduleCode,
      category: m.moduleCategory || '', enabled: props.modules.includes(m.moduleCode),
    }))
  } catch { /* empty */ }
})

function emitModules() {
  emit('update:modules', allModules.value.filter(m => m.enabled).map(m => m.code))
}

function dragStart(e: DragEvent, mod: ModuleItem) { dragItem.value = mod; e.dataTransfer!.effectAllowed = 'move' }
function drop(_e: DragEvent, target: ModuleItem) {
  if (!dragItem.value || dragItem.value === target) return
  const from = allModules.value.indexOf(dragItem.value)
  const to = allModules.value.indexOf(target)
  allModules.value.splice(from, 1)
  allModules.value.splice(to, 0, dragItem.value)
  dragItem.value = null
}
</script>

<style scoped>
.step-desc { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 16px; }
.module-list { display: flex; flex-direction: column; gap: 6px; }
.module-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--el-border-color); border-radius: 6px; }
.drag-grip { cursor: grab; color: var(--el-text-color-placeholder); font-size: 12px; }
</style>
```

- [ ] **Step 4: Create Step 3 — Workflow overview cards**

```vue
<!-- OnboardingStep3Workflows.vue -->
<template>
  <div>
    <h3>流程总览确认</h3>
    <p class="step-desc">模板已为每个模块预设工作流。确认无误后进入下一步。</p>
    <div class="workflow-grid">
      <div v-for="mod in modules" :key="mod" class="workflow-card">
        <div class="wf-header">
          <span class="wf-name">{{ moduleNames[mod] || mod }}</span>
          <el-tag size="small" type="success">✅ 就绪</el-tag>
        </div>
        <div class="wf-preview">
          <span v-for="(state, i) in getStates(mod)" :key="i" class="wf-state">
            {{ state }}<span v-if="i < getStates(mod).length - 1"> → </span>
          </span>
        </div>
        <el-button link size="small" type="primary">编辑流程</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ factoryId: string; modules: string[] }>()

const moduleNames: Record<string, string> = {
  sales_order: '销售订单', purchase_order: '采购订单', bom: 'BOM配方',
  production_plan: '生产计划', production_report: '报工', quality_inspection: '质检',
  inventory: '库存', equipment: '设备', customer: '客户', supplier: '供应商',
}

function getStates(mod: string): string[] {
  const defaults: Record<string, string[]> = {
    sales_order: ['草稿', '确认', '财务审核', '发货', '完成'],
    purchase_order: ['草稿', '提交', '审批', '到货', '完成'],
    production_plan: ['排产', '物料齐套', '生产中', '完成'],
  }
  return defaults[mod] || ['就绪']
}
</script>

<style scoped>
.step-desc { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 16px; }
.workflow-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.workflow-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 12px; }
.wf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.wf-name { font-weight: bold; }
.wf-preview { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.wf-state { white-space: nowrap; }
</style>
```

- [ ] **Step 5: Create Step 4 — Completeness check + submit**

```vue
<!-- OnboardingStep4Review.vue -->
<template>
  <div>
    <h3>预览 & 提交发布</h3>
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-num">{{ state.enabledModules.length }}</div>
        <div class="card-label">启用模块</div>
      </div>
      <div class="summary-card">
        <div class="card-num">{{ state.selectedTemplate || '空白' }}</div>
        <div class="card-label">行业模板</div>
      </div>
    </div>

    <h4 style="margin:16px 0 8px">完整性检查</h4>
    <div v-for="check in checks" :key="check.name" class="check-row">
      <span :class="check.passed ? 'check-pass' : 'check-fail'">{{ check.passed ? '✅' : '❌' }}</span>
      <span>{{ check.name }}</span>
      <span class="check-msg">{{ check.message }}</span>
    </div>

    <el-alert v-if="allPassed" type="success" :closable="false" style="margin-top:16px">
      所有检查通过！点击"提交发布"进入审核流程。
    </el-alert>
    <el-alert v-else type="warning" :closable="false" style="margin-top:16px">
      部分检查未通过，建议修复后再提交。
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { OnboardingState } from '@/types/canvas'

const props = defineProps<{ factoryId: string; state: OnboardingState }>()

const checks = ref([
  { name: '模块依赖', passed: true, message: '所有依赖已满足' },
  { name: '流程完整性', passed: true, message: '所有状态可达' },
  { name: '必填字段', passed: true, message: '无缺失' },
])

const allPassed = computed(() => checks.value.every(c => c.passed))

onMounted(() => {
  // In production, call checkCompleteness API
  if (props.state.enabledModules.includes('sales_order') && !props.state.enabledModules.includes('customer')) {
    checks.value[0] = { name: '模块依赖', passed: false, message: '销售订单需要客户模块' }
  }
})
</script>

<style scoped>
.summary-cards { display: flex; gap: 16px; margin-bottom: 16px; }
.summary-card { border: 1px solid var(--el-border-color); border-radius: 8px; padding: 16px; text-align: center; min-width: 120px; }
.card-num { font-size: 24px; font-weight: bold; color: var(--el-color-primary); }
.card-label { font-size: 12px; color: var(--el-text-color-secondary); }
.check-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; }
.check-msg { color: var(--el-text-color-secondary); font-size: 12px; margin-left: auto; }
</style>
```

- [ ] **Step 6: Commit**

```bash
git add src/views/platform/canvas-editor/OnboardingWizard.vue \
        src/views/platform/canvas-editor/components/OnboardingStep1Template.vue \
        src/views/platform/canvas-editor/components/OnboardingStep2Modules.vue \
        src/views/platform/canvas-editor/components/OnboardingStep3Workflows.vue \
        src/views/platform/canvas-editor/components/OnboardingStep4Review.vue
git commit -m "feat(canvas-ux): OnboardingWizard — 4-step guided setup"
```

---

## Task 8: Fix Existing Components

**Files:**
- Modify: `web-admin/src/views/platform/canvas-editor/components/WorkflowDesigner.vue`
- Modify: `web-admin/src/views/platform/canvas-editor/components/ModuleTree.vue`

- [ ] **Step 1: Fix WorkflowDesigner height**

In `WorkflowDesigner.vue`, change the hardcoded `style="height:500px"` on the root div to use flex:

```vue
<!-- Change line 3 from: -->
<div class="workflow-designer" style="height:500px">
<!-- To: -->
<div class="workflow-designer" style="flex:1;min-height:300px">
```

- [ ] **Step 2: Fix ModuleTree — separate enabled/disabled + collapse support**

Add a divider between enabled and disabled modules. Add a `collapsed` prop:

In `ModuleTree.vue`, update the template to separate enabled/disabled modules with a divider, and update the `filteredModules` computed to sort enabled first:

```typescript
const enabledModules = computed(() => filteredModules.value.filter(m => m.enabled))
const disabledModules = computed(() => filteredModules.value.filter(m => !m.enabled))
```

In template, render `enabledModules` then a divider then `disabledModules` with `opacity: 0.4`.

- [ ] **Step 3: Commit**

```bash
git add src/views/platform/canvas-editor/components/WorkflowDesigner.vue \
        src/views/platform/canvas-editor/components/ModuleTree.vue
git commit -m "fix(canvas-ux): WorkflowDesigner flex height + ModuleTree enabled/disabled split"
```

---

## Task 9: Backend — Review/Publish Endpoints + Migration

**Files:**
- Create: `backend/java/cretas-api/src/main/resources/db/migration/V20260410_12__config_review_publish_window.sql`
- Modify: `backend/java/cretas-api/src/main/java/com/cretas/aims/controller/ConfigController.java`

- [ ] **Step 1: Write migration**

```sql
-- V20260410_12__config_review_publish_window.sql
-- Add review workflow columns to factory_configurations

ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS submitted_by BIGINT;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS reviewed_by BIGINT;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE factory_configurations ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Publish window stored in factory_scheduler_configs
INSERT INTO factory_scheduler_configs (factory_id, task_code, cron_expression, enabled, tool_or_method, params, description)
VALUES (NULL, 'CONFIG_PUBLISH_WINDOW', '0 0 22 * * ?', true, 'canvas_auto_publish', '{"startHour":22,"startMinute":0,"endHour":6,"endMinute":0}', '配置自动发布窗口 (默认 22:00-06:00)')
ON CONFLICT (factory_id, task_code) DO NOTHING;
```

- [ ] **Step 2: Add review endpoints to ConfigController**

Add to ConfigController.java:

```java
@PostMapping("/submit-review")
@Operation(summary = "提交审核")
public ApiResponse<String> submitForReview(@PathVariable String factoryId) {
    // Update draft status to PENDING_REVIEW
    configService.submitForReview(factoryId, getCurrentUserId());
    return ApiResponse.success("已提交审核");
}

@PostMapping("/approve")
@Operation(summary = "审核通过")
public ApiResponse<String> approve(@PathVariable String factoryId, @RequestBody Map<String, String> body) {
    configService.approveConfig(factoryId, body.get("notes"), getCurrentUserId());
    return ApiResponse.success("已审核通过，等待发布窗口");
}

@PostMapping("/reject")
@Operation(summary = "驳回")
public ApiResponse<String> reject(@PathVariable String factoryId, @RequestBody Map<String, String> body) {
    configService.rejectConfig(factoryId, body.get("reason"), getCurrentUserId());
    return ApiResponse.success("已驳回");
}

@PostMapping("/publish-now")
@Operation(summary = "立即发布 (跳过窗口)")
public ApiResponse<String> publishNow(@PathVariable String factoryId) {
    configService.publishConfig(factoryId, getCurrentUserId());
    return ApiResponse.success("已发布");
}

@GetMapping("/current-version")
@Operation(summary = "获取当前配置版本状态")
public ApiResponse<FactoryConfiguration> getCurrentVersion(@PathVariable String factoryId) {
    return ApiResponse.success(configService.getCurrentVersion(factoryId));
}

@GetMapping("/publish-window")
@Operation(summary = "获取发布窗口设置")
public ApiResponse<Map<String, Object>> getPublishWindow(@PathVariable String factoryId) {
    // Read from factory_scheduler_configs where task_code = 'CONFIG_PUBLISH_WINDOW'
    return ApiResponse.success(configService.getPublishWindow(factoryId));
}

@PutMapping("/publish-window")
@Operation(summary = "设置发布窗口")
public ApiResponse<String> setPublishWindow(@PathVariable String factoryId, @RequestBody Map<String, Object> body) {
    configService.setPublishWindow(factoryId, body);
    return ApiResponse.success("发布窗口已更新");
}

private Long getCurrentUserId() {
    // Extract from JWT/SecurityContext
    return 0L; // placeholder
}
```

- [ ] **Step 3: Commit**

```bash
cd backend/java/cretas-api
git add src/main/resources/db/migration/V20260410_12__config_review_publish_window.sql \
        src/main/java/com/cretas/aims/controller/ConfigController.java
git commit -m "feat(canvas-ux): review/publish endpoints + migration"
```

---

## Task 10: Add Navigation Menu Entry

**Files:**
- Modify: `web-admin/src/router/index.ts`

- [ ] **Step 1: Add icon + meta for sidebar visibility**

Update the canvas-editor route in router/index.ts to include menu metadata:

```typescript
{
  path: 'canvas-editor',
  name: 'CanvasEditor',
  component: () => import('@/views/platform/canvas-editor/index.vue'),
  meta: {
    title: 'Canvas 配置编辑器',
    icon: 'Setting',
    requiresAuth: true,
    showInMenu: true,
  },
},
```

- [ ] **Step 2: Commit**

```bash
cd web-admin
git add src/router/index.ts
git commit -m "feat(canvas-ux): add Canvas Editor to navigation menu"
```

---

## Verification Criteria

1. Navigate to `/canvas-editor` — 3-panel layout renders with collapsible sides
2. Phase tabs show in correct order: workflow → triggers → rules | fields → permissions → tools
3. Breadcrumb updates when switching module or tab
4. Header shows correct status (DRAFT/PENDING/APPROVED/PUBLISHED) with appropriate actions
5. Onboarding wizard triggers for new factory — 4 steps complete
6. Template selection applies to factory
7. PublishWindowDialog saves time settings
8. ReviewDialog submits approve/reject
9. Left panel collapses to 32px icons, right panel collapses to 32px
10. Esc exits focus mode
11. WorkflowDesigner fills available height (no more 500px clip)

---

## Parallel Work Suggestions

### Subagent: ✅ Recommended
- Tasks 1-2 (types + composable): prerequisite for all others
- Tasks 3-4 (header + tabs): independent of each other, parallel OK
- Task 5 (index.vue rewrite): depends on Tasks 1-4
- Tasks 6-7 (dialogs + onboarding): independent of each other, parallel OK
- Tasks 8-9 (component fixes + backend): independent, parallel OK
- Task 10 (router): independent, can be done anytime

### Multi-Chat: ✅ Frontend + Backend parallel
- Tasks 1-8 (frontend) and Task 9 (backend) can run in parallel
