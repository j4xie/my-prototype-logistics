<template>
  <div class="approval-workflow-editor">
    <!-- Header -->
    <el-card shadow="never" class="header-card">
      <div class="header-row">
        <div class="header-left">
          <h2>审批工作流编辑器</h2>
          <el-tag v-if="currentWorkflow" :type="publishStatusType" size="small">
            {{ publishStatusLabel }} v{{ currentWorkflow.version }}
          </el-tag>
        </div>
        <div class="header-actions">
          <el-select
            v-model="selectedDecisionType"
            placeholder="选择决策类型"
            style="width: 200px"
            @change="onDecisionTypeChange"
          >
            <el-option
              v-for="dt in decisionTypeOptions"
              :key="dt.value"
              :label="dt.label"
              :value="dt.value"
            />
          </el-select>
          <el-input
            v-model="workflowName"
            placeholder="工作流名称"
            style="width: 220px"
          />
          <el-button
            type="primary"
            :icon="Download"
            :disabled="!canSave"
            :loading="saving"
            @click="handleSave"
          >
            保存草稿
          </el-button>
          <el-button
            type="success"
            :icon="Upload"
            :disabled="!canPublish"
            @click="handlePublish"
          >
            发布
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 3-pane body: palette | canvas | properties -->
    <div class="editor-body">
      <!-- Left: Node palette (Day 6 fills in real nodes) -->
      <div class="palette">
        <h4>节点类型</h4>
        <div
          v-for="schema in nodeSchemas"
          :key="schema.type"
          class="palette-node"
          draggable="true"
          @dragstart="onPaletteDragStart($event, schema)"
        >
          <span class="palette-icon" :style="{ backgroundColor: schema.color }">
            {{ schema.icon }}
          </span>
          <div class="palette-info">
            <span class="palette-name">{{ schema.displayName }}</span>
            <span class="palette-desc">{{ schema.description }}</span>
          </div>
        </div>
        <el-alert
          title="Day 5 scaffold"
          type="info"
          :closable="false"
          show-icon
          description="完整拖拽 / 属性面板 / Simulator 在 Day 6-9 上线"
          style="margin-top: 12px"
        />
      </div>

      <!-- Center: VueFlow canvas -->
      <div class="canvas-container" @drop="onCanvasDrop" @dragover.prevent>
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
          :default-viewport="{ zoom: 0.9, x: 50, y: 50 }"
          fit-view-on-init
          @node-click="onNodeClick"
          @edge-click="onEdgeClick"
          @connect="onConnect"
        >
          <Background />
          <Controls />
        </VueFlow>
      </div>

      <!-- Right: Property panel -->
      <div class="properties-panel">
        <PropertyPanel
          v-if="selectedElement"
          :key="selectedElement.id"
          :element="selectedElement"
          @update="onPropertyUpdate"
          @delete="onDeleteSelected"
        />
        <el-empty v-else description="点击节点或边查看属性" :image-size="80" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { markRaw, ref, computed, onMounted } from 'vue'
import { VueFlow, type Connection, type Node, type Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { Download, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/modules/auth'
import StartNode from './components/nodes/StartNode.vue'
import ApprovalNode from './components/nodes/ApprovalNode.vue'
import ConditionNode from './components/nodes/ConditionNode.vue'
import ParallelNode from './components/nodes/ParallelNode.vue'
import JoinNode from './components/nodes/JoinNode.vue'
import NotifyNode from './components/nodes/NotifyNode.vue'
import EndNode from './components/nodes/EndNode.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import {
  getDecisionTypes,
  createWorkflow,
  type DecisionType,
  type ApprovalWorkflowDTO,
  type ApprovalWorkflowNode,
  type NodeType,
} from '@/api/approvalWorkflow'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

// ==================== State ====================

const authStore = useAuthStore()
const factoryId = computed(() => authStore.factoryId)

const selectedDecisionType = ref<DecisionType>('QUALITY_RELEASE')
const workflowName = ref('')
const saving = ref(false)

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const currentWorkflow = ref<ApprovalWorkflowDTO | null>(null)

interface SelectedElement {
  kind: 'node' | 'edge'
  id: string
  type?: NodeType
  data: Record<string, unknown>
}
const selectedElement = ref<SelectedElement | null>(null)

// Custom node type registry — markRaw avoids Vue making components reactive.
const nodeTypes = {
  start: markRaw(StartNode),
  approval: markRaw(ApprovalNode),
  condition: markRaw(ConditionNode),
  parallel: markRaw(ParallelNode),
  join: markRaw(JoinNode),
  notify: markRaw(NotifyNode),
  end: markRaw(EndNode),
}

/** Default config per node type — used when dragging from palette. */
function defaultConfigFor(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'approval':
      return { approverRoles: [], requiredApprovers: 1, timeoutMinutes: 0 }
    case 'condition':
      return { description: '' }
    case 'parallel':
      return {}
    case 'join':
      return { mode: 'ALL' }
    case 'notify':
      return { notifyRoles: [] }
    case 'end':
      return { outcome: 'APPROVED' }
    default:
      return {}
  }
}

