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
