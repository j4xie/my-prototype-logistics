<template>
  <div class="property-panel">
    <!-- Node properties -->
    <template v-if="kind === 'node'">
      <h4>{{ nodeTypeLabel }} 属性</h4>
      <el-form label-position="top" size="small" @submit.prevent>
        <!-- Common: label -->
        <el-form-item label="显示名">
          <el-input v-model="localData.label" @change="emitUpdate" placeholder="节点标签" />
        </el-form-item>

        <!-- approval — 审批节点 -->
        <template v-if="nodeType === 'approval'">
          <el-form-item label="审批人角色">
            <el-select
              v-model="approverRoles"
              multiple filterable allow-create
              placeholder="选择或输入审批角色"
              style="width: 100%"
              @change="syncConfig({ approverRoles })"
            >
              <el-option v-for="r in ROLE_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="审批人 userId (可选)">
            <el-input
              :model-value="(approverUserIds || []).join(',')"
              placeholder="逗号分隔 e.g. 100,101"
              @change="(v: string | number) => syncConfig({ approverUserIds: String(v).split(',').map(s => s.trim()).filter(Boolean) })"
            />
          </el-form-item>
          <el-form-item label="必需审批人数 (≥2 即会签)">
            <el-input-number
              v-model="requiredApprovers"
              :min="1" :max="20"
              @change="(v: number | undefined) => syncConfig({ requiredApprovers: v ?? 1 })"
            />
          </el-form-item>
          <el-form-item label="超时 (分钟, 0 = 不超时)">
            <el-input-number
              v-model="timeoutMinutes"
              :min="0" :step="30"
              @change="(v: number | undefined) => syncConfig({ timeoutMinutes: v ?? 0 })"
            />
          </el-form-item>
          <el-form-item label="自动通过条件 (SpEL)">
            <el-input
              v-model="autoApproveCondition"
              placeholder="如: #trusted == true"
              @change="syncConfig({ autoApproveCondition })"
            />
            <div class="hint">满足时跳过审批人, 直接通过</div>
          </el-form-item>
          <el-form-item label="自动拒绝条件 (SpEL)">
            <el-input
              v-model="autoRejectCondition"
              placeholder="如: #amount > 1000000"
              @change="syncConfig({ autoRejectCondition })"
            />
            <div class="hint">满足时直接拒绝整个工作流</div>
          </el-form-item>
        </template>

        <!-- condition — 条件分叉 -->
        <template v-if="nodeType === 'condition'">
          <el-form-item label="说明">
            <el-input
              v-model="description"
              type="textarea" :rows="2"
              placeholder="如: 按金额阈值分流"
              @change="syncConfig({ description })"
            />
            <div class="hint">实际分支条件在 outgoing edges 的 condition 字段配置</div>
          </el-form-item>
        </template>

        <!-- parallel — 并行 -->
        <template v-if="nodeType === 'parallel'">
          <el-form-item label="说明">
            <el-input
              v-model="description"
              type="textarea" :rows="2"
              placeholder="如: 启动质检和采购同时审批"
              @change="syncConfig({ description })"
            />
            <div class="hint">所有 outgoing 分支同时启动, 必须配套 join 节点汇聚</div>
          </el-form-item>
        </template>

        <!-- join — 汇聚 -->
        <template v-if="nodeType === 'join'">
          <el-form-item label="汇聚模式">
            <el-select v-model="joinMode" @change="syncConfig({ mode: joinMode })">
              <el-option label="ALL — 所有分支到达" value="ALL" />
              <el-option label="N_OF_M — N 个分支到达" value="N_OF_M" />
              <el-option label="ANY — 任一分支到达" value="ANY" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="joinMode === 'N_OF_M'" label="N (需要到达的分支数)">
            <el-input-number
              v-model="joinN"
              :min="2"
              @change="(v: number | undefined) => syncConfig({ n: v ?? 2 })"
            />
          </el-form-item>
        </template>

        <!-- notify — 通知 -->
        <template v-if="nodeType === 'notify'">
          <el-form-item label="通知对象">
            <el-select
              v-model="notifyRoles"
              multiple filterable allow-create
              placeholder="选择角色"
              style="width: 100%"
              @change="syncConfig({ notifyRoles })"
            >
              <el-option v-for="r in ROLE_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="通知模板 (可选)">
            <el-input
              v-model="notifyTemplate"
              placeholder="预留 Sprint 4 NotificationTemplate id"
              @change="syncConfig({ notifyTemplate })"
            />
          </el-form-item>
        </template>

        <!-- end — 结束 -->
        <template v-if="nodeType === 'end'">
          <el-form-item label="终态结果">
            <el-select v-model="outcome" @change="syncConfig({ outcome })">
              <el-option label="APPROVED — 通过" value="APPROVED" />
              <el-option label="REJECTED — 拒绝" value="REJECTED" />
              <el-option label="TIMEOUT — 超时" value="TIMEOUT" />
              <el-option label="CANCELLED — 取消" value="CANCELLED" />
            </el-select>
          </el-form-item>
        </template>

        <!-- start — 入口 -->
        <template v-if="nodeType === 'start'">
          <el-alert type="info" :closable="false" title="入口节点无额外配置" />
        </template>
      </el-form>

      <el-divider />
      <el-button v-if="nodeType !== 'start'" type="danger" size="small" text @click="$emit('delete')">
        删除节点
      </el-button>
    </template>

    <!-- Edge properties -->
    <template v-if="kind === 'edge'">
      <h4>边属性</h4>
      <el-form label-position="top" size="small">
        <el-form-item label="标签">
          <el-input v-model="localData.label" @change="emitUpdate" placeholder="如: >10000 / DEFAULT" />
          <div class="hint">设 label=DEFAULT 时, condition 节点优先评估其他 edge 后兜底走这里</div>
        </el-form-item>
        <el-form-item label="条件 (SpEL)">
          <el-input
            :model-value="(localData.condition as string) ?? ''"
            placeholder="如: #amount > 10000"
            @change="(v: string | number) => updateEdgeCondition(String(v))"
          />
          <div class="hint">空 = 总是走 (无条件)</div>
        </el-form-item>
        <el-form-item label="优先级 (数值越小越优先)">
          <el-input-number
            :model-value="Number(localData.priority ?? 0)"
            :min="0"
            @change="(v: number | undefined) => updateEdgePriority(v ?? 0)"
          />
        </el-form-item>
      </el-form>
      <el-divider />
      <el-button type="danger" size="small" text @click="$emit('delete')">删除边</el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { NodeType } from '@/api/approvalWorkflow'