// Static node palette schemas (Day 6 will refine each)
interface PaletteSchema {
  type: NodeType
  displayName: string
  description: string
  icon: string
  color: string
}

const nodeSchemas: PaletteSchema[] = [
  { type: 'start',     displayName: '开始',   description: '工作流入口',            icon: '▶', color: '#67C23A' },
  { type: 'approval',  displayName: '审批',   description: '单签 / 会签节点',       icon: '✓', color: '#409EFF' },
  { type: 'condition', displayName: '条件',   description: 'SpEL 分支判断',          icon: '?', color: '#E6A23C' },
  { type: 'parallel',  displayName: '并行',   description: '同时启动多分支',         icon: '⇉', color: '#909399' },
  { type: 'join',      displayName: '汇聚',   description: 'ALL / N_OF_M / ANY',     icon: '⇇', color: '#909399' },
  { type: 'notify',    displayName: '通知',   description: '推 InAppNotification',   icon: '✉', color: '#909399' },
  { type: 'end',       displayName: '结束',   description: 'APPROVED / REJECTED',    icon: '■', color: '#F56C6C' },
]

const decisionTypeOptions: Array<{ value: DecisionType; label: string }> = [
  { value: 'QUALITY_RELEASE',         label: 'QUALITY_RELEASE 质检放行' },
  { value: 'FORCE_INSERT',            label: 'FORCE_INSERT 强制插单' },
  { value: 'QUALITY_EXCEPTION',       label: 'QUALITY_EXCEPTION 质检特批' },
  { value: 'BATCH_STATUS_CHANGE',     label: 'BATCH_STATUS_CHANGE 批次状态变更' },
  { value: 'SUPPLIER_APPROVAL',       label: 'SUPPLIER_APPROVAL 供应商准入' },
  { value: 'SUPPLIER_STATUS_CHANGE',  label: 'SUPPLIER_STATUS_CHANGE 供应商状态' },
  { value: 'MATERIAL_DISPOSAL',       label: 'MATERIAL_DISPOSAL 物料处置' },
  { value: 'PRODUCTION_PLAN_CHANGE',  label: 'PRODUCTION_PLAN_CHANGE 生产计划变更' },
  { value: 'EQUIPMENT_STATUS_CHANGE', label: 'EQUIPMENT_STATUS_CHANGE 设备状态' },
  { value: 'CUSTOM',                  label: 'CUSTOM 自定义' },
]

// ==================== Computed ====================

const canSave = computed(() => Boolean(workflowName.value && selectedDecisionType.value && nodes.value.length > 0))
const canPublish = computed(() => currentWorkflow.value?.publishStatus === 'draft')

const publishStatusType = computed<'success' | 'warning' | 'info'>(() => {
  if (!currentWorkflow.value) return 'info'
  const map: Record<string, 'success' | 'warning' | 'info'> = {
    published: 'success',
    draft: 'warning',
    archived: 'info',
  }
  return map[currentWorkflow.value.publishStatus] ?? 'info'
})

const publishStatusLabel = computed(() => {
  if (!currentWorkflow.value) return ''
  const map: Record<string, string> = { published: '已发布', draft: '草稿', archived: '已归档' }
  return map[currentWorkflow.value.publishStatus] ?? currentWorkflow.value.publishStatus
})

// ==================== Handlers ====================

function onDecisionTypeChange() {
  // Day 8: load existing workflows for this decision type from backend
}

function onPaletteDragStart(event: DragEvent, schema: PaletteSchema) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/vueflow', JSON.stringify(schema))
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onCanvasDrop(event: DragEvent) {
  const raw = event.dataTransfer?.getData('application/vueflow')
  if (!raw) return
  const schema: PaletteSchema = JSON.parse(raw)
  const canvasRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const position = {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  }
  // Enforce singleton for start (only one entry node allowed).
  if (schema.type === 'start' && nodes.value.some(n => n.type === 'start')) {
    ElMessage.warning('工作流只能有一个 start 节点')
    return
  }
  const id = `${schema.type}_${Date.now()}`
  nodes.value.push({
    id,
    type: schema.type,
    position,
    data: {
      label: schema.displayName,
      nodeType: schema.type,
      config: defaultConfigFor(schema.type),
    },
  })
}

function onConnect(connection: Connection) {
  const id = `e_${Date.now()}`
  edges.value.push({
    id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
    label: '',
    data: { condition: '', priority: 0 },
  })
}

function onNodeClick({ node }: { node: Node }) {
  selectedElement.value = {
    kind: 'node',
    id: node.id,
    type: node.type as NodeType,
    data: { label: String(node.data?.label ?? ''), config: { ...(node.data?.config as Record<string, unknown> ?? {}) } },
  }
}

function onEdgeClick({ edge }: { edge: Edge }) {
  selectedElement.value = {
    kind: 'edge',
    id: edge.id,
    data: {
      label: edge.label ? String(edge.label) : '',
      condition: (edge.data?.condition as string) ?? '',
      priority: Number(edge.data?.priority ?? 0),
    },
  }
}

