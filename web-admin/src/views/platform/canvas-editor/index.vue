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