interface SelectedElement {
  kind: 'node' | 'edge'
  id: string
  type?: NodeType
  data: Record<string, unknown>
}

const props = defineProps<{ element: SelectedElement }>()

const emit = defineEmits<{
  update: [data: Record<string, unknown>]
  delete: []
}>()

const kind = computed(() => props.element.kind)
const nodeType = computed<NodeType | undefined>(() => props.element.type)

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  start: '开始',
  approval: '审批',
  condition: '条件',
  parallel: '并行',
  join: '汇聚',
  notify: '通知',
  end: '结束',
}
const nodeTypeLabel = computed(() => (nodeType.value ? NODE_TYPE_LABELS[nodeType.value] : ''))

const ROLE_OPTIONS = [
  { value: 'factory_super_admin', label: '工厂管理员 (factory_super_admin)' },
  { value: 'factory_admin', label: '工厂 admin (factory_admin)' },
  { value: 'department_admin', label: '部门管理员 (department_admin)' },
  { value: 'workshop_supervisor', label: '车间主管 (workshop_supervisor)' },
  { value: 'quality_inspector', label: '质检员 (quality_inspector)' },
  { value: 'finance_manager', label: '财务主管 (finance_manager)' },
  { value: 'warehouse_manager', label: '仓管员 (warehouse_manager)' },
  { value: 'permission_admin', label: '权限管理员 (permission_admin)' },
]

// Local mutable copy of selected element data — emitted on change
const localData = reactive<Record<string, unknown>>({ ...props.element.data })

watch(
  () => props.element,
  (next) => {
    Object.keys(localData).forEach(k => delete localData[k])
    Object.assign(localData, next.data)
  },
)

// Per-node-type config getters mapped through localData.config map
const config = computed(() => {
  const c = (localData.config as Record<string, unknown>) ?? {}
  return c
})
const approverRoles = computed({
  get: () => (config.value.approverRoles as string[]) ?? [],
  set: (v: string[]) => syncConfig({ approverRoles: v }),
})
const approverUserIds = computed(() => (config.value.approverUserIds as string[]) ?? [])
const requiredApprovers = computed({
  get: () => Number(config.value.requiredApprovers ?? 1),
  set: (v: number) => syncConfig({ requiredApprovers: v }),
})
const timeoutMinutes = computed({
  get: () => Number(config.value.timeoutMinutes ?? 0),
  set: (v: number) => syncConfig({ timeoutMinutes: v }),
})
const autoApproveCondition = computed({
  get: () => String(config.value.autoApproveCondition ?? ''),
  set: (v: string) => syncConfig({ autoApproveCondition: v }),
})
const autoRejectCondition = computed({
  get: () => String(config.value.autoRejectCondition ?? ''),
  set: (v: string) => syncConfig({ autoRejectCondition: v }),
})
const description = computed({
  get: () => String(config.value.description ?? ''),
  set: (v: string) => syncConfig({ description: v }),
})
const joinMode = computed({
  get: () => String(config.value.mode ?? 'ALL'),
  set: (v: string) => syncConfig({ mode: v }),
})
const joinN = computed({
  get: () => Number(config.value.n ?? 2),
  set: (v: number) => syncConfig({ n: v }),
})
const notifyRoles = computed({
  get: () => (config.value.notifyRoles as string[]) ?? [],
  set: (v: string[]) => syncConfig({ notifyRoles: v }),
})
const notifyTemplate = computed({
  get: () => String(config.value.notifyTemplate ?? ''),
  set: (v: string) => syncConfig({ notifyTemplate: v }),
})
const outcome = computed({
  get: () => String(config.value.outcome ?? 'APPROVED'),
  set: (v: string) => syncConfig({ outcome: v }),
})

function syncConfig(patch: Record<string, unknown>) {
  const merged = { ...(localData.config as Record<string, unknown>), ...patch }
  // strip empty-string keys for cleanliness
  Object.keys(merged).forEach(k => {
    if (merged[k] === '' || merged[k] == null) delete merged[k]
  })
  localData.config = merged
  emitUpdate()
}

function updateEdgeCondition(v: string) {
  localData.condition = v
  emitUpdate()
}
function updateEdgePriority(v: number) {
  localData.priority = v
  emitUpdate()
}

function emitUpdate() {
  emit('update', { ...localData })
}
</script>

<style scoped>
.property-panel { padding: 12px; }
h4 { margin: 0 0 12px; font-size: 14px; color: #303133; }
.hint { font-size: 11px; color: #909399; margin-top: 2px; }
</style>