/** Property panel emits new data — apply to nodes/edges array. */
function onPropertyUpdate(newData: Record<string, unknown>) {
  if (!selectedElement.value) return
  const sel = selectedElement.value
  if (sel.kind === 'node') {
    const idx = nodes.value.findIndex(n => n.id === sel.id)
    if (idx !== -1) {
      const node = nodes.value[idx]
      nodes.value[idx] = {
        ...node,
        data: {
          ...node.data,
          label: newData.label,
          config: { ...(newData.config as Record<string, unknown>) },
        },
      }
    }
  } else {
    const idx = edges.value.findIndex(e => e.id === sel.id)
    if (idx !== -1) {
      const edge = edges.value[idx]
      edges.value[idx] = {
        ...edge,
        label: String(newData.label ?? ''),
        data: { condition: newData.condition, priority: newData.priority },
      }
    }
  }
  sel.data = { ...newData }
}

function onDeleteSelected() {
  if (!selectedElement.value) return
  const sel = selectedElement.value
  if (sel.kind === 'node') {
    if (sel.type === 'start') {
      ElMessage.warning('start 节点不可删除 (工作流入口)')
      return
    }
    nodes.value = nodes.value.filter(n => n.id !== sel.id)
    // 删除所有以此 node 为端点的边
    edges.value = edges.value.filter(e => e.source !== sel.id && e.target !== sel.id)
  } else {
    edges.value = edges.value.filter(e => e.id !== sel.id)
  }
  selectedElement.value = null
}

async function handleSave() {
  if (!factoryId.value || !canSave.value) return
  saving.value = true
  try {
    const startNode = nodes.value.find(n => n.type === 'start')
    if (!startNode) {
      ElMessage.warning('工作流必须包含一个 start 节点')
      return
    }

    const wireNodes: ApprovalWorkflowNode[] = nodes.value.map(n => ({
      id: n.id,
      type: (n.type as NodeType) ?? 'approval',
      label: String(n.data?.label ?? n.id),
      position: { x: n.position.x, y: n.position.y },
      config: (n.data?.config as Record<string, unknown>) ?? {},
    }))

    const wireEdges = edges.value.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      condition: (e.data?.condition as string) ?? undefined,
      label: e.label ? String(e.label) : undefined,
    }))

    const res = await createWorkflow(factoryId.value, {
      decisionType: selectedDecisionType.value,
      name: workflowName.value,
      nodes: wireNodes,
      edges: wireEdges,
      startNodeId: startNode.id,
    })
    if (res.success && res.data) {
      currentWorkflow.value = res.data
      ElMessage.success('草稿已保存')
    } else {
      ElMessage.error(res.message ?? '保存失败')
    }
  } catch (e) {
    console.error('[save failed]', e)
  } finally {
    saving.value = false
  }
}

function handlePublish() {
  // Day 8 wires publishWorkflow API + handles errors
  ElMessage.info('发布功能在 Day 8 上线')
}

// ==================== Lifecycle ====================

onMounted(async () => {
  if (!factoryId.value) return
  // Sanity-check backend connectivity (Day 8 will load existing workflow list)
  try {
    await getDecisionTypes(factoryId.value)
  } catch (e) {
    console.warn('[approval-workflow-editor] 后端未就绪 (Day 5 scaffold, Day 8 完整接入)', e)
  }
})
</script>

<style scoped>
.approval-workflow-editor {
  height: calc(100vh - 90px);
  display: flex;
  flex-direction: column;
}
.header-card { margin-bottom: 8px; flex-shrink: 0; }
.header-row { display: flex; justify-content: space-between; align-items: center; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h2 { margin: 0; font-size: 18px; }
.header-actions { display: flex; gap: 8px; align-items: center; }

.editor-body { flex: 1; display: flex; gap: 8px; min-height: 0; }

.palette {
  width: 220px; flex-shrink: 0; background: #fff;
  border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; overflow-y: auto;
}
.palette h4 { margin: 0 0 12px; font-size: 14px; color: #303133; }

.palette-node {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; margin-bottom: 4px;
  border: 1px solid #e4e7ed; border-radius: 6px;
  cursor: grab; transition: all 0.2s;
}
.palette-node:hover { border-color: #409EFF; background: #f0f7ff; }
.palette-icon {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; color: white; font-weight: bold;
}
.palette-info { display: flex; flex-direction: column; min-width: 0; }
.palette-name { font-size: 13px; font-weight: 500; }
.palette-desc { font-size: 11px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.canvas-container {
  flex: 1; background: #fafafa;
  border: 1px solid #e4e7ed; border-radius: 4px; min-height: 400px;
}

.properties-panel {
  width: 320px; flex-shrink: 0; background: #fff;
  border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; overflow-y: auto;
}
.properties-panel h4 { margin: 0 0 8px; font-size: 14px; color: #303133; }
.placeholder p { margin: 4px 0; font-size: 13px; }
.placeholder .hint { color: #909399; font-family: monospace; font-size: 11px; }
</style>
