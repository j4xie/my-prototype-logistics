<template>
  <el-dialog v-model="open" title="工作流模拟器" width="720px" :before-close="onClose">
    <div class="simulator">
      <!-- Business context input -->
      <el-card shadow="never" class="ctx-card">
        <template #header>
          <div class="card-header">
            <span>业务上下文 (SpEL 变量)</span>
            <el-button size="small" text type="primary" @click="addCtxRow">+ 添加变量</el-button>
          </div>
        </template>
        <div v-for="(row, idx) in ctxRows" :key="idx" class="ctx-row">
          <el-input v-model="row.key" placeholder="key (e.g. amount)" style="width: 180px" />
          <el-input v-model="row.value" placeholder="value (e.g. 15000 / true / 'finance')" style="flex: 1" />
          <el-button size="small" text type="danger" @click="ctxRows.splice(idx, 1)">×</el-button>
        </div>
      </el-card>

      <!-- Control row -->
      <div class="controls">
        <el-button type="primary" :disabled="ctxRunning" @click="onStart">▶ 启动模拟</el-button>
        <el-button :disabled="!ctxRunning" @click="onCancel">取消</el-button>
        <el-button @click="onReset">重置</el-button>
        <el-tag :type="statusTagType" effect="dark" size="large">
          {{ statusLabel }}
        </el-tag>
        <el-tag v-if="ctx?.finalOutcome" type="info" size="large">
          {{ ctx.finalOutcome }}
        </el-tag>
      </div>

      <!-- Pending approvals -->
      <el-card v-if="ctxRunning && pendingNodes.length" shadow="never" class="pending-card">
        <template #header>
          <span>待审批节点 ({{ pendingNodes.length }})</span>
        </template>
        <div v-for="pending in pendingNodes" :key="pending.id" class="pending-row">
          <div class="pending-info">
            <strong>{{ pending.label }}</strong>
            <span class="hint">
              {{ pending.approverRoles.join(' / ') || '(无角色限制)' }}
              · 会签 {{ pending.currentApprovers }}/{{ pending.requiredApprovers }}
            </span>
          </div>
          <div class="pending-actions">
            <el-button size="small" type="success" @click="onApprove(pending.id)">通过</el-button>
            <el-button size="small" type="danger" @click="onReject(pending.id)">拒绝</el-button>
          </div>
        </div>
      </el-card>

      <!-- History -->
      <el-card v-if="historyEntries.length" shadow="never" class="history-card">
        <template #header><span>执行历史</span></template>
        <div v-for="(h, i) in historyEntries" :key="i" class="history-row">
          <el-tag
            :type="h.decision === 'APPROVED' ? 'success' : h.decision === 'REJECTED' ? 'danger' : 'info'"
            size="small"
          >
            {{ h.decision || (h.joinArrivalFrom ? 'JOIN' : 'SYS') }}
          </el-tag>
          <span class="history-node">{{ h.nodeId }}</span>
          <span v-if="h.comment" class="history-comment">{{ h.comment }}</span>
        </div>
      </el-card>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ApprovalWorkflowEdge, ApprovalWorkflowNode } from '@/api/approvalWorkflow'
import {
  cancelSimulation,
  startSimulation,
  submitDecision,
  type SimApprovalRecord,
  type SimExecutionContext,
  type SimulatorInput,
} from '../composables/useSimulator'

const props = defineProps<{
  modelValue: boolean
  nodes: ApprovalWorkflowNode[]
  edges: ApprovalWorkflowEdge[]
  startNodeId: string
}>()

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

interface CtxRow { key: string; value: string }
const ctxRows = ref<CtxRow[]>([
  { key: 'amount', value: '15000' },
  { key: 'department', value: 'finance' },
])
const ctx = ref<SimExecutionContext | null>(null)

watch(open, (v) => {
  // reset on close
  if (!v) {
    ctx.value = null
  }
})

function addCtxRow() {
  ctxRows.value.push({ key: '', value: '' })
}

function parseCtxValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  // strip surrounding quotes if user provided 'foo' or "foo"
  if (/^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1)
  return trimmed
}

function buildBusinessContext(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const r of ctxRows.value) {
    if (!r.key) continue
    out[r.key] = parseCtxValue(r.value)
  }
  return out
}

