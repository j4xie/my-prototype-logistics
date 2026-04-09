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