function buildInput(): SimulatorInput {
  return reactive({
    startNodeId: props.startNodeId,
    nodes: props.nodes,
    edges: props.edges,
  }) as SimulatorInput
}

const ctxRunning = computed(() => ctx.value?.status === 'RUNNING')

const statusLabel = computed(() => {
  if (!ctx.value) return '未开始'
  const map: Record<string, string> = {
    RUNNING: '运行中',
    APPROVED: '通过',
    REJECTED: '拒绝',
    CANCELLED: '取消',
    TIMEOUT: '超时',
  }
  return map[ctx.value.status] ?? ctx.value.status
})

const statusTagType = computed<'success' | 'danger' | 'warning' | 'info' | 'primary'>(() => {
  if (!ctx.value) return 'info'
  const map: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary'> = {
    RUNNING: 'primary',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'info',
    TIMEOUT: 'warning',
  }
  return map[ctx.value.status] ?? 'info'
})

interface PendingDisplay {
  id: string
  label: string
  approverRoles: string[]
  requiredApprovers: number
  currentApprovers: number
}

const pendingNodes = computed<PendingDisplay[]>(() => {
  if (!ctx.value) return []
  const out: PendingDisplay[] = []
  for (const nodeId of ctx.value.activeNodeIds) {
    const node = props.nodes.find(n => n.id === nodeId)
    if (!node || node.type !== 'approval') continue
    const recs = ctx.value.nodeHistory.get(nodeId) ?? []
    const currentApprovers = recs.filter(r => r.decision === 'APPROVED').length
    out.push({
      id: nodeId,
      label: node.label ?? nodeId,
      approverRoles: (node.config?.approverRoles as string[]) ?? [],
      requiredApprovers: Number(node.config?.requiredApprovers ?? 1),
      currentApprovers,
    })
  }
  return out
})

const historyEntries = computed<SimApprovalRecord[]>(() => {
  if (!ctx.value) return []
  const out: SimApprovalRecord[] = []
  for (const recs of ctx.value.nodeHistory.values()) {
    out.push(...recs)
  }
  return out
})

function onStart() {
  if (!props.startNodeId) {
    ElMessage.warning('工作流缺少 start 节点')
    return
  }
  try {
    ctx.value = startSimulation(buildInput(), buildBusinessContext())
  } catch (e) {
    ElMessage.error(`启动模拟失败: ${e instanceof Error ? e.message : e}`)
  }
}

function onApprove(nodeId: string) {
  if (!ctx.value) return
  try {
    submitDecision(ctx.value, buildInput(), nodeId, 'APPROVED', { approverUserId: 999, approverRole: 'simulator' })
  } catch (e) {
    ElMessage.error(`提交失败: ${e instanceof Error ? e.message : e}`)
  }
}

function onReject(nodeId: string) {
  if (!ctx.value) return
  try {
    submitDecision(ctx.value, buildInput(), nodeId, 'REJECTED', { approverUserId: 999, approverRole: 'simulator' })
  } catch (e) {
    ElMessage.error(`提交失败: ${e instanceof Error ? e.message : e}`)
  }
}

function onCancel() {
  if (!ctx.value || ctx.value.status !== 'RUNNING') return
  cancelSimulation(ctx.value, '模拟器手动取消')
}

function onReset() {
  ctx.value = null
}

function onClose(done: () => void) {
  ctx.value = null
  done()
}
</script>

<style scoped>
.simulator { display: flex; flex-direction: column; gap: 12px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.ctx-row { display: flex; gap: 8px; margin-bottom: 6px; align-items: center; }
.controls { display: flex; gap: 8px; align-items: center; padding: 8px 0; }
.pending-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #ebeef5; }
.pending-row:last-child { border-bottom: none; }
.pending-info { display: flex; flex-direction: column; gap: 2px; }
.pending-actions { display: flex; gap: 6px; }
.hint { font-size: 11px; color: #909399; }
.history-row { display: flex; gap: 8px; align-items: center; padding: 3px 0; font-size: 12px; }
.history-node { font-family: monospace; color: #303133; }
.history-comment { color: #909399; font-style: italic; }
</style>
